"""Aviso por e-mail. Sem mailer, não faz nada (testes antigos seguem válidos)."""
from __future__ import annotations
from .providers import MailProvider


async def notify(mailer: MailProvider | None, *, to: str, locale: str, subject: str, body: str) -> None:
    if mailer is None or not to:
        return
    await mailer.send(to=to, subject=subject, body=body, locale=locale or "pt-BR")
