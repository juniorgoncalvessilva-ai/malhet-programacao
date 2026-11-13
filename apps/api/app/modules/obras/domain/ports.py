from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class Conta:
    id: str
    email: str
    verificada: bool
    roles: tuple[str, ...]


class ContasGateway(Protocol):
    """Contas de usuário (implementação: auth-kit)."""

    async def por_email(self, email: str) -> Conta | None: ...
    async def criar_verificada(self, email: str, senha: str, roles: tuple[str, ...] = ("user",)) -> Conta: ...
    async def definir_roles(self, conta_id: str, roles: tuple[str, ...]) -> None: ...
    async def redefinir_senha(self, conta_id: str, senha: str) -> None: ...
