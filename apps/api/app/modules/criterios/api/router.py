"""Critério de avanço (spec 079): importar a planilha de critérios de medição, editar etapas e percentuais (inclusive
etapas sem avanço, só esforço) e consultar o critério que vale para um item da PQ."""
from fastapi import APIRouter, Depends, File, UploadFile
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, ler, planejar
from app.core.db import get_session
from app.modules.criterios.domain.criterio import COLUNAS, COMO, CriterioRef, Etapa, ler_planilha, percentual, resolver_criterio, soma, sugerir_por_descricao
from app.modules.criterios.infra.models import CriterioModel, EtapaCriterioModel, VinculoCriterioModel
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


def _refs(cs: list[CriterioModel]) -> list[CriterioRef]:
    return [CriterioRef(x.id, x.codigo, x.item_pq, x.origem) for x in cs]


def _vinculos(s: Session, obra_id: int) -> dict[str, int]:
    return dict(s.execute(select(VinculoCriterioModel.item_pq, VinculoCriterioModel.criterio_id)
                          .where(VinculoCriterioModel.obra_id == obra_id)).all())


def _pq(s: Session, obra_id: int, so_folhas: bool = False) -> list:
    from app.modules.referencias.infra.models import ItemPqModel
    from app.modules.referencias.infra.resolvedor import ResolvedorReferencias

    vpq = ResolvedorReferencias(s, obra_id).versoes_vigentes().get("PQ")
    if not vpq:
        return []
    q = select(ItemPqModel).where(ItemPqModel.versao_id == vpq)
    if so_folhas:
        q = q.where(ItemPqModel.folha.is_(True))
    return list(s.scalars(q.order_by(ItemPqModel.ordem, ItemPqModel.id)))


def _resolvidos(s: Session, obra_id: int, cs: list[CriterioModel]) -> dict[str, tuple[int | None, str | None, int]]:
    refs, vin = _refs(cs), _vinculos(s, obra_id)
    return {f.item: resolver_criterio(f.item, f.criterio, refs, vin.get(f.item)) for f in _pq(s, obra_id, so_folhas=True)}


def criterio_para_item(s: Session, obra_id: int, item_pq: str | None) -> CriterioModel | None:
    """Linguagem publicada para a WBS: o critério do item da PQ — vínculo da linha, código CMS da PQ, critério
    cadastrado para o item ou o grupo do código CMS (spec 083)."""
    if not item_pq:
        return None
    cs = _todos(s, obra_id)
    pq = next((f for f in _pq(s, obra_id, so_folhas=True) if f.item == item_pq), None)
    cid, _, _ = resolver_criterio(item_pq, pq.criterio if pq else None, _refs(cs), _vinculos(s, obra_id).get(item_pq))
    return next((x for x in cs if x.id == cid), None)


def _uso_na_wbs(s: Session, obra_id: int) -> dict[int, int]:
    from app.modules.wbs.infra.models import WbsNoModel

    return dict(s.execute(select(EtapaCriterioModel.criterio_id, func.count()).join(WbsNoModel, WbsNoModel.etapa_id == EtapaCriterioModel.id)
                          .where(EtapaCriterioModel.obra_id == obra_id).group_by(EtapaCriterioModel.criterio_id)).all())


@router.get("")
def listar(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    cs = _todos(s, c.obra_id)
    res = _resolvidos(s, c.obra_id, cs)
    cobre: dict[int, int] = {}
    for cid, _, _ in res.values():
        if cid:
            cobre[cid] = cobre.get(cid, 0) + 1
    uso = _uso_na_wbs(s, c.obra_id)
    return {"criterios": [_out(x, cobre.get(x.id, 0), uso.get(x.id, 0)) for x in cs],
            "itens_pq": len(res), "itens_cobertos": sum(1 for cid, _, _ in res.values() if cid)}


@router.get("/pq")
def pela_pq(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """A PQ vigente na ordem dela (títulos e itens) com o critério de cada item e como ele foi achado (spec 083)."""
    cs = _todos(s, c.obra_id)
    refs, vin = _refs(cs), _vinculos(s, c.obra_id)
    linhas, titulos = [], {}
    descs = [(x.id, x.descricao) for x in cs]
    for f in _pq(s, c.obra_id):
        ln = {"item": f.item, "descricao": f.descricao, "unid": f.unid, "nivel": f.nivel, "folha": f.folha, "cms": f.criterio}
        if not f.folha:
            titulos[f.item] = f.descricao
        else:
            cid, como, opcoes = resolver_criterio(f.item, f.criterio, refs, vin.get(f.item))
            ln |= {"criterio_id": cid, "como": como, "como_texto": COMO.get(como or ""), "opcoes": opcoes, "vinculado": f.item in vin,
                   "sugestao_id": None}
            if cid is None and descs:
                partes = f.item.split(".")
                acima = [titulos[".".join(partes[:k])] for k in range(len(partes) - 1, 0, -1) if ".".join(partes[:k]) in titulos][:2]
                ln["sugestao_id"] = sugerir_por_descricao(f.descricao, acima, descs)
        linhas.append(ln)
    return {"linhas": linhas}


class VinculoIn(BaseModel):
    criterio_id: int | None = None


@router.put("/pq/{item}/vinculo")
def vincular(item: str, d: VinculoIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Escolhe à mão o critério do item da PQ (vazio = volta ao casamento automático pelo código CMS)."""
    item = item.strip()
    if not any(f.item == item for f in _pq(s, c.obra_id, so_folhas=True)):
        raise DomainError(f"o item {item} não é um item (folha) da PQ vigente", "item")
    v = s.scalar(select(VinculoCriterioModel).where(VinculoCriterioModel.obra_id == c.obra_id, VinculoCriterioModel.item_pq == item))
    if d.criterio_id is None:
        if v is not None:
            s.delete(v)
        return {"item": item, "criterio_id": None}
    _criterio(s, c.obra_id, d.criterio_id)
    if v is None:
        s.add(VinculoCriterioModel(obra_id=c.obra_id, item_pq=item, criterio_id=d.criterio_id, definido_por=c.usuario.id))
    else:
        v.criterio_id, v.definido_por = d.criterio_id, c.usuario.id
    s.flush()
    return {"item": item, "criterio_id": d.criterio_id}


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
