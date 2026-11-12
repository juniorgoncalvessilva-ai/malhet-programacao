"""Pareto de Desvios em Excel no layout da planilha da obra (para a fiscalização).

Abas: Gráfico (faixas "Acompanhamento | Principais Problemas" + gráficos Acumulado, Semana atual e Por frente),
Detalhamento (mesmo layout: título, faixa verde, cabeçalho 006666, Arial 12, ID cinza, Status com ícones
1 = ✖ vermelho, 2 = ! amarelo, 3 = ✔ verde) e Dados (recorrência por semana, matriz causa × semana, por frente).
"""
from collections import Counter
from datetime import date
from io import BytesIO

from openpyxl import Workbook
from openpyxl.formatting.rule import IconSetRule
from openpyxl.styles import Alignment, Border, Font
from openpyxl.utils import get_column_letter

from app.shared.excel import BORDA_HAIR, FINA, HAIR, barras, caber_na_largura, faixa, preencher
from app.shared.marca import Marca, cor_excel, inserir_logos

VERDE_FAIXA, VERDE_CAB, CINZA_ID, VERMELHO = "007E7A", "006666", "808080", "C00000"
COLUNAS = (("B", "Dia", 23), ("C", "Semana", 16.6), ("D", "ID", 11), ("E", "Classificação", 36.7), ("F", "Desvio", 64.1),
           ("G", "Frente de serviço", 27.1), ("H", "Ação", 77.3), ("I", "Responsabilidade", 34.6),
           ("J", "Responsabilidade - Gerencia", 38), ("K", "Status", 10.6), ("M", "Atividade impactada", 32.4))


def _detalhamento(ws, linhas: list[dict], titulo: str, marca: Marca | None = None) -> None:
    VERDE_FAIXA, VERDE_CAB = cor_excel(marca, "007E7A"), cor_excel(marca, "006666")  # cor do cliente, se houver
    ws.sheet_view.showGridLines = False
    ws.sheet_view.zoomScale = 60
    ws.column_dimensions["A"].width = 0.3
    ws.column_dimensions["L"].width = 2.1
    for col, _n, w in COLUNAS:
        ws.column_dimensions[col].width = w
    ws.row_dimensions[1].height = 70.5
    ws.merge_cells("B1:M1")
    ws["B1"] = titulo
    ws["B1"].font = Font(name="Calibri", size=26, bold=True, color="000000")
    ws["B1"].alignment = Alignment(horizontal="center", vertical="center")
    faixa(ws, "B2:K2", "Detalhamento", VERDE_FAIXA, 16, altura=37.5)
    inserir_logos(ws, marca, ["B1", "J1"], altura_px=72)
    ws.row_dimensions[3].height = 17.25
    ws.row_dimensions[4].height = 21
    for col, nome, _w in COLUNAS:
        c = ws[f"{col}4"]
        c.value = nome
        c.font = Font(name="Calibri", size=16, bold=True, color="FFFFFF")
        c.fill = preencher(VERDE_CAB)
        c.alignment = Alignment(horizontal="left" if col in ("E", "M") else "center", vertical="center", wrap_text=True)
        c.border = Border(left=HAIR)
    esq = {"E", "F", "H", "M"}
    for i, d in enumerate(linhas, start=5):
        ws.row_dimensions[i].height = 34.95
        vals = {"B": d["data"], "C": d["semana"], "D": d["referencia"], "E": d["causa"], "F": d["descricao"],
                "G": d["frente"], "H": d["acao"], "I": d["responsavel"], "J": d["gerencia"], "K": d["status"],
                "M": d["atividade_impactada"]}
        for col, v in vals.items():
            c = ws[f"{col}{i}"]
            c.value = v
            c.font = Font(name="Arial", size=20 if col == "K" else 12, color="000000")
            c.alignment = Alignment(horizontal="left" if col in esq else "center", vertical="center", wrap_text=col != "K")
            c.border = BORDA_HAIR
            if col == "B":
                c.number_format = "DD/MM/YYYY"
            if col == "D":
                c.fill = preencher(CINZA_ID)
    ult = max(5, len(linhas) + 4)
    # Status: 1 = ✖ vermelho, 2 = ! amarelo, 3 = ✔ verde (3 Símbolos circulados, sem mostrar o número)
    ws.conditional_formatting.add(f"K5:K{ult}", IconSetRule("3Symbols", "num", [0, 2, 3], showValue=False))
    ws.auto_filter.ref = f"B4:K{ult}"
    ws.freeze_panes = "B5"
    ws.print_title_rows = "4:4"
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True


