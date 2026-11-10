"""Tabelas do auth. A migration chama create_all nesta metadata — uma fonte só."""
from __future__ import annotations
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Index, String, Text, Boolean
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class UserRow(Base):
    __tablename__ = "auth_users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(16))
    roles: Mapped[str] = mapped_column(Text)
    locale: Mapped[str] = mapped_column(String(16))
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class CredentialRow(Base):
    __tablename__ = "auth_credentials"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("auth_users.id"), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(Text)
    algo: Mapped[str] = mapped_column(String(32))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class SessionRow(Base):
    __tablename__ = "auth_sessions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("auth_users.id"), index=True)
    refresh_hash: Mapped[str] = mapped_column(String(64), index=True)
    family_id: Mapped[str] = mapped_column(String(36), index=True)
    device: Mapped[str | None] = mapped_column(Text)
    ip: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class TokenRow(Base):
    __tablename__ = "auth_tokens"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("auth_users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), index=True)
    purpose: Mapped[str] = mapped_column(String(32))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class MfaRow(Base):
    __tablename__ = "auth_mfa"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("auth_users.id"), unique=True, index=True)
    secret_encrypted: Mapped[str] = mapped_column(Text)
    backup_codes_hash: Mapped[str] = mapped_column(Text)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class RateHitRow(Base):
    __tablename__ = "auth_rate_hits"
    __table_args__ = (Index("ix_auth_rate_key_at", "bucket", "at"),)
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    bucket: Mapped[str] = mapped_column(String(200))
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
