from __future__ import annotations
import hashlib
from datetime import timedelta
from shared.result import Result, Error
from shared.domain import now, new_id
from shared.settings import settings
from ..dto import LoginInput, TokenPair
from ..repositories import UserRepository, CredentialRepository, SessionRepository, MfaRepository
from ..providers import HashProvider, TokenProvider, TotpProvider, Random, CipherProvider, MailProvider
from ..notify import notify
from ...domain.entities import Session, UserStatus, MfaSecret
from ..backup_codes import normalize_backup, peppered_backup

_DUMMY_HASH = "pbkdf2$120000$ZmFrZQ==$ZmFrZWZha2VmYWtl"


class Login:
    def __init__(self, users: UserRepository, creds: CredentialRepository, sessions: SessionRepository,
                 hasher: HashProvider, tokens: TokenProvider, rng: Random,
                 mfa: MfaRepository | None = None, totp: TotpProvider | None = None,
                 cipher: CipherProvider | None = None, mailer: MailProvider | None = None):
        self.users, self.creds, self.sessions = users, creds, sessions
        self.hasher, self.tokens, self.rng = hasher, tokens, rng
        self.mfa, self.totp, self.cipher, self.mailer = mfa, totp, cipher, mailer

    async def execute(self, data: LoginInput) -> Result[TokenPair]:
        user = await self.users.by_email((data.email or "").strip().lower())
        cred = await self.creds.by_user(user.id) if user else None
        ok = self.hasher.verify(data.password or "", cred.password_hash if cred else _DUMMY_HASH)
        if not user or not cred or not ok:
            return Result.fail(Error("login.invalid"))
        if self.hasher.needs_rehash(cred.password_hash):
            await self.creds.save(cred.with_(
                password_hash=self.hasher.hash(data.password or ""),
                algo="argon2id", updated_at=now()))
        if not user.is_verified or user.status == UserStatus.PENDING:
            return Result.fail(Error("login.unverified"))
        if user.status == UserStatus.BLOCKED:
            return Result.fail(Error("login.invalid"))
        if user.mfa_enabled:
            if not data.mfa_code:
                return Result.success(TokenPair(access_token="", refresh_token="", mfa_required=True))
            secret = await self.mfa.by_user(user.id) if self.mfa else None
            plain = self._plain_secret(secret.secret_encrypted if secret else "")
            totp_ok = bool(secret and self.totp and plain and self.totp.verify(secret=plain, code=data.mfa_code))
            backup_ok = False
            if not totp_ok and secret and len(normalize_backup(data.mfa_code or "")) >= 8:
                backup_ok = await self._consume_backup(secret, data.mfa_code or "")
            if not (totp_ok or backup_ok):
                return Result.fail(Error("mfa.invalid"))
        if data.device:
            prior = await self.sessions.list_for_user(user.id)
            known = {s.device for s in prior if s.active and s.device}
            if known and data.device not in known:
                await notify(self.mailer, to=user.email, locale=user.locale, subject="Novo aparelho",
                             body="Houve um login de um aparelho que ainda não tínhamos visto.")
        refresh = self.rng.token(32)
        session = Session(id=new_id(), user_id=user.id,
                          refresh_hash=hashlib.sha256(refresh.encode()).hexdigest(),
                          family_id=new_id(), device=data.device, ip=data.ip,
                          expires_at=now() + timedelta(days=settings.refresh_ttl_days))
        await self.sessions.save(session)
        access = self.tokens.issue_access(subject=user.id, roles=list(user.roles))
        return Result.success(TokenPair(access_token=access, refresh_token=refresh))

    def _plain_secret(self, stored: str) -> str:
        if not stored or self.cipher is None:
            return stored
        try:
            return self.cipher.decrypt(stored)
        except Exception:
            return ""

    async def _consume_backup(self, secret: MfaSecret, code: str) -> bool:
        material = peppered_backup(code)
        kept: list[str] = []
        matched = False
        for hashed in secret.backup_codes_hash:
            if not matched and self.hasher.verify(material, hashed):
                matched = True
                continue
            kept.append(hashed)
        if matched and self.mfa:
            await self.mfa.save(secret.with_(backup_codes_hash=tuple(kept)))
        return matched
