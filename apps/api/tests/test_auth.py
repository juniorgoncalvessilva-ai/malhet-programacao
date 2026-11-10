"""Integração com o auth-kit: rotas /api/auth e proteção das rotas da obra por RBAC."""
import asyncio

from app.core.config import get_settings
from app.main import app
from modules.auth.application.dto import RegisterInput


def _criar(email: str, senha: str, admin: bool = False) -> None:
    auth = app.state.auth

    async def run():
        r = await auth.register.execute(RegisterInput(email, senha, "pt-BR"))
        u = await auth.users.by_id(r.value.user_id)
        u = u.verify_email()
        if admin:
            u = u.with_(roles=("admin",))
        await auth.users.save(u)

    asyncio.run(run())


def _token(client, email, senha) -> str:
    r = client.post("/api/auth/login", json={"email": email, "password": senha})
    assert r.status_code == 200, r.text
    assert "refresh_token" in r.cookies and "csrf_token" in r.cookies
    return r.json()["data"]["access_token"]


def test_rotas_exigem_login_e_papel(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "auth_disabled", False)
    assert client.get("/api/cadastros/frentes").status_code == 401

    _criar("encarregado@obra.com", "SenhaForte123")
    _criar("planejamento@obra.com", "SenhaForte456", admin=True)
    t_user = _token(client, "encarregado@obra.com", "SenhaForte123")
    t_admin = _token(client, "planejamento@obra.com", "SenhaForte456")

    h_user = {"Authorization": f"Bearer {t_user}"}
    assert client.get("/api/cadastros/frentes", headers=h_user).status_code == 200
    # carga de referência é só do papel admin
    r = client.post("/api/referencias/versoes/carregar", headers=h_user, data={"rotulo": "x"},
                    files={"arquivo": ("a.xlsx", b"x")})
    assert r.status_code == 403 and r.json()["ok"] is False
    assert client.get("/api/simova/exportar/opers-pendentes",
                      headers={"Authorization": f"Bearer {t_admin}"}).status_code == 200
    me = client.get("/api/auth/me", headers=h_user).json()
    assert me["ok"] and me["data"]["email"] == "encarregado@obra.com"
