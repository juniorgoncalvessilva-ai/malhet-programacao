"""Spec 060: só o super admin exclui revisões emitidas da programação; a anterior volta a ser a vigente."""
import asyncio

from sqlalchemy import select

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.main import app
from app.modules.indicadores.infra.models import FatoProgramacaoModel
from app.modules.obras.application.acessos import garantir_superadmin
from app.modules.obras.infra.contas_authkit import ContasAuthKit
from tests.test_pq_contrato import pq_contrato

LISTA = "CWA\tAtivo\tDESCRICAO CWA\tLocal\n004.05\tED-1800AA-01\tGalpão de resíduos classe II\tNovo CMD"


def _programacao(client) -> int:
    client.post("/api/importar/takeoff", data={"rotulo": "PQ"}, files={"arquivo": ("pq.xlsx", pq_contrato())})
    client.post("/api/frentes/importar", json={"texto": LISTA})
    g = client.post("/api/catalogo/grupos", json={"descricao": "Concreto"}).json()
    client.post(f"/api/catalogo/grupos/{g['id']}/itens-pq", json={"itens": ["1.8.3.1.2"]})
    t = client.get("/api/catalogo").json()[0]["tipos"][0]
    area = client.get("/api/frentes").json()[0]["areas"][0]
    p = client.post("/api/programacoes", json={"tipo": "SEMANAL", "referencia": "2026-11-10"}).json()
    r = client.post(f"/api/programacoes/{p['id']}/linhas", json={"area_id": area["id"], "tipo_id": t["id"], "complemento": "Fundo canaleta"})
    assert r.status_code == 201, r.text
    lid = r.json()["id"]
    client.put(f"/api/programacoes/{p['id']}/linhas/{lid}/valores",
               json={"campo": "previsto", "valores": [{"data": "2026-11-09", "valor": 3}]})
    return p["id"]


def _revs_fato(pid):
    with SessionLocal() as s:
        return sorted({(f.revisao, f.vigente) for f in s.scalars(select(FatoProgramacaoModel).where(FatoProgramacaoModel.programacao_id == pid))})


def test_excluir_revisoes(client):
    pid = _programacao(client)
    for rev in (0, 1, 2):
        if rev:
            assert client.post(f"/api/programacoes/{pid}/reabrir").status_code == 204
        assert client.post(f"/api/programacoes/{pid}/emitir").json() == {"revisao": rev}
    assert _revs_fato(pid) == [(0, False), (1, False), (2, True)]

    # revisão do meio: some a foto e o histórico; a programação continua emitida
    r = client.delete(f"/api/programacoes/{pid}/emissoes/1")
    assert r.status_code == 200, r.text
    assert r.json() == {"excluida": 1, "restantes": [2, 0], "status": "emitida", "proxima_revisao": 3}
    assert [e["revisao"] for e in client.get(f"/api/programacoes/{pid}/emissoes").json()] == [2, 0]
    assert _revs_fato(pid) == [(0, False), (2, True)]
    assert client.get(f"/api/programacoes/{pid}/emissoes/1").status_code == 404

    # a última: volta a rascunho, a rev. 0 volta a valer e a próxima emissão reaproveita o número
    r = client.delete(f"/api/programacoes/{pid}/emissoes/2").json()
    assert (r["status"], r["proxima_revisao"]) == ("rascunho", 1)
    assert _revs_fato(pid) == [(0, True)]
    assert client.post(f"/api/programacoes/{pid}/emitir").json() == {"revisao": 1}
    assert client.delete(f"/api/programacoes/{pid}/emissoes/9").status_code == 404

    # concluída: a última emissão sustenta a conclusão
    lid = client.get(f"/api/programacoes/{pid}").json()["locais"][0]["areas"][0]["linhas"][0]["id"]
    client.put(f"/api/programacoes/{pid}/linhas/{lid}/valores", json={"campo": "realizado", "valores": [{"data": "2026-11-09", "valor": 3}]})
    r = client.post(f"/api/programacoes/{pid}/concluir")
    assert r.status_code == 200, r.text
    r = client.delete(f"/api/programacoes/{pid}/emissoes/1")
    assert r.status_code == 422 and "sustenta a conclusão" in r.text
    assert client.delete(f"/api/programacoes/{pid}/emissoes/0").json()["status"] == "concluida"


def test_so_super_admin_exclui(client, monkeypatch):
    pid = _programacao(client)
    client.post(f"/api/programacoes/{pid}/emitir")
    obra = client.headers["X-Obra-Id"]
    monkeypatch.setattr(get_settings(), "auth_disabled", False)
    asyncio.run(garantir_superadmin(ContasAuthKit(app.state.auth), "super@obra.com", "SuperSenha123"))

    def login(email, senha):
        r = client.post("/api/auth/login", json={"email": email, "password": senha})
        return {"Authorization": f"Bearer {r.json()['data']['access_token']}", "X-Obra-Id": obra}

    sa = login("super@obra.com", "SuperSenha123")
    r = client.post(f"/api/obras/{obra}/acessos", headers=sa, json={"email": "adm@obra.com", "papel": "admin", "senha_inicial": "SenhaForte123"})
    assert r.status_code == 201, r.text
    adm = login("adm@obra.com", "SenhaForte123")
    r = client.delete(f"/api/programacoes/{pid}/emissoes/0", headers=adm)
    assert r.status_code == 403 and "super admin" in r.text  # nem o admin da obra
    assert client.delete(f"/api/programacoes/{pid}/emissoes/0", headers=sa).status_code == 200
