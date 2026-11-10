from __future__ import annotations
import hashlib
from datetime import timedelta
from shared.result import Result, Error
from shared.domain import now
from shared.settings import settings
from ..dto import RegisterInput, RegisterOutput
from ..repositories import UserRepository, CredentialRepository, TokenRepository
from ..providers import HashProvider, MailProvider, Random, BreachChecker, NeverBreached
from ...domain.value_objects import Email, Password
from ...domain.entities import User, Credential, OneTimeToken


class RegisterUser:
    def __init__(self, users: UserRepository, creds: CredentialRepository, tokens: TokenRepository,
                 hasher: HashProvider, mailer: MailProvider, rng: Random,
                 breaches: BreachChecker | None = None):
        self.users, self.creds, self.tokens = users, creds, tokens
        self.hasher, self.mailer, self.rng = hasher, mailer, rng
        self.breaches = breaches or NeverBreached()

    async def execute(self, data: RegisterInput) -> Result[RegisterOutput]:
        email = Email.create(data.email)
        pwd = Password.create(data.password)
        if email.failed or pwd.failed:
            return Result.fail(*email.errors, *pwd.errors)
        if self.breaches.breached(pwd.value.reveal()):
            return Result.fail(Error("validation.password.breached", field_name="password"))
        if await self.users.by_email(email.value.value):
            self.hasher.hash(pwd.value.reveal())
            await self.mailer.send(to=email.value.value, subject="Tentativa de cadastro",
                                   body="Este e-mail já tem conta. Se não foi você, ignore.",
                                   locale=data.locale or "pt-BR")
            return Result.success(RegisterOutput(user_id="", verification_token=""))
        user = User.register(email.value.value, locale=data.locale)
        await self.users.save(user)
        await self.creds.save(Credential(id=user.id, user_id=user.id,
                                         password_hash=self.hasher.hash(pwd.value.reveal())))
        raw = self.rng.token(32)
        ott = OneTimeToken(id=self.rng.token(8), user_id=user.id,
                           token_hash=hashlib.sha256(raw.encode()).hexdigest(),
                           purpose="email_verify",
                           expires_at=now() + timedelta(hours=settings.email_verify_ttl_h))
        await self.tokens.save(ott)
        await self.mailer.send(to=user.email, subject="Verifique seu e-mail",
                               body="Token: " + raw, locale=user.locale)
        return Result.success(RegisterOutput(user_id=user.id, verification_token=raw))
