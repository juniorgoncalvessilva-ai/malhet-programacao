"""Sessão do portal do líder (spec 111): JWT curto, assinado com uma chave derivada do JWT_SECRET (separada da do
auth-kit), com a versão do acesso — trocar/redefinir a senha ou bloquear derruba as sessões abertas."""
import hashlib
import os
import secrets
import time

import jwt

from app.modules.lideres.domain.portal import HORAS_SESSAO
from app.shared.errors import DomainError


def _chave() -> bytes:
    return hashlib.sha256(b"malhet-portal-lider:" + os.getenv("JWT_SECRET", "dev").encode()).digest()


def emitir(acesso_id: int, obra_id: int, versao: int, trocar: bool) -> str:
    agora = int(time.time())
    return jwt.encode({"sub": str(acesso_id), "obra": obra_id, "v": versao, "trocar": trocar, "iat": agora,
                       "exp": agora + HORAS_SESSAO * 3600}, _chave(), algorithm="HS256")


def ler(token: str | None) -> dict:
    if not token:
        raise DomainError("entre de novo com a matrícula e a senha", "sessao")
    try:
        return jwt.decode(token, _chave(), algorithms=["HS256"])
    except jwt.PyJWTError as e:
        raise DomainError("sessão expirada: entre de novo com a matrícula e a senha", "sessao") from e


def novo_codigo() -> str:
    """Código do link da obra: 12 caracteres sem ambiguidade (não dá para adivinhar)."""
    alfabeto = "abcdefghjkmnpqrstuvwxyz23456789"
    return "".join(secrets.choice(alfabeto) for _ in range(12))
