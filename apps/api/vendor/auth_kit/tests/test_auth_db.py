"""Auth no SQLite via Alembic: cadastro, rehash pbkdf2→Argon2, refresh e rate-limit na tabela."""
from __future__ import annotations
import asyncio, os, sys, pathlib, tempfile
from pathlib import Path

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "src"))

from alembic import command
from alembic.config import Config
from sqlalchemy.orm import sessionmaker

from modules.auth.application.dto import RegisterInput, VerifyEmailInput, LoginInput, RefreshInput
from modules.auth.application.use_cases.register_user import RegisterUser
from modules.auth.application.use_cases.verify_email import VerifyEmail
from modules.auth.application.use_cases.login import Login
from modules.auth.application.use_cases.refresh_token import RefreshToken
from modules.auth.infra.argon2_hash import Argon2Hash
from modules.auth.infra.cipher_aes import AesGcmCipher
from modules.auth.infra.db import Db
from modules.auth.infra.providers_std import Pbkdf2Hash, JwtHs256, ConsoleMail, SecretsRandom
from modules.auth.infra.rate_limit_db import DbRateLimiter
from modules.auth.infra.sql_repos import SqlUsers, SqlCredentials, SqlSessions, SqlTokens, SqlMfa
from modules.auth.infra.totp_std import StdTotp
from modules.auth.domain.entities import Credential
from shared.domain import now


def _upgrade(url: str) -> None:
    backend = Path(__file__).resolve().parents[1]
    cfg = Config(str(backend / "alembic.ini"))
    cfg.set_main_option("script_location", str(backend / "alembic"))
    cfg.set_main_option("sqlalchemy.url", url)
    command.upgrade(cfg, "head")


async def main() -> None:
    path = Path(tempfile.mkdtemp()) / "auth.db"
    url = "sqlite:///" + path.as_posix()
    os.environ.pop("DATABASE_URL", None)
    _upgrade(url)

    from sqlalchemy import create_engine
    factory = sessionmaker(bind=create_engine(url, connect_args={"check_same_thread": False}))
    db = Db(factory)
    users, creds, sessions = SqlUsers(db), SqlCredentials(db), SqlSessions(db)
    tokens, mfa = SqlTokens(db), SqlMfa(db)
    hasher = Argon2Hash(time_cost=1, memory_cost=8192)
    mailer, rng, jwt = ConsoleMail(), SecretsRandom(), JwtHs256("s")
    register = RegisterUser(users, creds, tokens, hasher, mailer, rng)
    verify = VerifyEmail(users, tokens)
    login = Login(users, creds, sessions, hasher, jwt, rng, mfa, StdTotp(), AesGcmCipher(os.urandom(32)))
    refresh = RefreshToken(sessions, users, jwt, rng)

    created = await register.execute(RegisterInput("bia@exemplo.com", "SenhaForte123", "pt-BR"))
    assert created.ok, created.errors
    assert (await verify.execute(VerifyEmailInput(created.value.verification_token))).ok
    first = await login.execute(LoginInput("bia@exemplo.com", "SenhaForte123"))
    assert first.ok and first.value.access_token
    stored = (await creds.by_user(created.value.user_id)).password_hash
    assert stored.startswith("$argon2")

    await creds.save(Credential(
        id=created.value.user_id, user_id=created.value.user_id,
        password_hash=Pbkdf2Hash(iterations=10_000).hash("SenhaForte123"),
        algo="pbkdf2", updated_at=now()))
    again = await login.execute(LoginInput("bia@exemplo.com", "SenhaForte123"))
    assert again.ok, again.errors
    upgraded = (await creds.by_user(created.value.user_id)).password_hash
    assert upgraded.startswith("$argon2") and upgraded != stored

    old = first.value.refresh_token
    rotated = await refresh.execute(RefreshInput(old))
    assert rotated.ok and rotated.value.refresh_token != old
    assert (await refresh.execute(RefreshInput(old))).failed
    assert (await refresh.execute(RefreshInput(rotated.value.refresh_token))).failed

    low = Argon2Hash(time_cost=1, memory_cost=8192)
    high = Argon2Hash(time_cost=2, memory_cost=8192)
    sample = low.hash("SenhaForte123")
    assert high.verify("SenhaForte123", sample) and high.needs_rehash(sample)

    a, b = DbRateLimiter(db), DbRateLimiter(db)
    assert await a.hit("login:ip:test", limit=2, window_s=60)
    assert await b.hit("login:ip:test", limit=2, window_s=60)
    assert not await a.hit("login:ip:test", limit=2, window_s=60)
    print("DB OK (alembic sqlite + argon2 rehash + refresh + rate-limit compartilhado)")


if __name__ == "__main__":
    asyncio.run(main())
