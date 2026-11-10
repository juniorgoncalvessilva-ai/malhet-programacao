from __future__ import annotations
import hashlib
from datetime import timedelta
from shared.result import Result, Error
from shared.domain import now, new_id
from ...domain.entities import Session
from shared.settings import settings
from ..dto import RefreshInput, TokenPair
from ..repositories import SessionRepository, UserRepository
from ..providers import TokenProvider, Random


class RefreshToken:
    def __init__(self, sessions: SessionRepository, users: UserRepository,
                 tokens: TokenProvider, rng: Random):
        self.sessions, self.users, self.tokens, self.rng = sessions, users, tokens, rng

    async def execute(self, data: RefreshInput) -> Result[TokenPair]:
        h = hashlib.sha256((data.refresh_token or "").encode()).hexdigest()
        session = await self.sessions.by_refresh_hash(h)
        if not session or not session.active:
            if session:
                await self.sessions.revoke_family(session.family_id)
            return Result.fail(Error("login.invalid"))
        user = await self.users.by_id(session.user_id)
        if not user:
            return Result.fail(Error("login.invalid"))
        new_refresh = self.rng.token(32)
        # Mantém o hash antigo revogado para o reuso achar a família e derrubar a sessão nova.
        await self.sessions.save(session.revoke())
        rotated = Session(
            id=new_id(), user_id=user.id, family_id=session.family_id,
            refresh_hash=hashlib.sha256(new_refresh.encode()).hexdigest(),
            device=session.device, ip=session.ip,
            expires_at=now() + timedelta(days=settings.refresh_ttl_days))
        await self.sessions.save(rotated)
        access = self.tokens.issue_access(subject=user.id, roles=list(user.roles))
        return Result.success(TokenPair(access_token=access, refresh_token=new_refresh))
