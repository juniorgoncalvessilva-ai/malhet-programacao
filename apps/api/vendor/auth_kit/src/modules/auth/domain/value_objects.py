"""Objetos de valor do módulo auth. A regra mora aqui primeiro."""
from __future__ import annotations
import re
from dataclasses import dataclass
from shared.domain import ValueObject
from shared.result import Result, Error

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@dataclass(frozen=True)
class Email(ValueObject):
    value: str

    @staticmethod
    def create(raw: str) -> Result["Email"]:
        norm = (raw or "").strip().lower()
        if not _EMAIL_RE.match(norm):
            return Result.fail(Error("validation.email.invalid", field_name="email"))
        return Result.success(Email(norm))


@dataclass(frozen=True)
class Password(ValueObject):
    """Representa uma senha em texto puro APENAS em trânsito (para hashear).
    Nunca é persistida: o que persiste é o hash (ver Credential)."""
    _raw: str

    @staticmethod
    def create(raw: str) -> Result["Password"]:
        raw = raw or ""
        strong = len(raw) >= 10 and re.search(r"[A-Za-z]", raw) and re.search(r"\d", raw)
        if not strong:
            return Result.fail(Error("validation.password.tooWeak", field_name="password"))
        return Result.success(Password(raw))

    def reveal(self) -> str:
        return self._raw

    def __repr__(self) -> str:  # nunca vazar em log
        return "Password(***)"


@dataclass(frozen=True)
class Role(ValueObject):
    name: str  # ex.: "user", "admin"
