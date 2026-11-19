"""Spec 116: importar a programação anterior para a nova e conferir o realizado acumulado com o projeto/programado."""
from app.modules.planejamento.domain.acumulado import conferir
from tests.test_programacao_simplificada import LISTA, takeoff


def test_conferencia_do_acumulado():
    c = conferir(100, 60, 30, 25)
    assert (c.situacao, c.acumulado, c.saldo_projeto, c.acima_do_programado) == ("em_andamento", 90, 10, True)
    assert c.mensagem("m³") == "acumulado 90 de 100 m³ do projeto · período 30 de 25 m³ programados"
    assert conferir(100, 60, 40, None).situacao == "concluiu"
    passou = conferir(100, 60, 45.5, 50)
    assert passou.excede_projeto and passou.mensagem("m³").startswith("acumulado 105,5 de 100 m³ do projeto · passa 5,5 m³")
    assert conferir(None, 0, 10, 5).situacao == "sem_projeto" and conferir(100, 0, 0.004 + 100, None).situacao == "concluiu"


def _montar(client) -> tuple[int, int, int]:
    arv = client.post("/api/frentes/importar", json={"texto": LISTA}).json()
    area = next(a for loc in arv for a in loc["areas"] if a["descricao"].startswith("ED-1800AA-01"))
    client.post("/api/importar/takeoff", data={"rotulo": "take-off"}, files={"arquivo": ("t.xlsx", takeoff())})
    g = client.post("/api/catalogo/grupos", json={"descricao": "Concreto"}).json()
    client.post(f"/api/catalogo/grupos/{g['id']}/itens-pq", json={"itens": ["1.5.3.1.2", "1.5.3.1.3"]})
    tipos = {t["item_pq"]: t["id"] for t in client.get("/api/catalogo").json()[0]["tipos"]}
    return area["id"], tipos["1.5.3.1.2"], tipos["1.5.3.1.3"]


