"""Cria o admin só se SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD existirem e a conta não."""
from __future__ import annotations
import os
from ..application.dto import RegisterInput


async def seed_admin(auth) -> None:
    email = os.getenv("SEED_ADMIN_EMAIL", "").strip().lower()
    password = os.getenv("SEED_ADMIN_PASSWORD", "")
    if not email or not password:
        return
    if await auth.users.by_email(email):
        return
    result = await auth.register.execute(RegisterInput(email, password, "pt-BR"))
    if result.failed or not result.value:
        return
    user = await auth.users.by_id(result.value.user_id)
    if user:
        await auth.users.save(user.verify_email().with_(roles=("admin",)))
