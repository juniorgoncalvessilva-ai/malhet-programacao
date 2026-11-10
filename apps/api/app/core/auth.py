"""Autenticação: valida o JWT emitido pelo Clerk (o front continua usando o Clerk do starter kit).

A infra de auth fica aqui, na borda; casos de uso recebem apenas `UsuarioAtual`.
"""
from dataclasses import dataclass
from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import Settings, get_settings

_bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class UsuarioAtual:
    id: str
    email: str | None = None


@lru_cache
def _jwks_client(url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(url)


def usuario_atual(
    cred: HTTPAuthorizationCredentials | None = Depends(_bearer),
    settings: Settings = Depends(get_settings),
) -> UsuarioAtual:
    if settings.auth_disabled:
        return UsuarioAtual(id="dev", email="dev@local")
    if cred is None or not settings.clerk_jwks_url:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Não autenticado")
    try:
        key = _jwks_client(settings.clerk_jwks_url).get_signing_key_from_jwt(cred.credentials)
        claims = jwt.decode(
            cred.credentials,
            key.key,
            algorithms=["RS256"],
            issuer=settings.clerk_issuer or None,
            options={"verify_aud": False},
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token inválido") from exc
    return UsuarioAtual(id=claims["sub"], email=claims.get("email"))
