"""Exporta o 6WLA (Sessão de Look Ahead) em Excel no layout da obra — spec 108.

Mesmas colunas da planilha "CRONOGRAMA 6WLA" (Local, Activity ID, Activity Name, % / status, Start, Finish, linha de
base, Variance, Indicador de Aderência, BL Semana, Semana Início/fim, Semana DD Cronograma, Semana Corrente, 1ª a 6ª
Semana e as colunas 6M) e as mesmas fórmulas: as semanas saem da aba "Dados - Semanas" (PROCV) e o "1" das colunas de
semana (pintado de azul-escuro) muda sozinho quando se troca o nº da semana no cabeçalho.
"""
from collections import defaultdict
from datetime import date, timedelta
from io import BytesIO

from openpyxl import Workbook
from openpyxl.formatting.rule import CellIsRule, FormulaRule, IconSetRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.planejamento.domain.periodo import numero_semana
from app.modules.planos.domain.plano import codigo_item
from app.modules.planos.domain.seis_semanas import (
    GRUPO_PLANO,
    SEIS_M,
    SEMANAS,
    Atividade,
    Janela,
    codigo_wbs,
    janela,
    montar,
)

AZUL_ESCURO, AMARELO, AZUL_CLARO, CINZA, CINZA_CAB = "002060", "FFFF00", "BDD7EE", "BFBFBF", "808080"
VERDE_6M, VERMELHO_6M = "C6EFCE", "FFC7CE"
FINO = Side(style="thin", color="000000")
BORDA = Border(left=FINO, right=FINO, top=FINO, bottom=FINO)
# coluna → (cabeçalho, largura, oculta)
COLUNAS = {
    "A": ("", 5.3, False), "B": ("Local", 27.3, False), "C": ("Activity ID", 21.4, False), "D": ("Activity Name", 72.4, False),
    "E": ("Activity % Complete", 23.7, True), "F": ("Activity Status", 17.0, False), "G": ("Start", 13.0, False),
    "H": ("Finish", 13.0, False), "I": ("BL Project Start", 15.6, True), "J": ("BL Project Finish", 15.6, False),
    "K": ("Variance - BL Project Finish Date", 16.0, False), "L": ("BL Project Start", 13.0, True),
    "M": ("BL Project Finish", 13.0, True), "N": ("Indicador\nde Aderência", 12.0, False), "O": ("BL Semana Início", 11.0, False),
    "P": ("BL Semana fim", 10.6, False), "Q": ("Semana Início", 11.0, False), "R": ("Semana fim", 9.4, False),
}
SEMANA_COLS = ["S", "T", "U", "V", "W", "X", "Y", "Z"]  # S = DD do cronograma, T = corrente, U…Z = 1ª…6ª
SEIS_COLS = dict(zip(SEIS_M, ["AA", "AB", "AC", "AD", "AE", "AF"]))
SEIS_TITULO = {"MET": "MÉTODO", "MDO": "MÃO DE OBRA", "MAT": "MATERIAL", "MAQ": "MÁQUINA", "MED": "MEDIDA", "MAB": "MEIO AMBIENTE"}
L0 = 4  # primeira linha de dados


# ---- dados ------------------------------------------------------------------------------------------------------
def versoes_cronograma(s: Session, obra_id: int) -> list[dict]:
    from app.modules.referencias.infra.models import VersaoReferenciaModel as V

    return [{"id": v.id, "rotulo": v.rotulo, "data_base": v.data_base.isoformat() if v.data_base else None,
             "vigente": v.vigente, "carregado_em": v.carregado_em.isoformat()}
            for v in s.scalars(select(V).where(V.obra_id == obra_id, V.tipo == "CRONOGRAMA").order_by(V.id))]


