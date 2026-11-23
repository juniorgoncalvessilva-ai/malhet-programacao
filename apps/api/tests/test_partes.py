"""Spec 139: partes da obra (CONTRATADA/CONTRATANTE/FISCALIZAÇÃO/PROJETOS) e responsáveis — a gerência sai padronizada
("CONTRATADA - CARDAN"); o responsável da contratada vem do efetivo, os outros são digitados."""
import pytest

from app.modules.partes.domain import partes as dom
from app.shared.errors import DomainError


def test_gerencia_padronizada():
    assert dom.gerencia("contratada", "Cardan") == "CONTRATADA - CARDAN"
    assert dom.gerencia("fiscalizacao", None) == "FISCALIZAÇÃO"
    with pytest.raises(DomainError):
        dom.gerencia("cliente", "Vale")


def test_partes_e_responsaveis(client):
    client.put("/api/obra/marca/nomes", json={"nome_contratada": "Cardan", "nome_contratante": "Vale"})
    p = client.get("/api/partes").json()
    assert [x["gerencia"] for x in p["partes"]] == ["CONTRATADA - CARDAN", "CONTRATANTE - VALE", "FISCALIZAÇÃO", "PROJETOS"]
    assert p["partes"][0]["da_marca"] is True
    assert client.put("/api/partes/fiscalizacao", json={"nome": "Tractebel"}).json()["gerencia"] == "FISCALIZAÇÃO - TRACTEBEL"
    client.put("/api/partes/projetos", json={"nome": "worley"})
    assert client.put("/api/partes/cliente", json={"nome": "X"}).status_code == 422
    # contratada: do efetivo
    c = client.post("/api/efetivo/colaboradores", json={"nome": "Willian Souza", "funcao": "Engenheiro de planejamento"}).json()
    r = client.post("/api/partes/responsaveis", json={"papel": "contratada", "colaborador_id": c["id"]})
    assert r.status_code == 201, r.text
    assert client.post("/api/partes/responsaveis", json={"papel": "contratada", "colaborador_id": c["id"]}).status_code == 422
    assert client.post("/api/partes/responsaveis", json={"papel": "fiscalizacao", "colaborador_id": c["id"]}).status_code == 422
    # os outros: digitados
    f = client.post("/api/partes/responsaveis", json={"papel": "fiscalizacao", "nome": "Ana  Lima", "funcao": "Fiscal"}).json()
    assert client.post("/api/partes/responsaveis", json={"papel": "fiscalizacao", "nome": "ana lima"}).status_code == 422
    lista = client.get("/api/partes").json()["responsaveis"]
    assert {(x["papel"], x["nome"], x["gerencia"]) for x in lista} == {
        ("contratada", "WILLIAN SOUZA", "CONTRATADA - CARDAN"), ("fiscalizacao", "Ana Lima", "FISCALIZAÇÃO - TRACTEBEL")}
    assert next(x for x in lista if x["papel"] == "contratada")["funcao"] == "Engenheiro de planejamento"
    assert client.put(f"/api/partes/responsaveis/{f['id']}", json={"nome": "Ana Lima", "funcao": "Fiscal de campo", "ativo": False}).status_code == 200
    assert next(x for x in client.get("/api/partes").json()["responsaveis"] if x["id"] == f["id"])["ativo"] is False
    # por obra
    outra = client.post("/api/admin/obras", json={"codigo": "OUT-PRT", "nome": "Outra"}).json()["id"]
    h = {"X-Obra-Id": str(outra)}
    assert client.get("/api/partes", headers=h).json()["responsaveis"] == []
    assert client.delete(f"/api/partes/responsaveis/{f['id']}", headers=h).status_code == 404
    assert client.delete(f"/api/partes/responsaveis/{f['id']}").status_code == 204


def test_casar_gerencia_antiga():
    ps = [dom.Parte("contratada", "CARDAN"), dom.Parte("contratante", "VALE"), dom.Parte("fiscalizacao", "TRACTEBEL"),
          dom.Parte("projetos", None)]
    assert dom.casar_gerencia("cardan ", ps) == "CONTRATADA - CARDAN"
    assert dom.casar_gerencia("Cliente", ps) == "CONTRATANTE - VALE"
    assert dom.casar_gerencia("Gerenciadora", ps) == "FISCALIZAÇÃO - TRACTEBEL"
    assert dom.casar_gerencia("CONTRATADA - CARDAN", ps) is None  # já padronizada
    assert dom.casar_gerencia("CARDAN / VALE", ps) is None  # ambígua: fica
    assert dom.casar_gerencia("Outra firma", ps) is None


def test_padronizar_o_que_ja_existe(client):
    client.put("/api/obra/marca/nomes", json={"nome_contratada": "Cardan", "nome_contratante": "Vale"})
    for resp, ger in (("Vitor Rocha", "VALE"), ("Lucas", "CARDAN"), ("Lucas", "cardan"), ("Bruno", "Outra")):
        r = client.post("/api/restricoes", json={"acao": f"ação de {resp}", "responsavel": resp, "gerencia": ger})
        assert r.status_code in (200, 201), r.text
    p = client.get("/api/partes/padronizar").json()
    assert {(g["de"], g["para"]) for g in p["gerencias"]} == {("VALE", "CONTRATANTE - VALE"), ("CARDAN", "CONTRATADA - CARDAN"),
                                                             ("cardan", "CONTRATADA - CARDAN")}
    lucas = next(x for x in p["responsaveis"] if x["nome"] == "Lucas")
    assert (lucas["registros"], lucas["papel"]) == (2, "contratada")
    assert client.get("/api/restricoes").json()[0]["gerencia"] in ("VALE", "CARDAN", "cardan", "Outra")  # a prévia não grava
    r = client.post("/api/partes/padronizar").json()
    assert r["trocados"] == 3
    assert sorted({a["gerencia"] for a in client.get("/api/restricoes").json()}) == ["CONTRATADA - CARDAN", "CONTRATANTE - VALE", "Outra"]
