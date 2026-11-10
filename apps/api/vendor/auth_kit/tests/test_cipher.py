"""Segredo TOTP cifrado em repouso: o store não guarda o segredo, e o login ainda confere o código."""
from __future__ import annotations
import asyncio, sys, pathlib
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "src"))

from modules.auth.application.dto import RegisterInput, VerifyEmailInput, LoginInput, MfaConfirmInput
from modules.auth.application.use_cases.register_user import RegisterUser
from modules.auth.application.use_cases.verify_email import VerifyEmail
from modules.auth.application.use_cases.login import Login
from modules.auth.application.use_cases.mfa import EnableMfa, ConfirmMfa
from modules.auth.infra.memory import (
    InMemoryUsers, InMemoryCredentials, InMemorySessions, InMemoryTokens, InMemoryMfa)
from modules.auth.infra.providers_std import Pbkdf2Hash, JwtHs256, ConsoleMail, SecretsRandom
from modules.auth.infra.totp_std import StdTotp, code_now
from modules.auth.infra.cipher_aes import AesGcmCipher
import os


async def main() -> None:
    users, creds, sessions = InMemoryUsers(), InMemoryCredentials(), InMemorySessions()
    tokens, mfa = InMemoryTokens(), InMemoryMfa()
    hasher, rng, totp = Pbkdf2Hash(iterations=10_000), SecretsRandom(), StdTotp()
    cipher = AesGcmCipher(os.urandom(32))
    mailer = ConsoleMail()
    register = RegisterUser(users, creds, tokens, hasher, mailer, rng)
    verify = VerifyEmail(users, tokens)
    login = Login(users, creds, sessions, hasher, JwtHs256("s"), rng, mfa, totp, cipher)
    enable = EnableMfa(users, mfa, totp, hasher, rng, cipher)
    confirm = ConfirmMfa(users, mfa, totp, cipher)

    r = await register.execute(RegisterInput("mfa@exemplo.com", "SenhaForte123", "pt-BR"))
    uid = r.value.user_id
    await verify.execute(VerifyEmailInput(r.value.verification_token))
    setup = await enable.execute(uid)
    secret = parse_qs(urlparse(setup.value.otpauth_uri).query)["secret"][0]
    stored = (await mfa.by_user(uid)).secret_encrypted
    assert stored != secret and secret not in stored, "segredo TOTP não pode ficar em claro"
    assert stored.startswith("v1.")
    assert (await confirm.execute(MfaConfirmInput(uid, code_now(secret)))).ok
    assert (await login.execute(LoginInput("mfa@exemplo.com", "SenhaForte123", mfa_code=code_now(secret)))).ok
    assert cipher.decrypt(stored) == secret
    print("CIPHER OK (TOTP cifrado em repouso)")


if __name__ == "__main__":
    asyncio.run(main())
