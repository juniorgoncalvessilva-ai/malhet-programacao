"""Linguagem publicada da CPU vigente para outros módulos: item da PQ → parâmetros de produção."""
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.referencias.domain import indice as ind
from app.modules.referencias.infra.models import (
    CpuComposicaoModel,
    CpuRecursoModel,
    CpuServicoModel,
    ItemPqModel,
)


@dataclass(frozen=True)
class ParametrosCpu:
    item_pq: str
    composicao: str | None
    descricao_composicao: str | None
    custo_unitario: float | None
    recursos: tuple[ind.RecursoCpu, ...]
    recurso_governa: str | None
    coef_governa: float | None  # h/un do recurso que governa
    hh_por_unidade: float | None  # soma da mão de obra (HH/un)

    def indice_un_dia(self, jornada: float) -> float | None:
        """Índice orçado: un/dia por oficial do recurso que governa."""
        return ind.indice_orcado(jornada, self.coef_governa)

    @property
    def coefs(self) -> dict[str, float]:
        return {r.recurso: r.coef_por_unidade for r in self.recursos}


class CpuGateway:
    def __init__(self, s: Session, obra_id: int, vigentes: dict[str, int]):
        self.s, self.obra_id, self.vig = s, obra_id, vigentes

    def por_itens(self, itens: set[str]) -> dict[str, ParametrosCpu]:
        if not itens:
            return {}
        comp_por_item: dict[str, str] = {}
        custo: dict[str, float | None] = {}
        if "CPU" in self.vig:
            for sv in self.s.scalars(select(CpuServicoModel).where(CpuServicoModel.versao_id == self.vig["CPU"],
                                                                   CpuServicoModel.item.in_(itens))):
                comp_por_item[sv.item] = sv.composicao
                custo[sv.item] = sv.custo_unitario
        if "PQ" in self.vig:  # sem a CPU da obra, vale a composição anotada na PQ (take-off)
            for p in self.s.scalars(select(ItemPqModel).where(ItemPqModel.versao_id == self.vig["PQ"],
                                                              ItemPqModel.item.in_(itens))):
                if p.composicao and p.item not in comp_por_item:
                    comp_por_item[p.item] = p.composicao
        comps = set(comp_por_item.values())
        recursos: dict[str, list[ind.RecursoCpu]] = {}
        cab: dict[str, CpuComposicaoModel] = {}
        if "CPU" in self.vig and comps:
            for r in self.s.scalars(select(CpuRecursoModel).where(CpuRecursoModel.versao_id == self.vig["CPU"],
                                                                  CpuRecursoModel.composicao.in_(comps))):
                recursos.setdefault(r.composicao, []).append(ind.RecursoCpu(r.recurso, r.tipo, r.coef_por_unidade))
            cab = {c.codigo: c for c in self.s.scalars(select(CpuComposicaoModel).where(
                CpuComposicaoModel.versao_id == self.vig["CPU"], CpuComposicaoModel.codigo.in_(comps)))}
        out = {}
        for item in itens:
            comp = comp_por_item.get(item)
            rec = tuple(recursos.get(comp, [])) if comp else ()
            c = cab.get(comp) if comp else None
            if c is not None:
                gov, coef, hh = c.recurso_governa, c.coef_governa, c.hh_por_unidade
            else:  # CPU antiga (planilha auxiliar): calcula na hora
                g = ind.recurso_que_governa(list(rec))
                gov, coef = (g.recurso, g.coef_por_unidade) if g else (None, None)
                hh = round(sum(r.coef_por_unidade for r in rec if r.tipo == "MOD"), 6) or None
            out[item] = ParametrosCpu(item, comp, c.descricao if c else None,
                                      custo.get(item) if item in custo else (c.custo if c else None),
                                      rec, gov, coef, hh)
        return out
