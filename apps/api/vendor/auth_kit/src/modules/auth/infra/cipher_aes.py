"""AES-256-GCM para o segredo TOTP. A chave vem de MFA_CIPHER_KEY (32 bytes, base64)."""
from __future__ import annotations
import base64, hashlib, os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from ..application.providers import CipherProvider


def load_mfa_key() -> bytes:
    raw = os.getenv("MFA_CIPHER_KEY", "").strip()
    if raw:
        key = base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4))
        if len(key) != 32:
            raise ValueError("MFA_CIPHER_KEY must decode to 32 bytes")
        return key
    # ponytail: sem MFA_CIPHER_KEY, deriva do JWT_SECRET. Em produção defina a chave
    # (32 bytes) ou um KMS — se o JWT_SECRET vazar, o segredo TOTP vaza junto.
    secret = os.getenv("JWT_SECRET", "dev-insecure-change-me").encode()
    return hashlib.sha256(b"minhas-financas/mfa-v1|" + secret).digest()


class AesGcmCipher(CipherProvider):
    def __init__(self, key: bytes):
        if len(key) != 32:
            raise ValueError("AES-256 key must be 32 bytes")
        self._aes = AESGCM(key)

    def encrypt(self, plain: str) -> str:
        nonce = os.urandom(12)
        ct = self._aes.encrypt(nonce, plain.encode(), b"mfa")
        return "v1." + _b64(nonce) + "." + _b64(ct)

    def decrypt(self, token: str) -> str:
        version, nonce_b, ct_b = token.split(".")
        if version != "v1":
            raise ValueError("unknown cipher version")
        return self._aes.decrypt(_b64d(nonce_b), _b64d(ct_b), b"mfa").decode()


def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _b64d(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))
