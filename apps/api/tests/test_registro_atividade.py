"""Spec 119: registrar no campo uma atividade fora da programação — frente (CWA), IWP da WBS (com CWP e grupo) ou item da
PQ, texto de quem registrou e fotos que entram no book; foto baixada com nome que diz o quê e quando."""
from datetime import timedelta

import pytest

from app.modules.campo.domain.registro import validar_registro
from app.shared.errors import DomainError
from app.shared.tempo import hoje_local
from tests.test_auditorias import _foto_leg
from tests.test_pq_contrato import pq_contrato
from tests.test_wbs import LISTA


def test_regras():
    hoje = hoje_local()
    assert validar_registro("  limpeza   da  frente ", hoje, hoje) == "limpeza da frente"
    for txt, dia in (("ok", hoje), ("limpeza", hoje + timedelta(days=1)), ("limpeza", hoje - timedelta(days=40))):
        with pytest.raises(DomainError):
            validar_registro(txt, dia, hoje)


def test_registrar_atividade_fora_da_programacao(client):
    client.post("/api/importar/takeoff", data={"rotulo": "PQ"}, files={"arquivo": ("pq.xlsx", pq_contrato())})
    area = client.post("/api/frentes/importar", json={"texto": LISTA}).json()[0]["areas"][0]
    g = client.post("/api/catalogo/grupos", json={"descricao": "Concreto"}).json()
    client.post(f"/api/catalogo/grupos/{g['id']}/itens-pq", json={"itens": ["1.8.3.1.2"]})
    tipo = client.get("/api/catalogo").json()[0]["tipos"][0]
    no = lambda **k: client.post("/api/wbs/nos", json=k).json()  # noqa: E731
    a = client.get("/api/wbs").json()["arvore"][0]
    cwp = no(tipo="cwp", pai_id=a["id"], elemento="Radier", complemento="Eixo A–B")
    gr = no(tipo="grupo", pai_id=cwp["id"], grupo_id=g["id"])
    iwp = no(tipo="iwp", pai_id=gr["id"], tipo_id=tipo["id"])

    # a frente traz os IWPs da WBS, com o CWP, o grupo e o texto da PQ
    op = client.get("/api/campo/registros/opcoes", params={"area_id": area["id"]}).json()["itens"]
    assert len(op) == 1 and op[0]["wbs_no_id"] == iwp["id"] and op[0]["cwp"] == "Radier - Eixo A–B"
    assert op[0]["grupo"].endswith("Concreto") and op[0]["item_pq"] == "1.8.3.1.2" and op[0]["descricao"]
    assert client.get("/api/campo/registros/opcoes", params={"area_id": 999999}).status_code == 404

    # pelo IWP
    r = client.post("/api/campo/registros", json={"area_id": area["id"], "wbs_no_id": iwp["id"], "descricao": "Limpeza do radier"}).json()
    assert r["item_pq"] == "1.8.3.1.2" and "004.05-01-1-01" in r["descricao_item"] and "Radier" in r["descricao_item"]
    # sem WBS: pelo item da PQ; ou só o texto
    r2 = client.post("/api/campo/registros", json={"area_id": area["id"], "item_pq": "1.8.3.1.2", "descricao": "Concreto magro extra"}).json()
    assert r2["descricao_item"].startswith("1.8.3.1.2")
    r3 = client.post("/api/campo/registros", json={"area_id": area["id"], "descricao": "Retirada de entulho"}).json()
    assert r3["descricao_item"] is None and r3["item_pq"] is None
    assert client.post("/api/campo/registros", json={"area_id": area["id"], "item_pq": "9.9.9", "descricao": "xxx"}).status_code == 422
    assert client.post("/api/campo/registros", json={"area_id": area["id"], "wbs_no_id": cwp["id"], "descricao": "xxx"}).status_code == 422
    assert client.post("/api/campo/registros", json={"area_id": area["id"], "descricao": "x"}).status_code == 422

    # fotos do registro entram no book como atividade "fora da programação"
    _foto_leg(client, "registro", r["id"], None)
    lista = client.get("/api/campo/registros").json()
    assert [x["id"] for x in lista] == [r3["id"], r2["id"], r["id"]] and len(lista[2]["fotos"]) == 1
    book = client.get("/api/fotos/book", params={"tipo": "atividade"}).json()
    assert len(book) == 1 and book[0]["programacao"] == "Fora da programação" and book[0]["titulo"] == "Limpeza do radier"
    assert book[0]["area_id"] == area["id"] and "Radier" in book[0]["atividade"]

    # baixar a foto: anexo com nome que diz quando e de onde
    fid = lista[2]["fotos"][0]
    b = client.get(f"/api/fotos/{fid}/arquivo", params={"baixar": True})
    cd = b.headers["content-disposition"]
    assert b.status_code == 200 and cd.startswith("attachment;") and "004.05" in cd and cd.endswith('.jpg"')
    assert client.get(f"/api/fotos/{fid}/arquivo").headers["content-disposition"].startswith("inline;")

    # registro com foto não sai; sem foto sai
    assert client.delete(f"/api/campo/registros/{r['id']}").status_code == 422
    assert client.delete(f"/api/campo/registros/{r3['id']}").status_code == 204


