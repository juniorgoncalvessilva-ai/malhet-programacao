"""Teste de integração do fluxo de auth com infra em memória + providers stdlib.
Roda sem dependências externas: `python tests/test_auth_flow.py`."""
from __future__ import annotations
import asyncio, sys, pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "src"))

from shared.settings import settings
from shared.i18n import t
from modules.auth.application.dto import RegisterInput, VerifyEmailInput, LoginInput, RefreshInput
from modules.auth.application.use_cases.register_user import RegisterUser
from modules.auth.application.use_cases.verify_email import VerifyEmail
from modules.auth.application.use_cases.login import Login
from modules.auth.application.use_cases.refresh_token import RefreshToken
from modules.auth.infra.memory import InMemoryUsers, InMemoryCredentials, InMemorySessions, InMemoryTokens, InMemoryMfa
from modules.auth.infra.providers_std import Pbkdf2Hash, JwtHs256, ConsoleMail, SecretsRandom


async def main() -> None:
    users, creds, sessions = InMemoryUsers(), InMemoryCredentials(), InMemorySessions()
    tokens, mfa = InMemoryTokens(), InMemoryMfa()
    hasher = Pbkdf2Hash(iterations=10_000)  # menor p/ teste rápido
    jwt = JwtHs256(secret="test-secret", access_ttl_s=900)
    mailer, rng = ConsoleMail(), SecretsRandom()

    register = RegisterUser(users, creds, tokens, hasher, mailer, rng)
    verify = VerifyEmail(users, tokens)
    login = Login(users, creds, sessions, hasher, jwt, rng, mfa, None)
    refresh = RefreshToken(sessions, users, jwt, rng)

    # 1) senha fraca -> falha
    r = await register.execute(RegisterInput("a@b.com", "123", "pt-BR"))
    assert r.failed and r.errors[0].key == "validation.password.tooWeak", "senha fraca deveria falhar"

    # 2) cadastro válido
    r = await register.execute(RegisterInput("Junior@Exemplo.com ", "SenhaForte123", "pt-BR"))
    assert r.ok, r.errors
    uid, vtoken = r.value.user_id, r.value.verification_token
    assert len(mailer.sent) == 1 and mailer.sent[0]["to"] == "junior@exemplo.com", "e-mail deveria ser enviado (normalizado)"

    # 3) login antes de verificar -> unverified
    r = await login.execute(LoginInput("junior@exemplo.com", "SenhaForte123"))
    assert r.failed and r.errors[0].key == "login.unverified", "login sem verificar deve falhar"

    # 4) verificar e-mail (idempotente na 2a vez)
    r = await verify.execute(VerifyEmailInput(vtoken))
    assert r.ok and r.value == "verify.success"
    r2 = await verify.execute(VerifyEmailInput(vtoken))
    assert r2.failed, "token usado nao pode revalidar"

    # 5) login errado
    r = await login.execute(LoginInput("junior@exemplo.com", "senhaErrada9"))
    assert r.failed and r.errors[0].key == "login.invalid"

    # 6) login correto -> tokens; JWT válido com sub == uid
    r = await login.execute(LoginInput("junior@exemplo.com", "SenhaForte123", device="pc", ip="127.0.0.1"))
    assert r.ok, r.errors
    access, refresh_tok = r.value.access_token, r.value.refresh_token
    payload = jwt.verify_access(access)
    assert payload and payload["sub"] == uid and "user" in payload["roles"], "access token invalido"

    # 7) refresh rotaciona; token antigo deixa de valer
    r = await refresh.execute(RefreshInput(refresh_tok))
    assert r.ok, r.errors
    new_refresh = r.value.refresh_token
    assert new_refresh != refresh_tok, "refresh deve rotacionar"
    r_old = await refresh.execute(RefreshInput(refresh_tok))
    assert r_old.failed, "refresh antigo (rotacionado) nao pode valer"
    assert (await refresh.execute(RefreshInput(new_refresh))).failed, "reuso revoga a familia"

    # 8) i18n: mensagem existe em pt-BR e en
    assert t("login.invalid", "pt-BR") != "login.invalid"
    assert t("login.invalid", "en") != t("login.invalid", "pt-BR")

    print("TODOS OS ASSERTS PASSARAM (register -> verify -> login -> refresh + erros + i18n)")


if __name__ == "__main__":
    asyncio.run(main())
