"""Janela deslizante na tabela auth_rate_hits. Vale entre processos que compartilham o banco.
ponytail: duas requisições simultâneas podem passar juntas no limite. Upgrade: trava por chave."""
from __future__ import annotations
from datetime import timedelta
from sqlalchemy import delete, func, select
from ..application.providers import RateLimiter
from .db import Db
from .models import RateHitRow
from shared.domain import now


class DbRateLimiter(RateLimiter):
    def __init__(self, db: Db):
        self.db = db

    async def hit(self, key: str, *, limit: int, window_s: int) -> bool:
        def fn(s) -> bool:
            moment = now()
            cutoff = moment - timedelta(seconds=window_s)
            s.execute(delete(RateHitRow).where(RateHitRow.bucket == key, RateHitRow.at < cutoff))
            count = s.scalar(select(func.count()).select_from(RateHitRow).where(
                RateHitRow.bucket == key, RateHitRow.at >= cutoff)) or 0
            s.add(RateHitRow(bucket=key, at=moment))
            return count + 1 <= limit
        return self.db.run(fn)
