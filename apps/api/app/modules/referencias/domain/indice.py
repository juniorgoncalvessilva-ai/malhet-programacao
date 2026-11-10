"""Índices de produtividade — portado de programacao_v5.py (aba MONTAR).

Convenções (iguais à planilha auxiliar):
- jornada de referência J (h/dia, PARAMETROS!B7);
- índice em un/dia por oficial do recurso que governa;
- coef da CPU em h/un por recurso.

Fórmulas:
- Índice ORÇADO        = J ÷ coef do recurso que governa
- Índice AJUSTADO      = manual da linha › ORÇADO × fator da família (FAMILIAS: ajustado ÷ orçado) › ORÇADO
- Índice ESPECÍFICO    = valor da aba ÍNDICES (vence a CPU)
- fator índice         = ORÇADO ÷ USADO (1 se faltar algum)
- h/un de cada função  = coef CPU × fator índice
  com índice específico: oficial = J ÷ índice; ajudante = ajud/oficial × J ÷ índice; demais = 0
"""
from dataclasses import dataclass
from enum import StrEnum

from app.modules.referencias.domain.cpu_obra import eh_apoio
from app.shared.errors import DomainError


class Seletor(StrEnum):
    ORCADO = "ORÇADO"
    AJUSTADO = "AJUSTADO"


@dataclass(frozen=True)
class RecursoCpu:
    recurso: str
    tipo: str  # MOD | EQU
    coef_por_unidade: float  # h/un


@dataclass(frozen=True)
class IndiceEspecifico:
    codigo: str
    funcao_governa: str
    indice_un_dia: float
    ajudante: str | None = None
    ajudantes_por_oficial: float | None = None


def indice_orcado(jornada: float, coef_governa: float | None) -> float | None:
    if not coef_governa or coef_governa <= 0:
        return None
    return jornada / coef_governa


def indice_usado(
    *,
    orcado: float | None,
    seletor: Seletor = Seletor.ORCADO,
    ajustado_manual: float | None = None,
    fator_familia: float | None = None,
    especifico: IndiceEspecifico | None = None,
) -> float | None:
    if especifico and especifico.indice_un_dia > 0:
        return especifico.indice_un_dia
    if seletor == Seletor.AJUSTADO:
        if ajustado_manual:
            return ajustado_manual
        if orcado and fator_familia:
            return orcado * fator_familia
    return orcado


def fator_indice(orcado: float | None, usado: float | None) -> float:
    if orcado and usado and orcado > 0 and usado > 0:
        return orcado / usado
    return 1.0


def coeficientes_usados(
    recursos: list[RecursoCpu],
    *,
    jornada: float,
    fator: float = 1.0,
    especifico: IndiceEspecifico | None = None,
) -> dict[str, float]:
    """h/un de cada função/equipamento já com a produtividade usada."""
    if especifico and especifico.indice_un_dia > 0:
        oficial = jornada / especifico.indice_un_dia
        out = {especifico.funcao_governa: oficial}
        if especifico.ajudante and especifico.ajudantes_por_oficial:
            out[especifico.ajudante] = especifico.ajudantes_por_oficial * oficial
        return out
    out: dict[str, float] = {}
    for r in recursos:
        out[r.recurso] = out.get(r.recurso, 0.0) + r.coef_por_unidade * fator
    return out


def hh_por_unidade_mod(recursos: list[RecursoCpu], coefs: dict[str, float]) -> float:
    tipos = {r.recurso: r.tipo for r in recursos}
    return round(sum(v for k, v in coefs.items() if tipos.get(k, "MOD") == "MOD"), 6)


def recurso_que_governa(recursos: list[RecursoCpu]) -> RecursoCpu | None:
    """A função que dita o ritmo: o oficial de maior coeficiente (servente, ajudante e encarregado são apoio);
    sem oficial, o maior MOD; sem MOD, o maior equipamento."""
    mod = [r for r in recursos if r.tipo == "MOD" and r.coef_por_unidade > 0]
    oficiais = [r for r in mod if not eh_apoio(r.recurso)]
    pool = oficiais or mod or [r for r in recursos if r.coef_por_unidade > 0]
    return max(pool, key=lambda r: r.coef_por_unidade) if pool else None


def hh_por_unidade_especifico(ind: IndiceEspecifico, jornada: float) -> float:
    if ind.indice_un_dia <= 0:
        raise DomainError("índice específico deve ser positivo")
    oficial = jornada / ind.indice_un_dia
    return round(oficial * (1 + (ind.ajudantes_por_oficial or 0)), 6)
