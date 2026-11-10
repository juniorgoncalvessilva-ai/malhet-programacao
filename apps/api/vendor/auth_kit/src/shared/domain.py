"""Bases de domínio: ValueObject imutável e Entity rica (valida a si mesma)."""
from __future__ import annotations
import uuid
from dataclasses import dataclass, replace
from datetime import datetime, timezone


def new_id() -> str:
    return str(uuid.uuid4())


def now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass(frozen=True)
class ValueObject:
    """Imutável por definição (frozen). Igualdade por valor."""


@dataclass(frozen=True)
class Entity:
    """Entidade imutável: alterações retornam um clone via `with_`."""
    id: str

    def with_(self, **changes):  # -> Self
        return replace(self, **changes)
