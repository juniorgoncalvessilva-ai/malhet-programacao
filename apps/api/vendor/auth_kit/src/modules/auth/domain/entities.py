"""Entidades ricas do módulo auth (imutáveis; alteram via with_)."""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from shared.domain import Entity, new_id, now


class UserStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    BLOCKED = "blocked"


@dataclass(frozen=True)
class User(Entity):
    email: str
    status: UserStatus = UserStatus.PENDING
    roles: tuple[str, ...] = ("user",)
    locale: str = "pt-BR"
    email_verified_at: datetime | None = None
    mfa_enabled: bool = False
    created_at: datetime = field(default_factory=now)

    @staticmethod
    def register(email: str, locale: str = "pt-BR") -> "User":
        return User(id=new_id(), email=email, locale=locale)

    def verify_email(self) -> "User":
        if self.email_verified_at:
            return self
        return self.with_(email_verified_at=now(),
                          status=UserStatus.ACTIVE if self.status == UserStatus.PENDING else self.status)

    @property
    def is_verified(self) -> bool:
        return self.email_verified_at is not None

    def has_role(self, role: str) -> bool:
        return role in self.roles


@dataclass(frozen=True)
class Credential(Entity):
    user_id: str
    password_hash: str
    algo: str = "argon2id"
    updated_at: datetime = field(default_factory=now)


@dataclass(frozen=True)
class Session(Entity):
    user_id: str
    refresh_hash: str
    family_id: str
    device: str | None = None
    ip: str | None = None
    created_at: datetime = field(default_factory=now)
    expires_at: datetime | None = None
    revoked_at: datetime | None = None

    @property
    def active(self) -> bool:
        return self.revoked_at is None and (self.expires_at is None or self.expires_at > now())

    def revoke(self) -> "Session":
        return self.with_(revoked_at=now())


@dataclass(frozen=True)
class OneTimeToken(Entity):
    """Token de uso único (verificação de e-mail / reset de senha). Guardar só o HASH."""
    user_id: str
    token_hash: str
    purpose: str  # "email_verify" | "password_reset"
    expires_at: datetime
    used_at: datetime | None = None

    @property
    def valid(self) -> bool:
        return self.used_at is None and self.expires_at > now()

    def consume(self) -> "OneTimeToken":
        return self.with_(used_at=now())


@dataclass(frozen=True)
class MfaSecret(Entity):
    user_id: str
    secret_encrypted: str
    backup_codes_hash: tuple[str, ...] = ()
    confirmed_at: datetime | None = None
