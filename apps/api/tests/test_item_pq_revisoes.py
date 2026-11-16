"""Specs 099 e 100: trocar o item da PQ de uma linha depois de emitida (vale na próxima revisão) e o super admin
renumerar as revisões emitidas (sem mudar conteúdo nem ordem)."""
import asyncio
from datetime import datetime, timedelta

import pytest
from sqlalchemy import select

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.main import app
from app.modules.indicadores.infra.models import FatoProgramacaoModel
from app.modules.obras.application.acessos import garantir_superadmin
from app.modules.obras.infra.contas_authkit import ContasAuthKit
from app.modules.planejamento.domain.revisoes import nova_numeracao, sequencial
from app.shared.errors import DomainError
from tests.test_excluir_revisao import _programacao


def _linha(client, pid):
    return client.get(f"/api/programacoes/{pid}").json()["locais"][0]["areas"][0]["linhas"][0]


def _emitir(client, pid, reabrir=True):
    if reabrir:
        assert client.post(f"/api/programacoes/{pid}/reabrir").status_code == 204
    r = client.post(f"/api/programacoes/{pid}/emitir")
    assert r.status_code == 200, r.text
    return r.json()["revisao"]


def test_trocar_item_pq_depois_de_emitida(client):
    pid = _programacao(client)
    _emitir(client, pid, reabrir=False)  # rev. 0 com o item errado
    ln = _linha(client, pid)
    assert ln["item_pq"] == "1.8.3.1.2"
    r = client.put(f"/api/programacoes/{pid}/linhas/{ln['id']}/item-pq", json={"item_pq": "1.8.3.1.3"})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["antes"] == "1.8.3.1.2" and j["item_pq"] == "1.8.3.1.3"
    assert j["tipo_criado"] == "1.2"  # o item não estava no Catálogo: entrou no mesmo grupo
    assert j["precisa_nova_revisao"] is True and j["proxima_revisao"] == 1
    novo = _linha(client, pid)
    assert novo["item_pq"] == "1.8.3.1.3" and novo["codigo_simova"].startswith("1.2.")  # complemento refeito no tipo novo
    # a rev. 0 emitida continua como foi impressa; a correção sai na rev. 1
    foto0 = client.get(f"/api/programacoes/{pid}/emissoes/0").json()
    assert foto0["locais"][0]["areas"][0]["linhas"][0]["item_pq"] == "1.8.3.1.2"
    assert _emitir(client, pid) == 1
    assert client.get(f"/api/programacoes/{pid}/emissoes/1").json()["locais"][0]["areas"][0]["linhas"][0]["item_pq"] == "1.8.3.1.3"

    # erros claros
    url = f"/api/programacoes/{pid}/linhas/{ln['id']}/item-pq"
    assert "já está no item" in client.put(url, json={"item_pq": "1.8.3.1.3"}).text
    assert "não está na PQ" in client.put(url, json={"item_pq": "9.9.9"}).text
    assert "título da PQ" in client.put(url, json={"item_pq": "1.8.3.1"}).text
    assert client.put(f"/api/programacoes/{pid}/linhas/999999/item-pq", json={"item_pq": "1.8.3.1.2"}).status_code == 404
    # volta para o item antigo (o tipo já existe: reaproveita)
    assert client.put(url, json={"item_pq": "1.8.3.1.2"}).json()["tipo_criado"] is None

    # concluída: só depois de Revisar
    client.put(f"/api/programacoes/{pid}/linhas/{ln['id']}/valores", json={"campo": "realizado", "valores": [{"data": "2026-11-09", "valor": 3}]})
    assert client.post(f"/api/programacoes/{pid}/concluir").status_code == 200
    r = client.put(url, json={"item_pq": "1.8.3.1.3"})
    assert r.status_code == 422 and "Revisar" in r.text
    assert client.post(f"/api/programacoes/{pid}/revisar", json={"motivo": "item da PQ errado"}).status_code == 200
    assert client.put(url, json={"item_pq": "1.8.3.1.3"}).status_code == 200


def _t(m):
    return datetime(2026, 11, 10) + timedelta(minutes=m)


