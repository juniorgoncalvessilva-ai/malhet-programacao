from __future__ import annotations
import hashlib
from shared.result import Result, Error
from ..dto import VerifyEmailInput
from ..repositories import UserRepository, TokenRepository


class VerifyEmail:
    def __init__(self, users: UserRepository, tokens: TokenRepository):
        self.users, self.tokens = users, tokens

    async def execute(self, data: VerifyEmailInput) -> Result[str]:
        h = hashlib.sha256((data.token or "").encode()).hexdigest()
        ott = await self.tokens.find_valid(h, "email_verify")
        if not ott:
            return Result.fail(Error("verify.invalid"))
        user = await self.users.by_id(ott.user_id)
        if not user:
            return Result.fail(Error("verify.invalid"))
        await self.tokens.save(ott.consume())
        await self.users.save(user.verify_email())
        return Result.success("verify.success")
