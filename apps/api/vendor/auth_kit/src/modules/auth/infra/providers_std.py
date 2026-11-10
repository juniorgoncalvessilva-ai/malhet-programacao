"""Providers usando só a stdlib (dev/testes). Produção: trocar por Argon2/jose/pyotp."""
from __future__ import annotations
import base64, hashlib, hmac, json, os, secrets, time
from ..application.providers import HashProvider, TokenProvider, MailProvider, RateLimiter, Random


def _b64u(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _b64u_dec(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


class Pbkdf2Hash(HashProvider):
    def __init__(self, iterations: int = 120_000):
        self.iterations = iterations
    def hash(self, plain: str) -> str:
        salt = os.urandom(16)
        dk = hashlib.pbkdf2_hmac("sha256", plain.encode(), salt, self.iterations)
        return f"pbkdf2${self.iterations}${_b64u(salt)}${_b64u(dk)}"
    def verify(self, plain: str, hashed: str) -> bool:
        try:
            _, it, salt_b, dk_b = hashed.split("$")
            dk = hashlib.pbkdf2_hmac("sha256", plain.encode(), _b64u_dec(salt_b), int(it))
            return hmac.compare_digest(dk, _b64u_dec(dk_b))
        except Exception:
            return False


class JwtHs256(TokenProvider):
    def __init__(self, secret: str, access_ttl_s: int = 900):
        self.secret = secret.encode(); self.ttl = access_ttl_s
    def issue_access(self, *, subject: str, roles: list[str]) -> str:
        now = int(time.time())
        header = {"alg": "HS256", "typ": "JWT"}
        payload = {"sub": subject, "roles": roles, "iat": now, "exp": now + self.ttl}
        si = _b64u(json.dumps(header, separators=(",", ":")).encode()) + "." + \
             _b64u(json.dumps(payload, separators=(",", ":")).encode())
        sig = hmac.new(self.secret, si.encode(), hashlib.sha256).digest()
        return si + "." + _b64u(sig)
    def verify_access(self, token: str) -> dict | None:
        try:
            si, sig = token.rsplit(".", 1)
            expected = hmac.new(self.secret, si.encode(), hashlib.sha256).digest()
            if not hmac.compare_digest(_b64u_dec(sig), expected):
                return None
            payload = json.loads(_b64u_dec(si.split(".", 1)[1]))
            if payload.get("exp", 0) < int(time.time()):
                return None
            return payload
        except Exception:
            return None
    def new_refresh(self) -> str:
        return secrets.token_urlsafe(32)


class ConsoleMail(MailProvider):
    def __init__(self): self.sent: list[dict] = []
    async def send(self, *, to: str, subject: str, body: str, locale: str) -> None:
        self.sent.append({"to": to, "subject": subject, "body": body, "locale": locale})
        print(f"[MAIL:{locale}] to={to} | {subject} | {body}")


class SecretsRandom(Random):
    def token(self, n_bytes: int = 32) -> str:
        return secrets.token_urlsafe(n_bytes)


class InMemoryRateLimiter(RateLimiter):
    def __init__(self): self._hits: dict[str, list[float]] = {}
    async def hit(self, key: str, *, limit: int, window_s: int) -> bool:
        now = time.time()
        xs = [t for t in self._hits.get(key, []) if now - t < window_s]
        xs.append(now); self._hits[key] = xs
        return len(xs) <= limit