def coletar(s: Session, obra_id: int, referencia: date, base_id: int | None) -> tuple[Janela, list[Atividade], dict]:
    """Atividades do cronograma vigente e do plano que cruzam a janela, com a linha de base e as restrições 6M."""
    from app.modules.frentes.infra.models import AreaFrenteModel
    from app.modules.planos.infra.models import PlanoItemModel
    from app.modules.referencias.application.importar_xer import status_pt
    from app.modules.referencias.infra.models import AtividadeCronogramaModel as A, VersaoReferenciaModel as V
    from app.modules.restricoes.infra.models import AcaoRestricaoModel as R
    from app.modules.wbs.domain.cronograma import escolher_area, ler_caminho
    from app.shared.errors import DomainError

    versoes = list(s.scalars(select(V).where(V.obra_id == obra_id, V.tipo == "CRONOGRAMA").order_by(V.id)))
    vig = next((v for v in versoes if v.vigente), None)
    if base_id is not None and not any(v.id == base_id for v in versoes):
        raise DomainError("linha de base: escolha uma versão do cronograma desta obra", "base_id")
    base = next((v for v in versoes if v.id == base_id), None) if base_id is not None else (versoes[0] if versoes else None)
    j = janela(referencia, vig.data_base if vig else None)

    areas = list(s.scalars(select(AreaFrenteModel).where(AreaFrenteModel.obra_id == obra_id)))
    nome_area = {a.id: a.descricao for a in areas}
    lista_areas = [(a.id, a.cwa, a.ativo_codigo) for a in areas if a.ativo]
    itens = list(s.scalars(select(PlanoItemModel).where(PlanoItemModel.obra_id == obra_id, PlanoItemModel.marco.is_(False),
                                                        PlanoItemModel.inicio <= j.fim, PlanoItemModel.fim >= j.inicio)))
    # restrições: pelo item do plano ou pelo Activity ID (coluna ID do Plano de Ação)
    chave_item = {i.id: (i.id_crono or codigo_item(i.numero)) for i in itens}
    rest: dict[str, dict[str, list[int]]] = defaultdict(lambda: defaultdict(lambda: [0, 0]))
    for r in s.scalars(select(R).where(R.obra_id == obra_id, R.seis_m.is_not(None), R.status1 != "Cancelada")):
        chave = chave_item.get(r.plano_item_id) if r.plano_item_id else (r.referencia or "").strip() or None
        if chave and r.seis_m in SEIS_M:
            c = rest[chave][r.seis_m]
            c[0] += 1
            c[1] += 1 if r.status1 == "Pendente" else 0
    restricoes = lambda k: {m: (v[0], v[1]) for m, v in rest.get(k, {}).items()}  # noqa: E731

    ats: list[Atividade] = []
    vistos: set[str] = set()
    if vig is not None:
        bl = {}
        if base is not None:
            bl = {cod: (ini, fim) for cod, ini, fim in s.execute(select(A.id_crono, A.inicio, A.fim).where(A.versao_id == base.id))}
        item_de = {i.id_crono: i for i in itens if i.id_crono}
        for a in s.scalars(select(A).where(A.versao_id == vig.id, A.inicio.is_not(None), A.fim.is_not(None),
                                          func.date(A.inicio) <= j.fim, func.date(A.fim) >= j.inicio)):
            nomes = [x.get("nome", "") for x in (a.wbs_niveis or [])]
            it = item_de.get(a.id_crono)
            if it is not None and it.area_id:
                local = nome_area.get(it.area_id)
            else:
                cam = ler_caminho(nomes, [x.get("codigo") or "" for x in (a.wbs_niveis or [])])
                local = nome_area.get(escolher_area(cam.cwa, cam.nome_cwa, lista_areas)) if cam else None
            bi, bf = bl.get(a.id_crono, (None, None))
            ats.append(Atividade(
                chave=a.id_crono, nome=a.atividade, niveis=codigo_wbs(a.wbs_niveis), inicio=a.inicio.date(), fim=a.fim.date(),
                ordem=a.ordem_p6 or 0, pct=(a.realizado / 100 if a.realizado is not None else None), status=status_pt(a.status),
                bl_inicio=bi.date() if bi else None, bl_fim=bf.date() if bf else None, local=local,
                restricoes=restricoes(a.id_crono)))
            vistos.add(a.id_crono)
    so_plano = [i for i in itens if not i.id_crono or i.id_crono not in vistos]
    for i in sorted(so_plano, key=lambda x: (x.inicio, x.numero)):
        ats.append(Atividade(
            chave=i.id_crono or codigo_item(i.numero), nome=i.descricao, niveis=(GRUPO_PLANO,), inicio=i.inicio, fim=i.fim,
            ordem=i.numero, local=nome_area.get(i.area_id), restricoes=restricoes(chave_item[i.id])))
    info = {"cronograma": vig.rotulo if vig else None, "linha_base": base.rotulo if base else None,
            "linha_base_id": base.id if base else None, "do_cronograma": len(vistos), "so_plano": len(so_plano)}
    return j, ats, info


