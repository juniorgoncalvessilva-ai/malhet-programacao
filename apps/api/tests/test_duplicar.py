"""Spec 136: duplicar grupo e IWP no MESMO CWA — na WBS (para outro CWP, existente ou novo) e na programação (linhas do IWP
ou de um grupo, logo abaixo, para outra equipe)."""
from tests.test_pq_contrato import pq_contrato

LISTA = ("CWA\tAtivo\tDESCRICAO CWA\tLocal\n004.05\tED-1800AA-01\tGalpão de resíduos classe II\tNovo CMD\n"
         "004.04\tED-1800AA-02\tGalpão de resíduos classe I\tNovo CMD")


def _base(client):
    client.post("/api/importar/takeoff", data={"rotulo": "PQ"}, files={"arquivo": ("pq.xlsx", pq_contrato())})
    client.post("/api/frentes/importar", json={"texto": LISTA})
    g = client.post("/api/catalogo/grupos", json={"descricao": "Concreto"}).json()
    client.post(f"/api/catalogo/grupos/{g['id']}/itens-pq", json={"itens": ["1.8.3.1.2", "1.8.3.1.3"]})
    tipos = client.get("/api/catalogo").json()[0]["tipos"]
    no = lambda **k: client.post("/api/wbs/nos", json=k).json()  # noqa: E731
    a05, a04 = sorted(client.get("/api/wbs").json()["arvore"], key=lambda n: n["codigo"], reverse=True)
    cwp = no(tipo="cwp", pai_id=a05["id"], elemento="Radier", complemento="Sapata 2A")
    outro = no(tipo="cwp", pai_id=a05["id"], elemento="Radier", complemento="Sapata 2B")
    longe = no(tipo="cwp", pai_id=a04["id"], elemento="Radier")
    gr = no(tipo="grupo", pai_id=cwp["id"], grupo_id=g["id"])
    i1 = no(tipo="iwp", pai_id=gr["id"], tipo_id=tipos[0]["id"], quantidade=12)
    i2 = no(tipo="iwp", pai_id=gr["id"], tipo_id=tipos[1]["id"])
    client.post("/api/wbs/nos", json={"tipo": "etapa", "pai_id": i1["id"], "elemento": "Armação", "percentual": 0.4})
    return {"a05": a05, "cwp": cwp, "outro": outro, "longe": longe, "gr": gr, "i1": i1, "i2": i2}


def _filhos(client, nid):
    def ir(ns):
        for n in ns:
            if n["id"] == nid:
                return n
            r = ir(n["filhos"])
            if r:
                return r
    return ir(client.get("/api/wbs").json()["arvore"])


def test_duplicar_na_wbs(client):
    b = _base(client)
    dup = lambda nid, **k: client.post(f"/api/wbs/nos/{nid}/duplicar", json=k)  # noqa: E731
    # grupo inteiro para outro CWP do mesmo CWA: IWPs e etapas vão; quantidade só se pedir
    r = dup(b["gr"]["id"], cwp_id=b["outro"]["id"])
    assert r.status_code == 201 and (r.json()["criados"], r.json()["ja_estavam"]) == (2, 0)
    destino = _filhos(client, b["outro"]["id"])
    iwps = destino["filhos"][0]["filhos"]
    assert [i["item_pq"] for i in iwps] == ["1.8.3.1.2", "1.8.3.1.3"] and iwps[0]["quantidade"] is None
    assert iwps[0]["filhos"][0]["titulo"] == "Armação" and iwps[0]["codigo"].startswith("004.05-02-")
    # de novo: o que já está não repete
    assert dup(b["gr"]["id"], cwp_id=b["outro"]["id"]).json() == {**r.json(), "criados": 0, "ja_estavam": 2}
    # IWP para um CWP novo, com a quantidade
    r = dup(b["i1"]["id"], novo_cwp_elemento="Radier", novo_cwp_complemento="Sapata 3", quantidades=True).json()
    assert r["criados"] == 1 and "Sapata 3" in r["cwp"]
    novo = _filhos(client, r["cwp_id"])
    assert novo["filhos"][0]["filhos"][0]["quantidade"] == 12
    # nunca para outro CWA, nem para o mesmo CWP; só grupo/IWP
    assert dup(b["gr"]["id"], cwp_id=b["longe"]["id"]).status_code == 422
    assert dup(b["i2"]["id"], cwp_id=b["cwp"]["id"]).status_code == 422
    assert dup(b["cwp"]["id"], cwp_id=b["outro"]["id"]).status_code == 422
    assert dup(b["gr"]["id"]).status_code == 422
    outra = client.post("/api/admin/obras", json={"codigo": "OUT-DUP", "nome": "Outra"}).json()["id"]
    assert client.post(f"/api/wbs/nos/{b['gr']['id']}/duplicar", json={"cwp_id": b["outro"]["id"]},
                       headers={"X-Obra-Id": str(outra)}).status_code == 404


def test_duplicar_na_programacao(client):
    b = _base(client)
    p = client.post("/api/programacoes", json={"tipo": "SEMANAL", "referencia": "2026-11-10"}).json()
    client.post(f"/api/programacoes/{p['id']}/linhas/da-wbs", json={"nos": [b["gr"]["id"]], "qtd_periodo": {str(b["i2"]["id"]): 5}})
    linhas = lambda: [ln for l in client.get(f"/api/programacoes/{p['id']}").json()["locais"] for a in l["areas"] for ln in a["linhas"]]  # noqa: E731
    antes = linhas()
    assert len(antes) == 2  # etapa do i1 + i2
    eq = client.post("/api/equipes", json={"nome": "EQUIPE.9"})
    eq_id = eq.json()["id"] if eq.status_code in (200, 201) else None
    # o grupo inteiro (as duas linhas), para outra equipe
    r = client.post(f"/api/programacoes/{p['id']}/linhas/duplicar", json={"linhas": [x["id"] for x in antes], "equipe_id": eq_id})
    assert r.status_code == 201, r.text
    depois = linhas()
    assert len(depois) == 4 and {x["area_id"] for x in depois} == {antes[0]["area_id"]}  # mesmo CWA
    copias = [x for x in depois if x["id"] in r.json()["ids"]]
    assert {x["wbs_no_id"] for x in copias} == {x["wbs_no_id"] for x in antes}
    assert all(x["qtd_periodo"] is None for x in copias)
    # uma linha só
    r = client.post(f"/api/programacoes/{p['id']}/linhas/duplicar", json={"linhas": [antes[1]["id"]]})
    assert r.status_code == 201 and len(linhas()) == 5
    assert client.post(f"/api/programacoes/{p['id']}/linhas/duplicar", json={"linhas": [999999]}).status_code == 404
