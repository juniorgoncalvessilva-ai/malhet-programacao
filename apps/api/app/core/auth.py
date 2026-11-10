"""Autenticação (auth-kit) e autorização por obra.

- Conta: JWT do auth-kit; papel global `superadmin` (RBAC do kit) cria obras e dá acesso.
- Obra: cabeçalho `X-Obra-Id`; o papel do usuário na obra (acesso_obra) decide o que ele faz.
A infra de auth fica aqui, na borda; casos de uso recebem só ids.
"""
from collections.abc import Callable, Coroutine
from dataclasses import dataclass
from typing import Any

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

import app.core.authkit  # noqa: F401  (sys.path + .env do kit)
from app.core.config import get_settings
from app.core.db import get_session
from app.modules.obras.domain.obra import PapelObra
from app.modules.obras.infra.models import AcessoObraModel, ObraModel
from modules.auth.domain.rbac import Permission
from modules.auth.presentation.http import require_user


@dataclass(frozen=True)
class UsuarioAtual:
    id: str
    email: str | None = None
    superadmin: bool = False


@dataclass(frozen=True)
class ContextoObra:
    obra_id: int
    usuario: UsuarioAtual
    papel: PapelObra
    cracha: str | None = None


_DEV = UsuarioAtual(id="dev", email="dev@local", superadmin=True)


async def _exigir(request: Request, permissao: Permission) -> UsuarioAtual:
    if get_settings().auth_disabled:
        return _DEV
    user = await require_user(request, permissao)  # 401/403 no formato do kit
    return UsuarioAtual(id=str(user.id), email=str(user.email), superadmin="superadmin" in user.roles)


async def usuario_atual(request: Request) -> UsuarioAtual:
    """Qualquer usuário verificado (papéis user, admin, superadmin)."""
    return await _exigir(request, Permission.OBRA_USAR)


async def superadmin(request: Request) -> UsuarioAtual:
    """Gestão de obras e de acessos de qualquer obra."""
    return await _exigir(request, Permission.OBRAS_GERIR)


def _erro(status: int, msg: str) -> HTTPException:
    return HTTPException(status, detail={"ok": False, "message": msg, "detail": msg})


def resolver_contexto(s: Session, usuario: UsuarioAtual, obra_id: int, minimo: PapelObra) -> ContextoObra:
    obra = s.get(ObraModel, obra_id)
    if obra is None or not obra.ativa:
        raise _erro(404, "Obra não encontrada ou inativa")
    if usuario.superadmin:
        return ContextoObra(obra_id, usuario, PapelObra.ADMIN)
    acesso = s.scalar(select(AcessoObraModel).where(
        AcessoObraModel.obra_id == obra_id, AcessoObraModel.usuario_id == usuario.id))
    if acesso is None:
        raise _erro(403, "Você não tem acesso a esta obra")
    papel = PapelObra(acesso.papel)
    if not papel.pode(minimo):
        raise _erro(403, f"Seu papel nesta obra ({papel.value}) não permite esta ação")
    return ContextoObra(obra_id, usuario, papel, acesso.cracha)


def contexto_obra(minimo: PapelObra) -> Callable[..., Coroutine[Any, Any, ContextoObra]]:
    async def dep(request: Request, usuario: UsuarioAtual = Depends(usuario_atual),
                  s: Session = Depends(get_session)) -> ContextoObra:
        bruto = request.headers.get("x-obra-id", "")
        if not bruto.isdigit():
            raise _erro(400, "Escolha a obra (cabeçalho X-Obra-Id)")
        return resolver_contexto(s, usuario, int(bruto), minimo)

    return dep


# Atalhos por nível de papel na obra
ler = contexto_obra(PapelObra.LEITOR)
programar = contexto_obra(PapelObra.ENCARREGADO)
planejar = contexto_obra(PapelObra.PLANEJADOR)
administrar = contexto_obra(PapelObra.ADMIN)


async def ssma(ctx: ContextoObra = Depends(ler)) -> ContextoObra:
    """Itens de SSMA da programação: segurança, planejador e admin."""
    if not ctx.papel.edita_ssma:
        raise _erro(403, "Só a segurança (ou o planejamento) preenche o SSMA")
    return ctx
