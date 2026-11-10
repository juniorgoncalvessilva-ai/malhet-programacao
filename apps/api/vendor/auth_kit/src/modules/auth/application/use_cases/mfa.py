from __future__ import annotations
from shared.result import Result, Error
from shared.domain import now, new_id
from ..dto import MfaSetupOutput, MfaConfirmInput, MfaDisableInput
from ..repositories import UserRepository, CredentialRepository, MfaRepository
import os
from ..providers import TotpProvider, HashProvider, Random, CipherProvider, MailProvider
from ...domain.entities import MfaSecret
from ..backup_codes import new_backup_codes, peppered_backup
from ..notify import notify

_ISSUER = os.getenv("AUTH_ISSUER", "app")


class EnableMfa:
    """Gera segredo + códigos de backup. Só ATIVA após ConfirmMfa com um código válido."""
    def __init__(self, users: UserRepository, mfa: MfaRepository,
                 totp: TotpProvider, hasher: HashProvider, rng: Random,
                 cipher: CipherProvider | None = None):
        self.users, self.mfa, self.totp, self.hasher, self.rng = users, mfa, totp, hasher, rng
        self.cipher = cipher
    async def execute(self, user_id: str) -> Result[MfaSetupOutput]:
        user = await self.users.by_id(user_id)
        if not user:
            return Result.fail(Error("verify.invalid"))
        secret = self.totp.new_secret()
        stored = self.cipher.encrypt(secret) if self.cipher else secret
        codes = new_backup_codes()
        await self.mfa.save(MfaSecret(id=new_id(), user_id=user_id, secret_encrypted=stored,
                                      backup_codes_hash=tuple(self.hasher.hash(peppered_backup(c)) for c in codes),
                                      confirmed_at=None))
        uri = self.totp.provisioning_uri(secret=secret, account=user.email, issuer=_ISSUER)
        return Result.success(MfaSetupOutput(otpauth_uri=uri, backup_codes=tuple(codes)))


class ConfirmMfa:
    """Confirma a ativação verificando um código TOTP; liga mfa_enabled no usuário."""
    def __init__(self, users: UserRepository, mfa: MfaRepository, totp: TotpProvider,
                 cipher: CipherProvider | None = None, mailer: MailProvider | None = None):
        self.users, self.mfa, self.totp, self.cipher, self.mailer = users, mfa, totp, cipher, mailer
    async def execute(self, data: MfaConfirmInput) -> Result[str]:
        sec = await self.mfa.by_user(data.user_id)
        user = await self.users.by_id(data.user_id)
        if not sec or not user:
            return Result.fail(Error("mfa.invalid"))
        plain = sec.secret_encrypted
        if self.cipher:
            try:
                plain = self.cipher.decrypt(sec.secret_encrypted)
            except Exception:
                return Result.fail(Error("mfa.invalid"))
        if not self.totp.verify(secret=plain, code=data.code):
            return Result.fail(Error("mfa.invalid"))
        await self.mfa.save(sec.with_(confirmed_at=now()))
        await self.users.save(user.with_(mfa_enabled=True))
        await notify(self.mailer, to=user.email, locale=user.locale, subject="Verificação em duas etapas ativada",
                     body="A verificação em duas etapas foi ativada na sua conta.")
        return Result.success("mfa.confirmed")


class DisableMfa:
    """Desativa 2FA exigindo a senha atual."""
    def __init__(self, users: UserRepository, creds: CredentialRepository,
                 mfa: MfaRepository, hasher: HashProvider, mailer: MailProvider | None = None):
        self.users, self.creds, self.mfa, self.hasher, self.mailer = users, creds, mfa, hasher, mailer
    async def execute(self, data: MfaDisableInput) -> Result[str]:
        cred = await self.creds.by_user(data.user_id)
        user = await self.users.by_id(data.user_id)
        if not cred or not user or not self.hasher.verify(data.password or "", cred.password_hash):
            return Result.fail(Error("password.change.wrongCurrent"))
        sec = await self.mfa.by_user(data.user_id)
        if sec:
            await self.mfa.save(sec.with_(secret_encrypted="", backup_codes_hash=(), confirmed_at=None))
        await self.users.save(user.with_(mfa_enabled=False))
        await notify(self.mailer, to=user.email, locale=user.locale, subject="Verificação em duas etapas desativada",
                     body="A verificação em duas etapas foi desativada. Se não foi você, recupere a conta.")
        return Result.success("mfa.disabled")
