"""Período da programação e divisão em linhas da FT do Simova."""
from calendar import monthrange
from datetime import date, timedelta
from enum import StrEnum

from app.shared.errors import DomainError

DIAS = ("SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM")  # date.weekday()
SEXTA = 4


class TipoProgramacao(StrEnum):
    SEMANAL = "SEMANAL"
    MENSAL = "MENSAL"


def periodo(tipo: TipoProgramacao, referencia: date) -> tuple[date, date]:
    """SEMANAL: da sexta (na data ou antes dela) até o sábado da semana seguinte (9 dias). MENSAL: o mês todo."""
    if tipo == TipoProgramacao.SEMANAL:
        inicio = referencia - timedelta(days=(referencia.weekday() - SEXTA) % 7)
        return inicio, inicio + timedelta(days=8)
    if tipo == TipoProgramacao.MENSAL:
        return referencia.replace(day=1), referencia.replace(day=monthrange(referencia.year, referencia.month)[1])
    raise DomainError(f"tipo de programação inválido: {tipo}", "tipo")


def dias(inicio: date, fim: date) -> list[date]:
    return [inicio + timedelta(days=i) for i in range((fim - inicio).days + 1)]


def numero_semana(d: date, domingo_ref: date = date(2026, 11, 1), semana_ref: int = 31) -> int:
    """Numeração da obra (01/11/2026 = S31), contada a partir do domingo."""
    return semana_ref + (d - domingo_ref).days // 7


def titulo(tipo: TipoProgramacao, inicio: date, fim: date) -> str:
    if tipo == TipoProgramacao.MENSAL:
        return f"Programação mensal {inicio:%m/%Y}"
    return f"Programação semanal S{numero_semana(fim)} · {inicio:%d/%m} a {fim:%d/%m/%Y}"


def janelas_ft(datas: list[date]) -> list[list[date]]:
    """A FT do Simova tem uma coluna por dia da semana: cada linha cobre no máximo 7 dias sem repetir o dia.

    A semanal de 9 dias (sex→sáb) vira 2 linhas: sex…qui (7 dias) + sex, sáb.
    """
    out: list[list[date]] = []
    atual: list[date] = []
    for d in sorted(datas):
        if atual and (d.weekday() in {x.weekday() for x in atual} or (d - atual[0]).days >= 7):
            out.append(atual)
            atual = []
        atual.append(d)
    if atual:
        out.append(atual)
    return out
