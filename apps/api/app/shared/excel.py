"""Peças comuns das planilhas que vão para a fiscalização (layout do cliente): estilos, faixas e gráficos."""
from openpyxl.chart import BarChart, Reference
from openpyxl.chart.label import DataLabelList
from openpyxl.chart.shapes import GraphicalProperties
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

HAIR = Side(style="hair", color="000000")
FINA = Side(style="thin", color="000000")
MEDIA = Side(style="medium", color="000000")
BORDA_HAIR = Border(left=HAIR, right=HAIR, top=HAIR, bottom=HAIR)
BRANCO = "FFFFFF"


def preencher(cor: str) -> PatternFill:
    return PatternFill("solid", fgColor=cor)


def faixa(ws, intervalo: str, texto: str, cor: str, tamanho: float, altura: float | None = None, cor_texto: str = BRANCO,
          alinhar: str = "center") -> None:
    """Faixa mesclada (título de seção) como as do Pareto e do Plano de Ação."""
    ws.merge_cells(intervalo)
    c = ws[intervalo.split(":")[0]]
    c.value = texto
    c.font = Font(name="Calibri", size=tamanho, bold=True, color=cor_texto)
    c.alignment = Alignment(horizontal=alinhar, vertical="center", wrap_text=True)
    for linha in ws[intervalo]:
        for x in linha:
            x.fill = preencher(cor)
    if altura:
        ws.row_dimensions[c.row].height = altura


def rotulos_so_valor() -> DataLabelList:
    """Rótulo só com o número (sem repetir categoria, série ou legenda)."""
    d = DataLabelList()
    d.showVal = True
    d.showCatName = d.showSerName = d.showLegendKey = d.showPercent = False
    return d


def caber_na_largura(ws, paisagem: bool = True) -> None:
    ws.page_setup.orientation = "landscape" if paisagem else "portrait"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True


def barras(titulo: str, ws_dados, col_rot: int, col_val: int, lin0: int, lin1: int, cor: str, horizontal: bool = True,
           largura: float = 24, altura: float = 14, maior_em_cima: bool = True) -> BarChart:
    """Barras com rótulo de valor (uma série; o título nomeia a série, sem legenda)."""
    ch = BarChart()
    ch.type = "bar" if horizontal else "col"
    ch.title = titulo
    ch.style = 10
    ch.legend = None
    ch.width, ch.height = largura, altura
    dados = Reference(ws_dados, min_col=col_val, min_row=lin0, max_row=lin1)
    rot = Reference(ws_dados, min_col=col_rot, min_row=lin0, max_row=lin1)
    ch.add_data(dados, titles_from_data=False)
    ch.set_categories(rot)
    s = ch.series[0]
    s.graphicalProperties = GraphicalProperties(solidFill=cor)
    s.graphicalProperties.line.solidFill = cor
    ch.dataLabels = rotulos_so_valor()
    ch.gapWidth = 60
    ch.y_axis.majorGridlines = None
    ch.y_axis.delete = False
    ch.x_axis.delete = False
    if horizontal and maior_em_cima:
        ch.x_axis.scaling.orientation = "maxMin"  # primeira categoria (a maior) no topo
    return ch
