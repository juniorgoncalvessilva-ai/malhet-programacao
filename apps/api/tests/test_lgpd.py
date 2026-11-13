"""Spec 074: termo LGPD versionado, aceite por finalidade (colhido offline, idempotente), revogação que apaga o rosto,
evidência de assinatura com foto/localização só com aceite, hash de integridade e registro de acesso às fotos."""
import json

import pytest

from app.modules.lgpd.domain.termo import FINALIDADES, consentimento, hash_evidencia, normalizar_escolhas
from app.shared.errors import DomainError
from tests.test_book_fotos import _jpeg
from tests.test_presenca import FACE, _montar

FINS = list(FINALIDADES)
SIM = {"biometria": True, "foto_assinatura": True, "localizacao": True}
ASS = {"meio": "codigo", "hora": "2026-11-13T07:00:00-03:00", "codigo": "115013"}
GEO = {"lat": -23.5505199, "lng": -46.6333094, "precisao": 12.4}


def test_regras_do_consentimento():
    with pytest.raises(DomainError):
        normalizar_escolhas({"biometria": True}, FINS)  # cada finalidade tem resposta própria
    with pytest.raises(DomainError):
        normalizar_escolhas({"biometria": False, "foto_assinatura": True, "localizacao": False}, FINS)
    assert consentimento([], 1).situacao == "pendente"
    a = {"versao": 1, "escolhas": SIM, "revogado": False}
    assert consentimento([a], 1).biometria and consentimento([a], 2).situacao == "desatualizado"
    assert consentimento([a, {**a, "escolhas": {k: False for k in SIM}}], 1).situacao == "recusado"
    assert consentimento([{**a, "revogado": True}], 1).situacao == "revogado" and not consentimento([{**a, "revogado": True}], 1).biometria
    assert hash_evidencia({"a": 1}, b"x") != hash_evidencia({"a": 1}, b"y")


def _aceite(client, cid, escolhas, i=1, versao=1, geo=GEO):
    return client.post("/api/lgpd/aceites", json={"id_local": f"cel1-lgpd-{i:04d}", "colaborador_id": cid, "versao": versao,
                                                  "escolhas": escolhas, "assinatura": ASS, "hora": "2026-11-13T07:00:00-03:00",
                                                  "geo": geo, "dispositivo": "Pixel 7"})


def _evid(client, cid, i, meio="facial", foto=True, geo=GEO):
    dados = {"id_local": f"cel1-evid-{i:04d}", "origem": "etilometro_teste", "origem_id_local": f"x-{i:06d}", "colaborador_id": cid,
             "meio": meio, "hora": "2026-11-13T07:10:00-03:00", "distancia": 0.31, "geo": geo, "documento": "Etilômetro · teste"}
    return client.post("/api/lgpd/evidencias", data={"dados": json.dumps(dados)},
                       files={"foto": ("rosto.jpg", _jpeg(), "image/jpeg")} if foto else None)


def test_termo_aceite_evidencia_e_relatorio(client):
    enc, ped, srv, eq = _montar(client)
    t = client.get("/api/lgpd/termo").json()
    assert t["versao"] == 1 and "art. 18" in t["texto"] and [f["chave"] for f in t["finalidades"]] == ["biometria", "foto_assinatura", "localizacao"]
    base = {p["id"]: p for p in client.get("/api/presenca/base").json()["pessoas"]}
    assert base[ped]["lgpd"]["situacao"] == "pendente"

    # pedreiro aceita tudo; servente recusa tudo (assina a recusa)
    r = _aceite(client, ped, SIM)
    assert r.status_code == 201, r.text
    a = r.json()
    assert a["consentimento"]["situacao"] == "aceito" and a["latitude"] == GEO["lat"] and len(a["hash"]) == 64
    assert _aceite(client, ped, SIM).json()["repetido"] is True  # fila reenviada
    assert _aceite(client, srv, {k: False for k in SIM}, i=2).json()["latitude"] is None  # sem aceite de localização, não grava
    assert _aceite(client, srv, {"biometria": True}, i=3).status_code == 422
    base = {p["id"]: p for p in client.get("/api/presenca/base").json()["pessoas"]}
    assert base[ped]["lgpd"]["foto_assinatura"] and base[srv]["lgpd"]["situacao"] == "recusado"

    # rosto: quem recusou não cadastra
    r = client.put(f"/api/presenca/identificacoes/{srv}", json={"face": FACE, "consentimento": True, "campos": ["face"]})
    assert r.status_code == 422 and "LGPD" in r.text
    assert client.put(f"/api/presenca/identificacoes/{ped}", json={"face": FACE, "consentimento": True, "campos": ["face"]}).status_code == 200

    # evidência: com aceite guarda foto e coordenadas; sem aceite descarta e anota
    e1 = _evid(client, ped, 1).json()
    assert e1["tem_foto"] and e1["latitude"] == GEO["lat"] and e1["observacao"] is None
    assert _evid(client, ped, 1).json()["repetido"] is True
    e2 = _evid(client, srv, 2).json()
    assert not e2["tem_foto"] and e2["latitude"] is None and "foto descartada" in e2["observacao"] and "localização" in e2["observacao"]

    rel = client.get("/api/lgpd/evidencias").json()
    assert {x["origem"] for x in rel} == {"etilometro_teste", "lgpd_aceite"} and all(x["integra"] for x in rel)
    f = client.get(f"/api/lgpd/evidencias/{e1['id']}/foto")
    assert f.status_code == 200 and f.headers["content-type"] == "image/jpeg"
    assert client.get(f"/api/lgpd/evidencias/{e2['id']}/foto").status_code == 404
    client.post("/api/lgpd/evidencias/relatorio", json={"filtro": "nov/2026"})
    ac = client.get("/api/lgpd/acessos").json()
    assert [x["acao"] for x in ac][:2] == ["relatorio", "ver_foto"] and ac[1]["evidencia_id"] == e1["id"]

    # revogação: apaga o rosto e daí para frente nada de foto
    r = client.post(f"/api/lgpd/aceites/{a['id']}/revogar", json={"motivo": "pediu no DP"})
    assert r.json()["rosto_apagado"] is True and r.json()["consentimento"]["situacao"] == "revogado"
    assert next(p for p in client.get("/api/presenca/base").json()["pessoas"] if p["id"] == ped)["face"] is None
    assert not _evid(client, ped, 3).json()["tem_foto"]

    # nova versão do termo: quem aceitou a anterior fica "desatualizado"
    _aceite(client, enc, SIM, i=4)
    novo = client.post("/api/lgpd/termos", json={"titulo": t["titulo"], "texto": t["texto"] + "\n8. Texto novo.", "finalidades": t["finalidades"]})
    assert novo.status_code == 201 and novo.json()["versao"] == 2
    cols = {x["id"]: x for x in client.get("/api/lgpd/colaboradores").json()}
    assert cols[enc]["consentimento"]["situacao"] == "desatualizado" and cols[srv]["consentimento"]["situacao"] == "recusado"
