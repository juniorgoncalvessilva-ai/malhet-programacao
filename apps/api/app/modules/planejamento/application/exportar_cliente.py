"""Programação no Excel do cliente (layout da aba "Programação Semanal - S32").

Mesmas colunas e posições do modelo (G = Item … AK = P/R, AL… = dias, depois Total, Aderência, análise de
indicadores, ITEM PQ, PU, faturamento). Na semanal são 9 dias (AL:AT, total em AU, como no modelo); na mensal as
colunas de dia crescem e as seguintes andam junto. Fonte grande e zoom 20%, como a planilha da obra.
"""
from datetime import date
from io import BytesIO

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter as L

from app.modules.planejamento.domain.periodo import DIAS, numero_semana
from app.modules.referencias.domain.cpu_obra import eh_apoio
from app.modules.ssma.domain.cadastro import texto_da_lista

AZUL, VERMELHO, BRANCO, VERDE_PR = "FF173761", "FFFF0000", "FFFFFFFF", "FF2B665E"
FINO, MEDIO = Side(style="thin"), Side(style="medium")
GRADE = Border(left=FINO, right=FINO, top=FINO, bottom=FINO)
CENTRO = Alignment(horizontal="center", vertical="center", wrap_text=True)
NUM = "#,##0.00_ ;[Red]\\-#,##0.00\\ "

# colunas fixas (G..AK) — exatamente as do modelo
FIXAS = [
    ("G", "Item", 22.5), ("H", "ID Cronograma", 50.5), ("I", "Programada\nOportunidade\nEmergencial", 34.6),
    ("J", "Atividade Detalhada", 226.8), ("K", "Tipo", 37.5), ("L", "Local", 65.3), ("M", "CWA", 28.9),
    ("N", "TÉCNICO DE SEGURANÇA RESPONSÁVEL", 51.6), ("O", "RAC", 26.8), ("P", "PTS", 21.4), ("Q", "ART", 51.2),
    ("R", "Planto de Trabalho de Obra (PTO)", 38.5), ("S", "AUTORIZAÇÃO DE TRABALHO AMBIENTAL (ATA) ", 43.6),
    ("T", "Responsável", 64.2), ("U", "Encarregado", 47.4), ("V", "Und.", 23.9), ("W", "Projeto", 16.0),
    ("X", "Realizado", 27.6), ("Y", "Restante", 28.5), ("Z", "Peso Ponderado da Atividade", 40.4),
    ("AA", "Status da Atividade", 27.4), ("AB", "Recursos", 15.2), ("AC", "Oficiais", 15.5),
    ("AD", "Servente", 15.5), ("AE", "Caminhão Munck", 15.5), ("AF", "Retro escavadeira", 15.5),
    ("AG", "Escavadeira Hidráulica", 15.5), ("AH", "Caminhão Basculante", 15.5), ("AI", "Trator esteira", 12.1),
    ("AJ", "Rolo Compactador", 15.5),
]
EQUIP = {"AE": ("munck",), "AF": ("retro",), "AG": ("escavadeira",), "AH": ("basculante",),
         "AI": ("trator",), "AJ": ("rolo", "compactador")}
ANALISE = ["PPC Frente da Obra", "OK? (S/N)", "Descrição da Causa", "Observações", "6M",
           "Restrições resolvidas durante o check-in/out? ", "Já identificado na 6WLA?",
           "Restrição identificada durante a elaboração da programação?", "ITEM PQ", "PU", "MOMENTO",
           "FATURAMENTO PREVISTO", "FATURAMENTO REAL", "ITEM AVANÇO FÍSICO", "PESO", "profis", "% PREV", "% REAL"]
LARG_ANALISE = [19.5, 13.6, 34.6, 184.6, 14.1, 59.6, 32.6, 79.5, 14.0, 48.8, 95.2, 93.8, 51.5, 37.8, 68.0, 20, 44.5, 23.6]
COL_DIA1 = 38  # AL


