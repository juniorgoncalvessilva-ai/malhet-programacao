"""Registrar atividade fora da programação (spec 119): a foto da frente precisa de onde (CWA) e do quê (IWP da WBS, item
da PQ ou só o texto). O texto de quem registrou é obrigatório — é ele que diz o que foi feito."""
from datetime import date, timedelta

from app.shared.errors import DomainError

DIAS_PARA_TRAS = 31


def validar_registro(descricao: str | None, dia: date, hoje: date) -> str:
    texto = " ".join((descricao or "").split())
    if len(texto) < 3:
        raise DomainError("descreva a atividade feita", "descricao")
    if dia > hoje:
        raise DomainError("a data não pode ser futura", "data")
    if dia < hoje - timedelta(days=DIAS_PARA_TRAS):
        raise DomainError(f"registre atividades de até {DIAS_PARA_TRAS} dias atrás", "data")
    return texto[:500]