def exportar(desvios: list[dict], causas: list[str], titulo_obra: str, hoje: date, marca: Marca | None = None) -> bytes:
    """desvios: dicts com data, semana, referencia, causa, descricao, frente, acao, responsavel, gerencia, status,
    atividade_impactada. causas: a lista de classificações da obra na ordem do cadastro."""
    linhas = sorted(desvios, key=lambda d: (d["data"], d.get("id") or 0))
    wb = Workbook()
    wg = wb.active
    wg.title = "Gráfico"
    wd_det = wb.create_sheet("Detalhamento")
    wdados = wb.create_sheet("Dados")
    VERDE_FAIXA, VERDE_CAB = cor_excel(marca, "007E7A"), cor_excel(marca, "006666")  # cor do cliente, se houver
    _detalhamento(wd_det, linhas, f"Pareto de Desvios | {titulo_obra}", marca)

    # ---- Dados -------------------------------------------------------------------------------------------
    wdados.sheet_view.showGridLines = False
    for col, w in (("A", 3), ("B", 9), ("C", 56.6), ("D", 20)):
        wdados.column_dimensions[col].width = w
    semanas = sorted({d["semana"] for d in linhas})
    atual = semanas[-1] if semanas else None
    ordem = list(dict.fromkeys([*causas, *(d["causa"] for d in linhas)]))
    por_causa = Counter(d["causa"] for d in linhas)
    por_sem = Counter((d["causa"], d["semana"]) for d in linhas)
    cab = lambda c, v: (wdados.__setitem__(c, v), setattr(wdados[c], "font", Font(bold=True, color="FFFFFF")),  # noqa: E731
                        setattr(wdados[c], "fill", preencher(VERDE_CAB)))
    # bloco 1: semana atual (gráfico "Semana atual")
    wdados["C1"] = f"Semana atual: S{atual}" if atual else "Semana atual: —"
    wdados["C1"].font = Font(bold=True, size=12)
    cab("C2", "Problema")
    cab("D2", "Recorrência")
    sem_atual = sorted(((c, por_sem[(c, atual)]) for c in ordem if por_sem[(c, atual)]), key=lambda t: -t[1])
    for i, (c, q) in enumerate(sem_atual, start=3):
        wdados[f"C{i}"], wdados[f"D{i}"] = c, q
    l_sem = (3, max(3, 2 + len(sem_atual)))
    # bloco 2: acumulado por causa (gráfico "Acumulado"), em ordem de recorrência
    b2 = l_sem[1] + 3
    wdados[f"C{b2 - 1}"] = "Acumulado (todas as semanas)"
    wdados[f"C{b2 - 1}"].font = Font(bold=True, size=12)
    cab(f"C{b2}", "Problema")
    cab(f"D{b2}", "Recorrência")
    acum = sorted(((c, por_causa[c]) for c in ordem if por_causa[c]), key=lambda t: -t[1])
    for i, (c, q) in enumerate(acum, start=b2 + 1):
        wdados[f"C{i}"], wdados[f"D{i}"] = c, q
    l_acum = (b2 + 1, max(b2 + 1, b2 + len(acum)))
    wdados[f"C{l_acum[1] + 1}"], wdados[f"D{l_acum[1] + 1}"] = "Total de ocorrências", len(linhas)
    wdados[f"C{l_acum[1] + 1}"].font = wdados[f"D{l_acum[1] + 1}"].font = Font(bold=True)
    # bloco 3: matriz causa × semana (como a aba Dados da obra)
    b3 = l_acum[1] + 4
    wdados[f"C{b3 - 1}"] = "Recorrência por semana"
    wdados[f"C{b3 - 1}"].font = Font(bold=True, size=12)
    cab(f"C{b3}", "Problema")
    cab(f"D{b3}", "Acumulado")
    for j, s in enumerate(semanas):
        c = wdados.cell(row=b3, column=5 + j, value=f"Semana {s}")
        c.font, c.fill = Font(bold=True, color="FFFFFF"), preencher(VERDE_CAB)
        wdados.column_dimensions[get_column_letter(5 + j)].width = 11
    for i, causa in enumerate(ordem, start=b3 + 1):
        wdados[f"C{i}"], wdados[f"D{i}"] = causa, por_causa[causa]
        for j, s in enumerate(semanas):
            wdados.cell(row=i, column=5 + j, value=por_sem[(causa, s)])
    tot = b3 + 1 + len(ordem)
    wdados[f"C{tot}"], wdados[f"D{tot}"] = "Total de ocorrências", len(linhas)
    for j, s in enumerate(semanas):
        wdados.cell(row=tot, column=5 + j, value=sum(1 for d in linhas if d["semana"] == s)).font = Font(bold=True)
    wdados[f"C{tot}"].font = wdados[f"D{tot}"].font = Font(bold=True)
    # bloco 4: por frente de serviço
    b4 = tot + 3
    wdados[f"C{b4 - 1}"] = "Quantidade | Problema por frente de serviço"
    wdados[f"C{b4 - 1}"].font = Font(bold=True, size=12)
    cab(f"C{b4}", "Frente de serviço")
    cab(f"D{b4}", "Recorrência")
    frentes = Counter((d["frente"] or "—") for d in linhas).most_common()
    for i, (f, q) in enumerate(frentes, start=b4 + 1):
        wdados[f"C{i}"], wdados[f"D{i}"] = f, q
    l_fr = (b4 + 1, max(b4 + 1, b4 + len(frentes)))
    for linha in wdados.iter_rows(min_row=2, max_row=l_fr[1], min_col=3, max_col=4 + len(semanas)):
        for c in linha:
            if c.value is not None:
                c.border = Border(left=FINA, right=FINA, top=FINA, bottom=FINA)

    # ---- Gráfico -----------------------------------------------------------------------------------------
    wg.sheet_view.showGridLines = False
    wg.sheet_view.zoomScale = 60
    caber_na_largura(wg, paisagem=False)
    for col in range(2, 21):
        wg.column_dimensions[get_column_letter(col)].width = 12
    wg.merge_cells("B2:T2")
    wg["B2"] = f"Pareto de Desvios | {titulo_obra}"
    wg["B2"].font = Font(name="Calibri", size=26, bold=True)
    wg["B2"].alignment = Alignment(horizontal="center", vertical="center")
    wg.row_dimensions[2].height = 45
    inserir_logos(wg, marca, ["C2", "Q2"], altura_px=52)
    wg["U2"] = f"Atualização: {hoje:%d/%m/%Y}"
    secoes = [("B3:T5", "ACUMULADO", f"Acumulado · {len(linhas)} ocorrência(s)", l_acum, VERMELHO, "C7"),
              ("B51:T53", f"SEMANA ATUAL (S{atual})" if atual else "SEMANA ATUAL", f"Semana {atual}" if atual else "Semana atual",
               l_sem, VERMELHO, "C55"),
              ("B99:T101", "POR FRENTE DE SERVIÇO", "Desvios | Frente de Serviço", l_fr, "00B050", "C103")]
    for intervalo, sub, titulo, (l0, l1), cor, ancora in secoes:
        faixa(wg, intervalo, f"Acompanhamento | Principais Problemas\n{sub}", VERDE_FAIXA, 28)
        l_ini = int(intervalo.split(":")[0][1:])
        for r in range(l_ini, l_ini + 3):
            wg.row_dimensions[r].height = 28
        ch = barras(titulo, wdados, 3, 4, l0, l1, cor, largura=42, altura=max(9, 0.75 * (l1 - l0 + 1) + 3))
        wg.add_chart(ch, ancora)
    wb.active = 1  # abre no Detalhamento
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()
