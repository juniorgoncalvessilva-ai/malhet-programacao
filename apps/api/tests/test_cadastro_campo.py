"""Spec 065: crachá lido e não cadastrado — vincular à pessoa do efetivo ou cadastro simplificado (nome + função do de-para),
com alerta para completar; a planilha do DP completa sozinha quando trouxer a matrícula."""
from io import BytesIO

from openpyxl import Workbook

from tests.test_efetivo import CAB, _l, efetivo


def test_vincular_e_cadastro_simplificado(client):
    client.post("/api/efetivo/importar", files={"arquivo": ("EFETIVO.xlsx", efetivo(1))})
    client.put("/api/efetivo/funcoes", json={"itens": [{"funcao": "PEDREIRO", "recurso": "Pedreiro"}]})
    base = client.get("/api/presenca/base").json()
    f = next(x for x in base["funcoes"] if x["funcao"] == "PEDREIRO")
    assert f["recurso"] == "Pedreiro"
    ped = next(p for p in base["pessoas"] if p["nome"] == "PEDREIRO TESTE DOIS")

    # crachá desconhecido → vincular à pessoa do efetivo
    r = client.post("/api/presenca/vincular", json={"colaborador_id": ped["id"], "nfc": "04:aa:bb"})
    assert r.status_code == 200 and r.json()["nfc"] == "04AABB"
    srv = next(p for p in base["pessoas"] if p["nome"] == "SERVENTE TESTE TRES")
    r = client.post("/api/presenca/vincular", json={"colaborador_id": srv["id"], "nfc": "04aabb"})
    assert r.status_code == 422 and "PEDREIRO TESTE DOIS" in r.text

    # não está no efetivo → nome + função do de-para; nasce pendente para o DP/RH
    assert client.post("/api/presenca/pessoa-simplificada", json={"nome": "Joao", "funcao_chave": f["funcao_chave"]}).status_code == 422
    assert client.post("/api/presenca/pessoa-simplificada", json={"nome": "João Novo da Silva", "funcao_chave": "XYZ"}).status_code == 422
    assert client.post("/api/presenca/pessoa-simplificada", json={"nome": "pedreiro teste dois", "funcao_chave": f["funcao_chave"]}).status_code == 422
    r = client.post("/api/presenca/pessoa-simplificada", json={"nome": "João Novo da Silva", "funcao_chave": f["funcao_chave"], "codigo": "QR-777"})
    assert r.status_code == 201, r.text
    novo = r.json()
    assert novo["nome"] == "JOÃO NOVO DA SILVA" and novo["funcao"] == "PEDREIRO" and "QR777" in novo["codigos"] and novo["cadastro_pendente"]
    pend = client.get("/api/presenca/cadastros-pendentes").json()
    assert [x["id"] for x in pend] == [novo["id"]] and client.get("/api/presenca/cadastros-pendentes", params={"meus": True}).json()
    # já entra na presença e na composição (função do de-para → recurso da CPU)
    leit = {"id_local": "cel9-0000001", "colaborador_id": novo["id"], "data": "2026-11-12", "hora": "2026-11-12T07:00:00-03:00", "meio": "codigo"}
    assert client.post("/api/presenca/leituras", json={"leituras": [leit]}).json()["aceitas"] == 1

    # a planilha do DP traz a matrícula com o mesmo nome: mesma pessoa, cadastro completo, alerta some
    wb = Workbook(); ws = wb.active; ws.title = "EFETIVO 310"; ws.append(CAB)
    ws.append(_l("DP 14", "MOD", "V", "115.099", "JOÃO NOVO DA SILVA", "PEDREIRO"))
    buf = BytesIO(); wb.save(buf)
    assert client.post("/api/efetivo/importar", files={"arquivo": ("EFETIVO.xlsx", buf.getvalue())}).status_code == 200
    cs = {c["nome"]: c for c in client.get("/api/efetivo/colaboradores").json()}
    assert cs["JOÃO NOVO DA SILVA"]["id"] == novo["id"] and cs["JOÃO NOVO DA SILVA"]["matricula"] == "115099"
    assert client.get("/api/presenca/cadastros-pendentes").json() == []


def test_dp_completa_a_mao(client):
    client.post("/api/efetivo/importar", files={"arquivo": ("EFETIVO.xlsx", efetivo(1))})
    client.put("/api/efetivo/funcoes", json={"itens": [{"funcao": "SERVENTE", "recurso": "Servente"}]})
    fk = next(x for x in client.get("/api/presenca/base").json()["funcoes"] if x["funcao"] == "SERVENTE")["funcao_chave"]
    novo = client.post("/api/presenca/pessoa-simplificada", json={"nome": "Maria Campo Teste", "funcao_chave": fk}).json()
    assert client.put(f"/api/presenca/cadastros-pendentes/{novo['id']}", json={"matricula": "115.013"}).status_code == 422  # já é de outro
    r = client.put(f"/api/presenca/cadastros-pendentes/{novo['id']}", json={"matricula": "115.500"}).json()
    assert (r["matricula"], r["cadastro_pendente"]) == ("115500", False)
