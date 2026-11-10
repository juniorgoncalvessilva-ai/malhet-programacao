"""Códigos de backup: texto só na entrega; o que persiste é hash(pepper + código)."""
from __future__ import annotations
import hashlib, os, secrets


def new_backup_codes(n: int = 8) -> list[str]:
    return [f"{secrets.token_hex(2).upper()}-{secrets.token_hex(2).upper()}" for _ in range(n)]


def normalize_backup(code: str) -> str:
    return "".join(ch for ch in (code or "") if ch.isalnum()).upper()


def backup_pepper() -> str:
    raw = os.getenv("MFA_BACKUP_PEPPER", "").strip()
    if raw:
        return raw
    # ponytail: sem MFA_BACKUP_PEPPER, deriva do JWT_SECRET. Em produção defina o pepper.
    # Se o JWT_SECRET vazar, os hashes dos códigos de backup vazam junto.
    secret = os.getenv("JWT_SECRET", "dev-insecure-change-me").encode()
    return hashlib.sha256(b"minhas-financas/backup-v1|" + secret).hexdigest()


def peppered_backup(code: str) -> str:
    return backup_pepper() + ":" + normalize_backup(code)
