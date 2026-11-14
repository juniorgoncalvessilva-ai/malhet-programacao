"""Critério de avanço (spec 079): importar a planilha de critérios de medição, editar etapas e percentuais (inclusive
etapas sem avanço, só esforço) e consultar o critério que vale para um item da PQ."""
from fastapi import APIRouter, Depends, File, UploadFile
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, ler, planejar
from app.core.db import get_session
from app.modules.criterios.domain.criterio import COLUNAS, Etapa, criterio_do_item, ler_planilha, percentual, soma
from app.modules.criterios.infra.models import CriterioModel, EtapaCriterioModel
from app.shared.errors import DomainError, NotFoundError

router = APIRouter(prefix="/criterios", tags=["critério de avanço"])


def _etapa_out(e: EtapaCriterioModel) -> dict:
    return {"id": e.id, "numero": e.numero, "nome": e.nome, "documento": e.documento, "percentual": e.percentual,
            "sem_avanco": e.sem_avanco}


def _out(c: CriterioModel, itens: int | None = None, uso: int = 0) -> dict:
    ets = [_etapa_out(e) for e in sorted(c.etapas, key=lambda e: e.numero)]
    return {"id": c.id, "codigo": c.codigo, "item_pq": c.item_pq, "descricao": c.descricao, "origem": c.origem,
            "etapas": ets, "soma": soma(ets), "itens_pq": itens, "etapas_na_wbs": uso}


def _todos(s: Session, obra_id: int) -> list[CriterioModel]:
    return list(s.scalars(select(CriterioModel).where(CriterioModel.obra_id == obra_id).order_by(CriterioModel.item_pq, CriterioModel.codigo)))


def criterio_para_item(s: Session, obra_id: int, item_pq: str | None) -> CriterioModel | None:
    """Linguagem publicada para a WBS: o critério do item (o mais específico que o contém)."""
    cs = _todos(s, obra_id)
    p = criterio_do_item(item_pq, [c.item_pq for c in cs if c.item_pq])
    return next((c for c in cs if c.item_pq == p), None) if p else None


