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
    """Guia de Remessa no modelo do contrato (spec 130, GRD-MIL-0272): FOLHA · DATA · PARA / DE / GRDT Nº · ATENÇÃO / EMITENTE /
    REFERÊNCIA com área/cargo · itens (Nº documento, título, rev., folhas, status, finalidade, tipo de via, formato, vias) ·
    observações · legendas · REMETENTE e RECEBIDO com data e assinatura."""
    from app.modules.documentos.domain import grd as gd

    g = sv.grd_detalhe(s, obra_id, gid)
    marca = marca_da_obra(s, obra_id)
    cor = cor_excel(marca, "284E4F")
    wb = Workbook()
    ws = wb.active
    ws.title = "GRD"
    larg = {"A": 6, "B": 22, "C": 46, "D": 7, "E": 9, "F": 8, "G": 11, "H": 8, "I": 9, "J": 8}
    for k, v in larg.items():
        ws.column_dimensions[k].width = v
    ws.row_dimensions[1].height = 48
    inserir_logos(ws, marca, ["A1", "I1"], altura_px=50)
    faixa(ws, "A2:H2", "GUIA DE REMESSA DE DOCUMENTOS", cor, 14, 26)
    ws["I2"], ws["J2"] = "FOLHA", "1 de 1"
    rot = Font(bold=True, size=8, color="555555")

    def bloco(linha: int, col: str, ate: str, rotulo: str, valor) -> None:
        ws[f"{col}{linha}"] = rotulo
        ws[f"{col}{linha}"].font = rot
        ws.merge_cells(f"{col}{linha + 1}:{ate}{linha + 1}")
        ws[f"{col}{linha + 1}"] = valor or ""
        ws[f"{col}{linha + 1}"].font = Font(bold=True, size=10)
        for c in (f"{col}{linha}", f"{col}{linha + 1}"):
            ws[c].border = BORDA

    bloco(3, "A", "C", "PARA:", g["destinatario"])
    bloco(3, "D", "G", "DE:", g["remetente"])
    bloco(3, "H", "J", "GRDT Nº:", g["numero"] + (f"  (origem {g['numero_externo']})" if g["numero_externo"] else ""))
    bloco(5, "A", "C", "ATENÇÃO:", g.get("atencao"))
    bloco(5, "D", "G", "EMITENTE:", g.get("emitente"))
    bloco(5, "H", "J", "DATA:", "/".join(reversed(g["data"].split("-"))))
    bloco(7, "A", "C", "ÁREA/CARGO", g.get("atencao_cargo"))
    bloco(7, "D", "G", "ÁREA/CARGO", g.get("emitente_cargo"))
    bloco(7, "H", "J", "REFERÊNCIA:", g.get("referencia"))
    cab = ["Item", "Nº Documento", "Título", "Rev.", "Nº folha", "Status", "Finalidade", "Tipo", "Formato", "Nº vias"]
    for i, nome in enumerate(cab, start=1):
        c = ws.cell(row=10, column=i, value=nome)
        c.font, c.fill, c.border = Font(bold=True, color="FFFFFF", size=9), preencher(cor), BORDA
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    n = 11
    for k, it in enumerate(g["itens"], start=1):
        _linha(ws, n, [k, it["codigo"], it["titulo"], it["revisao"], it.get("folhas"), it.get("status"), it.get("finalidade_remessa"),
                       it.get("via"), it.get("formato"), it.get("vias")])
        for col in "ADEFGHIJ":
            ws[f"{col}{n}"].alignment = Alignment(horizontal="center", vertical="center")
        n += 1
    for _ in range(max(0, 12 - len(g["itens"]))):  # linhas em branco como no modelo
        _linha(ws, n, ["-"] * 10)
        n += 1
    n += 1
    ws[f"A{n}"] = "Observações:"
    ws[f"A{n}"].font = rot
    ws.merge_cells(f"A{n + 1}:J{n + 2}")
    ws[f"A{n + 1}"] = g.get("observacao") or ""
    ws[f"A{n + 1}"].alignment = Alignment(wrap_text=True, vertical="top")
    n += 4
    leg = [("STATUS", "A", [f"{k} - {v}" for k, v in gd.STATUS.items()]), ("FINALIDADE", "D", [f"{k} - {v}" for k, v in gd.FINALIDADES.items()]),
           ("TIPO DE VIA", "G", [f"{k} - {v}" for k, v in gd.VIAS.items()]), ("FORMATO", "J", list(gd.FORMATOS))]
    for titulo, col, itens in leg:
        ws[f"{col}{n}"] = titulo
        ws[f"{col}{n}"].font = Font(bold=True, size=8)
        for k, x in enumerate(itens, start=1):
            ws[f"{col}{n + k}"] = x
            ws[f"{col}{n + k}"].font = Font(size=8, color="555555")
    n += max(len(x[2]) for x in leg) + 2
    ws[f"A{n}"], ws[f"F{n}"] = "REMETENTE", "RECEBIDO (IDENTIFICAÇÃO E ASSINATURA)"
    ws[f"A{n}"].font = ws[f"F{n}"].font = rot
    ws[f"A{n + 1}"] = "\n".join(x for x in (g.get("emitente"), g.get("emitente_cargo")) if x) or g["remetente"]
    ws[f"D{n}"], ws[f"D{n + 1}"] = "DATA:", "/".join(reversed(g["data"].split("-")))
    ws[f"F{n + 1}"] = g["ciente_por"] or ""
    ws[f"I{n}"], ws[f"I{n + 1}"] = "DATA:", ("/".join(reversed(g["ciente_em"][:10].split("-"))) if g["ciente_em"] else "____/____/______")
    ws[f"A{n + 3}"], ws[f"F{n + 3}"] = "CARIMBO E ASSINATURA DO RESPONSÁVEL", "CARIMBO E ASSINATURA DO RESPONSÁVEL"
    ws[f"A{n + 3}"].font = ws[f"F{n + 3}"].font = rot
    ws.page_setup.orientation, ws.page_setup.fitToWidth = "portrait", 1
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    out = BytesIO()
    wb.save(out)
    return out.getvalue(), g["numero"]


