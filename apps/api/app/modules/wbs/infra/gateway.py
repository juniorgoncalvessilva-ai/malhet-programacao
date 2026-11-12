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
    if n.tipo != "iwp":
        raise DomainError("escolha um IWP (item da PQ) da WBS para a linha", "wbs_no_id")
    grupo = todos[n.pai_id]
    cwp = todos[grupo.pai_id]
    area = todos[cwp.pai_id]
    return IwpParaLinha(n.id, codigos(s, obra_id, todos)[n.id].codigo, area.area_id, n.tipo_atividade_id, n.item_pq,
                        dom.texto_cwp(cwp.elemento, cwp.complemento), n.quantidade, n.id_crono)


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
                    achados[x.id] = None
            else:
                pilha.extend(filhos.get(x.id, []))
        if len(achados) == antes:
            vazios.append(i)
    return sorted(achados, key=lambda k: [int(p) if p.isdigit() else p for p in cods[k].codigo.replace(".", "-").split("-")]), vazios