def test_importar_anterior_e_conferir_realizado(client):
    area, t1, t2 = _montar(client)
    p1 = client.post("/api/programacoes", json={"tipo": "SEMANAL", "referencia": "2026-11-10"}).json()  # 06/11 → 14/11
    base = f"/api/programacoes/{p1['id']}"
    l1 = client.post(f"{base}/linhas", json={"area_id": area, "tipo_id": t1, "complemento": "Fundo", "qtd_projeto": 20,
                                             "qtd_periodo": 12, "responsavel": "Clayton"}).json()["id"]
    l2 = client.post(f"{base}/linhas", json={"area_id": area, "tipo_id": t2, "qtd_projeto": 5, "qtd_periodo": 5}).json()["id"]
    client.post(f"{base}/emitir")

    # realizado do dia: conferência com o projeto (20) e o programado (12)
    real = lambda lid, dia, q, **k: client.put(f"{base}/linhas/{lid}/valores", json={"campo": "realizado", "valores": [{"data": dia, "valor": q}], **k})  # noqa: E731
    c = real(l1, "2026-11-06", 10).json()["conferencia"]
    assert (c["situacao"], c["acumulado"], c["saldo_projeto"], c["acima_do_programado"]) == ("em_andamento", 10, 10, False)
    c = real(l1, "2026-11-07", 8).json()["conferencia"]
    assert c["acima_do_programado"] and c["realizado_periodo"] == 18 and "período 18 de 12" in c["mensagem"]
    r = real(l1, "2026-11-09", 3)  # 21 > 20 do projeto: trava até confirmar
    assert r.status_code == 422 and r.json()["campo"] == "excesso_projeto" and "passa 1" in r.json()["detail"]
    v = client.get(base).json()["locais"][0]["areas"][0]["linhas"]
    assert next(x for x in v if x["id"] == l1)["realizado"][3] is None  # nada gravado
    assert real(l2, "2026-11-06", 5).json()["conferencia"]["situacao"] == "concluiu"
    # pela tela (salvar de uma vez) vale o mesmo, e confirmar grava
    lote = {"linhas": [{"id": l1, "realizado": [{"data": "2026-11-09", "valor": 3}]}]}
    assert client.put(f"{base}/salvar", json=lote).status_code == 422
    c = client.put(f"{base}/salvar", json={**lote, "aceitar_excesso": True}).json()["conferencia"][0]
    assert c["situacao"] == "acima_do_projeto" and c["saldo_projeto"] == -1
    real(l1, "2026-11-09", None)  # desfaz: volta a 18
    ln = next(x for x in client.get(base).json()["locais"][0]["areas"][0]["linhas"] if x["id"] == l1)
    assert ln["conferencia"]["acumulado"] == 18 and ln["conferencia"]["programado_periodo"] == 12

    # semana seguinte: importar a anterior (sugerida), sem a concluída, com o saldo do período
    p2 = client.post("/api/programacoes", json={"tipo": "SEMANAL", "referencia": "2026-11-17"}).json()  # 13/11 → 21/11
    b2 = f"/api/programacoes/{p2['id']}"
    o = client.get(f"{b2}/importar/origens").json()
    assert o["sugerida"] == p1["id"] and o["origens"][0]["id"] == p1["id"]
    prev = {x["id"]: x for x in client.get(f"{b2}/importar/{p1['id']}").json()["linhas"]}
    assert (prev[l1]["situacao"], prev[l1]["restante"], prev[l1]["saldo_periodo"]) == ("entra", 2, 0)
    assert prev[l2]["situacao"] == "concluida"
    assert client.post(f"{b2}/importar", json={"de": p1["id"], "quantidade": "saldo"}).json() == \
        {"importadas": 1, "ja_estavam": 0, "concluidas_fora": 1}
    assert client.post(f"{b2}/importar", json={"de": p1["id"]}).json() == {"importadas": 0, "ja_estavam": 1, "concluidas_fora": 1}
    nova = client.get(b2).json()["locais"][0]["areas"][0]["linhas"]
    assert len(nova) == 1 and nova[0]["responsavel"] == "Clayton" and nova[0]["qtd_projeto"] == 20
    assert nova[0]["qtd_periodo"] is None and nova[0]["realizado_anterior"] == 18 and nova[0]["restante"] == 2
    assert client.post(f"{b2}/importar", json={"de": p2["id"]}).status_code == 422  # ela mesma

    # na criação: reaproveitar itens da anterior, trazendo a concluída quando pedido
    p3 = client.post("/api/programacoes", json={"tipo": "SEMANAL", "referencia": "2026-11-24", "copiar_de": p1["id"],
                                                "incluir_concluidas": True}).json()
    assert p3["linhas"] == 2
    # emitida não recebe importação
    client.post(f"{b2}/emitir")
    assert client.post(f"{b2}/importar", json={"de": p1["id"]}).status_code == 422
    # no projeto a semana 2 conhece o acumulado da 1: 18 + 3 passa dos 20
    r = client.put(f"{b2}/linhas/{nova[0]['id']}/valores", json={"campo": "realizado", "valores": [{"data": "2026-11-16", "valor": 3}]})
    assert r.status_code == 422 and r.json()["campo"] == "excesso_projeto"


def test_memoria_do_acumulado(client):
    area, t1, _ = _montar(client)
    p = client.post("/api/programacoes", json={"tipo": "SEMANAL", "referencia": "2026-11-10"}).json()
    lid = client.post(f"/api/programacoes/{p['id']}/linhas", json={"area_id": area, "tipo_id": t1, "qtd_projeto": 20, "qtd_periodo": 12}).json()["id"]
    client.post(f"/api/programacoes/{p['id']}/emitir")
    client.put(f"/api/programacoes/{p['id']}/linhas/{lid}/valores", json={"campo": "realizado", "valores": [{"data": "2026-11-06", "valor": 7}]})
    m = client.get(f"/api/programacoes/{p['id']}/linhas/{lid}/memoria").json()["memorias"]["acumulado"]
    assert m["valor"].startswith("7") and any("saldo 13" in x["resultado"] for x in m["passos"])
    s = client.get(f"/api/programacoes/{p['id']}/linhas/{lid}/memoria").json()["memorias"]["saldo_periodo"]
    assert s["valor"].startswith("5")  # 12 programado − 7 feito, cabe nos 13 que restam
