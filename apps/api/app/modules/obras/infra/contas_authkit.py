"""ContasGateway sobre o auth-kit: o super admin cria contas já verificadas com senha inicial."""
import app.core.authkit  # noqa: F401
from modules.auth.application.dto import RegisterInput
from shared.i18n import t

from app.modules.obras.domain.ports import Conta
from app.shared.errors import DomainError


class ContasAuthKit:
    def __init__(self, auth):  # auth = app.state.auth (AuthApp do kit)
        self.auth = auth

    @staticmethod
    def _conta(u) -> Conta:
        return Conta(id=str(u.id), email=str(u.email), verificada=u.email_verified_at is not None, roles=tuple(u.roles))

    async def por_email(self, email: str) -> Conta | None:
        u = await self.auth.users.by_email(email.strip().lower())
        return self._conta(u) if u else None

    async def criar_verificada(self, email: str, senha: str, roles: tuple[str, ...] = ("user",)) -> Conta:
        r = await self.auth.register.execute(RegisterInput(email.strip().lower(), senha, "pt-BR"))
        if r.failed:
            raise DomainError("; ".join(t(e.key, "pt-BR", **(e.params or {})) for e in r.errors), "senha_inicial")
        u = await self.auth.users.by_email(email.strip().lower())
        if u is None:
            raise DomainError("não foi possível criar a conta", "email")
        if u.email_verified_at is None:
            u = u.verify_email()
        u = u.with_(roles=roles)
        await self.auth.users.save(u)
        return self._conta(u)

    async def definir_roles(self, conta_id: str, roles: tuple[str, ...]) -> None:
        u = await self.auth.users.by_id(conta_id)
        if u is None:
            raise DomainError("conta não encontrada")
        await self.auth.users.save(u.with_(roles=roles))
