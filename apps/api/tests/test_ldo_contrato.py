"""Spec 128: LDO no modelo do contrato (folha de rosto + uma aba por pacote, TE em letra, Observações = CWA/local, duas colunas
Disciplina) e as Frentes pela planilha de CWAs (aba da contratada, só as linhas da empresa). Os arquivos reais do cliente
ficam fora do git: o teste com eles só roda com LDO_REAL / CWA_REAL."""
import io
import os
from datetime import datetime

import pytest
from openpyxl import Workbook

from app.modules.documentos.domain import documento as dom
from app.modules.documentos.domain import ldo as ldo_dom
from app.modules.frentes.domain import planilha_cwa as pc

CAB = ["Número VALE", "Descrição", "Revisão", "Tipo de Emissão", "Observações", "Disciplina", "Motivo Revisão", "Disciplina",
       "Enviado em", "Projeto Apresentado", "Para quem"]


def _ldo() -> bytes:
    wb = Workbook()
    rosto = wb.active
    rosto.title = "F. Rosto"
    rosto.append(["CLASSIFICAÇÃO", None, "USO INTERNO"])
    rosto.append([])
    rosto.append(["PROJETO DETALHADO", None, "Nº VALE", None, "PÁGINAS"])
    rosto.append([None, None, "LD-0000AA-G-54938", None, 1])
    rosto.append([None, None, "REVISÃO"])
    rosto.append([None, None, 5])
    for _ in range(4):
        rosto.append([])
    rosto.append(["Rev.", "TE", "Descrição", "Por", "Ver.", "Apr.", "Aut.", "Data"])
    rosto.append([0, "C", "EMISSÃO INICIAL.", "PHB", "PHB", "ALF", "ALF", datetime(2026, 4, 24)])
    rosto.append([5, "C", "ATUALIZAÇÃO DA LDO", "PHB", "PHB", "ALF", "ALF", datetime(2026, 8, 19)])
    for nome, linhas in (
        ("1870CC - CMD", [
            ["1800AA-C-52640", "PROJETO DETALHADO - CMD - GALPÃO CLASSE II", 2, "e", "Galpão de resíduos classe II", "C",
             "Adequação da nomenclatura", "Civil", datetime(2026, 6, 15), "Não", "apresentado em 13/05"],
            ["1800AA-C-52641", "PROJETO DETALHADO - CMD - CLASSE I", 0, "e", "Classe I", "C", None, None, datetime(2026, 6, 15), "Sim", "Togalma"],
            ["1800AA-A-52642", "PROJETO DETALHADO - CMD - CERCAMENTO", "A", "b", "Cercamento", "A", None, "Arquitetura", None, None, None],
        ]),
        ("16XXCC - OFICINA", [
            ["1800AA-E-51286", "INSTALAÇÕES - ATERRAMENTO", 3, "e", "004.05", "E", "Interferência no aterro", "Elétrica",
             datetime(2026, 5, 22), "Sim", "Bruno"],
            ["0000AA-C-00015", "COMUM GERAL - DETALHES CHUMBADORES", 0, "h", "Geral - Detalhes", "C", None, "Civil", None, None, None],
        ]),
    ):
        ws = wb.create_sheet(nome)
        for _ in range(11):
            ws.append([None])
        ws.append(CAB)
        for linha in linhas:
            ws.append(linha)
    b = io.BytesIO()
    wb.save(b)
    return b.getvalue()


def _cwa() -> bytes:
    wb = Workbook()
    wb.active.title = "CWA"
    wb.active.append(["Site", "Programa", "CWA / Sub CWA", "Código", "Descritivo"])
    ws = wb.create_sheet("CWAs Cardan")
    ws.append([None, "ÁREA", "CWA", "SUBCWA", "CONCATENADO", "ATIVO", "CWA Atualizada", "Lado", "Situação", "Empresa"])
    ws.append([None, "00", "000", "00", "000.00", None, "Comum Geral - Lado Sul", "Sul", "Ativa", "-"])
    ws.append([None, None, None, None, None, None, "Nova Subestação", "-", "-", "-"])
    ws.append([None, "18", "001", "00", "001.00", None, "Pátio - Nova Subestação", "Sul", "Ativa", "SNEF"])
    ws.append([None, "18", None, None, None, None, "Novo CMD", "-", "-", "-"])
    ws.append([None, None, "004", "04", "004.04", "ED-1800AA-02", "Galpão de resíduos classe I", "Sul", "Ativa", "CARDAN"])
    ws.append([None, None, "004", "05", "004.05", "ED-1800AA-01", "Galpão de resíduos classe II", "Sul", "Ativa", "CARDAN"])
    ws.append([None, None, "004", "09", "004.09", "ED-1800AA-03", "Pátio de caçambas", "Sul", "Ativa", "CARDAN"])
    ws.append([None, None, "004", "09", "004.09", "ED-1800AA-07", "DIR", "Sul", "Ativa", "CARDAN"])
    ws.append([None, None, "004", "10", "004.10", "ED-1800AA-09", "Desativada", "Sul", "Inativa", "CARDAN"])
    b = io.BytesIO()
    wb.save(b)
    return b.getvalue()


