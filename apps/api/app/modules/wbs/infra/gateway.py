"""Linguagem publicada da WBS de execução para a programação: código do nó e o que o IWP define na linha."""
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.catalogo.infra.models import GrupoAtividadeModel
from app.modules.frentes.infra.models import AreaFrenteModel
from app.modules.wbs.domain import wbs as dom
from app.modules.wbs.infra.models import WbsNoModel
from app.shared.errors import DomainError, NotFoundError


@dataclass(frozen=True)
class IwpParaLinha:
    id: int
    codigo: str
    area_id: int
    tipo_id: int
    item_pq: str | None
    complemento: str  # texto do CWP → texto complementar do Simova
    quantidade: float | None  # digitada no IWP (vazio = take-off da TAG, calculado na programação)
    id_crono: str | None = None  # IWP vindo do P6: a linha fica ligada à atividade do cronograma
    # spec 079: a linha é uma etapa do IWP (pré-armação, montagem…): peso no valor do item; sem avanço = só HH
    etapa_nome: str | None = None
    etapa_percentual: float | None = None
    sem_avanco: bool = False


def nos(s: Session, obra_id: int) -> dict[int, WbsNoModel]:
    return {n.id: n for n in s.scalars(select(WbsNoModel).where(WbsNoModel.obra_id == obra_id))}


def codigos(s: Session, obra_id: int, todos: dict[int, WbsNoModel] | None = None) -> dict[int, dom.CodigoNo]:
    todos = todos if todos is not None else nos(s, obra_id)
    areas = {a.id: a for a in s.scalars(select(AreaFrenteModel).where(AreaFrenteModel.obra_id == obra_id))}
    grupos = {g.id: g for g in s.scalars(select(GrupoAtividadeModel).where(GrupoAtividadeModel.obra_id == obra_id))}
    memo: dict[int, dom.CodigoNo] = {}

    def de(n: WbsNoModel) -> dom.CodigoNo:
        if n.id in memo:
            return memo[n.id]
        if n.tipo == "area":
            a = areas.get(n.area_id)
            c = dom.CodigoNo(a.codigo if a else "?", f"{a.codigo} {a.descricao}" if a else "?")
        else:
            pai = de(todos[n.pai_id])
            if n.tipo == "grupo":
                g = grupos.get(n.grupo_id)
                parte, nome = (str(g.numero), g.descricao) if g else ("?", "?")
            elif n.tipo == "cwp":
                parte, nome = dom.seq_texto("cwp", n.seq), dom.texto_cwp(n.elemento, n.complemento)
            elif n.tipo == "etapa":
                parte, nome = dom.seq_texto("etapa", n.seq), n.elemento or "etapa"
            else:
                parte, nome = dom.seq_texto("iwp", n.seq), n.item_pq or "?"
            c = dom.CodigoNo(dom.juntar([pai.codigo, parte]), f"{pai.caminho} › {nome}")
        memo[n.id] = c
        return c

    for n in todos.values():
        de(n)
    return memo


def iwp_para_linha(s: Session, obra_id: int, no_id: int) -> IwpParaLinha:
    todos = nos(s, obra_id)
    n = todos.get(no_id)
    if n is None:
        raise NotFoundError("Nó da WBS", no_id)
    if n.tipo not in ("iwp", "etapa"):
        raise DomainError("escolha um IWP (item da PQ) ou uma etapa dele na WBS para a linha", "wbs_no_id")
    etapa = n if n.tipo == "etapa" else None
    iwp = todos[n.pai_id] if etapa else n
    grupo = todos[iwp.pai_id]
    cwp = todos[grupo.pai_id]
    area = todos[cwp.pai_id]
    return IwpParaLinha(n.id, codigos(s, obra_id, todos)[n.id].codigo, area.area_id, iwp.tipo_atividade_id, iwp.item_pq,
                        dom.texto_cwp(cwp.elemento, cwp.complemento),
                        (etapa.quantidade if etapa and etapa.quantidade is not None else iwp.quantidade),
                        (etapa.id_crono if etapa and etapa.id_crono else iwp.id_crono),
                        etapa.elemento if etapa else None, etapa.percentual if etapa else None, bool(etapa and etapa.sem_avanco))


