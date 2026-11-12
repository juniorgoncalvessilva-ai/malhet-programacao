"""Importa a aba Ações do Plano de Ação 6WLA e gera o Excel no mesmo layout (com farol e status por fórmula)."""
from datetime import date, datetime
from io import BytesIO

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Border, Font, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.frentes.infra.models import AreaFrenteModel
from app.modules.planejamento.domain.periodo import numero_semana
from app.modules.restricoes.domain import acao as dom
from app.modules.restricoes.infra.models import AcaoRestricaoModel
from app.shared.errors import DomainError

# colunas C..V da aba Ações
COLUNAS = ("Nº", "ATIVIDADE", "IMPEDITIVO", "AÇÕES", "INÍCIO", "ÁREA", "ID", "REUNIÃO", "RESPONSÁVEL", "GERÊNCIA",
           "INÍCIO", "TÉRMINO", "DATA", "nº", "DATA", "STATUS 1", "FAROL", "STATUS 2", "6M", "OBSERVAÇÕES")


def _d(v) -> date | None:
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    t = str(v or "").strip()
    for f in ("%d/%m/%Y", "%Y-%m-%d", "%d/%m/%y"):
        try:
            return datetime.strptime(t, f).date()
        except ValueError:
            pass
    return None


def _t(v, n: int) -> str | None:
    t = " ".join(str(v).split()) if v is not None else ""
    return t[:n] or None


def proximo_numero(s: Session, obra_id: int) -> int:
    return (s.scalar(select(func.max(AcaoRestricaoModel.numero)).where(AcaoRestricaoModel.obra_id == obra_id)) or 0) + 1


def area_por_texto(areas: list[AreaFrenteModel], texto: str | None) -> int | None:
    """ÁREA da planilha é texto livre; casa com a área da obra só quando o código ou a descrição batem."""
    t = (texto or "").strip().casefold()
    if not t:
        return None
    for a in areas:
        if t in {(a.codigo or "").casefold(), (a.cwa or "").casefold(), (a.descricao or "").casefold()}:
            return a.id
    return None


def importar(s: Session, obra_id: int, conteudo: bytes, usuario: str) -> dict:
    try:
        wb = load_workbook(BytesIO(conteudo), read_only=True, data_only=True, keep_vba=False)
    except Exception as e:  # noqa: BLE001
        raise DomainError(f"arquivo não é uma planilha Excel válida ({e.__class__.__name__})", "arquivo") from e
    ws = next((w for w in wb.worksheets if w.title.strip().casefold() in ("ações", "acoes")), None)
    if ws is None:
        raise DomainError("a planilha não tem a aba Ações", "arquivo")
    linhas = [tuple(r) for r in ws.iter_rows(values_only=True)]
    cab = None
    for i, r in enumerate(linhas[:15]):
        nomes = [" ".join(str(c or "").split()).upper() for c in r]
        if "AÇÕES" in nomes and "RESPONSÁVEL" in nomes:
            cab = i, nomes.index("Nº") if "Nº" in nomes else nomes.index("AÇÕES") - 3
            break
    if cab is None:
        raise DomainError("não achei o cabeçalho da aba Ações (Nº | ATIVIDADE | IMPEDITIVO | AÇÕES …)")
    i0, c0 = cab
    areas = list(s.scalars(select(AreaFrenteModel).where(AreaFrenteModel.obra_id == obra_id)))
    existentes = {a.numero: a for a in s.scalars(select(AcaoRestricaoModel).where(AcaoRestricaoModel.obra_id == obra_id))}
    novas = atualizadas = 0
    avisos = []
    for k, r in enumerate(linhas[i0 + 1:], start=i0 + 2):
        v = list(r[c0:c0 + 20]) + [None] * 20
        if not v[3]:
            continue
        try:
            n = int(float(v[0]))
        except (TypeError, ValueError):
            avisos.append(f"linha {k}: sem Nº — ignorada")
            continue
        try:
            st = dom.validar_status1(v[15] or "Pendente")
        except DomainError:
            st = "Pendente"
        try:
            m6 = dom.validar_6m(v[18])
        except DomainError:
            m6 = None
        a = existentes.get(n) or AcaoRestricaoModel(obra_id=obra_id, numero=n, origem="importado", criado_por=usuario)
        a.atividade, a.impeditivo, a.acao = _t(v[1], 80), dom.ler_sim_nao(v[2]), _t(v[3], 600)
        a.area_texto, a.referencia, a.reuniao = _t(v[5], 200), _t(v[6], 80), _t(v[7], 20) or "6WLA"
        a.area_id = a.area_id or area_por_texto(areas, a.area_texto)
        a.responsavel, a.gerencia = _t(v[8], 150), _t(v[9], 80)
        a.prazo_inicio, a.prazo_termino, a.reprogramado = _d(v[10]), _d(v[11]), _d(v[12])
        try:
            a.reprogramacoes = int(float(v[13] or 0))
        except (TypeError, ValueError):
            a.reprogramacoes = 0
        a.conclusao, a.status1, a.seis_m, a.observacoes = _d(v[14]), st, m6, _t(v[19], 4000)
        if a.id is None:
            s.add(a)
            existentes[n] = a
            novas += 1
        else:
            atualizadas += 1
    s.flush()
    return {"novas": novas, "atualizadas": atualizadas, "avisos": avisos[:30]}


