"""E-mail via SMTP (stdlib). Só entra quando MAIL_PROVIDER=smtp e SMTP_HOST está definido."""
from __future__ import annotations
import asyncio, smtplib
from email.message import EmailMessage
from ..application.providers import MailProvider


class SmtpMail(MailProvider):
    def __init__(self, host: str, port: int, user: str, password: str, sender: str):
        self.host, self.port, self.user, self.password, self.sender = host, port, user, password, sender

    async def send(self, *, to: str, subject: str, body: str, locale: str) -> None:
        await asyncio.to_thread(self._send, to, subject, body)

    def _send(self, to: str, subject: str, body: str) -> None:
        msg = EmailMessage()
        msg["From"], msg["To"], msg["Subject"] = self.sender, to, subject
        msg.set_content(body)
        with smtplib.SMTP(self.host, self.port, timeout=10) as smtp:
            smtp.starttls()
            if self.user:
                smtp.login(self.user, self.password)
            smtp.send_message(msg)
