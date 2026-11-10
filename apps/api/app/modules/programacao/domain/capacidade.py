"""Serviço de domínio: capacidade produtiva diária de uma equipe.

HH disponível no dia = Σ (quantidade × horas do dia) dos recursos MOD da equipe.
Produção máxima      = HH disponível ÷ índice (HH/un).
Excesso              = HH programado (todas as OPERs da equipe/encarregado no dia) > HH disponível.

Próxima evolução (spec 004): gargalo por função — a produção é limitada pela função mais
escassa frente à CPU (como na aba EQUIPES da planilha auxiliar).
"""
from collections import defaultdict
from dataclasses import dataclass
from datetime import date

from app.modules.programacao.domain.item_programacao import ItemProgramacao


@dataclass(frozen=True)
class MembroEquipe:
    recurso: str
    tipo: str  # MOD | EQU
    quantidade: float
    jornada_horas: float


@dataclass(frozen=True)
class OcupacaoDia:
    data: date
    hh_disponivel: float
    hh_programado: float

    @property
    def saldo(self) -> float:
        return round(self.hh_disponivel - self.hh_programado, 2)

    @property
    def excedido(self) -> bool:
        return self.hh_programado > self.hh_disponivel + 1e-9


def hh_disponivel(equipe: list[MembroEquipe]) -> float:
    return round(sum(m.quantidade * m.jornada_horas for m in equipe if m.tipo == "MOD"), 2)


def producao_maxima(hh: float, indice_hh_por_unidade: float) -> float:
    if indice_hh_por_unidade <= 0:
        raise ValueError("índice deve ser positivo")
    return round(hh / indice_hh_por_unidade, 2)


def ocupacao(itens: list[ItemProgramacao], hh_disp_dia: float) -> list[OcupacaoDia]:
    por_dia: dict[date, float] = defaultdict(float)
    for item in itens:
        for d in item.dias:
            por_dia[d.data] += d.hh or 0
    return [OcupacaoDia(dt, hh_disp_dia, round(hh, 2)) for dt, hh in sorted(por_dia.items())]


def excessos(itens: list[ItemProgramacao], hh_disp_dia: float) -> list[OcupacaoDia]:
    return [o for o in ocupacao(itens, hh_disp_dia) if o.excedido]