def saida(a: AcaoRestricaoModel, hoje: date) -> dict:
    sit = dom.situacao(a.status1, a.prazo_termino, a.reprogramado, hoje)
    ds = dom.data_da_semana(a.prazo_termino, a.reprogramado)
    return {"id": a.id, "numero": a.numero, "atividade": a.atividade, "impeditivo": a.impeditivo, "acao": a.acao,
            "semana": numero_semana(ds) if ds else None, "area_texto": a.area_texto, "area_id": a.area_id,
            "referencia": a.referencia, "reuniao": a.reuniao, "responsavel": a.responsavel, "gerencia": a.gerencia,
            "prazo_inicio": a.prazo_inicio.isoformat() if a.prazo_inicio else None,
            "prazo_termino": a.prazo_termino.isoformat() if a.prazo_termino else None,
            "reprogramado": a.reprogramado.isoformat() if a.reprogramado else None, "reprogramacoes": a.reprogramacoes,
            "conclusao": a.conclusao.isoformat() if a.conclusao else None, "status1": a.status1,
            "farol": sit.farol, "status2": sit.status2, "seis_m": a.seis_m, "observacoes": a.observacoes,
            "linha_id": a.linha_id, "equipe_id": a.equipe_id, "origem": a.origem}


VERDE, LARANJA, VERMELHO, CINZA = "007E7A", "FFC000", "C00000", "D9D9D9"
LARGURAS = {"A": 4, "B": 1, "C": 15.7, "D": 22.7, "E": 18.2, "F": 79.7, "G": 21.6, "H": 34.6, "I": 13.7, "J": 17.9,
            "K": 22.9, "L": 15.4, "M": 20.7, "N": 20.7, "O": 17.9, "P": 7.6, "Q": 18.3, "R": 17.9, "S": 10.9, "T": 22.7,
            "U": 17.4, "V": 55}
COR_STATUS = {"Concluído": "00D661", "No Prazo": "008282", "Reprogramado": "FFC000", "Atrasado": "FF4747", "Cancelado": "BBBCBC"}


