"""Cifra dos tokens dos provedores no banco (Fernet). Chave: ARMAZENAMENTO_CHAVE, ou derivada do JWT_SECRET.
Trocar a chave invalida as conexões (é só conectar de novo); o token nunca sai da API nem aparece na tela."""
import base64
import os

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from app.core.config import get_settings


def _fernet() -> Fernet:
    base = get_settings().armazenamento_chave or os.getenv("JWT_SECRET", "")
    if len(base) < 16:
        raise RuntimeError("defina ARMAZENAMENTO_CHAVE (ou JWT_SECRET) para guardar as conexões de nuvem")
    chave = HKDF(algorithm=hashes.SHA256(), length=32, salt=b"malhet-armazenamento", info=b"tokens").derive(base.encode())
    return Fernet(base64.urlsafe_b64encode(chave))


def cifrar(texto: str) -> str:
    return _fernet().encrypt(texto.encode()).decode()


def decifrar(cifrado: str) -> str | None:
    try:
        return _fernet().decrypt(cifrado.encode()).decode()
    except (InvalidToken, ValueError):
        return None
