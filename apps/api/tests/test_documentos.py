"""Spec 123: documentos controlados (ISO 9001:2015, 7.5) — LDO, revisão vigente/superada, carimbo do desenho, TAG →
frente sugerida, ligações Zettelkasten, GRD, leituras, campo (só vigente) e o endereço do encarregado."""
import io
import os
from datetime import date

import ezdxf
import pytest
from openpyxl import Workbook

from app.modules.documentos.domain import documento as dom
from app.shared.errors import DomainError
from tests.test_wbs import LISTA

R = dom.RevisaoInfo


def test_revisoes_e_vigente():
    assert sorted(["1", "A", "0", "B", "10", "2"], key=dom.chave_revisao) == ["A", "B", "0", "1", "2", "10"]
    assert dom.normalizar_revisao("Rev. 4") == "4" and dom.normalizar_revisao(3.0) == "3" and dom.normalizar_revisao("b") == "B"
    assert dom.normalizar_finalidade("para construcao") == "PARA CONSTRUÇÃO" and dom.normalizar_finalidade("As Built") == "COMO CONSTRUÍDO"
    revs = [R(1, "A", "PARA APROVAÇÃO"), R(2, "B", "PARA COMENTÁRIOS")]
    assert dom.vigente(revs) is None and dom.situacao(revs[1], revs) == "em_analise" and dom.situacao(revs[0], revs) == "superada"
    revs.append(R(3, "0", "PARA CONSTRUÇÃO"))
    assert dom.vigente(revs) == 3
    revs.append(R(4, "1", "PARA COMENTÁRIOS"))  # revisão em análise não derruba a vigente
    assert dom.vigente(revs) == 3 and dom.situacao(revs[3], revs) == "em_analise"
    revs.append(R(5, "2", "PARA CONSTRUÇÃO"))
    assert dom.vigente(revs) == 5 and [dom.situacao(r, revs) for r in revs] == ["superada"] * 4 + ["vigente"]
    revs.append(R(6, "3", "CANCELADO"))
    assert dom.vigente(revs) is None and dom.situacao(revs[5], revs) == "cancelada"
    with pytest.raises(DomainError):
        dom.normalizar_revisao("")


def test_carimbo_e_tags():
    at = {"NUMERO_VALE": "1870AA-C-51890", "NÚMERO_DA_CONTRATADA": "319010-00242-CI-LST-00262", "REVISÃO": "4",
          "1a_REV": "A", "DESCRIÇÃO_DA_REVISÃO": "PARA CONSTRUÇÃO", "TÍTULO_DO_DESENHO": "COMUM GERAL",
          "SUBTÍTULO_1_DO_DESENHO": "CASA DE BOMBAS", "DATA": "16/07/26", "N_PROJ_SE": "S1803", "PROJETO": "FILTRAGEM"}
    assert dom.parece_carimbo(at)
    c = dom.ler_carimbo(at)
    assert (c.codigo, c.codigo_contratada, c.revisao, c.finalidade) == ("1870AA-C-51890", "319010-00242-CI-LST-00262", "4", "PARA CONSTRUÇÃO")
    assert c.titulo == "COMUM GERAL – CASA DE BOMBAS" and c.data == date(2026, 7, 16) and c.projeto == "FILTRAGEM"
    assert dom.tags_no_texto(["RADIER TQ-1870AA-01 - PLANTA", "ver ED-1870AA-06 e TQ-1870AA-01"]) == ["TQ-1870AA-01", "ED-1870AA-06"]
    assert dom.casa_tag("ED-1800AA-01", "ED-1800AA-01", None, "Galpão") and dom.casa_tag("ED-1800AA-01", None, "1800AA-ED-01", "")
    assert not dom.casa_tag("ED-1800AA-01", "ED-1800AA-02", "1800AA-ED-02", "Galpão")


