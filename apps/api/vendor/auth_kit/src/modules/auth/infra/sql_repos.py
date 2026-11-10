"""Repositórios SQLAlchemy. A interface é a mesma da memória."""
from __future__ import annotations
import json
from datetime import datetime, timezone
from sqlalchemy import delete, select, update
from ..application.repositories import (
    UserRepository, CredentialRepository, SessionRepository, TokenRepository, MfaRepository)
from ..domain.entities import User, Credential, Session, OneTimeToken, MfaSecret, UserStatus
from .db import Db
from .models import UserRow, CredentialRow, SessionRow, TokenRow, MfaRow


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _user(row: UserRow) -> User:
    roles = tuple(json.loads(row.roles))
    return User(
        id=row.id, email=row.email, status=UserStatus(row.status), roles=roles or ("user",),
        locale=row.locale, email_verified_at=_aware(row.email_verified_at),
        mfa_enabled=row.mfa_enabled, created_at=_aware(row.created_at),
    )


def _cred(row: CredentialRow) -> Credential:
    return Credential(id=row.id, user_id=row.user_id, password_hash=row.password_hash,
                      algo=row.algo, updated_at=_aware(row.updated_at))


def _session(row: SessionRow) -> Session:
    return Session(
        id=row.id, user_id=row.user_id, refresh_hash=row.refresh_hash, family_id=row.family_id,
        device=row.device, ip=row.ip, created_at=_aware(row.created_at),
        expires_at=_aware(row.expires_at), revoked_at=_aware(row.revoked_at),
    )


def _token(row: TokenRow) -> OneTimeToken:
    return OneTimeToken(
        id=row.id, user_id=row.user_id, token_hash=row.token_hash, purpose=row.purpose,
        expires_at=_aware(row.expires_at), used_at=_aware(row.used_at),
    )


def _mfa(row: MfaRow) -> MfaSecret:
    return MfaSecret(
        id=row.id, user_id=row.user_id, secret_encrypted=row.secret_encrypted,
        backup_codes_hash=tuple(json.loads(row.backup_codes_hash or "[]")),
        confirmed_at=_aware(row.confirmed_at),
    )


class SqlUsers(UserRepository):
    def __init__(self, db: Db): self.db = db
    async def by_email(self, email: str) -> User | None:
        def fn(s):
            row = s.scalars(select(UserRow).where(UserRow.email == email)).first()
            return _user(row) if row else None
        return self.db.run(fn)
    async def by_id(self, user_id: str) -> User | None:
        def fn(s):
            row = s.get(UserRow, user_id)
            return _user(row) if row else None
        return self.db.run(fn)
    async def save(self, user: User) -> None:
        def fn(s):
            row = s.get(UserRow, user.id)
            data = dict(email=user.email, status=user.status.value, roles=json.dumps(list(user.roles)),
                        locale=user.locale, email_verified_at=user.email_verified_at,
                        mfa_enabled=user.mfa_enabled, created_at=user.created_at)
            if row is None:
                s.add(UserRow(id=user.id, **data))
            else:
                for k, v in data.items():
                    setattr(row, k, v)
        self.db.run(fn)


class SqlCredentials(CredentialRepository):
    def __init__(self, db: Db): self.db = db
    async def by_user(self, user_id: str) -> Credential | None:
        def fn(s):
            row = s.scalars(select(CredentialRow).where(CredentialRow.user_id == user_id)).first()
            return _cred(row) if row else None
        return self.db.run(fn)
    async def save(self, cred: Credential) -> None:
        def fn(s):
            row = s.scalars(select(CredentialRow).where(CredentialRow.user_id == cred.user_id)).first()
            if row is None:
                s.add(CredentialRow(id=cred.id, user_id=cred.user_id, password_hash=cred.password_hash,
                                    algo=cred.algo, updated_at=cred.updated_at))
            else:
                row.password_hash, row.algo, row.updated_at = cred.password_hash, cred.algo, cred.updated_at
        self.db.run(fn)


class SqlSessions(SessionRepository):
    def __init__(self, db: Db): self.db = db
    async def by_id(self, session_id: str) -> Session | None:
        def fn(s):
            row = s.get(SessionRow, session_id)
            return _session(row) if row else None
        return self.db.run(fn)
    async def by_refresh_hash(self, refresh_hash: str) -> Session | None:
        def fn(s):
            row = s.scalars(select(SessionRow).where(SessionRow.refresh_hash == refresh_hash)).first()
            return _session(row) if row else None
        return self.db.run(fn)
    async def save(self, session: Session) -> None:
        def fn(s):
            row = s.get(SessionRow, session.id)
            data = dict(user_id=session.user_id, refresh_hash=session.refresh_hash, family_id=session.family_id,
                        device=session.device, ip=session.ip, created_at=session.created_at,
                        expires_at=session.expires_at, revoked_at=session.revoked_at)
            if row is None:
                s.add(SessionRow(id=session.id, **data))
            else:
                for k, v in data.items():
                    setattr(row, k, v)
        self.db.run(fn)
    async def revoke_all_for_user(self, user_id: str) -> None:
        from shared.domain import now
        self.db.run(lambda s: s.execute(update(SessionRow).where(
            SessionRow.user_id == user_id, SessionRow.revoked_at.is_(None)).values(revoked_at=now())))
    async def revoke_family(self, family_id: str) -> None:
        from shared.domain import now
        self.db.run(lambda s: s.execute(update(SessionRow).where(
            SessionRow.family_id == family_id, SessionRow.revoked_at.is_(None)).values(revoked_at=now())))
    async def list_for_user(self, user_id: str) -> list[Session]:
        def fn(s):
            rows = s.scalars(select(SessionRow).where(SessionRow.user_id == user_id)).all()
            return [_session(r) for r in rows]
        return self.db.run(fn)


class SqlTokens(TokenRepository):
    def __init__(self, db: Db): self.db = db
    async def save(self, token: OneTimeToken) -> None:
        def fn(s):
            row = s.get(TokenRow, token.id)
            if row is None:
                s.add(TokenRow(id=token.id, user_id=token.user_id, token_hash=token.token_hash,
                               purpose=token.purpose, expires_at=token.expires_at, used_at=token.used_at))
            else:
                row.used_at = token.used_at
                row.token_hash = token.token_hash
                row.expires_at = token.expires_at
        self.db.run(fn)
    async def find_valid(self, token_hash: str, purpose: str) -> OneTimeToken | None:
        from shared.domain import now
        def fn(s):
            row = s.scalars(select(TokenRow).where(
                TokenRow.token_hash == token_hash, TokenRow.purpose == purpose,
                TokenRow.used_at.is_(None), TokenRow.expires_at > now())).first()
            token = _token(row) if row else None
            return token if token and token.valid else None
        return self.db.run(fn)


class SqlMfa(MfaRepository):
    def __init__(self, db: Db): self.db = db
    async def by_user(self, user_id: str) -> MfaSecret | None:
        def fn(s):
            row = s.scalars(select(MfaRow).where(MfaRow.user_id == user_id)).first()
            return _mfa(row) if row else None
        return self.db.run(fn)
    async def save(self, mfa: MfaSecret) -> None:
        def fn(s):
            s.execute(delete(MfaRow).where(MfaRow.user_id == mfa.user_id))
            s.add(MfaRow(id=mfa.id, user_id=mfa.user_id, secret_encrypted=mfa.secret_encrypted,
                         backup_codes_hash=json.dumps(list(mfa.backup_codes_hash)),
                         confirmed_at=mfa.confirmed_at))
        self.db.run(fn)
