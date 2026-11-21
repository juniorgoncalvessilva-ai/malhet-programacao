"""Spec 124: take-off pelo projeto — quadros do desenho montados pela posição dos textos (tabela de ferros, resumo de aço,
lista de materiais), anotações com unidade, conferência pela NBR 7480, Δ entre revisões, aceite com item da PQ e frente,
comparação com o take-off da planilha e envio ao IWP."""
import io
from io import BytesIO

import ezdxf
import pytest
from openpyxl import Workbook

from app.modules.documentos.domain import takeoff as to
from tests.test_pq_contrato import _linha
from tests.test_wbs import LISTA

T = to.Texto


def _celula(x: float, y: float, s: str, h: float = 6.2) -> to.Texto:
    """Texto alinhado à esquerda como no AutoCAD: o centro fica meio texto à direita do ponto de inserção."""
    return T(x + len(to.limpar(s)) * h * 0.3, y, h, s, "LF100")


def _quadros_reais() -> list[to.Texto]:
    """Recorte da TABELA DE FERROS e do RESUMO AÇO do desenho 1870AA-C-51890 (posições do arquivo original)."""
    t = [_celula(7113.3, 1478.5, "TABELA DE FERROS", 7.5)]
    t += [_celula(x, 1460.3, s) for x, s in ((7074.8, "N"), (7152.0, "Q"), (7168.0, "UNIT.(cm)"), (7240.0, "TOT.(m)"))]
    t.append(_celula(7106.9, 1459.7, "%%C", 7.5))
    ferros = [("1", "6.3", "126", "180", "227"), ("2", "6.3", "38", "194", "74"), ("3", "10", "6", "CORR", "206"),
              ("4", "8", "6", "CORR", "206"), ("5", "12.5", "24", "210", "50"), ("6", "6.3", "20", "217", "43"),
              ("7", "8", "38", "150", "57"), ("8", "8", "38", "100", "38")]
    for k, (n, d, q, u, tot) in enumerate(ferros):
        y = 1444.1 - 15 * k
        t += [_celula(7075, y, n), _celula(7098.6, y, d), _celula(7146.6, y, q), _celula(7195.6, y, u), _celula(7258.1, y, tot)]
    t.append(_celula(7130.9, 1308.5, "RESUMO AÇO", 7.5))
    t += [_celula(7062.1, 1290.2, "AÇO", 6.6), _celula(7119.4, 1289.7, "%%C", 7.5), _celula(7143.2, 1290.2, "TOT.(m)", 6.6),
          _celula(7218.5, 1290.2, "MASSA(kg)", 6.6)]
    for k, (d, tot, m) in enumerate((("6.3", "344", "84"), ("8", "301", "119"), ("10", "206", "127"), ("12.5", "50", "49"))):
        y = 1274.1 - 15 * k
        t += [_celula(7062.1, y, "CA50"), _celula(7111.1, y, d), _celula(7162.8, y, tot), _celula(7263.8, y, m)]
    t += [_celula(7258.4, 1214.6, "379"), _celula(7116.9, 1213.8, "TOTAL (kg)", 7.8)]
    t += [_celula(6866.7, 1100.9, "ÁREA (m²)"), _celula(6829.4, 1088.9, "147,20m²+10%%% = 161,92")]
    return t


def test_quadros_do_desenho_conferidos():
    ex = to.extrair(_quadros_reais())
    aco = [e for e in ex if e.chave.startswith("aço")]
    assert [(e.chave, e.quantidade, e.unidade, e.confere) for e in aco] == [
        ("aço CA50 Ø6,3", 84, "kg", True), ("aço CA50 Ø8", 119, "kg", True),
        ("aço CA50 Ø10", 127, "kg", True), ("aço CA50 Ø12,5", 49, "kg", True)]
    # a memória mostra a conta pela NBR 7480 e a soma da tabela de ferros (N1 + N2 + N6)
    assert aco[0].passos[0][1] == "344 m × 0,245 kg/m" and aco[0].passos[1][1] == "227 + 74 + 43 m"
    assert aco[0].fontes[0][0] == "RESUMO AÇO, linha 1"
    area = next(e for e in ex if e.origem == "anotacao")
    assert (area.quantidade, area.unidade, area.chave) == (161.92, "m²", "AREA (M²) [m²]")


