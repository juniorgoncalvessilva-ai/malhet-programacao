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


def _xer_com_recursos() -> bytes:
    linhas = [
        "ERMHDR\t24.12",
        "%T\tPROJECT", "%F\tproj_id\tproj_short_name\tlast_recalc_date", "%R\t1\tTAM\t2026-11-01 00:00",
        "%T\tPROJWBS", "%F\twbs_id\tproj_id\tproj_node_flag\tseq_num\twbs_short_name\twbs_name\tparent_wbs_id",
        "%R\t10\t1\tY\t0\tTAM\tProjeto\t", "%R\t20\t1\tN\t1\t5\tO.S. 1\t10", "%R\t21\t1\tN\t2\t4\tCWP - CONSTRUÇÃO\t20",
        "%R\t22\t1\tN\t1\t3\tCWA 004 - Novo CMD\t21", "%R\t23\t1\tN\t1\t4\tCWA 004.05 - ED-1800AA-01 - Galpão\t22",
        "%R\t30\t1\tN\t1\t3\tPWP - SUPRIMENTOS\t20",
        "%T\tUMEASURE", "%F\tunit_id\tseq_num\tunit_abbrev\tunit_name", "%R\t101\t1\tm³\tMetro cúbico",
        "%T\tRSRC", "%F\trsrc_id\trsrc_name\trsrc_short_name\tunit_id\trsrc_type",
        "%R\t1\tPEDREIRO (HH)\tTAM-PED\t\tRT_Labor", "%R\t2\tBETONEIRA (HM)\tTAM-BET\t\tRT_Equip", "%R\t3\tCONCRETO FCK30\tTAM-C30\t101\tRT_Mat",
        "%T\tTASK", "%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\ttask_type\tstatus_code\tearly_start_date\tearly_end_date\tact_start_date\tact_end_date",
        "%R\t1\t1\t23\tC-1\tForma do radier\tTT_Task\tTK_NotStart\t2026-12-01 07:00\t2026-12-10 17:00\t\t",
        "%R\t2\t1\t23\tC-2\tConcreto do radier\tTT_Task\tTK_Active\t2026-12-05 07:00\t2026-12-20 17:00\t2026-12-05 07:00\t",
        "%R\t3\t1\t23\tC-3\tLimpeza do terreno\tTT_Task\tTK_Complete\t2026-11-20 07:00\t2026-12-02 17:00\t2026-11-20 07:00\t2026-12-02 17:00",
        "%R\t4\t1\t23\tC-4\tFundação fora do período\tTT_Task\tTK_NotStart\t2027-03-01 07:00\t2027-03-10 17:00\t\t",
        "%R\t5\t1\t30\tS-1\tCompra de aço\tTT_Task\tTK_NotStart\t2026-12-01 07:00\t2026-12-05 17:00\t\t",
        "%T\tTASKRSRC", "%F\ttaskrsrc_id\ttask_id\tproj_id\trsrc_id\ttarget_qty\tremain_qty\trsrc_type",
        "%R\t1\t2\t1\t1\t120\t80\tRT_Labor", "%R\t2\t2\t1\t2\t30\t30\tRT_Equip", "%R\t3\t2\t1\t3\t45\t45\tRT_Mat",
        "%R\t4\t1\t1\t1\t60\t60\tRT_Labor",
        "%E",
    ]
    return "\r\n".join(linhas).encode("cp1252")


def test_puxar_do_cronograma_por_periodo_com_recursos(client):
    client.post("/api/frentes/importar", json={"texto": LISTA})
    assert client.post("/api/importar/xer", data={"rotulo": "S48"}, files={"arquivo": ("c.xer", _xer_com_recursos())}).status_code == 200
    periodo = {"inicio": "2026-12-01", "fim": "2026-12-31"}
    pv = client.post("/api/planos/cronograma/previa", json=periodo).json()
    # C-4 fora do período, S-1 fora da construção (PWP), C-3 concluída: fica de fora por padrão
    assert [a["id_crono"] for a in pv["atividades"]] == ["C-1", "C-2"]
    assert (pv["concluidas_excluidas"], pv["fora_da_construcao"]) == (1, 1)
    c2 = pv["atividades"][1]
    assert c2["area"].startswith("004.05") and {r["codigo"] for r in c2["recursos"]} == {"TAM-PED", "TAM-BET", "TAM-C30"}
    mat = next(r for r in c2["recursos"] if r["tipo"] == "material")
    assert (mat["qtd"], mat["unid"]) == (45, "m³") and next(r for r in c2["recursos"] if r["tipo"] == "mao_de_obra")["restante"] == 80
    # só os escolhidos
    r = client.post("/api/planos/itens/do-cronograma", json={**periodo, "ids": ["C-2"]}).json()
    assert (r["novos"], r["atualizados"]) == (1, 0)
    r = client.post("/api/planos/itens/do-cronograma", json={**periodo, "excluir_concluidas": False}).json()
    assert (r["novos"], r["atualizados"], r["concluidas_excluidas"]) == (2, 1, 0)  # C-1 e C-3 novas; C-2 atualizada
    itens = {i["id_crono"]: i for i in client.get("/api/planos?inicio=2026-11-23").json()["itens"]}
    assert set(itens) == {"C-1", "C-2", "C-3"}
    assert (itens["C-2"]["inicio"], itens["C-2"]["fim"], itens["C-2"]["status_crono"]) == ("2026-12-05", "2026-12-20", "Em andamento")
    assert len(itens["C-2"]["recursos"]) == 3 and itens["C-1"]["recursos"][0]["nome"] == "PEDREIRO (HH)"
    # excluir as concluídas do plano (a com restrição pendente fica)
    client.post(f"/api/planos/itens/{itens['C-1']['id']}/restricoes", json={"acao": "Projeto liberado para construção"})
    r = client.post("/api/planos/tirar-concluidas").json()
    assert r["removidos"] == 1 and not r["mantidos"]
    assert {i["id_crono"] for i in client.get("/api/planos?inicio=2026-11-23").json()["itens"]} == {"C-1", "C-2"}
    assert client.post("/api/planos/cronograma/previa", json={"inicio": "2026-12-31", "fim": "2026-12-01"}).status_code == 422