def iwps_abaixo(s: Session, obra_id: int, ids: list[int]) -> tuple[list[int], list[int]]:
    """IWPs ativos dos nós escolhidos (o próprio IWP ou todos abaixo de área/CWP/grupo), na ordem do código.
    Devolve (iwps, nós escolhidos sem nenhum IWP abaixo)."""
    todos = nos(s, obra_id)
    filhos: dict[int, list[WbsNoModel]] = {}
    for n in todos.values():
        if n.pai_id:
            filhos.setdefault(n.pai_id, []).append(n)
    cods = codigos(s, obra_id, todos)
    achados: dict[int, None] = {}
    vazios = []
    for i in ids:
        n = todos.get(i)
        if n is None:
            raise NotFoundError("Nó da WBS", i)
        antes = len(achados)
        pilha = [n]
        while pilha:
            x = pilha.pop()
            if x.tipo == "iwp":
                if x.ativo:
                    # IWP com etapas (spec 079): vão as etapas ativas, cada uma vira uma linha
                    ets = [f for f in filhos.get(x.id, []) if f.tipo == "etapa" and f.ativo]
                    for f in (sorted(ets, key=lambda e: e.seq) if n.tipo != "etapa" else []) or [x]:
                        achados[f.id] = None
            elif x.tipo == "etapa":
                if x.ativo:
                    achados[x.id] = None
            else:
                pilha.extend(filhos.get(x.id, []))
        if len(achados) == antes:
            vazios.append(i)
    return sorted(achados, key=lambda k: [int(p) if p.isdigit() else p for p in cods[k].codigo.replace(".", "-").split("-")]), vazios


def itens_da_area(s: Session, obra_id: int, area_id: int) -> list[dict]:
    """IWPs ativos da WBS de uma frente (CWA), com o CWP e o grupo — para registrar no campo uma atividade fora da
    programação (spec 119). Frente sem WBS devolve lista vazia (aí vale o item da PQ)."""
    todos = nos(s, obra_id)
    raizes = {n.id for n in todos.values() if n.tipo == "area" and n.area_id == area_id and n.ativo}
    if not raizes:
        return []
    grupos = {g.id: g for g in s.scalars(select(GrupoAtividadeModel).where(GrupoAtividadeModel.obra_id == obra_id))}
    cods = codigos(s, obra_id, todos)

    def area_de(n: WbsNoModel) -> int | None:
        while n.pai_id:
            n = todos[n.pai_id]
            if not n.ativo:
                return None
        return n.id

    out = []
    for n in todos.values():
        if n.tipo != "iwp" or not n.ativo or area_de(n) not in raizes:
            continue
        grupo = todos.get(n.pai_id)
        cwp = todos.get(grupo.pai_id) if grupo else None
        g = grupos.get(grupo.grupo_id) if grupo else None
        out.append({"wbs_no_id": n.id, "codigo": cods[n.id].codigo, "item_pq": n.item_pq,
                    "cwp": dom.texto_cwp(cwp.elemento, cwp.complemento) if cwp else None,
                    "grupo": f"{g.numero} · {g.descricao}" if g else None})
    out.sort(key=lambda x: x["codigo"])
    return out


@dataclass(frozen=True)
class IwpDoItem:
    id: int
    codigo: str
    quantidade: float | None
    tem_etapas: bool


def iwps_do_item(s: Session, obra_id: int, area_id: int, item_pq: str) -> list[IwpDoItem]:
    """IWPs ativos da área (CWA) com o item da PQ — destino do take-off pelo projeto (spec 124)."""
    todos = nos(s, obra_id)
    cods = codigos(s, obra_id, todos)

    def area_de(n: WbsNoModel) -> int | None:
        while n.tipo != "area" and n.pai_id in todos:
            n = todos[n.pai_id]
        return n.area_id if n.tipo == "area" else None

    com_etapa = {n.pai_id for n in todos.values() if n.tipo == "etapa"}
    return [IwpDoItem(n.id, cods[n.id].codigo, n.quantidade, n.id in com_etapa) for n in todos.values()
            if n.tipo == "iwp" and n.ativo and n.item_pq == item_pq and area_de(n) == area_id]


def definir_quantidade_iwp(s: Session, obra_id: int, no_id: int, quantidade: float, observacao: str) -> None:
    n = s.get(WbsNoModel, no_id)
    if n is None or n.obra_id != obra_id or n.tipo != "iwp":
        raise NotFoundError("IWP", no_id)
    n.quantidade = dom.validar_quantidade(quantidade)
    n.observacao = observacao[:300]
