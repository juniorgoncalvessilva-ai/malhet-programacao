"""Implementações em memória dos repositórios (para testes/dev)."""
from __future__ import annotations
from ..application.repositories import (
    UserRepository, CredentialRepository, SessionRepository, TokenRepository, MfaRepository)
from ..domain.entities import User, Credential, Session, OneTimeToken, MfaSecret


class InMemoryUsers(UserRepository):
    def __init__(self): self._by_id: dict[str, User] = {}
    async def by_email(self, email: str) -> User | None:
        return next((u for u in self._by_id.values() if u.email == email), None)
    async def by_id(self, user_id: str) -> User | None:
        return self._by_id.get(user_id)
    async def save(self, user: User) -> None:
        self._by_id[user.id] = user


class InMemoryCredentials(CredentialRepository):
    def __init__(self): self._by_user: dict[str, Credential] = {}
    async def by_user(self, user_id: str) -> Credential | None:
        return self._by_user.get(user_id)
    async def save(self, cred: Credential) -> None:
        self._by_user[cred.user_id] = cred


class InMemorySessions(SessionRepository):
    def __init__(self): self._by_id: dict[str, Session] = {}
    async def by_id(self, session_id: str) -> Session | None:
        return self._by_id.get(session_id)
    async def by_refresh_hash(self, refresh_hash: str) -> Session | None:
        return next((s for s in self._by_id.values() if s.refresh_hash == refresh_hash), None)
    async def save(self, session: Session) -> None:
        self._by_id[session.id] = session
    async def revoke_all_for_user(self, user_id: str) -> None:
        for sid, s in list(self._by_id.items()):
            if s.user_id == user_id:
                self._by_id[sid] = s.revoke()
    async def revoke_family(self, family_id: str) -> None:
        for sid, s in list(self._by_id.items()):
            if s.family_id == family_id:
                self._by_id[sid] = s.revoke()
    async def list_for_user(self, user_id: str) -> list[Session]:
        return [s for s in self._by_id.values() if s.user_id == user_id]


class InMemoryTokens(TokenRepository):
    def __init__(self): self._items: list[OneTimeToken] = []
    async def save(self, token: OneTimeToken) -> None:
        self._items = [t for t in self._items if t.id != token.id] + [token]
    async def find_valid(self, token_hash: str, purpose: str) -> OneTimeToken | None:
        return next((t for t in self._items
                     if t.token_hash == token_hash and t.purpose == purpose and t.valid), None)


class InMemoryMfa(MfaRepository):
    def __init__(self): self._by_user: dict[str, MfaSecret] = {}
    async def by_user(self, user_id: str) -> MfaSecret | None:
        return self._by_user.get(user_id)
    async def save(self, mfa: MfaSecret) -> None:
        self._by_user[mfa.user_id] = mfa
