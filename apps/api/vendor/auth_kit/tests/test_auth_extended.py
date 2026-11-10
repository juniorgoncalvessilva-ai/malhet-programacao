"""Testa reset de senha, troca de senha e 2FA (enable->confirm->login com codigo).
Roda sem deps externas: `python tests/test_auth_extended.py`."""
from __future__ import annotations
import asyncio, sys, pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "src"))

from modules.auth.application.dto import (
    RegisterInput, VerifyEmailInput, LoginInput, RefreshInput,
    EmailInput, ResetPasswordInput, ChangePasswordInput, MfaConfirmInput, MfaDisableInput)
from modules.auth.application.use_cases.register_user import RegisterUser
from modules.auth.application.use_cases.verify_email import VerifyEmail
from modules.auth.application.use_cases.login import Login
from modules.auth.application.use_cases.refresh_token import RefreshToken
from modules.auth.application.use_cases.password import (
    RequestPasswordReset, ResetPassword, ChangePassword)
from modules.auth.application.use_cases.mfa import EnableMfa, ConfirmMfa, DisableMfa
from modules.auth.infra.memory import (
    InMemoryUsers, InMemoryCredentials, InMemorySessions, InMemoryTokens, InMemoryMfa)
from modules.auth.infra.providers_std import Pbkdf2Hash, JwtHs256, ConsoleMail, SecretsRandom
from modules.auth.infra.totp_std import StdTotp, code_now
from modules.auth.infra.hibp import suffix_listed
from modules.auth.application.providers import BreachChecker


def token_from_mail(mailer, needle="Token: "):
    return mailer.sent[-1]["body"].split(needle, 1)[1].strip()