def _dxf(codigo: str, rev: str, finalidade: str, tag: str = "ED-1800AA-01") -> bytes:
    """Folha com carimbo (bloco com atributos) e um texto citando a TAG — como os desenhos da obra."""
    doc = ezdxf.new("R2018")
    b = doc.blocks.new("A1")
    for i, t in enumerate(("NUMERO_VALE", "REVISÃO", "DESCRIÇÃO_DA_REVISÃO", "TÍTULO_DO_DESENHO", "DATA", "NÚMERO_DA_CONTRATADA")):
        b.add_attdef(t, (0, i * 5))
    msp = doc.modelspace()
    msp.add_line((0, 0), (100, 50))
    msp.add_text(f"RADIER {tag} - PLANTA", dxfattribs={"height": 3}).set_placement((10, 10))
    ps = doc.layouts.new("FOLHA")
    ins = ps.add_blockref("A1", (0, 0))
    ins.add_auto_attribs({"NUMERO_VALE": codigo, "REVISÃO": rev, "DESCRIÇÃO_DA_REVISÃO": finalidade,
                          "TÍTULO_DO_DESENHO": "BASE DO TANQUE", "DATA": "16/07/26", "NÚMERO_DA_CONTRATADA": "CT-001"})
    ps.add_line((0, 0), (200, 100))
    out = io.StringIO()
    doc.write(out)
    return out.getvalue().encode()


def _enviar(client, dados: bytes, nome: str, **campos):
    return client.post("/api/documentos/revisoes", data={k: str(v) for k, v in campos.items()},
                       files={"arquivo": (nome, dados, "application/octet-stream")})


def test_revisoes_pelo_arquivo_vigente_ligacoes_e_campo(client):
    area = client.post("/api/frentes/importar", json={"texto": LISTA}).json()[0]["areas"][0]  # 004.05 · ativo ED-1800AA-01
    r = _enviar(client, _dxf("1800AA-C-0001", "0", "PARA CONSTRUÇÃO"), "base-tanque.dxf")
    assert r.status_code == 201, r.text
    j = r.json()
    assert j["documento"]["codigo"] == "1800AA-C-0001" and j["documento"]["titulo"] == "BASE DO TANQUE"
    assert j["revisao"]["situacao"] == "vigente" and set(j["revisao"]["formatos"]) >= {"png", "pdf", "original"}
    assert j["revisao"]["tags"] == ["ED-1800AA-01"] and j["sugeridas"] == [f"{area['codigo']} · {area['descricao']}"] and j["nova_vigente"]
    did = j["documento"]["id"]
    assert _enviar(client, _dxf("1800AA-C-0001", "0", "PARA CONSTRUÇÃO"), "x.dxf").status_code == 422  # não sobrescreve
    # revisão para comentários não tira a vigente; a nova para construção tira
    assert _enviar(client, _dxf("1800AA-C-0001", "1", "PARA COMENTÁRIOS"), "x.dxf").json()["nova_vigente"] is False
    assert client.get(f"/api/documentos/{did}").json()["vigente"]["revisao"] == "0"
    assert _enviar(client, _dxf("1800AA-C-0001", "1", "x"), "x.dxf", revisao="2", finalidade="para construção").json()["nova_vigente"]
    d = client.get(f"/api/documentos/{did}").json()
    assert d["vigente"]["revisao"] == "2" and [h["situacao"] for h in d["historico"]] == ["vigente", "superada", "superada"]
    assert d["sugestoes"] == 1 and d["vinculos"][0]["sugerido"]

    # campo: só depois de confirmar a ligação, e só a vigente
    assert client.get("/api/documentos/campo", params={"area_id": area["id"]}).json() == []
    client.post(f"/api/documentos/vinculos/{d['vinculos'][0]['id']}/confirmar")
    campo = client.get("/api/documentos/campo", params={"area_id": area["id"]}).json()
    assert [x["codigo"] for x in campo] == ["1800AA-C-0001"] and campo[0]["vigente"]["revisao"] == "2"
    rid = campo[0]["vigente"]["id"]
    png = client.get(f"/api/documentos/revisoes/{rid}/arquivo", params={"formato": "png", "via": "campo"})
    assert png.status_code == 200 and png.content.startswith(b"\x89PNG") and "rev2.png" in png.headers["content-disposition"]
    assert client.get(f"/api/documentos/revisoes/{rid}/arquivo", params={"formato": "pdf"}).content.startswith(b"%PDF")
    assert client.get(f"/api/documentos/{did}").json()["leituras"][0] == {**client.get(f"/api/documentos/{did}").json()["leituras"][0],
                                                                       "revisao": "2", "via": "web", "formato": "pdf"}

    # ligações Zettelkasten: procedimento ligado ao desenho aparece em "citado por"; grafo com as arestas
    pr = _enviar(client, b"%PDF-1.4 procedimento", "PR-EXE-001.pdf", revisao="0", finalidade="aprovado", tipo="PRO",
                 titulo="Concretagem de fundações").json()
    pid = pr["documento"]["id"]
    assert pr["documento"]["tipo"] == "PRO" and pr["revisao"]["formatos"] == ["pdf", "original"]
    assert client.post(f"/api/documentos/{pid}/vinculos", json={"relacao": "referencia", "alvo_tipo": "documento", "alvo_id": did}).status_code == 201
    assert client.post(f"/api/documentos/{pid}/vinculos", json={"relacao": "referencia", "alvo_tipo": "documento", "alvo_id": pid}).status_code == 422
    assert client.post(f"/api/documentos/{pid}/vinculos", json={"alvo_tipo": "area", "alvo_id": 999999}).status_code == 404
    assert client.get(f"/api/documentos/{did}").json()["citado_por"][0]["documento"].startswith("PR-EXE-001")
    g = client.get("/api/documentos/grafo").json()
    assert {"de": f"documento:{pid}", "para": f"documento:{did}", "relacao": "referencia", "sugerido": False} in g["arestas"]
    assert any(n["id"] == f"area:{area['id']}" for n in g["nos"])
    assert [x["codigo"] for x in client.get("/api/documentos", params={"busca": "concretagem"}).json()] == ["PR-EXE-001"]


