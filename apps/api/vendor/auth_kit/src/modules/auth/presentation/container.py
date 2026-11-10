"""Composição dos casos de uso. Sem DATABASE_URL usa memória; com URL usa SQL + Argon2."""
from __future__ import annotations
import os
from dataclasses import dataclass
from shared.settings import settings
from ..application.providers import TokenProvider, RateLimiter, HashProvider, MailProvider
from ..application.repositories import UserRepository, SessionRepository
from ..application.use_cases.register_user import RegisterUser
from ..application.use_cases.verify_email import VerifyEmail
from ..application.use_cases.login import Login
from ..application.use_cases.refresh_token import RefreshToken
from ..application.use_cases.password import (
    ResendVerification, RequestPasswordReset, ResetPassword, ChangePassword, Logout, LogoutAll)
from ..application.use_cases.mfa import EnableMfa, ConfirmMfa, DisableMfa
from ..infra.memory import (
    InMemoryUsers, InMemoryCredentials, InMemorySessions, InMemoryTokens, InMemoryMfa)
from ..infra.providers_std import Pbkdf2Hash, JwtHs256, ConsoleMail, SecretsRandom, InMemoryRateLimiter
from ..infra.totp_std import StdTotp
from ..infra.cipher_aes import AesGcmCipher, load_mfa_key


@dataclass
class AuthApp:
    users: UserRepository
    sessions: SessionRepository
    mailer: MailProvider
    jwt: TokenProvider
    limiter: RateLimiter
    register: RegisterUser
    verify: VerifyEmail
    resend: ResendVerification
    login: Login
    refresh: RefreshToken
    logout: Logout
    logout_all: LogoutAll
    forgot: RequestPasswordReset
    reset: ResetPassword
    change: ChangePassword
    enable_mfa: EnableMfa
    confirm_mfa: ConfirmMfa
    disable_mfa: DisableMfa
    login_limit: int = 10
    register_limit: int = 5


def _mailer() -> MailProvider:
    if os.getenv("MAIL_PROVIDER", "console") == "smtp" and os.getenv("SMTP_HOST"):
        from ..infra.smtp_mail import SmtpMail
        return SmtpMail(
            os.environ["SMTP_HOST"], int(os.getenv("SMTP_PORT", "587")),
            os.getenv("SMTP_USER", ""), os.getenv("SMTP_PASS", ""),
            os.getenv("MAIL_FROM", "nao-responder@financas.app"))
    return ConsoleMail()


def _assemble(users, creds, sessions, tokens, mfa, hasher: HashProvider,
              mailer: MailProvider, limiter: RateLimiter) -> AuthApp:
    from ..infra.hibp import checker_from_env
    rng = SecretsRandom()
    jwt = JwtHs256(settings.jwt_secret, access_ttl_s=settings.access_ttl_min * 60)
    totp, cipher, breaches = StdTotp(), AesGcmCipher(load_mfa_key()), checker_from_env()
    return AuthApp(
        users=users, sessions=sessions, mailer=mailer, jwt=jwt, limiter=limiter,
        register=RegisterUser(users, creds, tokens, hasher, mailer, rng, breaches),
        verify=VerifyEmail(users, tokens),
        resend=ResendVerification(users, tokens, mailer, rng),
        login=Login(users, creds, sessions, hasher, jwt, rng, mfa, totp, cipher, mailer),
        refresh=RefreshToken(sessions, users, jwt, rng),
        logout=Logout(sessions),
        logout_all=LogoutAll(sessions),
        forgot=RequestPasswordReset(users, tokens, mailer, rng),
        reset=ResetPassword(users, creds, tokens, sessions, hasher, mailer, breaches),
        change=ChangePassword(users, creds, sessions, hasher, mailer, breaches),
        enable_mfa=EnableMfa(users, mfa, totp, hasher, rng, cipher),
        confirm_mfa=ConfirmMfa(users, mfa, totp, cipher, mailer),
        disable_mfa=DisableMfa(users, creds, mfa, hasher, mailer),
    )


def build_auth() -> AuthApp:
    url = os.getenv("DATABASE_URL", "").strip()
    if not url:
        return _assemble(
            InMemoryUsers(), InMemoryCredentials(), InMemorySessions(), InMemoryTokens(), InMemoryMfa(),
            Pbkdf2Hash(), ConsoleMail(), InMemoryRateLimiter())
    from ..infra.db import Db, make_session_factory
    from ..infra.sql_repos import SqlUsers, SqlCredentials, SqlSessions, SqlTokens, SqlMfa
    from ..infra.argon2_hash import Argon2Hash
    from ..infra.rate_limit_db import DbRateLimiter
    db = Db(make_session_factory(url))
    return _assemble(
        SqlUsers(db), SqlCredentials(db), SqlSessions(db), SqlTokens(db), SqlMfa(db),
        Argon2Hash(), _mailer(), DbRateLimiter(db))
