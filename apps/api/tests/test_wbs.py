"""WBS de execução: Área → CWP (elemento + complemento) → Grupo → IWP (item da PQ) e a linha da programação nascendo do IWP."""
from tests.test_pq_contrato import pq_contrato

LISTA = "CWA\tAtivo\tDESCRICAO CWA\tLocal\n004.05\tED-1800AA-01\tGalpão de resíduos classe II\tNovo CMD"


def test_wbs_e_linha_da_programacao(client):
    client.post("/api/importar/takeoff", data={"rotulo": "PQ"}, files={"arquivo": ("pq.xlsx", pq_contrato())})
    area = client.post("/api/frentes/importar", json={"texto": LISTA}).json()[0]["areas"][0]
    g = client.post("/api/catalogo/grupos", json={"descricao": "Concreto"}).json()
    client.post(f"/api/catalogo/grupos/{g['id']}/itens-pq", json={"itens": ["1.8.3.1.2"]})
    tipo = client.get("/api/catalogo").json()[0]["tipos"][0]
    g2 = client.post("/api/catalogo/grupos", json={"descricao": "Forma"}).json()

    no = lambda **k: client.post("/api/wbs/nos", json=k)  # noqa: E731
    a = no(tipo="area", area_id=area["id"]).json()
    assert a["codigo"] == "004.05"
    assert no(tipo="area", area_id=area["id"]).status_code == 422  # área repetida
    assert no(tipo="cwp", elemento="Radier").status_code == 422  # CWP precisa de área
    cwp = no(tipo="cwp", pai_id=a["id"], elemento="Radier", complemento="Eixo A–B").json()
    assert cwp["codigo"] == "004.05-01"
    assert no(tipo="cwp", pai_id=a["id"], elemento="radier", complemento="eixo a–b").status_code == 422
    gr = no(tipo="grupo", pai_id=cwp["id"], grupo_id=g["id"]).json()
    assert gr["codigo"] == "004.05-01-1"
    assert no(tipo="iwp", pai_id=cwp["id"], tipo_id=tipo["id"]).status_code == 422  # IWP fica abaixo de grupo
    gr2 = no(tipo="grupo", pai_id=cwp["id"], grupo_id=g2["id"]).json()
    assert no(tipo="iwp", pai_id=gr2["id"], tipo_id=tipo["id"]).status_code == 422  # item não é do grupo Forma
    iwp = no(tipo="iwp", pai_id=gr["id"], tipo_id=tipo["id"]).json()
    assert iwp["codigo"] == "004.05-01-1-01"

    arv = client.get("/api/wbs").json()["arvore"]
    i = arv[0]["filhos"][0]["filhos"][0]["filhos"][0]
    assert (i["item_pq"], i["qtd_takeoff"], i["quantidade_efetiva"], i["origem_qtd"]) == ("1.8.3.1.2", 50.0, 50.0, "take-off")
    assert arv[0]["filhos"][0]["titulo"] == "Radier - Eixo A–B" and "Radier - Eixo A–B" in i["caminho"]
    client.put(f"/api/wbs/nos/{iwp['id']}", json={"tipo": "iwp", "quantidade": 42})
    i = client.get("/api/wbs").json()["arvore"][0]["filhos"][0]["filhos"][0]["filhos"][0]
    assert (i["quantidade_efetiva"], i["origem_qtd"]) == (42, "digitada")

    # linha da programação só com o IWP: área, tipo, item da PQ, complemento (CWP) e quantidade vêm da WBS
    p = client.post("/api/programacoes", json={"tipo": "SEMANAL", "referencia": "2026-11-10"}).json()
    r = client.post(f"/api/programacoes/{p['id']}/linhas", json={"wbs_no_id": iwp["id"]})
    assert r.status_code == 201, r.text
    ln = client.get(f"/api/programacoes/{p['id']}").json()["locais"][0]["areas"][0]["linhas"][0]
    assert ln["wbs_codigo"] == "004.05-01-1-01" and ln["item_pq"] == "1.8.3.1.2" and ln["qtd_projeto"] == 42
    assert ln["complemento"] == "Radier - Eixo A–B" and ln["codigo_simova"] == "1.1.1"
    assert client.post(f"/api/programacoes/{p['id']}/linhas", json={"wbs_no_id": gr["id"]}).status_code == 422
    assert client.post(f"/api/programacoes/{p['id']}/linhas", json={}).status_code == 422
    # IWP em programação não sai (inativar); nó com filhos também não
    assert client.delete(f"/api/wbs/nos/{iwp['id']}").status_code == 422
    assert client.delete(f"/api/wbs/nos/{cwp['id']}").status_code == 422
    assert client.delete(f"/api/wbs/nos/{gr2['id']}").status_code == 204
