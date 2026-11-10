"""Autenticação pelo auth-kit (JWT HS256 + refresh em cookie com CSRF, 2FA, RBAC).

A infra de auth fica aqui, na borda; casos de uso recebem apenas `UsuarioAtual`.
"""
from dataclasses import dataclass

from fastapi import Request

import app.core.authkit  # noqa: F401  (sys.path + .env do kit)
from app.core.config import get_settings
from modules.auth.domain.rbac import Permission
from modules.auth.presentation.http import require_user


@dataclass(frozen=True)
class UsuarioAtual:
    id: str
    email: str | None = None
    admin: bool = False


_DEV = UsuarioAtual(id="dev", email="dev@local", admin=True)


async def _exigir(request: Request, permissao: Permission) -> UsuarioAtual:
    if get_settings().auth_disabled:
        return _DEV
    user = await require_user(request, permissao)  # 401/403 no formato do kit
    return UsuarioAtual(id=str(user.id), email=str(user.email), admin="admin" in user.roles)


async def usuario_atual(request: Request) -> UsuarioAtual:
    """Qualquer usuário verificado com permissão obra.usar (papéis user e admin)."""
    return await _exigir(request, Permission.OBRA_USAR)


async def usuario_admin(request: Request) -> UsuarioAtual:
    """Cargas de referência, importações e exportação ao Simova (papel admin)."""
    return await _exigir(request, Permission.OBRA_ADMINISTRAR)
