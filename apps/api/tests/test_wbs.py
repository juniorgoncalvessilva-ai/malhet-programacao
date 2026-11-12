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
    # excluir o item do grupo: em programação não sai (diz onde está); fora dela, sai junto com o IWP da WBS
    r = client.delete(f"/api/catalogo/tipos/{tipo['id']}")
    assert r.status_code == 422 and "Programação semanal" in r.json()["detail"]
    lid = ln["id"]
    assert client.delete(f"/api/programacoes/{p['id']}/linhas/{lid}").status_code == 204
    assert client.delete(f"/api/catalogo/tipos/{tipo['id']}").status_code == 204
    assert client.get("/api/wbs").json()["arvore"][0]["filhos"][0]["filhos"][0]["filhos"] == []
    assert client.get("/api/catalogo").json()[0]["tipos"] == []


def test_enviar_da_wbs_para_a_programacao(client):
    client.post("/api/importar/takeoff", data={"rotulo": "PQ"}, files={"arquivo": ("pq.xlsx", pq_contrato())})
    area = client.post("/api/frentes/importar", json={"texto": LISTA}).json()[0]["areas"][0]
    g = client.post("/api/catalogo/grupos", json={"descricao": "Concreto"}).json()
    client.post(f"/api/catalogo/grupos/{g['id']}/itens-pq", json={"itens": ["1.8.3.1.2", "1.8.3.1.3"]})
    tipos = client.get("/api/catalogo").json()[0]["tipos"]
    no = lambda **k: client.post("/api/wbs/nos", json=k).json()  # noqa: E731
    a = no(tipo="area", area_id=area["id"])
    cwp = no(tipo="cwp", pai_id=a["id"], elemento="Radier", complemento="Sapata 2A")
    vazio = no(tipo="cwp", pai_id=a["id"], elemento="Pilares")
    gr = no(tipo="grupo", pai_id=cwp["id"], grupo_id=g["id"])
    i1 = no(tipo="iwp", pai_id=gr["id"], tipo_id=tipos[0]["id"])
    i2 = no(tipo="iwp", pai_id=gr["id"], tipo_id=tipos[1]["id"])
    p = client.post("/api/programacoes", json={"tipo": "SEMANAL", "referencia": "2026-11-10"}).json()
    # marcar o CWP leva os IWPs abaixo; o CWP vazio é avisado
    r = client.post(f"/api/programacoes/{p['id']}/linhas/da-wbs",
                    json={"nos": [cwp["id"], vazio["id"]], "natureza": "P", "qtd_periodo": {str(i1["id"]): 12}}).json()
    assert (r["criadas"], r["ja_estavam"], r["nos_sem_iwp"]) == (2, 0, [vazio["id"]])
    linhas = client.get(f"/api/programacoes/{p['id']}").json()["locais"][0]["areas"][0]["linhas"]
    assert {ln["wbs_codigo"] for ln in linhas} == {"004.05-01-1-01", "004.05-01-1-02"}
    assert all(ln["complemento"] == "Radier - Sapata 2A" for ln in linhas)
    assert next(ln for ln in linhas if ln["wbs_no_id"] == i1["id"])["qtd_periodo"] == 12
    # reenviar não duplica
    r = client.post(f"/api/programacoes/{p['id']}/linhas/da-wbs", json={"nos": [i2["id"], a["id"]]}).json()
    assert (r["criadas"], r["ja_estavam"]) == (0, 2)
