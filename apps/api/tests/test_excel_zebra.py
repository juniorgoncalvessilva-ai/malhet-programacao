"""Spec 055: Excel do cliente no modelo S27 — faixa do local em vermelho na linha toda e atividades alternadas
(branca / azul-claro C5D9F1 nas colunas G..AJ; P/R e dias sem preenchimento)."""
from io import BytesIO

from openpyxl import load_workbook

from tests.test_pq_contrato import pq_contrato

LISTA = "CWA\tAtivo\tDESCRICAO CWA\tLocal\n004.05\tED-1800AA-01\tGalpão de resíduos classe II\tNovo CMD"


def _cor(c):
    return c.fill.fgColor.rgb if c.fill and c.fill.fill_type else None


def test_excel_zebrado_no_modelo(client):
    client.post("/api/importar/takeoff", data={"rotulo": "PQ"}, files={"arquivo": ("pq.xlsx", pq_contrato())})
    client.post("/api/frentes/importar", json={"texto": LISTA})
    g = client.post("/api/catalogo/grupos", json={"descricao": "Concreto"}).json()
    client.post(f"/api/catalogo/grupos/{g['id']}/itens-pq", json={"itens": ["1.8.3.1.2", "1.8.3.1.3"]})
    tipos = client.get("/api/catalogo").json()[0]["tipos"]
    area = client.get("/api/frentes").json()[0]["areas"][0]
    p = client.post("/api/programacoes", json={"tipo": "SEMANAL", "referencia": "2026-11-10"}).json()
    for t in tipos + tipos[:1]:
        client.post(f"/api/programacoes/{p['id']}/linhas", json={"area_id": area["id"], "tipo_id": t["id"], "complemento": f"X{t['id']}"})
    ws = load_workbook(BytesIO(client.get(f"/api/programacoes/{p['id']}/excel").content)).active
    linhas = [r for r in range(12, ws.max_row + 1) if ws[f"AK{r}"].value == "P"]
    assert len(linhas) == 3
    local = 12
    assert _cor(ws[f"G{local}"]) == _cor(ws[f"J{local}"]) == _cor(ws[f"AJ{local}"]) == "FFFF0000"  # linha toda
    assert _cor(ws[f"J{linhas[0]}"]) is None and _cor(ws[f"J{linhas[1]}"]) == "FFC5D9F1" and _cor(ws[f"J{linhas[2]}"]) is None
    assert _cor(ws[f"U{linhas[1]}"]) == "FFC5D9F1" and _cor(ws[f"AL{linhas[1]}"]) is None  # dias sem zebra