def _cel(ws, ref, valor=None, *, sz=42, b=False, fill=None, cor=None, borda=True, fmt=None, al=CENTRO):
    c = ws[ref]
    if valor is not None:
        c.value = valor
    c.font = Font(name="Calibri", size=sz, bold=b, color=cor)
    if fill:
        c.fill = PatternFill("solid", fgColor=fill)
    if borda:
        c.border = GRADE
    if fmt:
        c.number_format = fmt
    c.alignment = al
    return c


def _cab(ws, ref, txt, sz=36):
    return _cel(ws, ref, txt, sz=sz, b=True, fill=AZUL, cor=BRANCO)


def _merge(ws, a, b):
    if a != b:
        ws.merge_cells(f"{a}:{b}")


def _recursos(composicao: list[tuple[str, str, float]]) -> dict[str, float]:
    out: dict[str, float] = {}
    for rec, tipo, q in composicao:
        nome = rec.casefold()
        if tipo == "MOD":
            k = "AD" if eh_apoio(rec) and ("servente" in nome or "ajudante" in nome) else (None if eh_apoio(rec) else "AC")
        else:
            k = next((col for col, chaves in EQUIP.items() if any(ch in nome for ch in chaves)), None)
        if k:
            out[k] = out.get(k, 0) + q
    return out


