"""Spec 130: GRD no modelo do contrato (GRD-MIL-0272) — leitura, importação da GRD recebida (registra as revisões e guarda a
planilha), Excel no layout com as colunas e legendas, e o plano de arquivamento a partir das pastas."""
import io
import os
from datetime import datetime

import pytest
from openpyxl import Workbook, load_workbook

from app.modules.documentos.domain import grd as gd
from app.shared.errors import DomainError


def _grd() -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Pag.1"
    L = lambda *cels: ws.append(list(cels))  # noqa: E731
    L()
    L(None, None, None, None, "GUIA DE REMESSA DE DOCUMENTOS ", *[None] * 10, "FOLHA:", "1", "de 1")
    L(*[None] * 15, "DATA:", " 25/06/2026")
    L(None, "PARA:", *[None] * 6, "DE:", *[None] * 6, "GRDT Nº:")
    L(None, "Milplan", *[None] * 6, "MILPLAN Engenharia", *[None] * 6, "GRD-MIL-0272")
    L(None, "ATENÇÃO:", *[None] * 6, "EMITENTE:", *[None] * 6, "REFERÊNCIA:")
    L(None, "Raquel Teixeira", *[None] * 6, "Lidiane Gomes", *[None] * 6, "Book Qualidade")
    L(None, "ÁREA/CARGO", *[None] * 6, "ÁREA/CARGO")
    L(None, "ENGENHEIRO QUALIDADE", *[None] * 6, "ANALISTA QUALIDADE")
    L()
    L(None, "Item", "Nº Documento", None, None, "Título", None, None, None, None, "Rev.", "Nº folha", "Status", "Finalidade", "Tipo", "Formato", "Nº vias")
    L(None, "1", "450.QUA.IT-001", None, None, "EXECUÇÃO E INSPEÇÃO DE SOLDAGEM", None, None, None, None, "0", "14", "E", "E", "CC", "A4", "1")
    L(None, "2", "QSMS.QUA.PO-01", None, None, "ENSAIO VISUAL EM JUNTAS SOLDADAS", None, None, None, None, "3", "39", "B", "2", "AD", "A1", "2")
    L(None, "-", "-", None, None, "-", None, None, None, None, "-", "-", "-", "-", "-", "-", "-")
    L(None, "Observações:")
    L(None, "Book Qualidade")
    b = io.BytesIO()
    wb.save(b)
    return b.getvalue()


def test_leitura_e_regras_da_grd():
    g = gd.ler(list(load_workbook(io.BytesIO(_grd()), read_only=True).worksheets[0].iter_rows(values_only=True)))
    assert (g.numero, g.data.isoformat(), g.de, g.para, g.atencao, g.emitente_cargo, g.referencia, g.observacao) == (
        "GRD-MIL-0272", "2026-06-25", "MILPLAN Engenharia", "Milplan", "Raquel Teixeira", "ANALISTA QUALIDADE", "Book Qualidade", "Book Qualidade")
    a, b = g.itens
    assert (a.codigo, a.revisao, a.folhas, a.status, a.finalidade, a.via, a.formato, a.vias) == ("450.QUA.IT-001", "0", 14, "E", 3, "CC", "A4", 1)
    assert (b.status, b.finalidade, b.via, b.formato, b.vias) == ("B", 2, "AD", "A1", 2)
    assert gd.status_da_finalidade("PARA CONSTRUÇÃO") == "E" and gd.finalidade_da_remessa("CONFORME CONSTRUÍDO") == 6
    with pytest.raises(DomainError):
        gd.validar_item("XX", None, None, None, None)
    with pytest.raises(DomainError):
        gd.validar_item("CC", "A9", None, None, None)


