"""Argon2id. Verifica hash antigo pbkdf2 e pede rehash no login."""
from __future__ import annotations
import os
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from ..application.providers import HashProvider
from .providers_std import Pbkdf2Hash


class Argon2Hash(HashProvider):
    def __init__(self, time_cost: int | None = None, memory_cost: int = 65536):
        cost = time_cost if time_cost is not None else int(os.getenv("ARGON2_TIME_COST", "3"))
        self._ph = PasswordHasher(time_cost=cost, memory_cost=memory_cost, parallelism=1)
        self._legacy = Pbkdf2Hash()

    def hash(self, plain: str) -> str:
        return self._ph.hash(plain)

    def verify(self, plain: str, hashed: str) -> bool:
        if (hashed or "").startswith("pbkdf2$"):
            return self._legacy.verify(plain, hashed)
        try:
            return self._ph.verify(hashed, plain)
        except (VerifyMismatchError, VerificationError, InvalidHashError):
            return False

    def needs_rehash(self, hashed: str) -> bool:
        if not (hashed or "").startswith("$argon2"):
            return True
        try:
            return self._ph.check_needs_rehash(hashed)
        except InvalidHashError:
            return True