def test_fotos_de_atividade_pelo_endereco_do_encarregado(client):
    """Spec 121: o líder, sem conta do Malhet, registra a atividade com foto pelo /encarregado e vê só as dele."""
    from fastapi.testclient import TestClient

    from app.main import app
    from tests.test_auditorias import _jpeg
    from tests.test_efetivo import efetivo

    client.post("/api/importar/takeoff", data={"rotulo": "PQ"}, files={"arquivo": ("pq.xlsx", pq_contrato())})
    area = client.post("/api/frentes/importar", json={"texto": LISTA}).json()[0]["areas"][0]
    client.post("/api/efetivo/importar", files={"arquivo": ("EFETIVO.xlsx", efetivo(1))})
    enc = next(c for c in client.get("/api/efetivo/colaboradores").json() if c["nome"] == "ENCARREGADO TESTE UM")
    client.post("/api/efetivo/equipes", json={"nome": "EQUIPE.1_FORMA", "encarregado_id": enc["id"]})

    w = TestClient(app)
    assert w.get("/api/portal/frentes").status_code == 422  # sem sessão
    tok = w.post("/api/portal/entrar", json={"matricula": "115011", "senha": "123456"}).json()["token"]
    tok = w.post("/api/portal/senha", headers={"X-Portal-Token": tok}, json={"nova": "obra2026", "repetida": "obra2026"}).json()["token"]
    h = {"X-Portal-Token": tok}
    fr = w.get("/api/portal/frentes", headers=h).json()
    assert [x["id"] for x in fr] == [area["id"]] and fr[0]["codigo"] == "004.05"
    assert w.get("/api/portal/registros/opcoes", headers=h, params={"area_id": area["id"]}).json() == {"itens": []}
    achados = w.get("/api/portal/pq", headers=h, params={"q": "1.8.3"}).json()
    assert achados and achados[0]["item"].startswith("1.8.3")
    r = w.post("/api/portal/registros", headers=h, json={"area_id": area["id"], "item_pq": achados[0]["item"], "descricao": "Limpeza da frente"}).json()
    assert r["criado_por"].startswith("líder 115011")
    f = w.post(f"/api/portal/registros/{r['id']}/fotos", headers=h, files={"arquivo": ("f.jpg", _jpeg(), "image/jpeg")})
    assert f.status_code == 201
    dia = w.get("/api/portal/registros", headers=h).json()
    assert len(dia) == 1 and dia[0]["fotos"] == [f.json()["id"]]
    assert w.get(f"/api/portal/fotos/{f.json()['id']}", headers=h, params={"mini": True}).status_code == 200
    assert w.get(f"/api/portal/fotos/{f.json()['id']}", headers=h, params={"baixar": True}).headers["content-disposition"].startswith("attachment")
    # a foto vai para o book como as do app
    assert any(x["titulo"] == "Limpeza da frente" for x in client.get("/api/fotos/book").json())
    # registro e foto de outro (pelo app) não aparecem nem abrem para o líder
    outro = client.post("/api/campo/registros", json={"area_id": area["id"], "descricao": "Feito pelo planejamento"}).json()
    from tests.test_auditorias import _foto_leg
    _foto_leg(client, "registro", outro["id"], None)
    fid_outro = client.get("/api/campo/registros").json()[0]["fotos"][0]
    assert len(w.get("/api/portal/registros", headers=h).json()) == 1
    assert w.get(f"/api/portal/fotos/{fid_outro}", headers=h).status_code == 404
    assert w.post(f"/api/portal/registros/{outro['id']}/fotos", headers=h, files={"arquivo": ("f.jpg", _jpeg(), "image/jpeg")}).status_code == 404