def gerar(v: dict, obra_nome: str, composicoes: dict[int, list[tuple[str, str, float]]]) -> bytes:
    """v = visão da programação (servico.visao); composicoes = equipe_id → composição efetiva."""
    datas = [date.fromisoformat(d["data"]) for d in v["dias"]]
    nd = len(datas)
    c_tot = COL_DIA1 + nd  # Total Sem. (AU na semanal)
    c_ader = c_tot + 1  # Aderência
    c_an = c_ader + 1  # início da análise (AW na semanal)
    col = {nome: get for nome, get in zip(ANALISE, range(c_an, c_an + len(ANALISE)))}
    ult = c_an + len(ANALISE) - 1

    wb = Workbook()
    ws = wb.active
    ws.title = ("Programação Semanal - S" + str(numero_semana(datas[-1]))) if v["tipo"] == "SEMANAL" \
        else f"Programação Mensal - {datas[0]:%m-%Y}"
    for letra, w in zip("ABCDEF", (7.5, 31.4, 21.6, 12.5, 6.0, 1.5)):
        ws.column_dimensions[letra].width = w
    for letra, _, w in FIXAS:
        ws.column_dimensions[letra].width = w
    ws.column_dimensions["AK"].width = 36.5
    for i in range(nd):
        ws.column_dimensions[L(COL_DIA1 + i)].width = 38.5
    ws.column_dimensions[L(c_tot)].width = 41.2
    ws.column_dimensions[L(c_ader)].width = 31.6
    for i, w in enumerate(LARG_ANALISE):
        ws.column_dimensions[L(c_an + i)].width = w

    # título
    _merge(ws, "F4", f"{L(max(ult, 52))}4")
    _cel(ws, "F4", obra_nome.upper(), sz=55, b=True, borda=False)
    _merge(ws, "F5", f"{L(max(ult, 52))}6")
    _cel(ws, "F5", f"{datas[0]:%d/%m/%y} A {datas[-1]:%d/%m/%y}", sz=55, b=True, borda=False)
    for r, h in {4: 51.65, 5: 28.25, 6: 61.25, 7: 73.25, 8: 73.25, 9: 55.25, 10: 58.25, 11: 85.25}.items():
        ws.row_dimensions[r].height = h

    # cabeçalho (linhas 7 a 11)
    for letra, txt, _ in FIXAS:
        if letra in "NOPQRS":
            continue
        _cab(ws, f"{letra}7", txt)
        _merge(ws, f"{letra}7", f"{letra}11")
    _cab(ws, "N7", "SSMA")
    _merge(ws, "N7", "S7")
    _cab(ws, "N8", "TÉCNICO DE SEGURANÇA RESPONSÁVEL", 28)
    _merge(ws, "N8", "N11")
    for letra in "OPQRS":
        _cab(ws, f"{letra}8", None)
        txt = next(t for x, t, _ in FIXAS if x == letra)
        _cab(ws, f"{letra}9", txt, 36 if letra in "OPQ" else 28)
        _merge(ws, f"{letra}9", f"{letra}11")
    _cab(ws, "AK7", "Chuva (mm)", 28)
    _merge(ws, "AK7", "AK8")
    _cab(ws, "AK9", "(P)rev.\n(R)eal", 28)
    _merge(ws, "AK9", "AK11")
    for i, d in enumerate(datas):
        cl = L(COL_DIA1 + i)
        _cab(ws, f"{cl}7", None, 28)
        _cab(ws, f"{cl}8", None, 28)
        _cab(ws, f"{cl}9", f"S{numero_semana(d)}", 28)
        _cel(ws, f"{cl}10", d, sz=28, b=True, fill=AZUL, cor=BRANCO, fmt="d/m;@")
        _cab(ws, f"{cl}11", DIAS[d.weekday()], 28)
    tt = L(c_tot)
    _cab(ws, f"{tt}7", "EMISSÃO", 20)
    _merge(ws, f"{tt}7", f"{tt}8")
    _cel(ws, f"{tt}9", date.fromisoformat(v["emitida_em"][:10]) if v.get("emitida_em") else date.today(), sz=20,
         b=True, fill=AZUL, cor=BRANCO, fmt="dd/mm/yy")
    _cab(ws, f"{tt}10", None, 28)
    _cab(ws, f"{tt}11", "Total Sem." if v["tipo"] == "SEMANAL" else "Total Mês", 28)
    ad = L(c_ader)
    _cab(ws, f"{ad}7", "Aderência", 28)
    _merge(ws, f"{ad}7", f"{ad}11")
    _cab(ws, f"{L(c_an)}7", "Análise Indicadores", 28)
    _merge(ws, f"{L(c_an)}7", f"{L(c_an + 7)}9")
    _cab(ws, f"{L(c_an + 8)}7", "Medição / avanço físico", 20)
    _merge(ws, f"{L(c_an + 8)}7", f"{L(ult)}9")
    for nome, ci in col.items():
        _cab(ws, f"{L(ci)}10", nome, 16)
        _merge(ws, f"{L(ci)}10", f"{L(ci)}11")

    # corpo
    r = 12
    n_area = 0
    lin_valor: list[int] = []
    for loc in v["locais"]:
        _cel(ws, f"J{r}", loc["descricao"].upper(), sz=48, b=True, fill=VERMELHO, cor=BRANCO)
        ws.row_dimensions[r].height = 55.5
        r += 1
        for a in loc["areas"]:
            n_area += 1
            for ci in range(7, ult + 1):
                _cel(ws, f"{L(ci)}{r}", None, sz=42, b=True, fill=AZUL, cor=BRANCO)
            ws[f"G{r}"] = n_area
            tag_desc = a["descricao"]
            ws[f"J{r}"] = f"CWA {a['cwa']} - {tag_desc}" if a.get("cwa") else tag_desc
            ws[f"J{r}"].font = Font(size=48, bold=True, color=BRANCO)
            ws.row_dimensions[r].height = 55.5
            r += 1
            for i, ln in enumerate(a["linhas"], start=1):
                p, rr = r, r + 1
                ws.row_dimensions[p].height = ws.row_dimensions[rr].height = 80.4
                rec = _recursos(composicoes.get(ln["equipe_id"], [])) if ln.get("equipe_id") else {}
                local = tag_desc.split(" – ", 1)[1] if " – " in tag_desc else tag_desc
                ss = ln.get("ssma") or {}
                fixos = {
                    "G": f"{n_area}.{i}", "H": ln.get("id_crono") or "-", "I": ln.get("natureza") or "P",
                    "J": f"{ln['codigo_simova']} - {ln['descricao']}", "K": ln["grupo"]["descricao"], "L": local,
                    "M": a.get("cwa") or "-", "N": ss.get("tecnico"), "O": texto_da_lista(ss.get("rac")),
                    "P": texto_da_lista(ss.get("pts")), "Q": texto_da_lista(ss.get("art")),
                    "R": texto_da_lista(ss.get("pto")), "S": texto_da_lista(ss.get("ata")), "T": ln.get("responsavel"),
                    "U": ln.get("encarregado") or ln.get("equipe"), "V": ln.get("unidade"),
                    "W": ln.get("qtd_projeto"), "X": ln.get("realizado_anterior"), "Y": ln.get("restante"),
                    "Z": None, "AA": ln.get("status_crono"),
                    "AB": f"=SUM(AC{p}:AJ{p})" if rec else None,
                    **{k: (rec.get(k) or None) for k in ("AC", "AD", "AE", "AF", "AG", "AH", "AI", "AJ")},
                }
                for letra, val in fixos.items():
                    for rx in (p, rr):
                        _cel(ws, f"{letra}{rx}", None, fmt=NUM if letra in "WXY" else None)
                    ws[f"{letra}{p}"] = val
                    _merge(ws, f"{letra}{p}", f"{letra}{rr}")
                _cel(ws, f"AK{p}", "P", b=True, cor=VERDE_PR)
                _cel(ws, f"AK{rr}", "R", b=True, cor=VERDE_PR)
                for di in range(nd):
                    cl = L(COL_DIA1 + di)
                    _cel(ws, f"{cl}{p}", ln["previsto"][di], fmt="#,##0.000_ ;[Red]\\-#,##0.000\\ ")
                    _cel(ws, f"{cl}{rr}", ln["realizado"][di], fmt="#,##0.000_ ;[Red]\\-#,##0.000\\ ")
                d1, dn = L(COL_DIA1), L(COL_DIA1 + nd - 1)
                _cel(ws, f"{tt}{p}", f"=SUM({d1}{p}:{dn}{p})", fmt="#,##0.0_ ;[Red]\\-#,##0.0\\ ")
                _cel(ws, f"{tt}{rr}", f"=SUM({d1}{rr}:{dn}{rr})", fmt="#,##0.0_ ;[Red]\\-#,##0.0\\ ")
                analise = {
                    ad: f'=IF({tt}{p}=0,"",{tt}{rr}/{tt}{p})',
                    L(col["Observações"]): ln.get("observacao"),
                    L(col["ITEM PQ"]): ln.get("item_pq"),
                    L(col["PU"]): ln.get("pu"),
                    L(col["FATURAMENTO PREVISTO"]): f"={L(col['PU'])}{p}*{tt}{p}" if ln.get("pu") else None,
                    L(col["FATURAMENTO REAL"]): f"={L(col['PU'])}{p}*{tt}{rr}" if ln.get("pu") else None,
                }
                for ci in range(c_ader, ult + 1):
                    letra = L(ci)
                    for rx in (p, rr):
                        _cel(ws, f"{letra}{rx}", None, fmt="0%" if letra == ad else (NUM if ci in (
                            col["PU"], col["FATURAMENTO PREVISTO"], col["FATURAMENTO REAL"]) else None))
                    ws[f"{letra}{p}"] = analise.get(letra)
                    _merge(ws, f"{letra}{p}", f"{letra}{rr}")
                lin_valor.append(p)
                r += 2
    # total do faturamento
    if lin_valor:
        for nome in ("FATURAMENTO PREVISTO", "FATURAMENTO REAL"):
            cl = L(col[nome])
            _cel(ws, f"{cl}{r}", "=" + "+".join(f"{cl}{x}" for x in lin_valor) if len(lin_valor) < 200
                 else f"=SUM({cl}12:{cl}{r - 1})", b=True, fmt=NUM)
        _cel(ws, f"{L(col['PU'])}{r}", "TOTAL", b=True)

    ws.freeze_panes = "K12"
    ws.sheet_view.zoomScale = 20
    ws.print_area = f"F4:{L(ult)}{max(r, 12)}"
    ws.page_setup.orientation = "landscape"
    ws.page_setup.paperSize = 9
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_setup.fitToWidth, ws.page_setup.fitToHeight = 1, 0
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()
