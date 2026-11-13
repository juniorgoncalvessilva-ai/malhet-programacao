"""Super Admin, obras e acessos (auth-kit + papel por obra) e isolamento de dados entre obras."""
import asyncio

from app.core.config import get_settings
from app.main import app
from app.modules.obras.application.acessos import garantir_superadmin
from app.modules.obras.infra.contas_authkit import ContasAuthKit


def _login(client, email, senha) -> dict:
    r = client.post("/api/auth/login", json={"email": email, "password": senha})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['data']['access_token']}"}


def test_superadmin_obras_acessos_e_isolamento(client, monkeypatch):
    obra_a = int(client.headers.pop("X-Obra-Id"))
    monkeypatch.setattr(get_settings(), "auth_disabled", False)
    contas = ContasAuthKit(app.state.auth)
    asyncio.run(garantir_superadmin(contas, "super@obra.com", "SuperSenha123"))
    asyncio.run(garantir_superadmin(contas, "super@obra.com", "SuperSenha123"))  # idempotente
    sa = _login(client, "super@obra.com", "SuperSenha123")
    assert client.get("/api/eu", headers=sa).json()["superadmin"] is True

    # super admin cria a obra B e dá acesso a um planejador (conta nova) e a um encarregado
    r = client.post("/api/admin/obras", headers=sa, json={"codigo": "m450", "nome": "Usina 1 · Montagem"})
    assert r.status_code == 201 and r.json()["codigo"] == "M450"
    obra_b = r.json()["id"]
    assert client.post("/api/admin/obras", headers=sa, json={"codigo": "M450", "nome": "Outra"}).status_code == 422
    r = client.post(f"/api/obras/{obra_b}/acessos", headers=sa,
                    json={"email": "plan@obra.com", "papel": "planejador", "senha_inicial": "SenhaForte123"})
    assert r.status_code == 201 and r.json()["conta_criada"] is True
    r = client.post(f"/api/obras/{obra_b}/acessos", headers=sa, json={"email": "enc@obra.com", "papel": "encarregado"})
    assert r.status_code == 422  # encarregado sem crachá
    r = client.post(f"/api/obras/{obra_b}/acessos", headers=sa,
                    json={"email": "enc@obra.com", "papel": "encarregado", "cracha": "115095", "senha_inicial": "x"})
    assert r.status_code == 422  # senha fraca: regra do auth-kit
    r = client.post(f"/api/obras/{obra_b}/acessos", headers=sa,
                    json={"email": "enc@obra.com", "papel": "encarregado", "cracha": "115095", "senha_inicial": "SenhaForte456"})
    assert r.status_code == 201
    contas_lista = client.get("/api/admin/usuarios", headers=sa).json()
    assert {c["email"] for c in contas_lista} >= {"super@obra.com", "plan@obra.com", "enc@obra.com"}

    plan = _login(client, "plan@obra.com", "SenhaForte123")
    enc = _login(client, "enc@obra.com", "SenhaForte456")
    assert [o["codigo"] for o in client.get("/api/obras/minhas", headers=plan).json()] == ["M450"]
    assert client.get("/api/admin/obras", headers=plan).status_code == 403  # não é super admin

    hb = {**plan, "X-Obra-Id": str(obra_b)}
    assert client.get("/api/cadastros/frentes", headers=plan).status_code == 400  # sem obra escolhida
    assert client.get("/api/cadastros/frentes", headers={**plan, "X-Obra-Id": str(obra_a)}).status_code == 403
    assert client.get("/api/cadastros/frentes", headers=hb).status_code == 200
    # planejador não carrega versão nem envia FT (papel admin da obra)
    r = client.post("/api/referencias/versoes/carregar", headers=hb, data={"rotulo": "x"}, files={"arquivo": ("a.xlsx", b"x")})
    assert r.status_code == 403
    assert client.get("/api/simova/exportar/opers-pendentes", headers=hb).status_code == 403
    assert client.get(f"/api/obras/{obra_b}/acessos", headers=plan).status_code == 403

    # isolamento: equipe criada na obra B não aparece na obra A
    r = client.post("/api/equipes", headers=hb, json={"nome": "EQ-FORMA", "encarregado_cracha": "115095",
                                                     "composicao": [{"recurso": "Carpinteiro", "quantidade": 3}]})
    assert r.status_code == 201
    assert client.get("/api/equipes", headers={**sa, "X-Obra-Id": str(obra_a)}).json() == []
    assert len(client.get("/api/equipes", headers={**sa, "X-Obra-Id": str(obra_b)}).json()) == 1

    # encarregado: lê, mas não cria equipe e só programa a própria equipe
    he = {**enc, "X-Obra-Id": str(obra_b)}
    assert client.get("/api/equipes", headers=he).status_code == 200
    assert client.post("/api/equipes", headers=he, json={"nome": "X"}).status_code == 403
    item = {"encarregado_cracha": "999", "encarregado_nome": "Outro", "grupo_codigo": "4", "oper_codigo": "1.1",
            "frente_codigo": "30", "data_inicio": "2026-11-16", "data_fim": "2026-11-16",
            "dias": [{"data": "2026-11-16", "pe": 1}]}
    r = client.post("/api/programacao/itens", headers=he, json=item)
    assert r.status_code == 403 and "própria equipe" in r.json()["message"]

    # obra inativa some de "minhas" e bloqueia o acesso
    client.put(f"/api/admin/obras/{obra_b}", headers=sa, json={"codigo": "M450", "nome": "Usina 1 · Montagem", "ativa": False})
    assert client.get("/api/obras/minhas", headers=plan).json() == []
    assert client.get("/api/cadastros/frentes", headers=hb).status_code == 404


