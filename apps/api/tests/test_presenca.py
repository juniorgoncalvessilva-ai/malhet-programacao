"""Spec 063: apropriação de presença — base offline, cadastro de crachá/NFC/rosto, sincronização idempotente e o dia."""
from tests.test_efetivo import efetivo

FACE = [0.01 * (i % 7) for i in range(128)]


def _montar(client):
    client.post("/api/efetivo/importar", files={"arquivo": ("EFETIVO.xlsx", efetivo(1))})
    cs = {c["nome"]: c for c in client.get("/api/efetivo/colaboradores").json()}
    enc, ped, srv = cs["ENCARREGADO TESTE UM"]["id"], cs["PEDREIRO TESTE DOIS"]["id"], cs["SERVENTE TESTE TRES"]["id"]
    eq = client.post("/api/efetivo/equipes", json={"nome": "EQUIPE.1_FORMA", "encarregado_id": enc,
                                                  "colaboradores": [ped, srv], "turno": "Diurno"}).json()["id"]
    return enc, ped, srv, eq


def test_identificacao_e_base(client):
    enc, ped, srv, eq = _montar(client)
    base = {p["id"]: p for p in client.get("/api/presenca/base").json()["pessoas"]}
    assert base[ped]["equipe_id"] == eq and "115013" in base[ped]["codigos"] and base[enc]["equipe_id"] == eq
    assert all(p["situacao"] not in ("DESMOBILIZADO", "DESISTENCIA") for p in base.values())

    r = client.put(f"/api/presenca/identificacoes/{ped}", json={"nfc": "04:a1:b2:c3", "campos": ["nfc"]})
    assert r.status_code == 200 and r.json()["nfc"] == "04A1B2C3"
    r = client.put(f"/api/presenca/identificacoes/{srv}", json={"nfc": "04a1b2c3", "campos": ["nfc"]})
    assert r.status_code == 422 and "PEDREIRO TESTE DOIS" in r.text  # o mesmo crachá NFC não serve para duas pessoas
    r = client.put(f"/api/presenca/identificacoes/{ped}", json={"face": FACE, "campos": ["face"]})
    assert r.status_code == 422 and "consentimento" in r.text
    assert client.put(f"/api/presenca/identificacoes/{ped}", json={"face": FACE[:10], "consentimento": True, "campos": ["face"]}).status_code == 422
    r = client.put(f"/api/presenca/identificacoes/{ped}", json={"face": FACE, "consentimento": True, "campos": ["face"]})
    assert r.json() == {"id": ped, "codigo": None, "nfc": "04A1B2C3", "face": True}  # NFC continua
    ids = {x["id"]: x for x in client.get("/api/presenca/identificacoes").json()}
    assert ids[ped]["face"] is True and ids[ped]["consentimento_em"] and "face_descritor" not in ids[ped]
    p = next(x for x in client.get("/api/presenca/base").json()["pessoas"] if x["id"] == ped)
    assert p["nfc"] == "04A1B2C3" and len(p["face"]) == 128
    r = client.put(f"/api/presenca/identificacoes/{ped}", json={"face": None, "campos": ["face"]})
    assert r.json()["face"] is False  # apagar o rosto


def test_sincronizar_e_presenca_do_dia(client):
    enc, ped, srv, eq = _montar(client)
    leituras = [
        {"id_local": "cel1-0000001", "colaborador_id": ped, "data": "2026-11-12", "hora": "2026-11-12T07:01:00-03:00", "meio": "nfc"},
        {"id_local": "cel1-0000002", "colaborador_id": enc, "data": "2026-11-12", "hora": "2026-11-12T06:58:00-03:00", "meio": "facial"},
        {"id_local": "cel1-0000003", "colaborador_id": ped, "data": "2026-11-12", "hora": "2026-11-12T12:00:00-03:00", "meio": "qr"},
        {"id_local": "cel1-0000004", "colaborador_id": srv, "data": "2026-11-12", "hora": "2026-11-12T07:05:00-03:00", "meio": "telepatia"},
        {"id_local": "cel1-0000005", "colaborador_id": 999999, "data": "2026-11-12", "hora": "2026-11-12T07:05:00-03:00", "meio": "manual"},
    ]
    r = client.post("/api/presenca/leituras", json={"leituras": leituras}).json()
    assert (r["aceitas"], r["repetidas"], len(r["erros"])) == (3, 0, 2)
    r = client.post("/api/presenca/leituras", json={"leituras": leituras[:3]}).json()
    assert (r["aceitas"], r["repetidas"]) == (0, 3)  # a fila reenviada não duplica

    d = client.get("/api/presenca/dia", params={"data": "2026-11-12"}).json()
    assert d["presentes"] == 2 and d["programacao"] is None
    e = next(x for x in d["equipes"] if x["equipe_id"] == eq)
    assert (e["total"], e["presentes"]) == (3, 2)
    pes = {x["id"]: x for x in e["pessoas"]}
    assert pes[ped]["presente"] and pes[ped]["meio"] == "nfc" and pes[ped]["hora"].startswith("2026-11-12T10:01")  # 1ª leitura (UTC)
    assert not pes[srv]["presente"] and pes[enc]["papel"] == "encarregado"
    assert e["hh_disponivel"] == round(2 * e["jornada"], 2)
    assert client.get("/api/presenca/dia", params={"data": "2026-11-13"}).json()["presentes"] == 0


