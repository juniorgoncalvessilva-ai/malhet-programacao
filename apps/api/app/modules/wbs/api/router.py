"""WBS de execução: Área (CWA) → CWP (elemento + complemento) → Grupo (catálogo) → IWP (item da PQ)."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, ler, planejar
from app.core.db import get_session
from app.modules.catalogo.infra.models import GrupoAtividadeModel, TipoAtividadeModel
from app.modules.frentes.infra.models import AreaFrenteModel
from app.modules.planejamento.infra.models import LinhaProgramacaoModel
from app.modules.referencias.infra.pq_gateway import itens_pq, quantidades_por_tag
from app.modules.wbs.domain import wbs as dom
from app.modules.wbs.infra.gateway import codigos, nos
from app.modules.wbs.infra.models import WbsNoModel
from app.shared.errors import DomainError, NotFoundError

router = APIRouter(prefix="/wbs", tags=["WBS de execução"])


class NoIn(BaseModel):
    pai_id: int | None = None
    tipo: str
    area_id: int | None = None  # área
    elemento: str | None = None  # CWP
    complemento: str | None = None  # CWP
    grupo_id: int | None = None  # grupo
    tipo_id: int | None = None  # IWP: tipo do catálogo (= item da PQ no grupo)
    quantidade: float | None = None  # IWP
    observacao: str | None = None
    ativo: bool = True


def _no(s: Session, c: ContextoObra, nid: int) -> WbsNoModel:
    n = s.get(WbsNoModel, nid)
    if n is None or n.obra_id != c.obra_id:
        raise NotFoundError("Nó da WBS", nid)
    return n


def _atividades_p6(s: Session, obra_id: int, ids: set[str]) -> dict[str, str]:
    from app.modules.referencias.infra.resolvedor import ResolvedorReferencias
    from app.modules.referencias.infra.models import AtividadeCronogramaModel

    vig = ResolvedorReferencias(s, obra_id).versoes_vigentes().get("CRONOGRAMA")
    if not vig or not ids:
        return {}
    return {a.id_crono: a.atividade for a in s.scalars(select(AtividadeCronogramaModel).where(
        AtividadeCronogramaModel.versao_id == vig, AtividadeCronogramaModel.id_crono.in_(ids)))}


@router.get("")
def arvore(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    todos = nos(s, c.obra_id)
    cods = codigos(s, c.obra_id, todos)
    areas = {a.id: a for a in s.scalars(select(AreaFrenteModel).where(AreaFrenteModel.obra_id == c.obra_id))}
    grupos = {g.id: g for g in s.scalars(select(GrupoAtividadeModel).where(GrupoAtividadeModel.obra_id == c.obra_id))}
    itens = {n.item_pq for n in todos.values() if n.item_pq}
    pq = itens_pq(s, c.obra_id, itens)
    tk = quantidades_por_tag(s, c.obra_id, itens)
    uso = dict(s.execute(select(LinhaProgramacaoModel.wbs_no_id, func.count()).where(
        LinhaProgramacaoModel.wbs_no_id.in_(list(todos) or [0])).group_by(LinhaProgramacaoModel.wbs_no_id)).all())
    atividades_p6 = _atividades_p6(s, c.obra_id, {n.id_crono for n in todos.values() if n.id_crono})
    filhos: dict[int | None, list[WbsNoModel]] = {}
    for n in todos.values():
        filhos.setdefault(n.pai_id, []).append(n)

    def area_de(n: WbsNoModel) -> AreaFrenteModel | None:
        while n.tipo != "area":
            n = todos[n.pai_id]
        return areas.get(n.area_id)

    def saida(n: WbsNoModel) -> dict:
        d = {"id": n.id, "pai_id": n.pai_id, "tipo": n.tipo, "seq": n.seq, "codigo": cods[n.id].codigo,
             "caminho": cods[n.id].caminho, "ativo": n.ativo, "observacao": n.observacao,
             "linhas": uso.get(n.id, 0), "area_id": n.area_id, "elemento": n.elemento, "complemento": n.complemento,
             "grupo_id": n.grupo_id, "tipo_id": n.tipo_atividade_id, "item_pq": n.item_pq,
             "origem": n.origem, "fora_cronograma": n.fora_cronograma, "id_crono": n.id_crono,
             "atividade_p6": atividades_p6.get(n.id_crono) if n.id_crono else None}
        if n.tipo == "area":
            a = areas.get(n.area_id)
            d["titulo"], d["detalhe"] = (a.descricao if a else "?"), (f"CWA {a.cwa}" + (f" · Ativo {a.ativo_codigo}" if a and a.ativo_codigo else "") if a else "")
        elif n.tipo == "cwp":
            d["titulo"], d["detalhe"] = dom.texto_cwp(n.elemento, n.complemento), "CWP"
        elif n.tipo == "grupo":
            g = grupos.get(n.grupo_id)
            d["titulo"], d["detalhe"] = (g.descricao if g else "?"), (f"grupo {g.numero}" if g else "")
        else:
            info = pq.get(n.item_pq)
            a = area_de(n)
            qtd_tk = tk.get((n.item_pq, a.tag)) if a and a.tag else None
            d.update({"titulo": info.texto_simova if info else (n.item_pq or "?"),
                      "detalhe": f"PQ {n.item_pq}" + (f" · {info.descricao}" if info and info.nome_simplificado else ""),
                      "unid": info.unid if info else None, "quantidade": n.quantidade, "qtd_takeoff": qtd_tk,
                      "quantidade_efetiva": n.quantidade if n.quantidade is not None else qtd_tk,
                      "origem_qtd": "digitada" if n.quantidade is not None else ("take-off" if qtd_tk is not None else None),
                      "na_pq_vigente": info is not None})
        d["filhos"] = [saida(f) for f in sorted(filhos.get(n.id, []), key=lambda x: (x.seq, x.id))]
        return d

    import re

    natural = lambda t: [int(x) if x.isdigit() else x for x in re.split(r"(\d+)", t)]  # noqa: E731
    raizes = sorted(filhos.get(None, []), key=lambda n: natural(cods[n.id].codigo))
    return {"arvore": [saida(n) for n in raizes]}


@router.post("/sincronizar-cronograma")
def sincronizar_cronograma(s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Traz a WBS do cronograma vigente (P6): áreas, CWPs e IWPs (atividades com item da PQ no Catálogo)."""
    from app.modules.wbs.application.sincronizar_cronograma import sincronizar

    return sincronizar(s, c.obra_id)