def test_ldo_e_grd(client):
    client.post("/api/frentes/importar", json={"texto": LISTA})
    wb = Workbook()
    ws = wb.active
    ws.append(["LISTA DE DOCUMENTOS"])
    ws.append(["Código", "Nº Contratada", "Título", "Rev.", "Finalidade", "Disciplina", "Frente"])
    ws.append(["1800AA-C-0002", "CT-2", "Armação do radier", 0, "Para construção", "Civil", "004.05"])
    ws.append(["1800AA-C-0003", None, "Formas do radier", "A", "Para aprovação", "Civil", "999.99"])
    ws.append([None, None, "linha sem código", None, None, None, None])
    b = io.BytesIO()
    wb.save(b)
    r = client.post("/api/documentos/ldo", files={"arquivo": ("LDO.xlsx", b.getvalue())}).json()
    assert (r["criados"], r["revisoes"], r["ligados"]) == (2, 2, 1) and r["frentes_nao_achadas"] == ["1800AA-C-0003: 999.99"]
    assert client.post("/api/documentos/ldo", files={"arquivo": ("LDO.xlsx", b.getvalue())}).json()["criados"] == 0  # não duplica
    lista = {x["codigo"]: x for x in client.get("/api/documentos").json()}
    assert lista["1800AA-C-0002"]["vigente"]["revisao"] == "0" and lista["1800AA-C-0002"]["vigente"]["formatos"] == []
    assert lista["1800AA-C-0003"]["vigente"] is None and lista["1800AA-C-0003"]["ultima"]["situacao"] == "em_analise"
    # o arquivo da revisão listada na LDO chega depois e completa a mesma revisão
    up = _enviar(client, _dxf("1800AA-C-0002", "0", "PARA CONSTRUÇÃO"), "c2.dxf").json()
    assert up["revisao"]["revisao"] == "0" and "png" in up["revisao"]["formatos"] and up["documento"]["titulo"] == "Armação do radier"
    assert client.get("/api/documentos/ldo.xlsx").content[:2] == b"PK"

    # GRD recebida: a revisão chega apontando para ela; emitida: lista as vigentes
    g = client.post("/api/documentos/grds", json={"sentido": "recebida", "data": "2026-11-20", "remetente": "Projetista Worley",
                                                  "destinatario": "Contratada", "numero_externo": "GRD-W-0099"}).json()
    assert g["numero"] == "GRD-R-2026-0001"
    up = _enviar(client, _dxf("1800AA-C-0002", "1", "PARA CONSTRUÇÃO"), "c2r1.dxf", grd_id=g["id"]).json()
    assert client.get(f"/api/documentos/grds/{g['id']}").json()["itens"][0]["revisao"] == "1"
    did = up["documento"]["id"]
    e = client.post("/api/documentos/grds", json={"sentido": "emitida", "data": "2026-11-21", "remetente": "Planejamento",
                                                  "destinatario": "Campo — frente 004.05", "itens": [{"documento_id": did}]}).json()
    assert e["numero"] == "GRD-E-2026-0001" and e["itens"][0]["revisao"] == "1"
    assert client.post(f"/api/documentos/grds/{e['id']}/ciencia").status_code == 204
    assert client.get("/api/documentos/grds").json()[0]["ciente_por"] == "dev@local"
    assert client.get(f"/api/documentos/grds/{e['id']}/xlsx").content[:2] == b"PK"
    assert [x["numero"] for x in client.get(f"/api/documentos/{did}").json()["grds"]] == ["GRD-E-2026-0001", "GRD-R-2026-0001"]
    assert client.post("/api/documentos/grds", json={"sentido": "x", "data": "2026-11-21", "remetente": "a b", "destinatario": "c d"}).status_code == 422


