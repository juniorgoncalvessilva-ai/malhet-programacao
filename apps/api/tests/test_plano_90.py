"""Plano de 90 dias (spec 043): itens pensados da WBS, restrições que alimentam o 6WLA, limpar → liberar, e migrar
para a programação mensal/semanal (semanal só com item liberado), com a quantidade do período e a memória dela."""
from datetime import date, timedelta

from app.modules.planos.domain import plano as dom
from tests.test_pq_contrato import pq_contrato

LISTA = "CWA\tAtivo\tDESCRICAO CWA\tLocal\n004.05\tED-1800AA-01\tGalpão de resíduos classe II\tNovo CMD"


def test_dominio_do_plano():
    sem = dom.semanas(date(2026, 11, 12))
    assert len(sem) == 13 and sem[0] == (date(2026, 11, 9), date(2026, 11, 15))
    assert dom.situacao(False, 0, False) == "analisar" and dom.situacao(True, 0, False) == "liberado"
    assert dom.situacao(True, 2, False) == "restricao" and dom.situacao(True, 2, True) == "programado"
    pr = dom.qtd_no_periodo(date(2026, 11, 1), date(2026, 11, 20), 100, date(2026, 11, 16), date(2026, 11, 22))
    assert (pr.dias_item, pr.dias_no_periodo, pr.sugerida) == (20, 5, 25)
    m = dom.memoria_qtd("P90-0001", "m³", date(2026, 11, 1), date(2026, 11, 20), pr, "S47", date(2026, 11, 16), date(2026, 11, 22))
    assert m.valor == "25 m³" and len(m.fontes) == 3