def test_importar_grd_recebida_e_excel_no_modelo(client):
    r = client.post("/api/documentos/grds/importar", files={"arquivo": ("GRD-MIL-0272.xlsx", _grd())})
    assert r.status_code == 201, r.text
    g = r.json()
    assert (g["sentido"], g["numero_externo"], g["remetente"], g["atencao"], g["documentos_novos"], g["revisoes_novas"]) == (
        "recebida", "GRD-MIL-0272", "MILPLAN Engenharia", "Raquel Teixeira", 2, 2)
    assert [(i["codigo"], i["status"], i["finalidade_remessa"], i["via"], i["formato"], i["vias"], i["folhas"]) for i in g["itens"]] == [
        ("450.QUA.IT-001", "E", 3, "CC", "A4", 1, 14), ("QSMS.QUA.PO-01", "B", 2, "AD", "A1", 2, 39)]
    docs = {d["codigo"]: d for d in client.get("/api/documentos").json()}
    assert docs["450.QUA.IT-001"]["tipo"] == "IT" and docs["QSMS.QUA.PO-01"]["tipo"] == "PRO"
    assert docs["450.QUA.IT-001"]["ultima"]["finalidade"] == "PARA CONSTRUÇÃO" and docs["450.QUA.IT-001"]["ultima"]["grd_id"] == g["id"]
    assert client.post("/api/documentos/grds/importar", files={"arquivo": ("x.xlsx", _grd())}).status_code == 422  # já importada
    assert client.get(f"/api/documentos/grds/{g['id']}/arquivo").content[:2] == b"PK"
    # Excel no layout do contrato: cabeçalho, colunas e legendas
    x = client.get(f"/api/documentos/grds/{g['id']}/xlsx")
    ws = load_workbook(io.BytesIO(x.content)).active
    textos = {str(c.value) for row in ws.iter_rows() for c in row if c.value is not None}
    assert {"PARA:", "DE:", "GRDT Nº:", "ATENÇÃO:", "EMITENTE:", "REFERÊNCIA:", "Nº folha", "Tipo", "Nº vias", "Raquel Teixeira",
            "CC - Cópia controlada", "3 - Para aplicação/construção", "OB - OBSOLETO", "OFICIO"} <= textos
    # GRD emitida: status pela finalidade, finalidade da remessa e via padrão (cópia controlada)
    did = docs["450.QUA.IT-001"]["id"]
    e = client.post("/api/documentos/grds", json={"sentido": "emitida", "data": "2026-11-22", "remetente": "Contratada",
                                                   "destinatario": "Campo", "atencao": "Encarregado", "itens": [{"documento_id": did, "formato": "a4"}]}).json()
    assert (e["itens"][0]["status"], e["itens"][0]["finalidade_remessa"], e["itens"][0]["via"], e["itens"][0]["formato"], e["itens"][0]["vias"]) == ("E", 3, "CC", "A4", 1)
    assert client.get("/api/documentos/grds/opcoes").json()["vias"]["AD"] == "Arquivo digital"


def test_plano_de_arquivamento(client):
    p = client.get("/api/documentos/pastas").json()["pastas"]
    assert p[0]["natureza"] == "documento" and p[-1]["natureza"] == "registro" and "Data-Book" in p[0]["retencao"]
    nova = client.post("/api/documentos/pastas", json={"nome": "Registros de solda", "tipos": ["OUT"], "natureza": "registro",
                                                        "responsavel": "CQ", "retencao": "5 anos"}).json()
    assert client.post("/api/documentos/pastas", json={"nome": "X y z", "tipos": ["OUT"], "natureza": "outra"}).status_code == 422
    ws = load_workbook(io.BytesIO(client.get("/api/documentos/plano-arquivamento.xlsx").content)).active
    linhas = [[c for c in r] for r in ws.iter_rows(values_only=True)]
    assert any(r[1] == "Registros de solda" and r[2] == "Registro" and r[4] == "CQ" and r[6] == "5 anos" for r in linhas if len(r) > 6)
    assert any(str(r[0]).startswith("1. Toda distribuição externa sai com Guia de Remessa") for r in linhas if r[0])
    assert nova["codigo"] == "70"


@pytest.mark.skipif(not os.environ.get("GRD_REAL"), reason="GRD real só localmente")
def test_grd_real():
    g = gd.ler(list(load_workbook(os.environ["GRD_REAL"], read_only=True, data_only=True).worksheets[0].iter_rows(values_only=True)))
    assert g.numero and len(g.itens) >= 5 and all(i.via for i in g.itens) and datetime
