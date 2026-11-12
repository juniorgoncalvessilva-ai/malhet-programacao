"""Importa a aba Ações do Plano de Ação 6WLA e gera o Excel no mesmo layout (com farol e status por fórmula)."""
from collections import Counter
from datetime import date, datetime
from io import BytesIO

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
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
        a.conclusao, a.status1, a.seis_m, a.observacoes = _d(v[14]), st, m6, _t(v[19], 600)
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


FILL = {1: "F8D7DA", 2: "FFF3CD", 3: "D1E7DD", 4: "CFE2FF"}


def exportar(acoes: list[AcaoRestricaoModel], hoje: date, titulo: str) -> bytes:
    """Plano de Ação no layout da aba Ações (C..V); FAROL e STATUS 2 com a fórmula da planilha (mudam com HOJE())."""
    wb = Workbook()
    ws = wb.active
    ws.title = "Ações"
    fino = Side(style="thin", color="BFBFBF")
    borda = Border(left=fino, right=fino, top=fino, bottom=fino)
    cab = PatternFill("solid", fgColor="1F3B4D")
    ws["C1"] = titulo
    ws["C1"].font = Font(bold=True, size=13)
    ws["V1"] = f"Atualização: {hoje:%d/%m/%Y}"
    for col, nome in (("G", "SEMANA"), ("M", "PRAZO"), ("O", "REPROGRAMADO"), ("Q", "CONCLUSÃO")):
        ws[f"{col}2"] = nome
    ws.merge_cells("M2:N2")
    ws.merge_cells("O2:P2")
    for j, nome in enumerate(COLUNAS):
        c = ws.cell(row=3, column=3 + j, value=nome)
        c.font, c.fill, c.border = Font(bold=True, color="FFFFFF"), cab, borda
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    for col in "GMOQ":
        ws[f"{col}2"].font = Font(bold=True)
        ws[f"{col}2"].alignment = Alignment(horizontal="center")
    for i, a in enumerate(sorted(acoes, key=lambda x: x.numero), start=4):
        ds = dom.data_da_semana(a.prazo_termino, a.reprogramado)
        sit = dom.situacao(a.status1, a.prazo_termino, a.reprogramado, hoje)
        vals = [a.numero, a.atividade, None if a.impeditivo is None else ("SIM" if a.impeditivo else "NÃO"), a.acao,
                f"S{numero_semana(ds)}" if ds else None, a.area_texto, a.referencia, a.reuniao, a.responsavel, a.gerencia,
                a.prazo_inicio, a.prazo_termino, a.reprogramado, a.reprogramacoes or None, a.conclusao, a.status1,
                None, None, a.seis_m, a.observacoes]
        for j, v in enumerate(vals):
            c = ws.cell(row=i, column=3 + j, value=v)
            c.border = borda
            c.alignment = Alignment(vertical="center", wrap_text=j in (3, 19))
            if isinstance(v, date):
                c.number_format = "DD/MM/YYYY"
        r = i
        ws[f"S{r}"] = (f'=IF(R{r}="","",IF(R{r}="Concluído",4,IF(R{r}="Cancelado","",IF(AND(TODAY()>=N{r},O{r}<>"",'
                       f'TODAY()<=O{r}),2,IF(AND(N{r}<>"",TODAY()>=N{r}),1,3)))))')
        ws[f"T{r}"] = (f'=IF(R{r}="","",IF(R{r}="Concluído","Concluído",IF(R{r}="Cancelado","Cancelado",'
                       f'IF(AND(TODAY()>=N{r},O{r}<>"",TODAY()<=O{r}),"Reprogramado",IF(AND(N{r}<>"",TODAY()>=N{r}),'
                       f'"Atrasado","No Prazo")))))')
        for col in "ST":
            ws[f"{col}{r}"].border = borda
            ws[f"{col}{r}"].alignment = Alignment(horizontal="center", vertical="center")
        if sit.farol:
            ws[f"S{r}"].fill = PatternFill("solid", fgColor=FILL[sit.farol])
    ult = max(4, len(acoes) + 3)
    dv = DataValidation(type="list", formula1='"Pendente,Concluído,Cancelado"', allow_blank=True)
    dv6 = DataValidation(type="list", formula1='"MDO,MET,MAT,MAQ,MAB,MED"', allow_blank=True)
    dvs = DataValidation(type="list", formula1='"SIM,NÃO"', allow_blank=True)
    ws.add_data_validation(dv)
    ws.add_data_validation(dv6)
    ws.add_data_validation(dvs)
    dv.add(f"R4:R{ult + 200}")
    dv6.add(f"U4:U{ult + 200}")
    dvs.add(f"E4:E{ult + 200}")
    larg = {"A": 2, "B": 1, "C": 7, "D": 18, "E": 11, "F": 70, "G": 9, "H": 30, "I": 12, "J": 10, "K": 22, "L": 14,
            "M": 12, "N": 12, "O": 12, "P": 5, "Q": 12, "R": 12, "S": 7, "T": 14, "U": 7, "V": 50}
    for col, w in larg.items():
        ws.column_dimensions[col].width = w
    ws.freeze_panes = "G4"
    ws.auto_filter.ref = f"C3:V{ult}"
    # resumo (no lugar das tabelas dinâmicas do PAINEL AÇÃO)
    wr = wb.create_sheet("PAINEL AÇÃO")
    blocos = [("STATUS 2", Counter(dom.situacao(a.status1, a.prazo_termino, a.reprogramado, hoje).status2 for a in acoes)),
              ("6M (pendentes)", Counter(dom.SEIS_M.get(a.seis_m, "Não classificado") for a in acoes if a.status1 == "Pendente")),
              ("GERÊNCIA", Counter(a.gerencia or "—" for a in acoes)),
              ("ÁREA (pendentes)", Counter(a.area_texto or "—" for a in acoes if a.status1 == "Pendente")),
              ("RESPONSÁVEL (pendentes)", Counter(a.responsavel or "—" for a in acoes if a.status1 == "Pendente"))]
    col = 1
    for nome, cont in blocos:
        wr.cell(row=1, column=col, value=nome).font = Font(bold=True)
        wr.cell(row=2, column=col, value="Rótulo").font = Font(bold=True)
        wr.cell(row=2, column=col + 1, value="Contagem de AÇÕES").font = Font(bold=True)
        for k, (rot, q) in enumerate(cont.most_common(), start=3):
            wr.cell(row=k, column=col, value=rot)
            wr.cell(row=k, column=col + 1, value=q)
        wr.cell(row=len(cont) + 3, column=col, value="Total Geral").font = Font(bold=True)
        wr.cell(row=len(cont) + 3, column=col + 1, value=sum(cont.values())).font = Font(bold=True)
        wr.column_dimensions[get_column_letter(col)].width = 34
        wr.column_dimensions[get_column_letter(col + 1)].width = 12
        col += 3
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()