# ---- Excel ------------------------------------------------------------------------------------------------------
def _cf(cor: str) -> PatternFill:
    """Preenchimento de formatação condicional: o Excel lê a cor do `bgColor` (o LibreOffice aceita o `fgColor`)."""
    return PatternFill(fill_type="solid", fgColor=cor, bgColor=cor)


def _f(cor: str) -> PatternFill:
    return PatternFill("solid", fgColor=cor)


def _aba_semanas(wb: Workbook, de: date, ate: date) -> None:
    """"Dados - Semanas": data → nº da semana (domingo a sábado) → dia da semana (1 = domingo), como na planilha da obra."""
    ws = wb.create_sheet("Dados - Semanas")
    d = de - timedelta(days=(de.weekday() + 1) % 7)
    while d <= ate:
        ws.append([d, numero_semana(d), (d.weekday() + 1) % 7 + 1])
        ws.cell(ws.max_row, 1).number_format = "dd/mm/yyyy"
        d += timedelta(days=1)
    ws.column_dimensions["A"].width = 12


def gerar(s: Session, obra_id: int, referencia: date, base_id: int | None, obra_nome: str) -> tuple[bytes, dict]:
    from app.shared.marca import inserir_logos, marca_da_obra

    j, ats, info = coletar(s, obra_id, referencia, base_id)
    linhas = montar(ats, j)
    wb = Workbook()
    ws = wb.active
    ws.title = "CRONOGRAMA 6WLA"
    ws.sheet_view.showGridLines = False
    ws.sheet_view.zoomScale = 80

    # cabeçalho (linhas 1–3) — como na planilha da obra
    ult = "AF"
    for c in range(1, 33):
        ws.cell(1, c).fill = _f(CINZA)
    ws.row_dimensions[1].height = 16.2
    ws.row_dimensions[2].height = 51.6
    ws.row_dimensions[3].height = 40.2
    ws.merge_cells("D2:R2")
    ws["D2"] = f"Sessão de Look Ahead — {obra_nome} · S{j.corrente} a S{j.corrente + SEMANAS}"
    ws["D2"].font = Font(bold=True, size=12)
    ws["D2"].alignment = Alignment(horizontal="center", vertical="center")
    titulos2 = ["Semana DD Cronograma", "Semana Corrente"] + [f"{k}ª Semana" for k in range(1, SEMANAS + 1)]
    for col, t in zip(SEMANA_COLS, titulos2):
        x = ws[f"{col}2"]
        x.value = t
        x.font = Font(bold=True, size=9)
        x.alignment = Alignment(horizontal="center", vertical="center", text_rotation=90, wrap_text=True)
        x.border = BORDA
    ws.merge_cells("AA2:AF2")
    ws["AA2"] = "Ishikawa 6M · restrições pendentes (0 = levantada e resolvida)"
    ws["AA2"].font = Font(bold=True, size=11)
    ws["AA2"].alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    for col, (titulo, larg, oculta) in COLUNAS.items():
        ws.column_dimensions[col].width = larg
        ws.column_dimensions[col].hidden = oculta
        if titulo:
            ws[f"{col}3"] = titulo
    ws["S3"] = j.data_date
    ws["T3"] = j.corrente
    for a, b in zip(SEMANA_COLS[1:-1], SEMANA_COLS[2:]):
        ws[f"{b}3"] = f"={a}3+1"
    for col in SEMANA_COLS:
        ws.column_dimensions[col].width = 7.4
    for cod, col in SEIS_COLS.items():
        ws[f"{col}3"] = SEIS_TITULO[cod]
        ws.column_dimensions[col].width = 16
    for c in range(2, 33):
        x = ws.cell(3, c)
        x.fill = _f(CINZA_CAB)
        x.font = Font(bold=True, size=12, color="FFFFFF")
        x.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        x.border = BORDA

    # dados
    datas: list[date] = [j.inicio, j.fim]
    r = L0
    for ln in linhas:
        a = ln.atividade
        valores = {"B": a.local if a else None, "C": ("  " * ln.nivel) + ln.codigo,
                   "D": ln.nome or None, "E": ln.pct, "F": ln.pct, "G": ln.inicio, "H": ln.fim}
        if a:
            valores |= {"I": a.bl_inicio, "J": a.bl_fim, "L": a.bl_inicio, "M": a.bl_fim, "K": a.variacao}
            datas += [x for x in (a.bl_inicio, a.bl_fim) if x]
        datas += [x for x in (ln.inicio, ln.fim) if x]
        for col, v in valores.items():
            ws[f"{col}{r}"] = v
        ws[f"N{r}"] = f'=IF(K{r}="","",K{r})'
        for col, alvo in (("O", "L"), ("P", "M"), ("Q", "G"), ("R", "H")):  # semana pela aba "Dados - Semanas"
            ws[f"{col}{r}"] = f"=IF({alvo}{r}=\"\",\"\",IFERROR(VLOOKUP(INT({alvo}{r}),'Dados - Semanas'!$A:$B,2,0),\"\"))"
        for col in SEMANA_COLS:
            ws[f"{col}{r}"] = f'=IF(AND({col}$3>=$Q{r},{col}$3<=$R{r}),"1","")'
        if a:
            for cod, col in SEIS_COLS.items():
                ws[f"{col}{r}"] = a.seis_m(cod)
        # formatação
        if ln.tipo == "wbs":
            fundo, fonte = ((AMARELO, Font(bold=True, size=11)) if ln.nivel == 0 else
                            (AZUL_ESCURO, Font(bold=True, size=11, color="FFFFFF")) if ln.nivel == 1 else
                            (AZUL_CLARO, Font(bold=False, size=11)))
            for c in range(2, 19):
                ws.cell(r, c).fill = _f(fundo)
                ws.cell(r, c).font = fonte
        for c in range(2, 33):
            x = ws.cell(r, c)
            x.border = BORDA
            if c >= 5:
                x.alignment = Alignment(horizontal="center", vertical="center")
        for col in ("G", "H", "I", "J", "L", "M"):
            ws[f"{col}{r}"].number_format = "dd/mm/yyyy"
        ws[f"E{r}"].number_format = "0%"
        ws[f"F{r}"].number_format = "0.00%"
        # agrupamento como no cronograma: cada nível da WBS recolhe o que está abaixo dele (+/− na margem)
        if ln.nivel:
            ws.row_dimensions[r].outline_level = min(ln.nivel, 7)
        r += 1
    fim = max(r - 1, L0)

    # formatação condicional: semana com a atividade = azul-escuro; 6M: pendente vermelho, resolvida verde
    ws.conditional_formatting.add(f"S{L0}:Z{fim}", CellIsRule(operator="equal", formula=['"1"'], fill=_cf(AZUL_ESCURO),
                                                              font=Font(color=AZUL_ESCURO)))
    # (célula vazia = nenhuma restrição: sem cor)
    ws.conditional_formatting.add(f"AA{L0}:AF{fim}", FormulaRule(formula=[f"AND(ISNUMBER(AA{L0}),AA{L0}>0)"], fill=_cf(VERMELHO_6M)))
    ws.conditional_formatting.add(f"AA{L0}:AF{fim}", FormulaRule(formula=[f"AND(ISNUMBER(AA{L0}),AA{L0}=0)"], fill=_cf(VERDE_6M)))
    ws.conditional_formatting.add(f"N{L0}:N{fim}", IconSetRule("3TrafficLights1", "num", [-99999, -5, 0]))
    ws.sheet_properties.outlinePr.summaryBelow = False  # o título fica em cima dos filhos, como no P6
    ws.freeze_panes = f"E{L0}"
    ws.auto_filter.ref = f"B3:{ult}{fim}"
    ws.print_title_rows = "1:3"
    ws.page_setup.orientation = "landscape"
    ws.page_setup.paperSize = ws.PAPERSIZE_A3
    ws.page_setup.fitToWidth, ws.page_setup.fitToHeight = 1, 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.column_dimensions["AG"].width = 20
    inserir_logos(ws, marca_da_obra(s, obra_id), ["B2", "AG2"], altura_px=55)  # contratada à direita, sem cobrir o título 6M

    _aba_semanas(wb, min(datas), max(datas))
    buf = BytesIO()
    wb.save(buf)
    info |= {"semana_corrente": j.corrente, "semana_dd": j.data_date, "inicio": j.inicio.isoformat(), "fim": j.fim.isoformat(),
             "atividades": sum(1 for x in linhas if x.tipo == "atividade"), "linhas": len(linhas)}
    return buf.getvalue(), info