def test_tipo_de_emissao_em_letra():
    assert [dom.normalizar_finalidade(x) for x in ("e", "B", "G", "H", "D", "g - conforme construído")] == [
        "PARA CONSTRUÇÃO", "PARA APROVAÇÃO", "CONFORME CONSTRUÍDO", "CANCELADO", "PARA COTAÇÃO", "CONFORME CONSTRUÍDO"]
    assert dom.libera_uso("e") and dom.libera_uso("G") and not dom.libera_uso("F") and not dom.libera_uso("c")


def test_leitura_da_ldo_do_contrato():
    from openpyxl import load_workbook

    wb = load_workbook(io.BytesIO(_ldo()), read_only=True, data_only=True)
    L = ldo_dom.ler([(ws.title, list(ws.iter_rows(values_only=True))) for ws in wb.worksheets])
    assert (L.codigo, L.revisao, [h.revisao for h in L.historico]) == ("LD-0000AA-G-54938", "5", ["0", "5"])
    assert L.abas == [("1870CC - CMD", 3), ("16XXCC - OFICINA", 2)] and L.ignoradas == ["F. Rosto"]
    x = L.linhas[0]
    assert (x.codigo, x.revisao, x.finalidade, x.local, x.disciplina_sigla, x.disciplina) == (
        "1800AA-C-52640", "2", "PARA CONSTRUÇÃO", "Galpão de resíduos classe II", "C", "Civil")
    assert (x.motivo, x.enviado_em.isoformat(), x.apresentado, x.para_quem) == ("Adequação da nomenclatura", "2026-06-15", False, "apresentado em 13/05")
    assert L.linhas[1].disciplina == "Civil"  # só a sigla: completa pelo par da própria LDO
    assert L.linhas[2].finalidade == "PARA APROVAÇÃO" and L.linhas[4].finalidade == "CANCELADO"
    areas = [ldo_dom.AreaRef(1, "004.04", "004.04", "Galpão de resíduos classe I", "ED-1800AA-02", "Novo CMD"),
             ldo_dom.AreaRef(2, "004.05", "004.05", "Galpão de resíduos classe II", "ED-1800AA-01", "Novo CMD")]
    assert ldo_dom.casar_local("Classe I", "X", areas)[:2] == (1, False)  # palavra inteira: não casa com "classe II"
    assert ldo_dom.casar_local("004.05", "X", areas)[:2] == (2, True)  # código exato confirma
    assert ldo_dom.casar_local("ver ED-1800AA-02", "X", areas)[:2] == (1, False)
    assert ldo_dom.casar_local("Cercamento", "1800AA-A-1", areas)[0] is None  # local escrito e não achado: não chuta


def test_frentes_pela_planilha_de_cwas(client):
    assert client.put("/api/obra/marca/nomes", json={"nome_contratada": "Cardan Engenharia"}).status_code == 200
    p = client.post("/api/frentes/planilha/previa", files={"arquivo": ("cwa.xlsx", _cwa())}).json()
    assert p["sugerida"] == "CWAs Cardan" and p["empresas"] == ["CARDAN"]
    aba = next(a for a in p["abas"] if a["nome"] == "CWAs Cardan")
    assert aba["empresas"] == {"CARDAN": 4, "-": 1, "SNEF": 1} and aba["inativas"] == 1
    r = client.post("/api/frentes/planilha", data={"aba": "CWAs Cardan", "empresas": "CARDAN"}, files={"arquivo": ("cwa.xlsx", _cwa())})
    assert r.status_code == 200, r.text
    locais = r.json()
    assert [l["descricao"] for l in locais] == ["Novo CMD"]
    assert [(a["codigo"], a["descricao"], a["ativo_codigo"]) for a in locais[0]["areas"]] == [
        ("004.04", "Galpão de resíduos classe I", "ED-1800AA-02"), ("004.05", "Galpão de resíduos classe II", "ED-1800AA-01"),
        ("004.09.1", "Pátio de caçambas", "ED-1800AA-03"), ("004.09.2", "DIR", "ED-1800AA-07")]  # CWA repetido ganha sufixo
    assert len(client.get("/api/wbs").json()["arvore"]) == 4  # as áreas da contratada já são a WBS de execução
    # reimportar não duplica
    again = client.post("/api/frentes/planilha", data={"aba": "CWAs Cardan", "empresas": "CARDAN"}, files={"arquivo": ("cwa.xlsx", _cwa())}).json()
    assert sum(len(l["areas"]) for l in again) == 4


