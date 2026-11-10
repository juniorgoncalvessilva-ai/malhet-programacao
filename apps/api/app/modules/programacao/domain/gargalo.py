"""Capacidade de uma equipe numa atividade — portado de MONTAR (rmax / gargalo) e EQUIPES.

razão_f   = coef_f (h/un) ÷ quantidade_f na equipe   (função que a equipe não tem → não limita, vem de apoio)
rmax      = max(razão_f)
capacidade (un/dia de referência) = jornada ÷ rmax    (0 se a equipe não tem o recurso que governa)
gargalo   = função de maior razão
"""
import math
from dataclasses import dataclass


@dataclass(frozen=True)
class CapacidadeEquipe:
    capacidade_un_dia: float
    gargalo: str | None
    falta_governante: bool
    apoio_externo: tuple[str, ...]  # CPU pede e a equipe não tem


def capacidade_da_equipe(
    coefs: dict[str, float], composicao: dict[str, float], jornada: float, recurso_governa: str | None
) -> CapacidadeEquipe:
    apoio = tuple(sorted(f for f, c in coefs.items() if c > 0 and not composicao.get(f)))
    if recurso_governa and not composicao.get(recurso_governa):
        return CapacidadeEquipe(0.0, f"falta {recurso_governa}", True, apoio)
    razoes = {f: c / composicao[f] for f, c in coefs.items() if c > 0 and composicao.get(f)}
    if not razoes:
        return CapacidadeEquipe(0.0, None, False, apoio)
    gargalo, rmax = max(razoes.items(), key=lambda kv: kv[1])
    return CapacidadeEquipe(jornada / rmax, gargalo, False, apoio)


def equipe_para_prazo(restante: float, indice_usado: float, dias_ref_disponiveis: float) -> int | None:
    """Base PRAZO: oficiais necessários para terminar até o fim do cronograma (mín. 1)."""
    if not restante or not indice_usado:
        return None
    return max(1, math.ceil(restante / (indice_usado * max(1.0, dias_ref_disponiveis))))


def capacidade_por_indice(indice_usado: float, equipe: float) -> float:
    """Base PRAZO / equipe digitada: capacidade (un/dia de ref.) = índice × oficiais."""
    return indice_usado * equipe


def distribuir_no_periodo(restante: float, capacidade: float, fatores_dia: list[float]) -> list[float]:
    """Sem sequência: produção do dia = min(capacidade × fator do dia, saldo), arredondado a 2 casas."""
    out, feito = [], 0.0
    for f in fatores_dia:
        q = round(max(0.0, min(capacidade * f, restante - feito)), 2)
        out.append(q)
        feito += q
    return out