def test_isolamento_por_obra(client):
    d = _enviar(client, _dxf("1800AA-C-0009", "0", "PARA CONSTRUÇÃO"), "x.dxf").json()
    outra = client.post("/api/admin/obras", json={"codigo": "OUT-DOC", "nome": "Outra"}).json()["id"]
    h = {"X-Obra-Id": str(outra)}
    assert client.get(f"/api/documentos/{d['documento']['id']}", headers=h).status_code == 404
    assert client.get(f"/api/documentos/revisoes/{d['revisao']['id']}/arquivo", headers=h).status_code == 404
    assert client.get("/api/documentos", headers=h).json() == []


@pytest.mark.skipif(not os.environ.get("DWG_REAL"), reason="DWG real só localmente (projeto do cliente fora do git)")
def test_dwg_real_convertido(client):
    from app.modules.documentos.infra import dwg

    assert dwg.disponivel()
    j = _enviar(client, open(os.environ["DWG_REAL"], "rb").read(), os.path.basename(os.environ["DWG_REAL"])).json()
    assert j["revisao"]["finalidade"] == "PARA CONSTRUÇÃO" and {"png", "pdf", "dxf", "original"} <= set(j["revisao"]["formatos"])


def test_encarregado_ve_so_a_vigente(client):
    from fastapi.testclient import TestClient

    from app.main import app
    from tests.test_efetivo import efetivo

    area = client.post("/api/frentes/importar", json={"texto": LISTA}).json()[0]["areas"][0]
    r0 = _enviar(client, _dxf("1800AA-C-0005", "0", "PARA CONSTRUÇÃO"), "x.dxf").json()
    r1 = _enviar(client, _dxf("1800AA-C-0005", "1", "PARA CONSTRUÇÃO"), "x.dxf").json()
    vid = client.get(f"/api/documentos/{r0['documento']['id']}").json()["vinculos"][0]["id"]
    client.post(f"/api/documentos/vinculos/{vid}/confirmar")
    client.post("/api/efetivo/importar", files={"arquivo": ("EFETIVO.xlsx", efetivo(1))})
    enc = next(c for c in client.get("/api/efetivo/colaboradores").json() if c["nome"] == "ENCARREGADO TESTE UM")
    client.post("/api/efetivo/equipes", json={"nome": "EQUIPE.1_FORMA", "encarregado_id": enc["id"]})
    w = TestClient(app)
    tok = w.post("/api/portal/entrar", json={"matricula": "115011", "senha": "123456"}).json()["token"]
    h = {"X-Portal-Token": w.post("/api/portal/senha", headers={"X-Portal-Token": tok}, json={"nova": "obra2026", "repetida": "obra2026"}).json()["token"]}
    docs = w.get("/api/portal/documentos", headers=h, params={"area_id": area["id"]}).json()
    assert [(d["codigo"], d["vigente"]["revisao"]) for d in docs] == [("1800AA-C-0005", "1")]
    assert w.get(f"/api/portal/documentos/revisoes/{r1['revisao']['id']}/arquivo", headers=h).content.startswith(b"\x89PNG")
    assert w.get(f"/api/portal/documentos/revisoes/{r0['revisao']['id']}/arquivo", headers=h).status_code == 404  # superada
    leit = client.get(f"/api/documentos/{r0['documento']['id']}").json()["leituras"]
    assert leit[0]["via"] == "portal" and leit[0]["quem"].startswith("líder 115011")
