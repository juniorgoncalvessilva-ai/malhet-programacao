"""Fluxo HTTP: cadastro, verificação, login com cookie, RBAC, refresh com reuso, CSRF."""
from __future__ import annotations
import asyncio, sys, pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "src"))

from fastapi.testclient import TestClient
from modules.auth.domain.entities import UserStatus
from modules.auth.presentation.app import create_app
from modules.auth.presentation.container import build_auth


def _token(mailer) -> str:
    return mailer.sent[-1]["body"].split("Token: ", 1)[1].strip()


def _run(coro):
    return asyncio.run(coro)


def main() -> None:
    auth = build_auth()
    client = TestClient(create_app(auth))

    health = client.get("/health")
    assert health.status_code == 200
    assert "frame-ancestors 'none'" in health.headers["content-security-policy"]
    assert health.headers["x-content-type-options"] == "nosniff"

    weak = client.post("/auth/register", json={"email": "a@b.com", "password": "123"})
    assert weak.status_code == 422 and weak.json()["errors"][0]["key"] == "validation.password.tooWeak"

    created = client.post("/auth/register", json={
        "email": "Junior@Exemplo.com ", "password": "SenhaForte123", "locale": "pt-BR"})
    assert created.status_code == 201, created.text
    assert "verification_token" not in created.text
    assert "user_id" not in created.text
    verify_token = _token(auth.mailer)
    uid = _run(auth.users.by_email("junior@exemplo.com")).id
    again = client.post("/auth/register", json={"email": "junior@exemplo.com", "password": "SenhaForte123"})
    assert again.status_code == 201 and again.json()["message_key"] == created.json()["message_key"]

    verified = client.post("/auth/verify-email", json={"token": verify_token})
    assert verified.status_code == 200 and verified.json()["message_key"] == "verify.success"

    logged = client.post("/auth/login", json={"email": "junior@exemplo.com", "password": "SenhaForte123"})
    assert logged.status_code == 200, logged.text
    body = logged.json()
    assert body["data"]["access_token"] and body["data"]["mfa_required"] is False
    assert "refresh_token" not in body["data"]
    old_refresh = client.cookies.get("refresh_token")
    csrf = client.cookies.get("csrf_token")
    assert old_refresh and csrf
    access = body["data"]["access_token"]
    bearer = {"Authorization": "Bearer " + access}

    me = client.get("/auth/me", headers=bearer)
    assert me.status_code == 200 and me.json()["data"]["email"] == "junior@exemplo.com"
    assert client.get("/auth/me").status_code == 401

    sessions = client.get("/auth/sessions", headers=bearer)
    assert sessions.status_code == 200 and len(sessions.json()["data"]) == 1
    assert "refresh_hash" not in sessions.text

    denied = client.get("/auth/admin/ping", headers=bearer)
    assert denied.status_code == 403 and denied.json()["errors"][0]["key"] == "auth.forbidden"
    user = _run(auth.users.by_id(uid))
    _run(auth.users.save(user.with_(roles=("admin",))))
    allowed = client.get("/auth/admin/ping", headers=bearer)
    assert allowed.status_code == 200, allowed.text
    _run(auth.users.save(user.with_(roles=("user",))))

    assert client.post("/auth/refresh").status_code == 403
    rotated = client.post("/auth/refresh", headers={"X-CSRF-Token": csrf})
    assert rotated.status_code == 200, rotated.text
    new_csrf = client.cookies.get("csrf_token")
    client.cookies.set("refresh_token", old_refresh)
    reused = client.post("/auth/refresh", headers={"X-CSRF-Token": new_csrf})
    assert reused.status_code == 401, reused.text

    english = client.post(
        "/auth/login",
        json={"email": "ninguem@exemplo.com", "password": "SenhaForte123"},
        headers={"Accept-Language": "en"})
    assert english.json()["message"] == "Invalid e-mail or password."

    blocked_user = _run(auth.users.by_id(uid))
    _run(auth.users.save(blocked_user.with_(status=UserStatus.BLOCKED)))
    assert client.get("/auth/me", headers=bearer).status_code == 401

    limited = build_auth()
    limited.login_limit = 2
    gate = TestClient(create_app(limited))
    payload = {"email": "a@b.co", "password": "SenhaForte123"}
    assert gate.post("/auth/login", json=payload).status_code == 401
    assert gate.post("/auth/login", json=payload).status_code == 401
    blocked_try = gate.post("/auth/login", json=payload)
    assert blocked_try.status_code == 429 and blocked_try.json()["errors"][0]["key"] == "rateLimited"

    print("HTTP OK")


if __name__ == "__main__":
    main()
