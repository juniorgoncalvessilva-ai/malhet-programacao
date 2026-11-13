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