def test_seed_promove_conta_existente_e_tolera_senha_fraca(client):
    contas = ContasAuthKit(app.state.auth)
    asyncio.run(contas.criar_verificada("admin@construtora-demo.test", "SenhaForte123"))
    asyncio.run(garantir_superadmin(contas, "Admin@Construtora-Demo.test", ""))  # conta existe: só promove
    conta = asyncio.run(contas.por_email("admin@construtora-demo.test"))
    assert "superadmin" in conta.roles
    r = client.post("/api/auth/login", json={"email": "admin@construtora-demo.test", "password": "SenhaForte123"})
    assert r.status_code == 200  # senha não foi trocada
    import pytest
    from app.shared.errors import DomainError
    with pytest.raises(DomainError):  # senha fora da regra: o boot registra e segue (main.lifespan)
        asyncio.run(garantir_superadmin(contas, "novo@obra.com", "fraca"))


def test_paginas_por_usuario_e_programacao_vigente(client):
    obra = client.get("/api/obras/minhas").json()[0]
    a = client.post(f"/api/obras/{obra['id']}/acessos", json={"email": "leitor.paginas@ex.com", "papel": "leitor",
                                                               "senha_inicial": "Senha12345abc", "paginas": ["/app/vigente"]})
    assert a.status_code == 201, a.text
    ac = a.json()["acesso"]
    assert ac["paginas"] == ["/app/vigente"]
    r = client.put(f"/api/obras/{obra['id']}/acessos/{ac['id']}/paginas", json={"paginas": ["/app/lookahead", "x", "/app/vigente"]}).json()
    assert r["paginas"] == ["/app/lookahead", "/app/vigente"]
    assert client.put(f"/api/obras/{obra['id']}/acessos/{ac['id']}/paginas", json={"paginas": []}).json()["paginas"] is None
    assert client.get("/api/programacoes/vigente").json() == {"id": None, "revisao": None, "titulo": None}


def test_telas_do_celular_por_pessoa(client):
    """Spec 066: telas do app de campo por pessoa, separadas das páginas do web."""
    obra = client.get("/api/obras/minhas").json()[0]
    ac = client.post(f"/api/obras/{obra['id']}/acessos", json={"email": "campo.telas@ex.com", "papel": "encarregado", "cracha": "1",
                                                                "senha_inicial": "Senha12345abc", "paginas": ["/app/vigente"]}).json()["acesso"]
    assert ac["paginas_mobile"] is None  # todas as do papel
    url = f"/api/obras/{obra['id']}/acessos/{ac['id']}/paginas"
    r = client.put(url, json={"so_mobile": True, "paginas_mobile": ["/m/presenca", "/app/lookahead", "/m/lancar"]}).json()
    assert r["paginas_mobile"] == ["/m/lancar", "/m/presenca"] and r["paginas"] == ["/app/vigente"]  # o web não mudou
    r = client.put(url, json={"paginas": ["/app/lookahead"]}).json()
    assert r["paginas"] == ["/app/lookahead"] and r["paginas_mobile"] == ["/m/lancar", "/m/presenca"]  # o celular não mudou
    assert client.put(url, json={"so_mobile": True, "paginas_mobile": []}).json()["paginas_mobile"] is None