async def main() -> None:
    users, creds, sessions = InMemoryUsers(), InMemoryCredentials(), InMemorySessions()
    tokens, mfa = InMemoryTokens(), InMemoryMfa()
    hasher = Pbkdf2Hash(iterations=10_000)
    jwt, mailer, rng, totp = JwtHs256("s"), ConsoleMail(), SecretsRandom(), StdTotp()

    register = RegisterUser(users, creds, tokens, hasher, mailer, rng)
    verify = VerifyEmail(users, tokens)
    login = Login(users, creds, sessions, hasher, jwt, rng, mfa, totp, mailer=mailer)
    refresh = RefreshToken(sessions, users, jwt, rng)
    req_reset = RequestPasswordReset(users, tokens, mailer, rng)
    do_reset = ResetPassword(users, creds, tokens, sessions, hasher, mailer)
    change = ChangePassword(users, creds, sessions, hasher, mailer)
    enable_mfa = EnableMfa(users, mfa, totp, hasher, rng)
    confirm_mfa = ConfirmMfa(users, mfa, totp, mailer=mailer)
    disable_mfa = DisableMfa(users, creds, mfa, hasher, mailer)

    # setup: cadastra e verifica
    r = await register.execute(RegisterInput("ana@exemplo.com", "SenhaForte123", "pt-BR"))
    uid = r.value.user_id
    await verify.execute(VerifyEmailInput(r.value.verification_token))

    # login inicial -> refresh valido
    r = await login.execute(LoginInput("ana@exemplo.com", "SenhaForte123"))
    old_refresh = r.value.refresh_token

    # ---- RESET DE SENHA ----
    r = await req_reset.execute(EmailInput("ana@exemplo.com"))
    assert r.ok and r.value == "password.reset.requested"
    reset_tok = token_from_mail(mailer)
    r = await do_reset.execute(ResetPasswordInput(reset_tok, "NovaSenha456"))
    assert r.ok and r.value == "password.reset.success", r.errors
    # senha antiga falha, nova funciona, e a sessao antiga foi revogada
    assert (await login.execute(LoginInput("ana@exemplo.com", "SenhaForte123"))).failed
    assert (await login.execute(LoginInput("ana@exemplo.com", "NovaSenha456"))).ok
    assert (await refresh.execute(RefreshInput(old_refresh))).failed, "reset deve revogar sessoes"
    # e-mail de reset nao revela existencia (mesma resposta p/ inexistente)
    assert (await req_reset.execute(EmailInput("naoexiste@x.com"))).value == "password.reset.requested"

    # ---- TROCA DE SENHA ----
    r = await login.execute(LoginInput("ana@exemplo.com", "NovaSenha456"))
    ref_before_change = r.value.refresh_token
    assert (await change.execute(ChangePasswordInput(uid, "errada9", "OutraSenha789"))).failed  # senha atual errada
    r = await change.execute(ChangePasswordInput(uid, "NovaSenha456", "OutraSenha789"))
    assert r.ok and r.value == "password.change.success", r.errors
    assert (await refresh.execute(RefreshInput(ref_before_change))).failed, "troca deve revogar sessoes"
    assert (await login.execute(LoginInput("ana@exemplo.com", "OutraSenha789"))).ok

    # ---- 2FA (enable -> confirm -> login exige codigo) ----
    r = await enable_mfa.execute(uid)
    assert r.ok and r.value.otpauth_uri.startswith("otpauth://totp/") and len(r.value.backup_codes) == 8
    backups = r.value.backup_codes
    secret = (await mfa.by_user(uid)).secret_encrypted
    assert backups[0] not in secret and all(backups[0] not in h for h in (await mfa.by_user(uid)).backup_codes_hash)
    # confirmar com codigo errado falha; com codigo valido liga
    assert (await confirm_mfa.execute(MfaConfirmInput(uid, "000000"))).failed
    assert (await confirm_mfa.execute(MfaConfirmInput(uid, code_now(secret)))).ok
    assert (await users.by_id(uid)).mfa_enabled is True
    # login sem codigo -> mfa_required (sem tokens)
    r = await login.execute(LoginInput("ana@exemplo.com", "OutraSenha789"))
    assert r.ok and r.value.mfa_required and r.value.access_token == "", "login deve pedir 2FA"
    # login com codigo -> tokens
    r = await login.execute(LoginInput("ana@exemplo.com", "OutraSenha789", mfa_code=code_now(secret)))
    assert r.ok and not r.value.mfa_required and r.value.access_token, r.errors
    assert (await login.execute(LoginInput("ana@exemplo.com", "OutraSenha789", mfa_code=backups[0]))).ok
    assert (await login.execute(LoginInput("ana@exemplo.com", "OutraSenha789", mfa_code=backups[0]))).failed
    assert len((await mfa.by_user(uid)).backup_codes_hash) == 7
    # desativar 2FA exige senha; depois login volta sem codigo
    assert (await disable_mfa.execute(MfaDisableInput(uid, "senhaErrada"))).failed
    assert (await disable_mfa.execute(MfaDisableInput(uid, "OutraSenha789"))).ok
    assert (await users.by_id(uid)).mfa_enabled is False
    assert (await login.execute(LoginInput("ana@exemplo.com", "OutraSenha789"))).value.access_token
    subjects = [m["subject"] for m in mailer.sent]
    assert "Senha redefinida" in subjects and "Senha alterada" in subjects
    assert "Verificação em duas etapas ativada" in subjects and "Verificação em duas etapas desativada" in subjects

    dup = await register.execute(RegisterInput("ana@exemplo.com", "OutraSenha789", "pt-BR"))
    assert dup.ok and dup.value.user_id == "" and (await users.by_email("ana@exemplo.com")).id == uid
    assert "Tentativa de cadastro" in [m["subject"] for m in mailer.sent]

    class _Bad(BreachChecker):
        def breached(self, password: str) -> bool:
            return password == "Vazada12345"
    blocked = await RegisterUser(users, creds, tokens, hasher, mailer, rng, _Bad()).execute(
        RegisterInput("nova@exemplo.com", "Vazada12345", "pt-BR"))
    assert blocked.failed and blocked.errors[0].key == "validation.password.breached"
    assert suffix_listed("ABCDEF:10\nZZZZZ:0\n", "ABCDEF") and not suffix_listed("ABCDEF:0\n", "ABCDEF")

    await login.execute(LoginInput("ana@exemplo.com", "OutraSenha789", device="celular"))
    before = len(mailer.sent)
    await login.execute(LoginInput("ana@exemplo.com", "OutraSenha789", device="celular"))
    assert len(mailer.sent) == before
    await login.execute(LoginInput("ana@exemplo.com", "OutraSenha789", device="notebook"))
    assert any(m["subject"] == "Novo aparelho" for m in mailer.sent)

    print("EXTENDED OK (reset + troca de senha + 2FA enable/confirm/login/disable + anti-enumeracao + revogacao)")


if __name__ == "__main__":
    asyncio.run(main())
