"""Interfaces de infraestrutura (a implementação NÃO contamina o domínio)."""
from __future__ import annotations
from abc import ABC, abstractmethod
from datetime import datetime


class HashProvider(ABC):
    @abstractmethod
    def hash(self, plain: str) -> str: ...
    @abstractmethod
    def verify(self, plain: str, hashed: str) -> bool: ...
    def needs_rehash(self, hashed: str) -> bool:
        return False


class TokenProvider(ABC):
    @abstractmethod
    def issue_access(self, *, subject: str, roles: list[str]) -> str: ...
    @abstractmethod
    def verify_access(self, token: str) -> dict | None: ...
    @abstractmethod
    def new_refresh(self) -> str: ...            # valor opaco (guarda-se o hash)


class MailProvider(ABC):
    @abstractmethod
    async def send(self, *, to: str, subject: str, body: str, locale: str) -> None: ...


class TotpProvider(ABC):
    @abstractmethod
    def new_secret(self) -> str: ...
    @abstractmethod
    def provisioning_uri(self, *, secret: str, account: str, issuer: str) -> str: ...
    @abstractmethod
    def verify(self, *, secret: str, code: str) -> bool: ...


class RateLimiter(ABC):
    @abstractmethod
    async def hit(self, key: str, *, limit: int, window_s: int) -> bool:
        """Retorna True se permitido; False se estourou o limite."""


class Clock(ABC):
    @abstractmethod
    def now(self) -> datetime: ...


class Random(ABC):
    @abstractmethod
    def token(self, n_bytes: int = 32) -> str: ...


class CipherProvider(ABC):
    """Cifra o segredo TOTP em repouso (AES-256-GCM). O domínio nunca vê a chave."""
    @abstractmethod
    def encrypt(self, plain: str) -> str: ...
    @abstractmethod
    def decrypt(self, token: str) -> str: ...


class BreachChecker(ABC):
    """True se a senha apareceu em vazamento (HIBP k-anonimato)."""
    @abstractmethod
    def breached(self, password: str) -> bool: ...


class NeverBreached(BreachChecker):
    def breached(self, password: str) -> bool:
        return False