def test_plano_90_restricoes_e_migracao(client):
    client.post("/api/importar/takeoff", data={"rotulo": "PQ"}, files={"arquivo": ("pq.xlsx", pq_contrato())})
    client.post("/api/frentes/importar", json={"texto": LISTA})
    g = client.post("/api/catalogo/grupos", json={"descricao": "Concreto"}).json()
    client.post(f"/api/catalogo/grupos/{g['id']}/itens-pq", json={"itens": ["1.8.3.1.2"]})
    tipo = client.get("/api/catalogo").json()[0]["tipos"][0]
    area = client.get("/api/wbs").json()["arvore"][0]
    no = lambda **k: client.post("/api/wbs/nos", json=k).json()  # noqa: E731
    cwp = no(tipo="cwp", pai_id=area["id"], elemento="Radier")
    gr = no(tipo="grupo", pai_id=cwp["id"], grupo_id=g["id"])
    iwp = no(tipo="iwp", pai_id=gr["id"], tipo_id=tipo["id"], quantidade=70)

    hoje = date.today()
    seg = hoje - timedelta(days=hoje.weekday())
    # marco (pull planning) e itens pensados a partir da WBS
    marco = client.post("/api/planos/itens", json={"descricao": "Galpão liberado para montagem", "marco": True,
                                                  "inicio": str(seg + timedelta(weeks=8)), "fim": str(seg + timedelta(weeks=8))}).json()
    r = client.post("/api/planos/itens/da-wbs", json={"nos": [area["id"]], "inicio": str(seg), "fim": str(seg + timedelta(days=13)),
                                                      "marco_id": marco["id"]})
    assert r.status_code == 201 and r.json()["criados"] == 1
    assert client.post("/api/planos/itens/da-wbs", json={"nos": [iwp["id"]], "inicio": str(seg), "fim": str(seg)}).json()["ja_estavam"] == 1
    plano = client.get("/api/planos").json()
    assert len(plano["semanas"]) == 13 and plano["resumo"]["analisar"] == 1
    it = next(x for x in plano["itens"] if not x["marco"])
    assert (it["codigo"], it["wbs_no_id"], it["quantidade"], it["marco_id"], it["situacao"]) == ("P90-0002", iwp["id"], 70, marco["id"], "analisar")
    assert "Radier" in it["descricao"] and it["area"].startswith("004.05")
    assert client.post("/api/planos/itens", json={"descricao": "x", "inicio": str(seg), "fim": str(seg)}).status_code == 422
    assert client.post("/api/planos/itens", json={"descricao": "Andaime", "inicio": str(seg), "fim": str(seg - timedelta(days=1))}).status_code == 422

    # restrição do item → ação no Plano de Ação (6WLA), ligada ao item
    r = client.post(f"/api/planos/itens/{it['id']}/restricoes", json={"acao": "Liberar PT da área", "responsavel": "SSMA",
                                                                      "prazo_termino": str(hoje + timedelta(days=3)), "seis_m": "MET"})
    assert r.status_code == 201, r.text
    it = r.json()
    assert (it["situacao"], it["pendentes"], it["analisado"]) == ("restricao", 1, True)
    acao = next(a for a in client.get("/api/restricoes").json() if a["id"] == it["restricoes"][0]["id"])
    assert (acao["referencia"], acao["area_id"], acao["reuniao"]) == ("P90-0002", area["area_id"], "6WLA")

    # programação semanal: com restrição pendente o item não entra; a mensal aceita com aviso
    sem = client.post("/api/programacoes", json={"tipo": "SEMANAL", "referencia": str(seg)}).json()
    prev = client.get(f"/api/planos/migrar/{sem['id']}").json()
    p_it = prev["itens"][0]
    assert p_it["migravel"] and p_it["qtd_sugerida"] > 0 and f"qtd-{p_it['codigo']}" in prev["memorias"]
    r = client.post("/api/planos/migrar", json={"programacao_id": sem["id"], "itens": [it["id"]]}).json()
    assert r["criadas"] == 0 and "restrição" in r["bloqueados"][0]
    men = client.post("/api/programacoes", json={"tipo": "MENSAL", "referencia": str(hoje)}).json()
    r = client.post("/api/planos/migrar", json={"programacao_id": men["id"], "itens": [it["id"]]}).json()
    assert r["criadas"] == 1 and "pendente" in r["avisos"][0]

    # limpar a restrição → liberado; agora vai para a semanal com a quantidade do período
    it = client.post(f"/api/planos/restricoes/{it['restricoes'][0]['id']}/limpar", json={}).json()
    assert it["pendentes"] == 0 and it["situacao"] == "programado"  # já está na mensal
    assert next(a for a in client.get("/api/restricoes").json() if a["id"] == it["restricoes"][0]["id"])["status1"] == "Concluído"
    r = client.post("/api/planos/migrar", json={"programacao_id": sem["id"], "itens": [it["id"]], "qtd": {str(it["id"]): 35}}).json()
    assert r["criadas"] == 1 and not r["bloqueados"]
    assert client.post("/api/planos/migrar", json={"programacao_id": sem["id"], "itens": [it["id"]]}).json()["criadas"] == 0
    ln = client.get(f"/api/programacoes/{sem['id']}").json()["locais"][0]["areas"][0]["linhas"][0]
    assert ln["wbs_codigo"] and "P90-0002" in (ln["observacao"] or "")
    it = next(x for x in client.get("/api/planos").json()["itens"] if x["id"] == it["id"])
    assert {p["tipo"] for p in it["programacoes"]} == {"SEMANAL", "MENSAL"}
    # item programado não sai; o marco sai e solta quem ele puxava
    assert client.delete(f"/api/planos/itens/{it['id']}").status_code == 422
    assert client.delete(f"/api/planos/itens/{marco['id']}").status_code == 204
    assert next(x for x in client.get("/api/planos").json()["itens"] if x["id"] == it["id"])["marco_id"] is None


def test_nomes_da_marca(client):
    r = client.put("/api/obra/marca/nomes", json={"nome_contratada": "  Construtora   X ", "nome_contratante": "Cliente Y"})
    assert r.status_code == 200 and r.json()["nome_contratada"] == "Construtora X"
    assert client.get("/api/obra/marca").json()["nome_contratante"] == "Cliente Y"
