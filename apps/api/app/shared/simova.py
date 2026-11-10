"""Normalização dos valores vindos das planilhas do Simova.

O Simova mistura int/str nas colunas de código ("28" e 28), usa ';' para listas
e '1'/1/None para flags. Toda leitura passa por aqui.
"""
from datetime import date, datetime


def codigo(v: object) -> str | None:
    if v is None:
        return None
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    s = str(v).strip()
    return s or None


def lista(v: object) -> list[str]:
    s = codigo(v)
    return [p.strip() for p in s.split(";") if p.strip()] if s else []


def flag(v: object) -> bool:
    return codigo(v) == "1"


def numero(v: object) -> float | None:
    s = codigo(v)
    if s is None:
        return None
    return float(s.replace(",", "."))


def data_br(v: object) -> date | None:
    if v is None or v == "":
        return None
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    return datetime.strptime(str(v).strip(), "%d/%m/%Y").date()


def fmt_data_br(d: date) -> str:
    return d.strftime("%d/%m/%Y")
