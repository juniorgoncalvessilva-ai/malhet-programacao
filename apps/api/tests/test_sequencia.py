"""Spec 054: sequência da programação (ordem manual + ligações TI/II/TT/IT) e conferência pelas janelas."""
from datetime import date

import pytest

from app.modules.planejamento.domain.sequencia import Ligacao, conferir, ordem_cronologica, validar
from app.shared.errors import DomainError
from tests.test_pq_contrato import pq_contrato

LISTA = "CWA\tAtivo\tDESCRICAO CWA\tLocal\n004.05\tED-1800AA-01\tGalpão de resíduos classe II\tNovo CMD"
D = lambda d: date(2026, 11, d)  # noqa: E731


def test_dominio():
    assert conferir(Ligacao(1, "TI"), (D(10), D(11)), (D(12), D(13))) is None
    assert "antes do término" in conferir(Ligacao(1, "TI"), (D(10), D(12)), (D(12), D(13)))
    # TI com 2 dias de defasagem (como no P6): termina 11/11 → pode começar a partir de 14/11
    assert conferir(Ligacao(1, "TI", 2), (D(10), D(11)), (D(14), D(15))) is None
    assert "+ 2 d" in conferir(Ligacao(1, "TI", 2), (D(10), D(11)), (D(13), D(14)))
    assert conferir(Ligacao(1, "II"), (D(10), D(12)), (D(10), D(11))) is None
    assert "antes do início" in conferir(Ligacao(1, "II"), (D(10), D(12)), (D(9), D(11)))
    assert "termina" in conferir(Ligacao(1, "TT"), (D(10), D(12)), (D(9), D(11)))
    assert conferir(Ligacao(1, "IT"), (D(10), D(12)), (D(8), D(10))) is None
    assert conferir(Ligacao(1, "TI"), None, (D(8), D(10))) is None
    with pytest.raises(DomainError):
        Ligacao(1, "XX")
    with pytest.raises(DomainError):  # ciclo
        validar({1: [Ligacao(2, "TI")], 2: [Ligacao(1, "TI")]}, {1, 2})
    with pytest.raises(DomainError):
        validar({1: [Ligacao(1, "TI")]}, {1})
    # a 3 começa antes, mas depende da 1 (TI): vem depois dela; a 2 sem previsto vai para o fim
    jan = {1: (D(12), D(13)), 2: None, 3: (D(10), D(11))}
    assert ordem_cronologica([1, 2, 3], jan, {1: 1, 2: 2, 3: 3}, {3: [Ligacao(1, "TI")]}) == [1, 3, 2]
    assert ordem_cronologica([1, 2, 3], jan, {1: 1, 2: 2, 3: 3}, {}) == [3, 1, 2]


def test_sequencia_na_programacao(client):
    client.post("/api/importar/takeoff", data={"rotulo": "PQ"}, files={"arquivo": ("pq.xlsx", pq_contrato())})
    client.post("/api/frentes/importar", json={"texto": LISTA})
    g = client.post("/api/catalogo/grupos", json={"descricao": "Concreto"}).json()
    client.post(f"/api/catalogo/grupos/{g['id']}/itens-pq", json={"itens": ["1.8.3.1.2", "1.8.3.1.3"]})
    tipos = client.get("/api/catalogo").json()[0]["tipos"]
    area = client.get("/api/frentes").json()[0]["areas"][0]
    p = client.post("/api/programacoes", json={"tipo": "SEMANAL", "referencia": "2026-11-10"}).json()
    ids = [client.post(f"/api/programacoes/{p['id']}/linhas", json={"area_id": area["id"], "tipo_id": t["id"]}).json()["id"] for t in tipos]
    v = client.get(f"/api/programacoes/{p['id']}").json()
    dias = [d["data"] for d in v["dias"]]
    # linha A: dias 3 e 4 do período; linha B: dias 1 e 2 (antes de A)
    a, b = ids
    def prev(lid, ds):
        client.put(f"/api/programacoes/{p['id']}/linhas/{lid}/valores", json={"campo": "previsto", "valores": [{"data": x, "valor": 5} for x in ds]})
    prev(a, dias[2:4]); prev(b, dias[0:2])
    # B depende de A (TI) → alerta, pois B começa antes de A terminar
    r = client.put(f"/api/programacoes/{p['id']}/sequencia", json={"ordem": [a, b], "predecessoras": {str(b): [{"de": a, "tipo": "TI"}]}})
    assert r.status_code == 200, r.text
    v = client.get(f"/api/programacoes/{p['id']}").json()
    lns = {ln["id"]: ln for loc in v["locais"] for ar in loc["areas"] for ln in ar["linhas"]}
    assert v["sequenciada"] and (lns[a]["seq"], lns[b]["seq"]) == (1, 2)
    assert lns[b]["predecessoras"] == [{"de": a, "tipo": "TI", "lag": 0}] and "TI com nº 1" in lns[b]["alertas_sequencia"][0]
    assert lns[a]["janela"] == [dias[2], dias[3]]
    # ordem invertida manda na tela
    client.put(f"/api/programacoes/{p['id']}/sequencia", json={"ordem": [b, a], "predecessoras": {}})
    v = client.get(f"/api/programacoes/{p['id']}").json()
    assert [ln["id"] for ln in v["locais"][0]["areas"][0]["linhas"]] == [b, a]
    # ordenação cronológica sugerida (não grava): B (começa antes) e depois A
    assert client.post(f"/api/programacoes/{p['id']}/sequencia/previa").json()["ordem"] == [b, a]
    # erros: ordem incompleta, ciclo, tipo inválido
    assert client.put(f"/api/programacoes/{p['id']}/sequencia", json={"ordem": [a]}).status_code == 422
    assert client.put(f"/api/programacoes/{p['id']}/sequencia", json={"ordem": [a, b], "predecessoras": {str(a): [{"de": b, "tipo": "TI"}], str(b): [{"de": a, "tipo": "II"}]}}).status_code == 422
    assert client.put(f"/api/programacoes/{p['id']}/sequencia", json={"ordem": [a, b], "predecessoras": {str(b): [{"de": a, "tipo": "ZZ"}]}}).status_code == 422
