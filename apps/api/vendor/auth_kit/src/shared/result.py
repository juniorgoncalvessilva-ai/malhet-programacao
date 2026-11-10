"""Padrão Result — erros como valor, sem exceptions para regra de negócio."""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Generic, TypeVar

T = TypeVar("T")


@dataclass(frozen=True)
class Error:
    key: str                       # chave i18n (ex.: "login.invalid")
    params: dict[str, object] = field(default_factory=dict)
    field_name: str | None = None  # para erros de validação de campo


@dataclass(frozen=True)
class Result(Generic[T]):
    ok: bool
    value: T | None = None
    errors: tuple[Error, ...] = ()

    @staticmethod
    def success(value: T | None = None) -> "Result[T]":
        return Result(ok=True, value=value)

    @staticmethod
    def fail(*errors: Error) -> "Result[T]":
        return Result(ok=False, errors=tuple(errors))

    @property
    def failed(self) -> bool:
        return not self.ok


class ResultValidator:
    """Acumula erros de validação e vira um Result no final."""

    def __init__(self) -> None:
        self._errors: list[Error] = []

    def check(self, condition: bool, key: str, *, field_name: str | None = None, **params: object) -> "ResultValidator":
        if not condition:
            self._errors.append(Error(key=key, params=params, field_name=field_name))
        return self

    @property
    def valid(self) -> bool:
        return not self._errors

    def to_result(self, value: T | None = None) -> Result[T]:
        return Result.success(value) if self.valid else Result.fail(*self._errors)