def test_quadro_que_nao_bate_avisa():
    t = [x if x.texto != "119" else _celula(7258.4, x.y, "150") for x in _quadros_reais()]
    ex = {e.chave: e for e in to.extrair(t)}
    assert ex["aço CA50 Ø8"].confere is False
    assert any("o resumo diz 150 kg" in a for a in ex["aço CA50 Ø8"].avisos)
    assert any("TOTAL do quadro diz 379" in a for a in ex["aço CA50 Ø6,3"].avisos)


def test_so_tabela_de_ferros_calcula_a_massa_e_lista_de_materiais():
    t = [x for x in _quadros_reais() if x.y > 1300]
    ex = [e for e in to.extrair(t) if e.chave.startswith("aço")]
    assert [(e.chave, e.quantidade) for e in ex][:2] == [("aço Ø6,3", round(344 * 0.245, 2)), ("aço Ø8", round(301 * 0.395, 2))]
    lista = [_celula(0, 100, "LISTA DE MATERIAIS", 3)]
    lista += [_celula(x, 94, s, 2.5) for x, s in ((0, "ITEM"), (20, "DESCRIÇÃO"), (90, "QUANT."), (110, "UN"))]
    lista += [_celula(0, 88, "1", 2.5), _celula(20, 88, "Chumbador M20 x 600", 2.5), _celula(90, 88, "16", 2.5), _celula(110, 88, "pç", 2.5)]
    ex = to.extrair(lista)
    assert [(e.descricao, e.quantidade, e.unidade) for e in ex] == [("Chumbador M20 x 600", 16, "pç")]


def test_numeros_e_sugestao_de_item():
    assert to.numero("1.234,5") == 1234.5 and to.numero("161,92") == 161.92 and to.numero("1.250") == 1250
    assert to.diametro("6.3") == 6.3 and to.numero("CORR") is None
    itens = [("1.1", "Concreto fck 30", "m³"), ("2.1", "Armação de aço CA-50 em fundação", "kg"), ("3.1", "Forma plana", "m²")]
    assert to.sugerir_item("Aço CA50 Ø8 mm", "kg", itens) == "2.1"
    assert to.sugerir_item("Aço CA50 Ø8 mm", "m³", itens) is None  # unidade diferente não sugere
    assert to.sugerir_item("ÁREA DE FORMA (m²): 12 m²", "m²", itens) == "3.1"
    assert to.fator_de_conversao("kg", "t") == 0.001 and to.fator_de_conversao("m²", "M2") == 1 and to.fator_de_conversao("kg", "vb") is None
    assert sorted(["aço Ø10", "aço Ø12,5", "aço Ø6,3", "aço Ø8"], key=to.ordem_natural) == ["aço Ø6,3", "aço Ø8", "aço Ø10", "aço Ø12,5"]


# ---- pela API ---------------------------------------------------------------------------------------------------------

def _pq_aco() -> bytes:
    wb = Workbook()
    pq = wb.active
    pq.title = "PQ"
    for _ in range(11):
        pq.append([None])
    pq.append(_linha("1", ["C", "00", "00", "000", "000"], "OBRAS CIVIS"))
    pq.append(_linha("1.9", ["C", "46", "00", "000", "000"], "ARMAÇÃO"))
    pq.append(_linha("1.9.1", ["C", "46", "10", "000", "000"], "AÇO"))
    pq.append(_linha("1.9.1.1", ["C", "46", "10", "005", "000"], "FUNDAÇÃO"))
    pq.append(_linha("1.9.1.1.1", ["C", "46", "10", "005", "010"], "Armação de aço CA-50", "kg", ["CMS", "C", "46", "10", "001"], 5000, 12))
    mc = wb.create_sheet("MC")
    for _ in range(11):
        mc.append([None])
    r = [None] * 18
    r[1], r[3] = 18, "ED-01"
    r[4:9] = ["C", "46", "10", "005", "010"]
    r[9], r[11], r[12], r[15] = "Aço", "kg", 400, "ED-1800AA-01"
    mc.append(r)
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _dxf(rev: str, massa_8: str = "119") -> bytes:
    doc = ezdxf.new("R2018")
    b = doc.blocks.new("A1")
    for i, t in enumerate(("NUMERO_VALE", "REVISÃO", "DESCRIÇÃO_DA_REVISÃO", "TÍTULO_DO_DESENHO", "DATA")):
        b.add_attdef(t, (0, i * 5))
    msp = doc.modelspace()
    for t in _quadros_reais():
        s = massa_8 if t.texto == "119" else t.texto
        total = str(84 + int(massa_8) + 127 + 49)
        s = total if t.texto == "379" else s
        x = t.x - len(to.limpar(t.texto)) * t.h * 0.3
        msp.add_text(s, dxfattribs={"height": t.h, "layer": "LF100"}).set_placement((x, t.y))
    msp.add_text("BASE ED-1800AA-01", dxfattribs={"height": 5}).set_placement((0, 0))
    msp.add_lwpolyline([(0, 0), (100, 0), (100, 50), (0, 50)], close=True, dxfattribs={"layer": "CONCRETO"})
    ps = doc.layouts.new("FOLHA")
    ins = ps.add_blockref("A1", (0, 0))
    ins.add_auto_attribs({"NUMERO_VALE": "1800AA-C-0100", "REVISÃO": rev, "DESCRIÇÃO_DA_REVISÃO": "PARA CONSTRUÇÃO",
                          "TÍTULO_DO_DESENHO": "BASE", "DATA": "16/07/26"})
    out = io.StringIO()
    doc.write(out)
    return out.getvalue().encode()


