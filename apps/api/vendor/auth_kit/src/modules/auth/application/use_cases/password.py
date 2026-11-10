from __future__ import annotations
import hashlib
from datetime import timedelta
from shared.result import Result, Error
from shared.domain import now
from shared.settings import settings
from ..dto import EmailInput, ResetPasswordInput, ChangePasswordInput, LogoutInput
from ..repositories import (UserRepository, CredentialRepository, TokenRepository, SessionRepository)
from ..providers import HashProvider, MailProvider, Random, BreachChecker, NeverBreached
from ..notify import notify
from ...domain.value_objects import Password
from ...domain.entities import OneTimeToken


def _sha(x: str) -> str:
    return hashlib.sha256(x.encode()).hexdigest()


class ResendVerification:
    def __init__(self, users: UserRepository, tokens: TokenRepository, mailer: MailProvider, rng: Random):
        self.users, self.tokens, self.mailer, self.rng = users, tokens, mailer, rng
    async def execute(self, data: EmailInput) -> Result[str]:
        user = await self.users.by_email((data.email or "").strip().lower())
        if user and not user.is_verified:
            raw = self.rng.token(32)
            await self.tokens.save(OneTimeToken(id=self.rng.token(8), user_id=user.id,
                token_hash=_sha(raw), purpose="email_verify",
                expires_at=now() + timedelta(hours=settings.email_verify_ttl_h)))
            await self.mailer.send(to=user.email, subject="Verifique seu e-mail",
                                   body="Token: " + raw, locale=user.locale)
        return Result.success("register.success")  # uniforme (anti-enumeração)


class RequestPasswordReset:
    def __init__(self, users: UserRepository, tokens: TokenRepository, mailer: MailProvider, rng: Random):
        self.users, self.tokens, self.mailer, self.rng = users, tokens, mailer, rng
    async def execute(self, data: EmailInput) -> Result[str]:
        user = await self.users.by_email((data.email or "").strip().lower())
        if user:
            raw = self.rng.token(32)
            await self.tokens.save(OneTimeToken(id=self.rng.token(8), user_id=user.id,
                token_hash=_sha(raw), purpose="password_reset",
                expires_at=now() + timedelta(hours=settings.password_reset_ttl_h)))
            await self.mailer.send(to=user.email, subject="Redefinição de senha",
                                   body="Token: " + raw, locale=user.locale)
        return Result.success("password.reset.requested")  # uniforme


class ResetPassword:
    def __init__(self, users: UserRepository, creds: CredentialRepository,
                 tokens: TokenRepository, sessions: SessionRepository, hasher: HashProvider,
                 mailer: MailProvider | None = None, breaches: BreachChecker | None = None):
        self.users, self.creds, self.tokens, self.sessions, self.hasher = users, creds, tokens, sessions, hasher
        self.mailer, self.breaches = mailer, breaches or NeverBreached()
    async def execute(self, data: ResetPasswordInput) -> Result[str]:
        pwd = Password.create(data.new_password)
        if pwd.failed:
            return Result.fail(*pwd.errors)
        if self.breaches.breached(pwd.value.reveal()):
            return Result.fail(Error("validation.password.breached", field_name="password"))
        ott = await self.tokens.find_valid(_sha(data.token or ""), "password_reset")
        if not ott:
            return Result.fail(Error("verify.invalid"))
        cred = await self.creds.by_user(ott.user_id)
        if not cred:
            return Result.fail(Error("verify.invalid"))
        await self.tokens.save(ott.consume())
        await self.creds.save(cred.with_(password_hash=self.hasher.hash(pwd.value.reveal()), updated_at=now()))
        await self.sessions.revoke_all_for_user(ott.user_id)  # invalida sessões
        user = await self.users.by_id(ott.user_id)
        if user:
            await notify(self.mailer, to=user.email, locale=user.locale, subject="Senha redefinida",
                         body="Sua senha foi redefinida. Se não foi você, recupere a conta agora.")
        return Result.success("password.reset.success")


class ChangePassword:
    def __init__(self, users: UserRepository, creds: CredentialRepository,
                 sessions: SessionRepository, hasher: HashProvider,
                 mailer: MailProvider | None = None, breaches: BreachChecker | None = None):
        self.users, self.creds, self.sessions, self.hasher = users, creds, sessions, hasher
        self.mailer, self.breaches = mailer, breaches or NeverBreached()
    async def execute(self, data: ChangePasswordInput) -> Result[str]:
        cred = await self.creds.by_user(data.user_id)
        if not cred or not self.hasher.verify(data.current_password or "", cred.password_hash):
            return Result.fail(Error("password.change.wrongCurrent"))
        pwd = Password.create(data.new_password)
        if pwd.failed:
            return Result.fail(*pwd.errors)
        if self.breaches.breached(pwd.value.reveal()):
            return Result.fail(Error("validation.password.breached", field_name="password"))
        await self.creds.save(cred.with_(password_hash=self.hasher.hash(pwd.value.reveal()), updated_at=now()))
        await self.sessions.revoke_all_for_user(data.user_id)
        user = await self.users.by_id(data.user_id)
        if user:
            await notify(self.mailer, to=user.email, locale=user.locale, subject="Senha alterada",
                         body="Sua senha foi alterada. Se não foi você, recupere a conta agora.")
        return Result.success("password.change.success")


class Logout:
    def __init__(self, sessions: SessionRepository):
        self.sessions = sessions
    async def execute(self, data: LogoutInput) -> Result[str]:
        s = await self.sessions.by_refresh_hash(_sha(data.refresh_token or ""))
        if s:
            await self.sessions.save(s.revoke())
        return Result.success("session.revoked")


class LogoutAll:
    def __init__(self, sessions: SessionRepository):
        self.sessions = sessions
    async def execute(self, user_id: str) -> Result[str]:
        await self.sessions.revoke_all_for_user(user_id)
        return Result.success("session.revoked")