def plano_arquivamento_xlsx(s: Session, obra_id: int, por: str) -> bytes:
    """Plano de arquivamento (spec 130, no espírito do PR-17321-002): uma linha por pasta — natureza (documento ou registro),
    o que entra (regra), responsável, meio e local, retenção e quantos itens tem hoje — e as regras de controle da obra."""
    from app.modules.documentos.application import pastas as pst
    from app.modules.documentos.domain import documento as dom
    from app.modules.documentos.domain import pastas as pd

    dados = pst.listar(s, obra_id, por)
    marca = marca_da_obra(s, obra_id)
    wb = Workbook()
    ws = wb.active
    ws.title = "Plano de arquivamento"
    cols = [("Código", 8), ("Pasta", 30), ("Natureza", 12), ("O que entra", 40), ("Responsável", 24), ("Meio e local", 34),
            ("Retenção", 40), ("Itens", 8), ("Vigentes", 9)]
    n = _cabecalho(ws, "PLANO DE ARQUIVAMENTO", cor_excel(marca, "284E4F"), cols, marca)
    for p in dados["pastas"]:
        regra = "; ".join(filter(None, [", ".join(dom.TIPOS.get(t, t) for t in p["tipos"]),
                                        ("disciplinas " + ", ".join(p["disciplinas"])) if p["disciplinas"] else "",
                                        ("pacotes " + ", ".join(p["pacotes"])) if p["pacotes"] else ""]))
        _linha(ws, n, [p["codigo"], p["nome"], pd.NATUREZAS.get(p["natureza"], p["natureza"]), regra, p["responsavel"],
                       " · ".join(x for x in (p["meio"], p["local"]) if x), p["retencao"], p["documentos"], p["vigentes"]])
        n += 1
    n += 1
    regras = [
        "Toda distribuição externa sai com Guia de Remessa de Documentos (GRD); a ciência de quem recebe fica registrada.",
        "Projetos são controlados pela Lista de Documentos (LDO) e pelo carimbo; vale no campo só a revisão vigente.",
        "Cópia impressa de documento vigente leva \"CÓPIA CONTROLADA\"; revisão superada aparece como \"DOCUMENTO OBSOLETO\".",
        "Quem abriu cada revisão (computador, app de campo ou link do encarregado) fica registrado.",
        "Os arquivos ficam no acervo da obra (servidor do Malhet ou nuvem da própria empresa), com a ficha .md das ligações.",
        f"Arquivo baixado sai com o nome OBRA_CÓDIGO_Rrev_TE. Documentos sem pasta hoje: {dados['sem_pasta']}.",
    ]
    ws.cell(row=n, column=1, value="Regras de controle").font = Font(bold=True)
    for k, r in enumerate(regras, start=1):
        ws.merge_cells(start_row=n + k, start_column=1, end_row=n + k, end_column=9)
        ws.cell(row=n + k, column=1, value=f"{k}. {r}").alignment = Alignment(wrap_text=True)
    out = BytesIO()
    wb.save(out)
    return out.getvalue()
