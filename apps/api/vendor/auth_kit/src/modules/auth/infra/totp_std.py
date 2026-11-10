"""TOTP (RFC 6238) com a stdlib. O segredo entra em claro aqui; quem persiste
cifra antes (CipherProvider / AES-GCM). Produção pode trocar por pyotp."""
from __future__ import annotations
import base64, hashlib, hmac, secrets, time
from urllib.parse import quote, urlencode
from ..application.providers import TotpProvider

_ALPH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
_STEP = 30
_DIGITS = 6
_WINDOW = 1


def _b32(raw: bytes) -> str:
    return base64.b32encode(raw).decode().rstrip("=")


def _unb32(s: str) -> bytes:
    s = s.upper().replace(" ", "")
    return base64.b32decode(s + "=" * (-len(s) % 8))


def _hotp(key: bytes, counter: int) -> str:
    msg = counter.to_bytes(8, "big")
    dig = hmac.new(key, msg, hashlib.sha1).digest()
    off = dig[-1] & 0x0F
    bin_code = ((dig[off] & 0x7F) << 24) | (dig[off + 1] << 16) | (dig[off + 2] << 8) | dig[off + 3]
    return str(bin_code % (10 ** _DIGITS)).zfill(_DIGITS)


class StdTotp(TotpProvider):
    def new_secret(self) -> str:
        return _b32(secrets.token_bytes(20))

    def provisioning_uri(self, *, secret: str, account: str, issuer: str) -> str:
        label = quote(f"{issuer}:{account}")
        q = urlencode({"secret": secret, "issuer": issuer, "digits": _DIGITS, "period": _STEP})
        return f"otpauth://totp/{label}?{q}"

    def verify(self, *, secret: str, code: str) -> bool:
        code = "".join(ch for ch in (code or "") if ch.isdigit())
        if len(code) != _DIGITS:
            return False
        key = _unb32(secret)
        counter = int(time.time() // _STEP)
        return any(hmac.compare_digest(_hotp(key, counter + i), code)
                   for i in range(-_WINDOW, _WINDOW + 1))


def code_now(secret: str, at_s: float | None = None) -> str:
    """Código TOTP atual (para exibir/entregar e para testes)."""
    key = _unb32(secret)
    counter = int((at_s if at_s is not None else time.time()) // _STEP)
    return _hotp(key, counter)