def _acoes(ws, acoes: list[AcaoRestricaoModel], hoje: date, titulo: str) -> None:
    """Aba Ações no layout do Plano de Ação 6WLA (C..V)."""
    from math import ceil

    from openpyxl.formatting.rule import IconSetRule

    from app.shared.excel import BORDA_HAIR, preencher

    branco = Font(name="Calibri", size=16, bold=True, color="FFFFFF")
    ws.sheet_view.showGridLines = False
    ws.sheet_view.zoomScale = 50
    for col, w in LARGURAS.items():
        ws.column_dimensions[col].width = w
    ws.row_dimensions[1].height = 42
    ws.row_dimensions[2].height = 21.75
    ws.row_dimensions[3].height = 35.7
    for col in "CDEFGHIJKLMNOPQRSTUV":
        for r in (1, 2, 3):
            ws[f"{col}{r}"].fill = preencher(VERDE)
            ws[f"{col}{r}"].font = branco
    ws.merge_cells("C1:T1")
    ws["C1"] = titulo
    ws["C1"].alignment = Alignment(horizontal="left", vertical="center")
    ws["V1"] = f"Atualização: {hoje:%d/%m/%Y}"
    ws["V1"].font = Font(name="Calibri", size=16, color="FFFFFF")
    ws["V1"].alignment = Alignment(horizontal="center", vertical="center")
    ws["G2"] = "SEMANA"
    ws.merge_cells("M2:N2")
    ws["M2"] = "PRAZO"
    ws.merge_cells("O2:P2")
    ws["O2"] = "REPROGRAMADO"
    ws["Q2"] = "CONCLUSÃO"
    for c in ("O2", "P2", "O3", "P3"):
        ws[c].fill = preencher(LARANJA)
    for c in ("Q2", "Q3"):
        ws[c].fill = preencher(VERMELHO)
    for c in ("G2", "M2", "O2", "Q2"):
        ws[c].alignment = Alignment(horizontal="center", vertical="center")
    medio = Side(style="medium", color="000000")
    for j, nome in enumerate(COLUNAS):
        c = ws.cell(row=3, column=3 + j, value=nome)
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = Border(top=medio, bottom=medio, left=Side(style="thin", color="000000"))
    fonte = Font(name="Calibri", size=16, color="000000")
    for r, a in enumerate(sorted(acoes, key=lambda x: x.numero), start=4):
        ds = dom.data_da_semana(a.prazo_termino, a.reprogramado)
        vals = [a.numero, a.atividade, None if a.impeditivo is None else ("SIM" if a.impeditivo else "NÃO"), a.acao,
                f"S{numero_semana(ds)}" if ds else None, a.area_texto, a.referencia, a.reuniao, a.responsavel, a.gerencia,
                a.prazo_inicio, a.prazo_termino, a.reprogramado, a.reprogramacoes or None, a.conclusao, a.status1,
                None, None, a.seis_m, a.observacoes]
        for j, v in enumerate(vals):
            c = ws.cell(row=r, column=3 + j, value=v)
            c.font, c.border = fonte, BORDA_HAIR
            c.alignment = Alignment(horizontal="left" if j in (3, 19) else "center", vertical="center", wrap_text=True)
            if isinstance(v, date):
                c.number_format = "DD/MM/YY"
        ws[f"S{r}"] = (f'=IF(R{r}="","",IF(R{r}="Concluído",4,IF(R{r}="Cancelado","",IF(AND(TODAY()>=N{r},O{r}<>"",'
                       f'TODAY()<=O{r}),2,IF(AND(N{r}<>"",TODAY()>=N{r}),1,3)))))')
        ws[f"T{r}"] = (f'=IF(R{r}="","",IF(R{r}="Concluído","Concluído",IF(R{r}="Cancelado","Cancelado",'
                       f'IF(AND(TODAY()>=N{r},O{r}<>"",TODAY()<=O{r}),"Reprogramado",IF(AND(N{r}<>"",TODAY()>=N{r}),'
                       f'"Atrasado","No Prazo")))))')
        for col in "TU":
            ws[f"{col}{r}"].fill = preencher(CINZA)
        linhas_texto = max(ceil(len(a.acao or "") / 62), ceil(len(a.observacoes or "") / 44), 1)
        ws.row_dimensions[r].height = max(35.7, 21 * linhas_texto + 12)
    ult = max(4, len(acoes) + 3)
    # FAROL: 4 semáforos sem o número (1 vermelho atrasado · 2 amarelo reprogramado · 3/4 verde no prazo/concluído)
    ws.conditional_formatting.add(f"S4:S{ult}", IconSetRule("4TrafficLights", "num", [0, 1, 2, 3], showValue=False))
    for regra, faixa_ in (('"Pendente,Concluído,Cancelado"', f"R4:R{ult + 200}"), ('"MDO,MET,MAT,MAQ,MAB,MED"', f"U4:U{ult + 200}"),
                          ('"SIM,NÃO"', f"E4:E{ult + 200}")):
        dv = DataValidation(type="list", formula1=regra, allow_blank=True)
        ws.add_data_validation(dv)
        dv.add(faixa_)
    ws.freeze_panes = "G4"
    ws.auto_filter.ref = f"C3:V{ult}"
    ws.print_title_rows = "1:3"
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True