def _enviar(client, dados):
    return client.post("/api/documentos/revisoes", files={"arquivo": ("base.dxf", dados, "application/octet-stream")})


@pytest.fixture
def obra_com_iwp(client):
    client.post("/api/importar/takeoff", data={"rotulo": "PQ"}, files={"arquivo": ("pq.xlsx", _pq_aco())})
    area = client.post("/api/frentes/importar", json={"texto": LISTA}).json()[0]["areas"][0]
    g = client.post("/api/catalogo/grupos", json={"descricao": "Armação"}).json()
    client.post(f"/api/catalogo/grupos/{g['id']}/itens-pq", json={"itens": ["1.9.1.1.1"]})
    tipo = client.get("/api/catalogo").json()[0]["tipos"][0]
    a = client.get("/api/wbs").json()["arvore"][0]
    no = lambda **k: client.post("/api/wbs/nos", json=k).json()  # noqa: E731
    cwp = no(tipo="cwp", pai_id=a["id"], elemento="Base", complemento="Tanque")
    gr = no(tipo="grupo", pai_id=cwp["id"], grupo_id=g["id"])
    iwp = no(tipo="iwp", pai_id=gr["id"], tipo_id=tipo["id"])
    return area, iwp


def test_takeoff_do_desenho_ate_o_iwp(client, obra_com_iwp):
    area, iwp = obra_com_iwp
    r = _enviar(client, _dxf("0"))
    assert r.status_code == 201, r.text
    assert r.json()["quantidades"] >= 5
    did = r.json()["documento"]["id"]
    j = client.get("/api/documentos/takeoff", params={"documento_id": did}).json()
    aco8 = next(x for x in j["linhas"] if x["chave"] == "aço CA50 Ø8")
    assert (aco8["quantidade"], aco8["unidade"], aco8["confere"], aco8["situacao"]) == (119, "kg", True, "extraido")
    assert aco8["item_sugerido"] == "1.9.1.1.1" and aco8["area_id"] == area["id"]  # frente pela TAG do desenho
    assert aco8["memoria"]["fontes"][0]["origem"] == "1800AA-C-0100 rev. 0"
    camada = next(x for x in j["linhas"] if x["origem"] == "camada" and "CONCRETO" in x["chave"] and "área" in x["chave"])
    assert camada["quantidade"] == 5000 and camada["avisos"]
    # aceitar sem item não pode; com o item, sim
    aco = [x for x in j["linhas"] if x["chave"].startswith("aço")]
    assert client.put(f"/api/documentos/takeoff/{aco8['id']}", json={"situacao": "aceito"}).status_code == 422
    for x in aco:
        assert client.put(f"/api/documentos/takeoff/{x['id']}", json={"item_pq": "1.9.1.1.1", "situacao": "aceito"}).status_code == 204
    assert client.put(f"/api/documentos/takeoff/{camada['id']}", json={"fator": 0}).status_code == 422
    anot = next(x for x in j["linhas"] if x["origem"] == "anotacao")  # m² não vai para item em kg
    r = client.put(f"/api/documentos/takeoff/{anot['id']}", json={"item_pq": "1.9.1.1.1"})
    assert r.status_code == 422 and "mesma unidade" in r.text
    assert [x["chave"] for x in j["linhas"] if x["chave"].startswith("aço")] == ["aço CA50 Ø6,3", "aço CA50 Ø8", "aço CA50 Ø10", "aço CA50 Ø12,5"]
    comp = client.get("/api/documentos/takeoff").json()["comparacao"]
    assert len(comp) == 1 and (comp[0]["projeto"], comp[0]["planilha"], comp[0]["diferenca"]) == (379, 400, -21)
    assert comp[0]["iwps"][0]["id"] == iwp["id"] and len(comp[0]["memorias"]["projeto"]["passos"]) == 4
    # leva ao IWP: a WBS passa a usar a quantidade do projeto, com a origem
    r = client.post("/api/documentos/takeoff/iwp", json={"item_pq": "1.9.1.1.1", "area_id": area["id"]})
    assert r.status_code == 200, r.text
    assert r.json()["quantidade"] == 379
    i = client.get("/api/wbs").json()["arvore"][0]["filhos"][0]["filhos"][0]["filhos"][0]
    assert (i["quantidade"], i["origem_qtd"]) == (379, "digitada") and "1800AA-C-0100 rev. 0" in i["observacao"]

    # revisão nova: aço Ø8 mudou → Δ, decisões herdadas (item e frente), mas precisa aceitar de novo
    assert _enviar(client, _dxf("1", massa_8="140")).status_code == 201
    j = client.get("/api/documentos/takeoff", params={"documento_id": did}).json()
    novo = next(x for x in j["linhas"] if x["chave"] == "aço CA50 Ø8" and x["revisao"] == "1")
    assert novo["delta"] == 21 and novo["anterior"] == {"revisao": "0", "quantidade": 119}
    assert novo["item_pq"] == "1.9.1.1.1" and novo["situacao"] == "extraido" and novo["confere"] is False
    velho = next(x for x in j["linhas"] if x["chave"] == "aço CA50 Ø8" and x["revisao"] == "0")
    assert velho["situacao_revisao"] == "superada"
    assert j["comparacao"] == []  # a vigente ainda não foi aceita
    assert client.post("/api/documentos/takeoff/iwp", json={"item_pq": "1.9.1.1.1", "area_id": area["id"]}).status_code == 422
    # ler de novo a mesma revisão não duplica e mantém as decisões
    client.put(f"/api/documentos/takeoff/{novo['id']}", json={"situacao": "descartado"})
    assert client.post(f"/api/documentos/revisoes/{novo['revisao_id']}/takeoff").status_code == 200
    j2 = client.get("/api/documentos/takeoff", params={"documento_id": did}).json()
    assert len(j2["linhas"]) == len(j["linhas"])
    assert next(x for x in j2["linhas"] if x["id"] == novo["id"])["situacao"] == "descartado"


def test_takeoff_isolado_por_obra(client, obra_com_iwp):
    assert _enviar(client, _dxf("0")).status_code == 201
    linhas = client.get("/api/documentos/takeoff").json()["linhas"]
    assert linhas
    outra = client.post("/api/admin/obras", json={"codigo": "OUT-TO", "nome": "Outra"}).json()["id"]
    h = {"X-Obra-Id": str(outra)}
    assert client.get("/api/documentos/takeoff", headers=h).json() == {"linhas": [], "comparacao": []}
    assert client.put(f"/api/documentos/takeoff/{linhas[0]['id']}", json={"situacao": "descartado"}, headers=h).status_code == 404


@pytest.mark.skipif(not __import__("os").environ.get("DWG_REAL"), reason="DWG real só localmente (projeto do cliente fora do git)")
def test_takeoff_do_dwg_real():
    import os

    from app.modules.documentos.infra import desenho, dwg

    dxf = dwg.dwg_para_dxf(open(os.environ["DWG_REAL"], "rb").read())
    ex = to.extrair(*desenho.levantar(dxf))
    aco = [e for e in ex if e.chave.startswith("aço")]
    assert aco and all(e.confere for e in aco)
