"""Dia da obra: as obras estão no horário de Brasília. O servidor roda em UTC — entre 21h e meia-noite o `date.today()`
dele já é o dia seguinte. Telas que abrem em "hoje" usam `hoje_local()`."""
from datetime import date, datetime
from zoneinfo import ZoneInfo

FUSO_OBRA = ZoneInfo("America/Sao_Paulo")


def hoje_local() -> date:
    return datetime.now(FUSO_OBRA).date()