@router.post("/nos", status_code=201)
def criar(d: NoIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    pai = _no(s, c, d.pai_id) if d.pai_id else None
    dom.validar_tipo(d.tipo, pai.tipo if pai else None)
    irmaos = list(s.scalars(select(WbsNoModel).where(WbsNoModel.obra_id == c.obra_id,
                                                     WbsNoModel.pai_id.is_(None) if pai is None else WbsNoModel.pai_id == pai.id)))
    n = WbsNoModel(obra_id=c.obra_id, pai_id=pai.id if pai else None, tipo=d.tipo,
                   seq=max([x.seq for x in irmaos], default=0) + 1, observacao=(d.observacao or None), ativo=d.ativo)
    if d.tipo == "area":
        a = s.get(AreaFrenteModel, d.area_id or 0)
        if a is None or a.obra_id != c.obra_id:
            raise DomainError("escolha a área (CWA) em Frentes", "area_id")
        if any(x.area_id == a.id for x in irmaos):
            raise DomainError(f"a área {a.codigo} já está na WBS", "area_id")
        n.area_id = a.id
    elif d.tipo == "cwp":
        n.elemento, n.complemento = dom.validar_cwp(d.elemento, d.complemento)
        if any((x.elemento or "").lower() == n.elemento.lower() and (x.complemento or "").lower() == (n.complemento or "").lower()
               for x in irmaos):
            raise DomainError(f"o CWP {dom.texto_cwp(n.elemento, n.complemento)} já existe nesta área", "elemento")
    elif d.tipo == "grupo":
        g = s.get(GrupoAtividadeModel, d.grupo_id or 0)
        if g is None or g.obra_id != c.obra_id:
            raise DomainError("escolha o grupo do catálogo", "grupo_id")
        if any(x.grupo_id == g.id for x in irmaos):
            raise DomainError(f"o grupo {g.numero} · {g.descricao} já está neste CWP", "grupo_id")
        n.grupo_id, n.seq = g.id, g.numero
    else:  # iwp
        t = s.get(TipoAtividadeModel, d.tipo_id or 0)
        if t is None or t.obra_id != c.obra_id or not t.item_pq:
            raise DomainError("escolha o item da PQ (vinculado ao grupo no Catálogo)", "tipo_id")
        if t.grupo_id != pai.grupo_id:
            raise DomainError(f"o item {t.item_pq} não é do grupo deste nó: vincule-o ao grupo no Catálogo", "tipo_id")
        if any(x.tipo_atividade_id == t.id for x in irmaos):
            raise DomainError(f"o item {t.item_pq} já está neste grupo", "tipo_id")
        n.tipo_atividade_id, n.item_pq, n.quantidade = t.id, t.item_pq, dom.validar_quantidade(d.quantidade)
    s.add(n)
    s.flush()
    return {"id": n.id, "codigo": codigos(s, c.obra_id)[n.id].codigo}


@router.put("/nos/{nid}")
def editar(nid: int, d: NoIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Edita o texto do CWP, a quantidade do IWP, a observação e a situação (área, grupo e item não mudam)."""
    n = _no(s, c, nid)
    if n.tipo == "cwp":
        n.elemento, n.complemento = dom.validar_cwp(d.elemento, d.complemento)
    if n.tipo == "iwp":
        n.quantidade = dom.validar_quantidade(d.quantidade)
    n.observacao, n.ativo = (d.observacao or None), d.ativo
    s.flush()
    return {"id": n.id}


@router.delete("/nos/{nid}", status_code=204)
def excluir(nid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    n = _no(s, c, nid)
    if s.scalar(select(func.count()).select_from(WbsNoModel).where(WbsNoModel.pai_id == n.id)):
        raise DomainError("o nó tem itens abaixo: exclua-os antes")
    if s.scalar(select(func.count()).select_from(LinhaProgramacaoModel).where(LinhaProgramacaoModel.wbs_no_id == n.id)):
        raise DomainError("o IWP está em programação: inative em vez de excluir")
    s.delete(n)