def previa(s: Session, obra_id: int, referencia: date, base_id: int | None) -> dict:
    """O que vai no Excel: janela, quantas atividades (cronograma × só no plano) e quantas têm restrição 6M."""
    from app.shared.memoria import Fonte, Memoria, Passo, num

    j, ats, info = coletar(s, obra_id, referencia, base_id)
    linhas = montar(ats, j)
    n = sum(1 for x in linhas if x.tipo == "atividade")
    rest = sum(1 for x in linhas if x.atividade and x.atividade.restricoes)
    periodo = f"S{j.corrente} a S{j.corrente + SEMANAS} ({j.inicio:%d/%m/%Y} a {j.fim:%d/%m/%Y})"
    memorias = {
        "atividades": Memoria(
            chave="atividades", titulo="Atividades no 6WLA", valor=num(n),
            formula="atividades do cronograma vigente que cruzam a janela + as do Plano de 90 dias fora do cronograma",
            passos=(Passo("Do cronograma (P6) na janela", num(info["do_cronograma"]), num(info["do_cronograma"])),
                    Passo("Do Plano de 90 dias, fora do cronograma nestas semanas", num(info["so_plano"]), num(info["so_plano"])),
                    Passo("Total", f"{num(info['do_cronograma'])} + {num(info['so_plano'])}", num(n), True)),
            fontes=(Fonte("Cronograma vigente", info["cronograma"] or "—", "Importações", "atividades com início ≤ fim da janela e fim ≥ início"),
                    Fonte("Janela", periodo, "semana corrente + 1ª a 6ª semana", "semanas de domingo a sábado"))).como_dict(),
        "com_restricao": Memoria(
            chave="com_restricao", titulo="Atividades com restrição 6M", valor=num(rest),
            formula="atividades com ao menos uma restrição do 6WLA classificada no 6M (pelo item do plano ou pelo Activity ID)",
            passos=(Passo("Com restrição", num(rest), num(rest), True),),
            fontes=(Fonte("Restrições", "Plano de Ação 6WLA", "Restrições (6WLA)", "coluna 6M; canceladas não contam"),)).como_dict(),
    }
    return info | {"semana_corrente": j.corrente, "semana_dd": j.data_date, "inicio": j.inicio.isoformat(),
                   "fim": j.fim.isoformat(), "atividades": n, "com_restricao": rest,
                   "titulos_wbs": sum(1 for x in linhas if x.tipo == "wbs"), "memorias": memorias}