def test_importar_ldo_do_contrato(client):
    client.post("/api/frentes/planilha", data={"aba": "CWAs Cardan", "empresas": "CARDAN"}, files={"arquivo": ("cwa.xlsx", _cwa())})
    r = client.post("/api/documentos/ldo", files={"arquivo": ("LD-0000AA-G-54938 REV 5.xlsx", _ldo())})
    assert r.status_code == 200, r.text
    j = r.json()
    assert (j["criados"], j["revisoes"], j["ligados"], j["sugeridos"]) == (5, 5, 1, 2)
    assert j["abas"] == [{"aba": "1870CC - CMD", "documentos": 3}, {"aba": "16XXCC - OFICINA", "documentos": 2}]
    assert {x["local"] for x in j["locais_nao_achados"]} == {"Cercamento", "Geral - Detalhes"}
    assert j["ldo"]["codigo"] == "LD-0000AA-G-54938" and j["ldo"]["revisao"] == "5" and j["ldo"]["arquivo_guardado"]
    docs = {d["codigo"]: d for d in client.get("/api/documentos").json()}
    d = docs["1800AA-C-52640"]
    assert (d["pacote"], d["local_texto"], d["disciplina"], d["disciplina_sigla"]) == ("1870CC - CMD", "Galpão de resíduos classe II", "CIVIL", "C")
    assert d["ultima"]["revisao"] == "2" and d["ultima"]["finalidade"] == "PARA CONSTRUÇÃO" and d["vigente"]["revisao"] == "2"
    det = client.get(f"/api/documentos/{d['id']}").json()
    h = det["historico"][0]
    assert (h["motivo"], h["ldo_enviada_em"], h["apresentado"], h["ldo"]) == ("Adequação da nomenclatura", "2026-06-15", False, "LD-0000AA-G-54938 rev. 5")
    assert det["vinculos"][0]["sugerido"] and det["vinculos"][0]["alvo"].startswith("004.05")
    assert docs["0000AA-C-00015"]["vigente"] is None  # H = cancelado
    # a própria LDO vira documento (Lista) com o histórico e o arquivo na revisão atual
    ldo = docs["LD-0000AA-G-54938"]
    assert ldo["tipo"] == "LIS" and ldo["revisoes"] == 2 and "original" in ldo["ultima"]["formatos"]
    # reimportar não duplica nem perde o que já estava
    j2 = client.post("/api/documentos/ldo", files={"arquivo": ("ldo.xlsx", _ldo())}).json()
    assert (j2["criados"], j2["revisoes"], j2["ligados"], j2["sugeridos"]) == (0, 0, 0, 0) and not j2["ldo"]["arquivo_guardado"]


@pytest.mark.skipif(not (os.environ.get("LDO_REAL") and os.environ.get("CWA_REAL")), reason="arquivos do cliente fora do git")
def test_arquivos_reais():
    from openpyxl import load_workbook

    wb = load_workbook(os.environ["LDO_REAL"], read_only=True, data_only=True)
    L = ldo_dom.ler([(ws.title, list(ws.iter_rows(values_only=True))) for ws in wb.worksheets])
    assert L.codigo and L.revisao and len(L.linhas) > 100 and len(L.abas) >= 2
    wb = load_workbook(os.environ["CWA_REAL"], read_only=True, data_only=True)
    lidas = pc.ler([(ws.title, list(ws.iter_rows(values_only=True))) for ws in wb.worksheets])
    aba, emp = pc.sugerir_aba(lidas, "CARDAN")
    assert aba is not None and emp == ["CARDAN"] and len([x for x in aba.linhas if x.empresa == "CARDAN"]) > 20
