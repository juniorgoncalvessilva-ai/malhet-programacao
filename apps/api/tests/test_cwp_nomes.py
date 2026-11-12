"""Spec 046: nível CWP na programação e nome reduzido + complemento (padrão) × descritivo da PQ."""
from io import BytesIO

from openpyxl import load_workbook

from tests.test_pq_contrato import pq_contrato

LISTA = "CWA\tAtivo\tDESCRICAO CWA\tLocal\n004.05\tED-1800AA-01\tGalpão de resíduos classe II\tNovo CMD"


def test_cwp_e_nome_reduzido_na_programacao(client):
    client.post("/api/importar/takeoff", data={"rotulo": "PQ"}, files={"arquivo": ("pq.xlsx", pq_contrato())})
    client.post("/api/frentes/importar", json={"texto": LISTA})
    g = client.post("/api/catalogo/grupos", json={"descricao": "Concreto"}).json()
    client.post(f"/api/catalogo/grupos/{g['id']}/itens-pq", json={"itens": ["1.8.3.1.2"]})
    client.put("/api/catalogo/nomes-simplificados", json={"itens": [{"item": "1.8.3.1.2", "nome": "Concreto fck 30"}]})
    tipo = client.get("/api/catalogo").json()[0]["tipos"][0]
    area = client.get("/api/wbs").json()["arvore"][0]
    no = lambda **k: client.post("/api/wbs/nos", json=k).json()  # noqa: E731
    cwp = no(tipo="cwp", pai_id=area["id"], elemento="Radier", complemento="Eixo A–B")
    gr = no(tipo="grupo", pai_id=cwp["id"], grupo_id=g["id"])
    iwp = no(tipo="iwp", pai_id=gr["id"], tipo_id=tipo["id"])
    p = client.post("/api/programacoes", json={"tipo": "SEMANAL", "referencia": "2026-11-10"}).json()
    client.post(f"/api/programacoes/{p['id']}/linhas", json={"wbs_no_id": iwp["id"]})
    ln = client.get(f"/api/programacoes/{p['id']}").json()["locais"][0]["areas"][0]["linhas"][0]
    assert ln["cwp"] == {"id": cwp["id"], "codigo": "004.05-01", "texto": "Radier - Eixo A–B"}
    assert ln["descricao_reduzida"] == "Concreto fck 30 - (Radier - Eixo A–B)"
    assert ln["descricao_completa"].startswith(ln["descricao_pq"]) and ln["descricao_completa"].endswith("(Radier - Eixo A–B)")
    assert ln["descricao_completa"] != ln["descricao_reduzida"]
    # Excel: nome reduzido por padrão; nomes=pq volta ao descritivo
    def coluna_j(**q):
        r = client.get(f"/api/programacoes/{p['id']}/excel", params=q)
        ws = load_workbook(BytesIO(r.content)).active
        return [c.value for c in ws["J"] if isinstance(c.value, str) and c.value.startswith(ln["codigo_simova"] + " - ")]
    assert coluna_j() == [f"{ln['codigo_simova']} - Concreto fck 30 - (Radier - Eixo A–B)"]
    assert coluna_j(nomes="pq") == [f"{ln['codigo_simova']} - {ln['descricao_completa']}"]