def test_duas_leituras_da_mesma_pessoa_vale_a_mais_cedo(client):
    """Spec 069: dois celulares leem a mesma pessoa; o que estava sem internet sobe depois, mas leu mais cedo — vale ele."""
    enc, ped, srv, eq = _montar(client)
    a = {"id_local": "celA-0000001", "colaborador_id": ped, "data": "2026-11-12", "hora": "2026-11-12T07:05:00-03:00", "meio": "nfc"}
    r = client.post("/api/presenca/leituras", json={"leituras": [a]}).json()
    assert r["resultados"] == [{"id_local": "celA-0000001", "valida": True, "hora_valida": r["resultados"][0]["hora_valida"], "outro_celular": False}]
    assert [x["colaborador_id"] for x in client.get("/api/presenca/hoje", params={"data": "2026-11-12"}).json()] == [ped]
    # celular B estava sem rede e leu às 07:01: ao sincronizar, a dele vale e a do A vira duplicada
    b = {**a, "id_local": "celB-0000001", "hora": "2026-11-12T07:01:00-03:00", "meio": "qr"}
    r = client.post("/api/presenca/leituras", json={"leituras": [b]}).json()
    assert r["resultados"][0]["valida"] is True and r["resultados"][0]["hora_valida"].startswith("2026-11-12T10:01")
    # celular C leu às 07:30: duplicada, e ele fica sabendo que a válida é de outro celular
    c = {**a, "id_local": "celC-0000001", "hora": "2026-11-12T07:30:00-03:00"}
    r = client.post("/api/presenca/leituras", json={"leituras": [c]}).json()
    assert r["resultados"] == [{"id_local": "celC-0000001", "valida": False, "hora_valida": r["resultados"][0]["hora_valida"], "outro_celular": True}]
    hoje = client.get("/api/presenca/hoje", params={"data": "2026-11-12"}).json()
    assert [(x["colaborador_id"], x["id_local"]) for x in hoje] == [(ped, "celB-0000001")]
    p = next(x for e in client.get("/api/presenca/dia", params={"data": "2026-11-12"}).json()["equipes"] if e["equipe_id"] == eq
             for x in e["pessoas"] if x["id"] == ped)
    assert p["leituras"] == 3 and p["meio"] == "qr" and p["hora"].startswith("2026-11-12T10:01")


def test_dia_por_setor_e_indicadores_do_periodo(client):
    """Spec 071: a presença do dia traz o setor da equipe (para agrupar) e os indicadores do período, com memória."""
    enc, ped, srv, eq = _montar(client)
    assert client.post("/api/efetivo/setores", json={"nome": "Civil", "cor": "#0f766e", "equipes": [eq]}).status_code == 201
    L = lambda i, cid, d, h, m="nfc": {"id_local": f"cel1-ind{i:04d}", "colaborador_id": cid, "data": d,
                                       "hora": f"{d}T{h}:00-03:00", "meio": m}
    leituras = [L(1, enc, "2026-11-10", "06:50"), L(2, ped, "2026-11-10", "07:10", "qr"), L(3, srv, "2026-11-10", "07:20"),
                L(4, enc, "2026-11-11", "06:55", "facial"), L(5, ped, "2026-11-11", "07:05"),
                L(6, ped, "2026-11-11", "08:00")]  # 2ª leitura do mesmo dia não conta duas vezes
    assert client.post("/api/presenca/leituras", json={"leituras": leituras}).json()["aceitas"] == 6

    d = client.get("/api/presenca/dia", params={"data": "2026-11-10"}).json()
    e = next(x for x in d["equipes"] if x["equipe_id"] == eq)
    assert e["setor"]["nome"] == "Civil" and e["setor"]["cor"].upper() == "#0F766E" and e["linhas"] == []

    r = client.get("/api/presenca/indicadores", params={"de": "2026-11-09", "ate": "2026-11-12"})
    assert r.status_code == 200, r.text
    r = r.json()
    res = r["resumo"]  # dias 09 e 12 sem leitura não são apurados (não viram falta)
    assert (res["dias"], res["efetivo"], res["presencas"], res["possiveis"]) == (2, 3, 5, 6)
    assert res["taxa"] == round(5 / 6, 4) and res["absenteismo"] == round(1 / 6, 4) and res["media_presentes"] == 2.5
    assert [(x["data"], x["presentes_nas_equipes"]) for x in r["por_dia"]] == [("2026-11-10", 3), ("2026-11-11", 2)]
    eqi = next(x for x in r["por_equipe"] if x["equipe_id"] == eq)
    assert (eqi["setor"], eqi["faltas"], eqi["presencas"]) == ("Civil", 1, 5) and eqi["hh"] == round(5 * e["jornada"], 2)
    assert r["por_meio"] == {"nfc": 3, "qr": 1, "facial": 1}
    assert {x["hora"]: x["pessoas"] for x in r["chegada"]} == {6: 2, 7: 3}  # horário de Brasília
    assert r["mais_faltas"] == [{"colaborador_id": srv, "nome": "SERVENTE TESTE TRES", "equipe": "EQUIPE.1_FORMA", "faltas": 1, "dias": 2}]
    m = r["memorias"]["taxa"]
    assert m["valor"] == "83,3%" and m["passos"][1]["conta"] == "3 × 2" and m["passos"][3]["conta"] == "5 ÷ 6"
    assert client.get("/api/presenca/indicadores", params={"de": "2026-11-12", "ate": "2026-11-01"}).status_code == 422
    vazio = client.get("/api/presenca/indicadores", params={"de": "2026-01-01", "ate": "2026-01-31"}).json()
    assert vazio["resumo"]["dias"] == 0 and vazio["resumo"]["taxa"] is None and vazio["por_dia"] == []
