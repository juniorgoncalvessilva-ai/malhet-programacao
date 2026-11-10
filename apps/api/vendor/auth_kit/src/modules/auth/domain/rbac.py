"""Papéis e permissões. A rota revalida isto no usuário persistido, não só no JWT."""
from __future__ import annotations
from enum import Enum
from shared.result import Result, Error


class Permission(str, Enum):
    ME = "auth.me"
    SESSIONS_READ = "auth.sessions.read"
    SESSIONS_REVOKE = "auth.sessions.revoke"
    PASSWORD_CHANGE = "auth.password.change"
    MFA_MANAGE = "auth.mfa.manage"
    USERS_ADMIN = "admin.users"
    # Programação de Obra (Malhet) — adicionado ao copiar o kit
    OBRA_USAR = "obra.usar"  # consultar, programar, aprovar
    OBRA_ADMINISTRAR = "obra.administrar"  # carregar versões, importar cadastros, exportar ao Simova


_USER = frozenset({
    Permission.ME, Permission.SESSIONS_READ, Permission.SESSIONS_REVOKE,
    Permission.PASSWORD_CHANGE, Permission.MFA_MANAGE, Permission.OBRA_USAR,
})
_ADMIN = _USER | frozenset({Permission.USERS_ADMIN, Permission.OBRA_ADMINISTRAR})

GRANTS: dict[str, frozenset[Permission]] = {"user": _USER, "admin": _ADMIN}


def granted(roles: tuple[str, ...] | list[str]) -> frozenset[Permission]:
    out: set[Permission] = set()
    for role in roles:
        out |= GRANTS.get(role, frozenset())
    return frozenset(out)


def authorize(roles: tuple[str, ...] | list[str], permission: Permission) -> Result[None]:
    if permission in granted(roles):
        return Result.success(None)
    return Result.fail(Error("auth.forbidden"))