@router.get("")
def listar(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    from app.modules.referencias.infra.models import ItemPqModel
    from app.modules.referencias.infra.resolvedor import ResolvedorReferencias
    from app.modules.wbs.infra.models import WbsNoModel

    cs = _todos(s, c.obra_id)
    vpq = ResolvedorReferencias(s, c.obra_id).versoes_vigentes().get("PQ")
    folhas = list(s.scalars(select(ItemPqModel.item).where(ItemPqModel.versao_id == vpq, ItemPqModel.folha.is_(True)))) if vpq else []
    prefixos = [x.item_pq for x in cs if x.item_pq]
    cobre: dict[str, int] = {}
    for f in folhas:
        p = criterio_do_item(f, prefixos)
        if p:
            cobre[p] = cobre.get(p, 0) + 1
    uso = dict(s.execute(select(EtapaCriterioModel.criterio_id, func.count()).join(WbsNoModel, WbsNoModel.etapa_id == EtapaCriterioModel.id)
                         .where(EtapaCriterioModel.obra_id == c.obra_id).group_by(EtapaCriterioModel.criterio_id)).all())
    return {"criterios": [_out(x, cobre.get(x.item_pq or "", 0), uso.get(x.id, 0)) for x in cs],
            "itens_pq": len(folhas), "itens_cobertos": sum(cobre.values())}


@router.get("/do-item")
def do_item(item: str, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    cr = criterio_para_item(s, c.obra_id, item.strip())
    return _out(cr) if cr else None


@router.post("/importar")
def importar(arquivo: UploadFile = File(...), s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Planilha de critérios de medição do cliente. Reimportar atualiza (casa por código + item e etapa pelo número),
    sem quebrar as etapas já usadas na WBS. Etapas criadas à mão (sem avanço) ficam."""
    from io import BytesIO

    import openpyxl

    try:
        wb = openpyxl.load_workbook(BytesIO(arquivo.file.read()), data_only=True, read_only=True)
    except Exception:  # noqa: BLE001
        raise DomainError("envie a planilha .xlsx/.xltx dos critérios de medição", "arquivo") from None
    ws = next((w for w in wb.worksheets if "CRIT" in w.title.upper()), wb.worksheets[0])
    linhas = list(ws.iter_rows(values_only=True))
    cab = [" ".join(str(x or "").split()).upper() for x in (linhas[0] if linhas else [])]
    if not cab or "CRITÉRIO MEDIÇÃO" not in cab[0] and "CRITERIO MEDICAO" not in cab[0]:
        raise DomainError(f"cabeçalho esperado: {' | '.join(COLUNAS)}", "arquivo")
    lidos, avisos = ler_planilha(linhas[1:])
    existentes = {(x.codigo, x.item_pq): x for x in _todos(s, c.obra_id)}
    novos = atualizados = 0
    for cr in lidos:
        m = existentes.get((cr.codigo, cr.item_pq))
        if m is None:
            m = CriterioModel(obra_id=c.obra_id, codigo=cr.codigo[:40], item_pq=cr.item_pq, descricao=cr.descricao[:400], origem="planilha")
            s.add(m)
            s.flush()
            novos += 1
        else:
            m.descricao, atualizados = cr.descricao[:400], atualizados + 1
        por_num = {e.numero: e for e in m.etapas if not e.sem_avanco}
        for e in cr.etapas:
            x = por_num.get(e.numero)
            if x is None:
                m.etapas.append(EtapaCriterioModel(obra_id=c.obra_id, numero=e.numero, nome=e.nome, documento=e.documento,
                                                   percentual=e.percentual, sem_avanco=False))
            else:
                x.nome, x.documento, x.percentual = e.nome, e.documento, e.percentual
    s.flush()
    return {"lidos": len(lidos), "novos": novos, "atualizados": atualizados, "etapas": sum(len(x.etapas) for x in lidos), "avisos": avisos[:60]}


class EtapaIn(BaseModel):
    numero: int | None = None
    nome: str
    percentual: float | str | None = 0
    sem_avanco: bool = False
    documento: str | None = None


class CriterioIn(BaseModel):
    codigo: str
    item_pq: str | None = None
    descricao: str
    etapas: list[EtapaIn] = []


def _criterio(s: Session, obra_id: int, cid: int) -> CriterioModel:
    x = s.get(CriterioModel, cid)
    if x is None or x.obra_id != obra_id:
        raise NotFoundError("Critério", cid)
    return x


def _aplicar_etapas(s: Session, obra_id: int, m: CriterioModel, etapas: list[EtapaIn]) -> None:
    """Substitui as etapas mantendo os ids das que continuam (casadas pelo número) — a WBS segue apontando para elas."""
    validas = []
    for i, e in enumerate(etapas, start=1):
        pct = 0.0 if e.sem_avanco else percentual(e.percentual)
        validas.append(Etapa(e.numero if e.numero is not None else i, " ".join(e.nome.split()), pct, e.sem_avanco, (e.documento or "").strip() or None))
    if len({e.numero for e in validas}) != len(validas):
        raise DomainError("número de etapa repetido", "etapas")
    atuais = {x.numero: x for x in m.etapas}
    for e in validas:
        x = atuais.get(e.numero)
        if x is None:
            m.etapas.append(EtapaCriterioModel(obra_id=obra_id, numero=e.numero, nome=e.nome, documento=e.documento,
                                               percentual=e.percentual, sem_avanco=e.sem_avanco))
        else:
            x.nome, x.documento, x.percentual, x.sem_avanco = e.nome, e.documento, e.percentual, e.sem_avanco
    nums = {e.numero for e in validas}
    for x in list(m.etapas):
        if x.numero not in nums:
            m.etapas.remove(x)


@router.post("", status_code=201)
def criar(d: CriterioIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    cod = " ".join(d.codigo.split())
    if not cod or not d.descricao.strip():
        raise DomainError("informe o código e a descrição do critério", "codigo")
    item = (d.item_pq or "").strip() or None
    if s.scalar(select(CriterioModel.id).where(CriterioModel.obra_id == c.obra_id, CriterioModel.codigo == cod, CriterioModel.item_pq == item)):
        raise DomainError("já existe esse critério para esse item", "codigo")
    m = CriterioModel(obra_id=c.obra_id, codigo=cod[:40], item_pq=item, descricao=" ".join(d.descricao.split())[:400], origem="manual")
    s.add(m)
    s.flush()
    _aplicar_etapas(s, c.obra_id, m, d.etapas)
    s.flush()
    return _out(m)


@router.put("/{cid}")
def editar(cid: int, d: CriterioIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    m = _criterio(s, c.obra_id, cid)
    m.codigo, m.item_pq = " ".join(d.codigo.split())[:40], (d.item_pq or "").strip() or None
    m.descricao = " ".join(d.descricao.split())[:400]
    _aplicar_etapas(s, c.obra_id, m, d.etapas)
    s.flush()
    return _out(m)


@router.delete("/{cid}", status_code=204)
def excluir(cid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    from app.modules.wbs.infra.models import WbsNoModel

    m = _criterio(s, c.obra_id, cid)
    if s.scalar(select(func.count()).select_from(WbsNoModel).where(WbsNoModel.etapa_id.in_([e.id for e in m.etapas] or [0]))):
        raise DomainError("etapas deste critério estão na WBS: tire-as da WBS antes")
    s.delete(m)
