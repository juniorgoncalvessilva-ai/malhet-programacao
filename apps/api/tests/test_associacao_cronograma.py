"""Spec 080: associar a atividade do cronograma (ID do P6) ao IWP/etapa da WBS — pela tela de associação, com
sugestões, ou direto na linha da programação, levando para a WBS e para as programações em rascunho."""
from app.modules.referencias.infra.models import AtividadeCronogramaModel
from tests.test_pq_contrato import pq_contrato
from tests.test_wbs import LISTA
from tests.test_wbs_cronograma import _cronograma


def test_associar_atividade_do_cronograma(client):
    obra = int(client.headers["X-Obra-Id"])
    client.post("/api/importar/takeoff", data={"rotulo": "PQ"}, files={"arquivo": ("pq.xlsx", pq_contrato())})
    client.post("/api/frentes/importar", json={"texto": LISTA})
    g = client.post("/api/catalogo/grupos", json={"descricao": "Concreto"}).json()
    client.post(f"/api/catalogo/grupos/{g['id']}/itens-pq", json={"itens": ["1.8.3.1.2"]})
    tipo = client.get("/api/catalogo").json()[0]["tipos"][0]
    _cronograma(obra, "Rev.1", [("C-100", "Concretagem do radier", []), ("C-101", "Montagem de forma", [])])
    from app.core.db import SessionLocal

    with SessionLocal() as s:  # a atividade C-100 mede o mesmo item da PQ e fica na área do CWA
        at = s.query(AtividadeCronogramaModel).filter_by(id_crono="C-100").one()
        at.item_pq, at.area = "1.8.3.1.2", "CWA 004.05 - Galpão"
        s.commit()
    no = lambda **k: client.post("/api/wbs/nos", json=k).json()  # noqa: E731
    a = client.get("/api/wbs").json()["arvore"][0]
    cwp = no(tipo="cwp", pai_id=a["id"], elemento="Radier")
    gr = no(tipo="grupo", pai_id=cwp["id"], grupo_id=g["id"])
    iwp = no(tipo="iwp", pai_id=gr["id"], tipo_id=tipo["id"], quantidade=10)

    r = client.get("/api/wbs/associacao").json()
    n = next(x for x in r["nos"] if x["id"] == iwp["id"])
    assert n["id_crono"] is None and n["sugestoes"][0]["id_crono"] == "C-100"
    assert (r["atividades"], r["atividades_sem_wbs"]) == (2, 2)

    # programação em rascunho com o IWP, sem atividade; associar na tela de associação leva para a linha
    p = client.post("/api/programacoes", json={"tipo": "SEMANAL", "referencia": "2026-11-10"}).json()
    client.post(f"/api/programacoes/{p['id']}/linhas", json={"wbs_no_id": iwp["id"]})
    assert client.put(f"/api/wbs/nos/{iwp['id']}/atividade", json={"id_crono": "XX-9"}).status_code == 422  # fora do cronograma
    r = client.put(f"/api/wbs/nos/{iwp['id']}/atividade", json={"id_crono": "C-100"}).json()
    assert (r["id_crono"], r["linhas_atualizadas"]) == ("C-100", 1)
    ln = client.get(f"/api/programacoes/{p['id']}").json()["locais"][0]["areas"][0]["linhas"][0]
    assert ln["id_crono"] == "C-100" and ln["atividade_crono"] == "Concretagem do radier"
    assert client.get("/api/wbs/associacao").json()["atividades_sem_wbs"] == 1

    # direto na linha da programação: troca a atividade e leva para a WBS
    r = client.put(f"/api/programacoes/{p['id']}/linhas/{ln['id']}/atividade", json={"id_crono": "C-101"}).json()
    assert r["id_crono"] == "C-101" and r["wbs_atualizada"] is True
    n = next(x for x in client.get("/api/wbs/associacao").json()["nos"] if x["id"] == iwp["id"])
    assert (n["id_crono"], n["atividade"]) == ("C-101", "Montagem de forma")
    # tirar a associação só da linha
    r = client.put(f"/api/programacoes/{p['id']}/linhas/{ln['id']}/atividade", json={"id_crono": None, "tambem_na_wbs": False}).json()
    assert r["id_crono"] is None
    assert next(x for x in client.get("/api/wbs/associacao").json()["nos"] if x["id"] == iwp["id"])["id_crono"] == "C-101"
