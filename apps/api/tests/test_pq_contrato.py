"""PQ do contrato (abas PQ e MC): estrutura com títulos, itens, critério e quantidade por TAG."""
from io import BytesIO
from pathlib import Path

import pytest
from openpyxl import Workbook, load_workbook

from app.modules.referencias.application.importar_takeoff import linhas_pq


def _linha(item, cod, desc, unid=None, cms=None, qtd=None, pu=None):
    r = [None] * 20
    r[0], r[9], r[10] = item, desc, unid
    r[4:9] = cod
    if cms:
        r[11:16] = cms
    r[16], r[17] = qtd, pu
    r[18] = round(qtd * pu, 2) if qtd and pu else None
    return r


def pq_contrato() -> bytes:
    wb = Workbook()
    pq = wb.active
    pq.title = "PQ"
    for _ in range(11):
        pq.append([None])
    pq.append(_linha("1", ["C", "00", "00", "000", "000"], "OBRAS CIVIS"))
    pq.append(_linha("1.8", ["C", "45", "00", "000", "000"], "CONCRETO"))
    pq.append(_linha("1.8.3", ["C", "45", "12", "000", "000"], "CONCRETO ESTRUTURAL"))
    pq.append(_linha("1.8.3.1", ["C", "45", "12", "005", "000"], "FUNDAÇÃO"))
    pq.append(_linha("1.8.3.1.2", ["C", "45", "12", "005", "010"], "Concreto bombeado fck 30 MPa", "m³",
                     ["CMS", "C", "45", "12", "001"], 4412.45, 1295.53))
    pq.append(_linha("1.8.3.1.3", ["C", "45", "12", "005", "015"], "Concreto bombeado fck 40 MPa", "m³",
                     ["CMS", "C", "45", "12", "002"], 471.2, 1345))
    mc = wb.create_sheet("MC")
    for _ in range(11):
        mc.append([None])
    for tag, q in (("ED-1800AA-01", 42.5), ("ED-1800AA-01", 7.5), ("AR-1600AA-01", 10)):
        r = [None] * 18
        r[1], r[3] = 18, tag[:2] + "-01"
        r[4:9] = ["C", "45", "12", "005", "010"]
        r[9], r[11], r[12], r[15] = "Concreto", "m³", q, tag
        mc.append(r)
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_estrutura_da_aba_pq():
    ws = load_workbook(BytesIO(pq_contrato()), read_only=True)["PQ"]
    ls = list(linhas_pq(ws))
    assert [(x["item"], x["nivel"], x["folha"]) for x in ls][:5] == [
        ("1", 1, False), ("1.8", 2, False), ("1.8.3", 3, False), ("1.8.3.1", 4, False), ("1.8.3.1.2", 5, True)]
    assert ls[4]["criterio"] == "CMS C.45.12.001" and ls[4]["cod"] == "C.45.12.005.010" and ls[4]["total"] == pytest.approx(4412.45 * 1295.53, abs=0.01)


def test_importa_pq_do_contrato_e_mc_por_tag(client):
    r = client.post("/api/importar/takeoff", data={"rotulo": "PQ Rev.11"}, files={"arquivo": ("pq.xlsx", pq_contrato())})
    assert r.status_code == 200, r.text
    assert r.json()["contagem"] == {"PQ": 2, "ESTRUTURA": 4, "QTD_TAG": 2}
    est = client.get("/api/pq/estrutura").json()
    assert [x["item"] for x in est["linhas"]] == ["1", "1.8", "1.8.3", "1.8.3.1", "1.8.3.1.2", "1.8.3.1.3"]
    assert est["linhas"][4]["criterio"] == "CMS C.45.12.001" and est["linhas"][4]["tipo"] is None
    # busca da montagem só traz itens (folhas), com a quantidade da TAG
    busca = client.get("/api/pq/itens", params={"q": "1.8", "tag": "1800AA-ED-01"}).json()
    assert [b["item"] for b in busca] == ["1.8.3.1.2", "1.8.3.1.3"] and busca[0]["qtd_tag"] == 50
    # título não vira tipo; item vira e aparece na estrutura
    g = client.post("/api/catalogo/grupos", json={"descricao": "Concreto"}).json()
    r = client.post(f"/api/catalogo/grupos/{g['id']}/itens-pq", json={"itens": ["1.8.3", "1.8.3.1.2"]}).json()
    assert r["criados"] == ["1.1"] and "título" in r["avisos"][0]
    assert client.get("/api/pq/estrutura").json()["linhas"][4]["tipo"]["codigo"] == "1.1"


def test_pq_real_quando_disponivel():
    p = Path("/root/.claude/uploads/011bc413-02b1-5ac2-8ac9-328b64323d85/5f4c415e-C.01_-_PQ-1485AA-C-00019_Rev.11.xlsx")
    if not p.exists():
        pytest.skip("PQ real fora do repositório")
    ls = list(linhas_pq(load_workbook(p, read_only=True, data_only=True)["PQ"]))
    folhas = [x for x in ls if x["folha"]]
    assert len(folhas) > 450 and len(ls) > 800
    x = next(f for f in folhas if f["item"] == "1.8.3.1.2")
    assert x["unid"] == "m³" and x["criterio"].startswith("CMS")


def test_codigo_repetido_vai_para_o_bloco_da_area_da_tag():
    from app.modules.referencias.application.importar_takeoff import blocos_por_area, escolher_item
    ls = [{"item": "1", "nivel": 1, "folha": False, "descricao": "OBRAS CIVIS"},
          {"item": "1.1.1.1.1", "nivel": 5, "folha": True, "descricao": "Mobilização"},
          {"item": "2", "nivel": 1, "folha": False, "descricao": "OBRAS CIVIS"},
          *[{"item": f"2.1.1.1.{i}", "nivel": 5, "folha": True, "descricao": f"Serviço {i} - 1485AA"} for i in range(1, 4)]]
    bloco, area = blocos_por_area(ls)
    assert bloco == {"1": 0, "2": 1} and area == {1: "1485AA"}
    assert escolher_item(["1.1.1.1.1", "2.1.1.1.1"], "1485AA-ED-12", bloco, area) == "2.1.1.1.1"
    assert escolher_item(["1.1.1.1.1", "2.1.1.1.1"], "1800AA-ED-01", bloco, area) == "1.1.1.1.1"
