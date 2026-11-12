"""Previsto do dia pela capacidade produtiva — botão "Pela capacidade" da programação.

fator do dia    = horas do dia no calendário da obra ÷ jornada de referência (SEG–QUI 9 h → 1; SEX 8 h → 0,889;
                  SÁB/DOM 0 h → 0). Na semanal, a sexta e o sábado anteriores (2 primeiros dias) ficam com 0 h,
                  como na planilha auxiliar.
capacidade do dia = capacidade da equipe (un/dia, base escolhida) × fator do dia
previsto do dia   = capacidade do dia, até completar o limite (qtd do período ou o que resta do projeto)
"""
from dataclasses import dataclass
from datetime import date

from app.modules.programacao.domain.calendario import DIAS_PT, HORAS_PADRAO

JORNADA_CALENDARIO = 9.0


@dataclass(frozen=True)
class DiaFator:
    data: date
    horas: float
    fator: float


def fatores_do_periodo(datas: list[date], semanal: bool, horas_padrao: dict[str, float] | None = None,
                       jornada: float = JORNADA_CALENDARIO) -> list[DiaFator]:
    hp = horas_padrao or HORAS_PADRAO
    out = []
    for j, d in enumerate(sorted(datas)):
        h = 0.0 if semanal and j < 2 else float(hp.get(DIAS_PT[d.weekday()], 0))
        out.append(DiaFator(d, h, round(h / jornada, 6) if jornada else 0.0))
    return out


def capacidade_por_dia(capacidade_un_dia: float | None, fatores: list[DiaFator]) -> list[float | None]:
    if capacidade_un_dia is None:
        return [None] * len(fatores)
    return [round(capacidade_un_dia * f.fator, 4) for f in fatores]


def previsto_pela_capacidade(capacidade_un_dia: float | None, fatores: list[DiaFator], limite: float | None = None,
                             casas: int = 2) -> list[float | None]:
    """Previsto de cada dia = capacidade × fator, parando quando o limite (quantidade do período) é atingido.

    Dia sem horas fica vazio. Sem capacidade (sem equipe/CPU) não há sugestão: tudo vazio.
    """
    if not capacidade_un_dia or capacidade_un_dia <= 0:
        return [None] * len(fatores)
    resta = None if limite is None else max(0.0, float(limite))
    out: list[float | None] = []
    for f in fatores:
        q = round(capacidade_un_dia * f.fator, casas) if f.fator > 0 else 0.0
        if resta is not None:
            q = round(min(q, resta), casas)
            resta = round(resta - q, 6)
        out.append(q if q > 0 else None)
    return out
