"""Configuração via ambiente (sem dependências externas para facilitar testes)."""
from __future__ import annotations
import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    jwt_secret: str = os.getenv("JWT_SECRET", "dev-insecure-change-me")
    access_ttl_min: int = int(os.getenv("JWT_ACCESS_TTL_MIN", "15"))
    refresh_ttl_days: int = int(os.getenv("JWT_REFRESH_TTL_DAYS", "7"))
    default_locale: str = os.getenv("DEFAULT_LOCALE", "pt-BR")
    email_verify_ttl_h: int = 24
    password_reset_ttl_h: int = 1
    cors_origins: tuple[str, ...] = tuple(
        p.strip() for p in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if p.strip())
    cookie_secure: bool = os.getenv("COOKIE_SECURE", "0") == "1"
    cookie_samesite: str = os.getenv("COOKIE_SAMESITE", "lax")
    hsts: bool = os.getenv("HSTS", "0") == "1"


settings = Settings()