def _painel(wp, acoes: list[AcaoRestricaoModel], hoje: date, titulo: str) -> None:
    """PAINEL AÇÃO: as tabelas (no lugar das dinâmicas) à direita e os gráficos do painel da obra."""
    from openpyxl.chart import BarChart, DoughnutChart, Reference
    from openpyxl.chart.series import DataPoint
    from openpyxl.chart.shapes import GraphicalProperties

    from app.shared.excel import barras, caber_na_largura, faixa, preencher, rotulos_so_valor

    caber_na_largura(wp)
    wp.sheet_view.showGridLines = False
    wp.sheet_view.zoomScale = 70
    for col in range(1, 26):
        wp.column_dimensions[get_column_letter(col)].width = 11
    faixa(wp, "A1:X2", f"PAINEL AÇÃO | {titulo}", VERDE, 22)
    wp["A3"] = f"HOJE: {hoje:%d/%m/%Y}"
    wp["A3"].font = Font(bold=True)
    from app.modules.restricoes.domain.painel import STATUS1, STATUS_PENDENTE, LinhaPainel, painel

    def semana_de(a):
        d = dom.data_da_semana(a.prazo_termino, a.reprogramado)
        return numero_semana(d) if d else None

    pn = painel([LinhaPainel(a.id, a.status1, dom.situacao(a.status1, a.prazo_termino, a.reprogramado, hoje).status2,
                             a.responsavel, a.area_texto, a.gerencia, a.seis_m, semana_de(a)) for a in acoes])
    col0 = 27  # AA: tabelas que alimentam os gráficos
    lin = [1]

    def tabela(nome: str, cab: list[str], linhas: list[list]) -> tuple[int, int]:
        r = lin[0]
        wp.cell(row=r, column=col0, value=nome).font = Font(bold=True)
        for j, h in enumerate(cab):
            c = wp.cell(row=r + 1, column=col0 + j, value=h)
            c.font, c.fill = Font(bold=True, color="FFFFFF"), preencher(VERDE)
        for i, ln in enumerate(linhas, start=r + 2):
            for j, v in enumerate(ln):
                wp.cell(row=i, column=col0 + j, value=v)
        tot = r + 2 + len(linhas)
        wp.cell(row=tot, column=col0, value="Total Geral").font = Font(bold=True)
        for j in range(1, len(cab)):
            wp.cell(row=tot, column=col0 + j, value=sum(ln[j] or 0 for ln in linhas)).font = Font(bold=True)
        lin[0] = tot + 3
        return r + 2, max(r + 2, tot - 1)

    for col in range(col0, col0 + 6):
        wp.column_dimensions[get_column_letter(col)].width = 18
    wp.column_dimensions[get_column_letter(col0)].width = 36
    # 1. status das restrições (rosca)
    ordem_st = [g.rotulo for g in pn["status"]]
    l_st = tabela("STATUS DAS RESTRIÇÕES", ["Status 2", "Contagem de AÇÕES"], [[g.rotulo, g.n("total")] for g in pn["status"]])
    rosca = DoughnutChart()
    rosca.title = "STATUS DAS RESTRIÇÕES"
    rosca.add_data(Reference(wp, min_col=col0 + 1, min_row=l_st[0], max_row=l_st[1]), titles_from_data=False)
    rosca.set_categories(Reference(wp, min_col=col0, min_row=l_st[0], max_row=l_st[1]))
    for i, s in enumerate(ordem_st):
        pt = DataPoint(idx=i)
        pt.graphicalProperties = GraphicalProperties(solidFill=COR_STATUS[s])
        rosca.series[0].dPt.append(pt)
    rosca.dataLabels = rotulos_so_valor()
    rosca.holeSize = 55
    rosca.width, rosca.height = 14, 10
    wp.add_chart(rosca, "A5")
    # 2. pendentes por responsável e status (colunas empilhadas)
    sts = list(STATUS_PENDENTE)
    l_rp = tabela("PENDENTES POR RESPONSÁVEL", ["Responsável", *sts], [[g.rotulo, *[g.n(s) for s in sts]] for g in pn["responsavel"]])
    ch = BarChart()
    ch.type, ch.grouping, ch.overlap = "col", "stacked", 100
    ch.title = "STATUS RESTRIÇÕES POR RESPONSÁVEL"
    ch.add_data(Reference(wp, min_col=col0 + 1, max_col=col0 + 3, min_row=l_rp[0] - 1, max_row=l_rp[1]), titles_from_data=True)
    ch.set_categories(Reference(wp, min_col=col0, min_row=l_rp[0], max_row=l_rp[1]))
    for s_, nome in zip(ch.series, sts):
        s_.graphicalProperties = GraphicalProperties(solidFill=COR_STATUS[nome])
    ch.dataLabels = rotulos_so_valor()
    ch.y_axis.majorGridlines = None
    ch.y_axis.delete = ch.x_axis.delete = False
    ch.width, ch.height = 26, 10
    wp.add_chart(ch, "I5")
    # 3. pendentes por semana do projeto
    l_sem = tabela("RESTRIÇÕES (PENDENTES) POR SEMANA", ["Semana", "Contagem de AÇÕES"], [[g.rotulo, g.n("total")] for g in pn["semana"]])
    wp.add_chart(barras("RESTRIÇÕES POR SEMANA DO PROJETO", wp, col0, col0 + 1, l_sem[0], l_sem[1], "008282",
                        horizontal=False, largura=18, altura=10), "A26")
    # 4. por área: pendente × concluído × cancelado
    s1 = list(STATUS1)
    l_ar = tabela("RESTRIÇÕES POR ÁREAS / ATIVOS", ["Área", *s1], [[g.rotulo, *[g.n(s) for s in s1]] for g in pn["areas"]])
    ch = BarChart()
    ch.type, ch.grouping = "col", "clustered"
    ch.title = "RESTRIÇÕES POR ÁREAS / ATIVOS"
    ch.add_data(Reference(wp, min_col=col0 + 1, max_col=col0 + 3, min_row=l_ar[0] - 1, max_row=l_ar[1]), titles_from_data=True)
    ch.set_categories(Reference(wp, min_col=col0, min_row=l_ar[0], max_row=l_ar[1]))
    for s_, cor in zip(ch.series, ("DA291C", "008282", "BBBCBC")):
        s_.graphicalProperties = GraphicalProperties(solidFill=cor)
    ch.dataLabels = rotulos_so_valor()
    ch.y_axis.majorGridlines = None
    ch.y_axis.delete = ch.x_axis.delete = False
    ch.width, ch.height = 26, 10
    wp.add_chart(ch, "K26")
    # 5. 6M das pendentes  6. por gerência
    m6 = [[dom.SEIS_M.get(g.rotulo, "Não classificado"), g.n("total")] for g in pn["seis_m"]]
    l_6m = tabela("6M´S (PENDENTES)", ["6M", "Contagem de AÇÕES"], m6)
    wp.add_chart(barras("6M´S", wp, col0, col0 + 1, l_6m[0], l_6m[1], "008282", largura=18, altura=10), "A47")
    l_ge = tabela("RESTRIÇÃO POR GERÊNCIA", ["Gerência", "Contagem de AÇÕES"], [[g.rotulo, g.n("total")] for g in pn["gerencia"]])
    wp.add_chart(barras("RESTRIÇÃO POR GERÊNCIA", wp, col0, col0 + 1, l_ge[0], l_ge[1], "007680", horizontal=False,
                        largura=18, altura=10), "K47")


def exportar(acoes: list[AcaoRestricaoModel], hoje: date, titulo: str) -> bytes:
    """Plano de Ação 6WLA no layout da obra: aba Ações (farol com semáforos e status por fórmula com HOJE()) e o
    PAINEL AÇÃO com os gráficos de status, responsável, semana, área, 6M e gerência."""
    wb = Workbook()
    ws = wb.active
    ws.title = "Ações"
    _acoes(ws, acoes, hoje, titulo)
    _painel(wb.create_sheet("PAINEL AÇÃO"), acoes, hoje, titulo)
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()