def test_dominio_numeracao():
    em = [(0, _t(0)), (1, _t(1)), (2, _t(2)), (5, _t(3))]
    assert sequencial(em) == {0: 0, 1: 1, 2: 2, 5: 3}
    assert nova_numeracao(em, {5: 3}) == {0: 0, 1: 1, 2: 2, 5: 3}
    with pytest.raises(DomainError, match="duas revisões"):
        nova_numeracao(em, {5: 2})
    with pytest.raises(DomainError, match="número maior"):
        nova_numeracao(em, {0: 4})
    with pytest.raises(DomainError, match="não existe"):
        nova_numeracao(em, {7: 1})
    with pytest.raises(DomainError, match="inválido"):
        nova_numeracao(em, {5: -1})


def _fatos(pid):
    with SessionLocal() as s:
        return sorted({(f.revisao, f.vigente) for f in s.scalars(select(FatoProgramacaoModel).where(FatoProgramacaoModel.programacao_id == pid))})


def test_renumerar_revisoes(client):
    pid = _programacao(client)
    for k in range(4):
        _emitir(client, pid, reabrir=bool(k))  # rev. 0, 1, 2, 3 (testes)
    client.delete(f"/api/programacoes/{pid}/emissoes/1")
    client.delete(f"/api/programacoes/{pid}/emissoes/2")
    assert [e["revisao"] for e in client.get(f"/api/programacoes/{pid}/emissoes").json()] == [3, 0]

    # a rev. 3 vira rev. 1 no documento
    r = client.put(f"/api/programacoes/{pid}/emissoes/numeracao", json={"mapa": {"3": 1}})
    assert r.status_code == 200, r.text
    assert r.json()["alteradas"] == 1 and r.json()["proxima_revisao"] == 2
    lista = client.get(f"/api/programacoes/{pid}/emissoes").json()
    assert [(e["revisao"], e["revisao_original"]) for e in lista] == [(1, 3), (0, None)]
    foto = client.get(f"/api/programacoes/{pid}/emissoes/1").json()
    assert foto["revisao"] == 1 and foto["revisao_original"] == 3
    assert _fatos(pid) == [(0, False), (1, True)]
    assert client.get("/api/programacoes/vigente").json()["revisao"] == 1
    assert _emitir(client, pid) == 2  # a próxima continua do maior número

    # trocar a ordem não pode; em sequência tira os buracos
    assert client.put(f"/api/programacoes/{pid}/emissoes/numeracao", json={"mapa": {"0": 5}}).status_code == 422
    client.delete(f"/api/programacoes/{pid}/emissoes/1")
    r = client.put(f"/api/programacoes/{pid}/emissoes/numeracao", json={"sequencial": True}).json()
    assert r["numeracao"] == [{"de": 0, "para": 0}, {"de": 2, "para": 1}] and r["proxima_revisao"] == 2
    assert _fatos(pid) == [(0, False), (1, True)]


def test_so_super_admin_renumera(client, monkeypatch):
    pid = _programacao(client)
    client.post(f"/api/programacoes/{pid}/emitir")
    obra = client.headers["X-Obra-Id"]
    monkeypatch.setattr(get_settings(), "auth_disabled", False)
    asyncio.run(garantir_superadmin(ContasAuthKit(app.state.auth), "super@obra.com", "SuperSenha123"))

    def login(email, senha):
        r = client.post("/api/auth/login", json={"email": email, "password": senha})
        return {"Authorization": f"Bearer {r.json()['data']['access_token']}", "X-Obra-Id": obra}

    sa = login("super@obra.com", "SuperSenha123")
    client.post(f"/api/obras/{obra}/acessos", headers=sa, json={"email": "adm@obra.com", "papel": "admin", "senha_inicial": "SenhaForte123"})
    adm = login("adm@obra.com", "SenhaForte123")
    r = client.put(f"/api/programacoes/{pid}/emissoes/numeracao", headers=adm, json={"sequencial": True})
    assert r.status_code == 403 and "super admin" in r.text
    assert client.put(f"/api/programacoes/{pid}/emissoes/numeracao", headers=sa, json={"sequencial": True}).status_code == 200
