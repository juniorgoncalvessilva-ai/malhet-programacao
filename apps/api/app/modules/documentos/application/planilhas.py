"""Spec 123 — LDO e GRD em Excel com as logos da obra (a lista mestra e a guia de remessa que vão para a fiscalização)."""
from io import BytesIO

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, Side
from sqlalchemy.orm import Session

from app.modules.documentos.application import servico as sv
from app.shared.excel import faixa, preencher
from app.shared.marca import cor_excel, inserir_logos, marca_da_obra

FINA = Side(style="thin", color="9CA3AF")
BORDA = Border(left=FINA, right=FINA, top=FINA, bottom=FINA)
SITUACAO = {"vigente": "Vigente", "em_analise": "Em análise", "superada": "Superada", "cancelada": "Cancelada"}


def _cabecalho(ws, titulo: str, cor: str, colunas: list[tuple[str, int]], marca) -> int:
    ultima = chr(ord("A") + len(colunas) - 1)
    ws.row_dimensions[1].height = 50
    inserir_logos(ws, marca, ["A1", f"{chr(ord('A') + len(colunas) - 2)}1"], altura_px=55)
    faixa(ws, f"A2:{ultima}2", titulo, cor, 14, 26)
    for i, (nome, largura) in enumerate(colunas):
        c = ws.cell(row=3, column=i + 1, value=nome)
        c.font, c.fill, c.border = Font(bold=True, color="FFFFFF"), preencher(cor), BORDA
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        ws.column_dimensions[chr(ord("A") + i)].width = largura
    ws.freeze_panes = "A4"
    return 4


def _linha(ws, n: int, valores: list) -> None:
    for i, v in enumerate(valores):
        c = ws.cell(row=n, column=i + 1, value=v)
        c.border, c.alignment = BORDA, Alignment(vertical="center", wrap_text=True)


def ldo_xlsx(s: Session, obra_id: int) -> bytes:
    marca = marca_da_obra(s, obra_id)
    wb = Workbook()
    ws = wb.active
    ws.title = "LDO"
    cols = [("Código", 22), ("Código contratada", 26), ("Título", 60), ("Tipo", 18), ("Disciplina", 14),
            ("Rev. vigente", 10), ("Finalidade", 20), ("Data", 12), ("Última rev.", 10), ("Situação da última", 16)]
    n = _cabecalho(ws, "LISTA DE DOCUMENTOS (LDO)", cor_excel(marca, "284E4F"), cols, marca)
    for d in sv.listar(s, obra_id):
        v, u = d["vigente"] or {}, d["ultima"] or {}
        _linha(ws, n, [d["codigo"], d["codigo_contratada"], d["titulo"], d["tipo_nome"], d["disciplina"], v.get("revisao") or "—",
                       v.get("finalidade"), v.get("data_emissao"), u.get("revisao"), SITUACAO.get(u.get("situacao"), "")])
        n += 1
    ws.auto_filter.ref = f"A3:J{max(n - 1, 3)}"
    out = BytesIO()
    wb.save(out)
    return out.getvalue()


def grd_xlsx(s: Session, obra_id: int, gid: int) -> tuple[bytes, str]:
    g = sv.grd_detalhe(s, obra_id, gid)
    marca = marca_da_obra(s, obra_id)
    wb = Workbook()
    ws = wb.active
    ws.title = "GRD"
    cols = [("Item", 6), ("Código", 22), ("Título", 60), ("Revisão", 9), ("Finalidade", 22)]
    cor = cor_excel(marca, "284E4F")
    _cabecalho(ws, f"GUIA DE REMESSA DE DOCUMENTOS · {g['numero']}", cor, cols, marca)
    ws.insert_rows(3, 4)
    dados = [("Data", g["data"]), ("De", g["remetente"]), ("Para", g["destinatario"]),
             ("GRD de origem" if g["sentido"] == "recebida" else "Observação", g["numero_externo"] or g["observacao"] or "")]
    for i, (k, v) in enumerate(dados):
        ws.cell(row=3 + i, column=1, value=k).font = Font(bold=True)
        ws.merge_cells(start_row=3 + i, start_column=2, end_row=3 + i, end_column=5)
        ws.cell(row=3 + i, column=2, value=v)
    n = 8
    for k, it in enumerate(g["itens"], start=1):
        _linha(ws, n, [k, it["codigo"], it["titulo"], it["revisao"], it["finalidade"]])
        n += 1
    n += 2
    ws.cell(row=n, column=1, value="Recebido por:").font = Font(bold=True)
    ws.cell(row=n, column=2, value=g["ciente_por"] or "__________________________")
    ws.cell(row=n + 1, column=1, value="Em:").font = Font(bold=True)
    ws.cell(row=n + 1, column=2, value=(g["ciente_em"] or "")[:10] or "____/____/______")
    out = BytesIO()
    wb.save(out)
    return out.getvalue(), g["numero"]
