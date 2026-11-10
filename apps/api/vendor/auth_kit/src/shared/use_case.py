"""Contrato de caso de uso (application). Comando -> Result."""
from __future__ import annotations
from abc import ABC, abstractmethod
from typing import Generic, TypeVar
from .result import Result

I = TypeVar("I")
O = TypeVar("O")


class UseCase(ABC, Generic[I, O]):
    @abstractmethod
    async def execute(self, data: I) -> Result[O]:
        ...
