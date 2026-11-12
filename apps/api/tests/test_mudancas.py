"""Tempo real (spec 045): toda alteração bem-sucedida muda a marca da obra; leitura e erro não mudam."""


def test_marca_muda_so_com_alteracao_da_obra(client):
    m0 = client.get("/api/mudancas").json()["marca"]
    assert client.get("/api/frentes").status_code == 200
    assert client.get("/api/mudancas").json()["marca"] == m0  # leitura não muda
    assert client.post("/api/planos/itens", json={"descricao": "x", "inicio": "2026-11-12", "fim": "2026-11-12"}).status_code == 422
    assert client.get("/api/mudancas").json()["marca"] == m0  # erro não muda
    assert client.post("/api/planos/itens", json={"descricao": "Andaime", "inicio": "2026-11-12", "fim": "2026-11-13"}).status_code == 201
    m1 = client.get("/api/mudancas").json()["marca"]
    assert m1 != m0 and m1.split(".")[0] == m0.split(".")[0]
