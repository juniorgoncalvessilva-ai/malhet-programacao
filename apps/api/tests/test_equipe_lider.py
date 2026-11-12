"""Spec 047: engenheiro/supervisor do efetivo lidera a equipe e vira o Responsável na programação."""
from tests.test_efetivo import efetivo
from tests.test_pq_contrato import pq_contrato

LISTA = "CWA\tAtivo\tDESCRICAO CWA\tLocal\n004.05\tED-1800AA-01\tGalpão de resíduos classe II\tNovo CMD"


def test_lider_do_efetivo_preenche_responsavel(client):
    client.post("/api/efetivo/importar", files={"arquivo": ("EFETIVO.xlsx", efetivo(1))})
    cs = {c["nome"]: c for c in client.get("/api/efetivo/colaboradores").json()}
    enc, lider = cs["ENCARREGADO TESTE UM"]["id"], cs["MOTORISTA TERCEIRO"]
    eq = client.post("/api/efetivo/equipes", json={"nome": "EQUIPE.1_FORMA", "encarregado_id": enc, "colaboradores": []}).json()
    corpo = next(e for e in client.get("/api/equipes").json() if e["id"] == eq["id"])
    r = client.put(f"/api/equipes/{eq['id']}", json={**corpo, "responsavel_id": lider["id"], "responsavel": "texto velho"})
    assert r.status_code == 200, r.text
    e = r.json()
    assert (e["responsavel"], e["responsavel_id"], e["responsavel_efetivo"]["nome"]) == (lider["nome"], lider["id"], lider["nome"])
    assert client.put(f"/api/equipes/{eq['id']}", json={**corpo, "responsavel_id": 999999}).status_code == 422

    # a linha da programação com essa equipe já sai com o responsável (sem digitar)
    client.post("/api/importar/takeoff", data={"rotulo": "PQ"}, files={"arquivo": ("pq.xlsx", pq_contrato())})
    client.post("/api/frentes/importar", json={"texto": LISTA})
    g = client.post("/api/catalogo/grupos", json={"descricao": "Concreto"}).json()
    client.post(f"/api/catalogo/grupos/{g['id']}/itens-pq", json={"itens": ["1.8.3.1.2"]})
    tipo = client.get("/api/catalogo").json()[0]["tipos"][0]
    area = client.get("/api/frentes").json()[0]["areas"][0]
    p = client.post("/api/programacoes", json={"tipo": "SEMANAL", "referencia": "2026-11-10"}).json()
    client.post(f"/api/programacoes/{p['id']}/linhas", json={"area_id": area["id"], "tipo_id": tipo["id"], "equipe_id": eq["id"]})
    ln = client.get(f"/api/programacoes/{p['id']}").json()["locais"][0]["areas"][0]["linhas"][0]
    assert ln["responsavel"] == lider["nome"] and ln["encarregado"]
