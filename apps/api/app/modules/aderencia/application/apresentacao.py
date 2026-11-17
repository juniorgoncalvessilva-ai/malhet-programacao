"""Apresentação de aderência semanal no modelo da contratada (spec 104).

Do modelo (.pptx) ficam o mestre e os layouts (fundo, rodapé, logos), a capa, a divisória e o encerramento — só obra e
semana mudam. Os slides de dados são redesenhados no layout de conteúdo do modelo, com as mesmas posições, cores e
fontes da apresentação de referência (semanas anteriores, ranking, semana anterior, panorama da meta e marcos).
Sem modelo, sai num 16:9 em branco com o mesmo desenho.
"""
import re
from io import BytesIO

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Cm, Pt

from app.modules.aderencia.domain.aderencia import brl, pct

FONTE = "Aptos"
NAVY, NAVY2, NAVY3, VERDE_ESC = "103144", "185246", "1C3657", "062E28"
CINZA_TXT, SUB = "60758F", "526564"
LARANJA, LARANJA2, TEAL = "EEA722", "F3A51A", "00877D"
CLARO, CLARO2, CLARO3, FAIXA = "EDF2F8", "F0F3F5", "DCE8ED", "FCE0D9"
VERMELHO, VERDE = "D6473D", "008580"
BARRA_FUNDO, BARRA = "DDE4E7", "E8542F"


class Folha:
    def __init__(self, slide):
        self.s = slide

    def ret(self, x, y, w, h, cor, forma=MSO_SHAPE.RECTANGLE):
        sh = self.s.shapes.add_shape(forma, Cm(x), Cm(y), Cm(w), Cm(h))
        sh.fill.solid()
        sh.fill.fore_color.rgb = RGBColor.from_string(cor)
        sh.line.fill.background()
        sh.shadow.inherit = False
        if forma == MSO_SHAPE.ROUNDED_RECTANGLE:
            sh.adjustments[0] = 0.12
        return sh

    def txt(self, x, y, w, h, texto, tam, cor=NAVY, negrito=False, alin="l", vert="m", quebra=True):
        tb = self.s.shapes.add_textbox(Cm(x), Cm(y), Cm(w), Cm(h))
        tf = tb.text_frame
        tf.word_wrap = quebra
        tf.margin_left = tf.margin_right = Cm(0.05)
        tf.margin_top = tf.margin_bottom = 0
        tf.vertical_anchor = {"m": MSO_ANCHOR.MIDDLE, "t": MSO_ANCHOR.TOP}[vert]
        p = tf.paragraphs[0]
        p.alignment = {"l": PP_ALIGN.LEFT, "c": PP_ALIGN.CENTER, "r": PP_ALIGN.RIGHT}[alin]
        r = p.add_run()
        r.text = texto
        f = r.font
        f.name, f.size, f.bold = FONTE, Pt(tam), negrito
        f.color.rgb = RGBColor.from_string(cor)
        return tb

    # cabeçalho e rodapé padrão das folhas de dados
    def topo(self, eyebrow, titulo, subtitulo, cor_eyebrow=TEAL, tam_titulo=26):
        self.ret(1.27, 1.07, 0.36, 1.02, LARANJA)
        self.txt(1.85, 0.94, 27.9, 0.76, eyebrow, 11, cor_eyebrow, True)
        self.txt(1.27, 2.05, 31.2, 1.3, titulo, tam_titulo, "123144", True)
        if subtitulo:
            self.txt(1.30, 3.45, 31.2, 0.7, subtitulo, 12, SUB)

    def pe(self, texto, pagina):
        """Rodapé da seção (o número da página vem do mestre do modelo)."""
        self.txt(22.5, 18.25, 9.3, 0.7, texto, 8, "BFEFEC", alin="r")


def _saldo(v):
    return (VERMELHO if (v or 0) < 0 else VERDE), brl(v, sinal=True)


def _faixa_acumulado(f: Folha, g: dict):
    f.ret(0.02, 16.27, 33.87, 0.94, FAIXA)
    f.txt(1.39, 16.47, 5.0, 0.56, "ACUMULADO GERAL", 9, NAVY, True)
    f.txt(6.75, 16.47, 7.9, 0.56, f"PROGRAMADO  {brl(g['programado'])}", 9, NAVY, True)
    f.txt(15.01, 16.47, 7.9, 0.56, f"REALIZADO  {brl(g['realizado'])}", 9, NAVY, True)
    f.txt(23.01, 16.47, 7.0, 0.56, f"SALDO  {brl(g['saldo'], sinal=True)}", 9, VERMELHO if (g["saldo"] or 0) < 0 else VERDE, True)
    f.txt(29.6, 16.40, 3.6, 0.74, pct(g["aderencia"]), 15, "112F40", True, "r")


def _semanas_txt(semanas: list[int]) -> str:
    if not semanas:
        return ""
    return f"Semana {semanas[0]}" if len(semanas) == 1 else f"Semanas {semanas[0]} a {semanas[-1]}"


# ---------------------------------------------------------------- folhas
def folha_anteriores(f: Folha, ant: dict, blocos: list[dict], obra: str, semana: int, pagina: int):
    f.topo("04 · ANÁLISE DE PERFORMANCE — COMPARATIVO ACUMULADO", "ANÁLISE FINANCEIRA POR ENGENHEIRO – SEMANAS ANTERIORES",
           f"{_semanas_txt(ant['semanas'])}  |  Programado × Realizado × Saldo não executado", tam_titulo=23)
    cols = [("SEM.", 0, 2.16), ("PROGRAMADO", 2.16, 4.11), ("REALIZADO", 6.28, 3.99), ("SALDO", 10.26, 3.76), ("ADER.", 14.02, 2.13)]
    for k, b in enumerate(blocos[:4]):
        x, y = (0.71 if k % 2 == 0 else 17.45), (4.50 if k < 2 else 10.57)
        f.ret(x, y, 16.15, 0.91, NAVY2)
        f.txt(x + 0.33, y + 0.16, 15.6, 0.58, f"{b['posicao']}º  {b['responsavel'].upper()}", 11, "FFFFFF", True)
        f.ret(x, y + 0.91, 16.15, 0.84, NAVY)
        for rot, dx, w in cols:
            f.txt(x + dx, y + 1.10, w, 0.41, rot, 8, "FFFFFF", True, "c")
        ly = y + 1.75
        linhas = [*b["linhas"], {"semana": None, **b["total"]}]
        for i, ln in enumerate(linhas):
            tot = ln["semana"] is None
            f.ret(x, ly, 16.15, 0.72, CLARO3 if tot else (CLARO2 if i % 2 == 0 else "FFFFFF"))
            cor_s, saldo = _saldo(ln["saldo"])
            rot = ("ACUM." if len(ant["semanas"]) > len(ant["mostradas"]) else "TOTAL") if tot else f"S{ln['semana']}"
            for (_, dx, w), v, cor in zip(cols, [rot, brl(ln["programado"]), brl(ln["realizado"]), saldo, pct(ln["aderencia"])],
                                          [NAVY, NAVY, NAVY, cor_s, NAVY]):
                f.txt(x + dx, ly + 0.12, w, 0.46, v, 8.3, cor, tot, "c")
            ly += 0.72
        f.ret(x + 0.41, ly + 0.15, 15.34, 0.19, BARRA_FUNDO)
        a = min(max(b["total"]["aderencia"] or 0, 0), 1)
        if a:
            f.ret(x + 0.41, ly + 0.15, 15.34 * a, 0.19, BARRA)
    _faixa_acumulado(f, ant["geral"])
    f.pe(f"Análise de Performance — Semana {semana}", pagina)


def folha_ranking(f: Folha, rk: dict, obra: str, semana: int, pagina: int):
    f.topo("04 · ANÁLISE DE PERFORMANCE — COMPARATIVO ACUMULADO", "Ranking Financeiro | Programado x Realizado",
           f"{_semanas_txt(rk['semanas'])}  •  {obra}  •  Desvio financeiro acumulado")
    g = rk["geral"]
    for x, rot, v, cor in ((1.09, "TOTAL PROGRAMADO", brl(g["programado"]), "193554"), (12.12, "TOTAL REALIZADO", brl(g["realizado"]), "193554"),
                           (23.14, "SALDO NÃO REALIZADO", brl(-(g["saldo"] or 0)), VERMELHO)):
        f.ret(x, 4.50, 9.40, 2.18, CLARO, MSO_SHAPE.ROUNDED_RECTANGLE)
        f.txt(x + 0.59, 4.85, 8.5, 0.64, rot, 10, CINZA_TXT, True)
        f.txt(x + 0.59, 5.61, 8.5, 0.86, v, 21, cor, True)
    f.ret(1.09, 7.19, 31.57, 1.19, VERDE_ESC)
    f.txt(1.83, 7.49, 29.7, 0.64, f"COMPARATIVO FINANCEIRO POR ENGENHEIRO  |  ACUMULADO {('S' + str(rk['semanas'][0]) + '–S' + str(rk['semanas'][-1])) if rk['semanas'] else ''}",
          11, "FFFFFF", True, "c")
    for x, rot in ((1.63, "RANKING / RESPONSÁVEL"), (11.30, "PROGRAMADO"), (17.27, "REALIZADO"), (22.96, "NÃO REALIZADO"), (29.21, "ADERÊNCIA")):
        f.txt(x, 8.81, 6.0, 0.56, rot, 9, CINZA_TXT, True)
    itens = rk["itens"]
    passo = min(1.45, (16.05 - 9.63) / max(len(itens), 1))
    for i, it in enumerate(itens):
        y = 9.63 + i * passo
        if i % 2 == 0:
            f.ret(1.09, y, 31.57, passo * 0.9, CLARO, MSO_SHAPE.ROUNDED_RECTANGLE)
        f.ret(1.52, y + passo * 0.16, 0.20, passo * 0.6, "F5A623")
        f.txt(2.08, y, 1.1, passo * 0.9, f"{it['posicao']}º", 12, NAVY, True)
        f.txt(3.25, y, 7.95, passo * 0.9, it["responsavel"].upper(), 11, "193554", True)
        f.txt(11.33, y, 5.3, passo * 0.9, brl(it["programado"]), 11, "193554")
        f.txt(17.25, y, 5.3, passo * 0.9, brl(it["realizado"]), 11, "193554")
        f.txt(22.99, y, 5.3, passo * 0.9, brl(-(it["saldo"] or 0)), 11, VERMELHO)
        f.txt(29.18, y, 3.1, passo * 0.9, pct(it["aderencia"]), 11, TEAL, True)
    _faixa_acumulado(f, g)
    f.pe(f"Análise de Performance — Semana {semana}", pagina)


def folha_anterior(f: Folha, an: dict, obra: str, semana: int, pagina: int):
    f.topo("02 · ANÁLISE DE PERFORMANCE — SEMANA ANTERIOR", "Planejado x Realizado | Desempenho Financeiro",
           f"Semana {an['semana']}  •  {obra}  •  Análise financeira e física", "007A77", 28)
    for x, rot, v in ((1.17, "PRODUÇÃO FINANCEIRA PROGRAMADA", brl(an["programado"])), (17.53, "PRODUÇÃO FINANCEIRA REALIZADA", brl(an["realizado"]))):
        f.ret(x, 4.29, 15.14, 3.15, CLARO, MSO_SHAPE.ROUNDED_RECTANGLE)
        f.txt(x + 0.76, 4.85, 14.0, 0.71, rot, 13, CINZA_TXT, True)
        f.txt(x + 0.76, 5.94, 14.0, 1.25, v, 25, NAVY3, True)
    f.ret(0.99, 7.75, 16.15, 1.30, "052B25")
    f.txt(1.73, 8.05, 15.2, 0.76, "◉   COMPARATIVO FINANCEIRO POR ENGENHEIRO", 14, "FFFFFF", True)
    itens = an["itens"]
    fisica = any(it.get("fisica") is not None for it in itens)  # só a semana do sistema tem o físico (atividades)
    cab = [(1.65, "RESPONSÁVEL"), (13.08, "PLANEJADO"), (19.68, "REALIZADO")] + (
        [(25.6, "ADER. FINANC."), (29.6, "ADER. FÍSICA")] if fisica else [(26.92, "ADERÊNCIA")])
    for x, rot in cab:
        f.txt(x, 9.58, 5.8, 0.64, rot, 11 if fisica else 12, CINZA_TXT, True)
    passo = min(1.63, (16.35 - 10.46) / max(len(itens), 1))
    for i, it in enumerate(itens):
        y = 10.46 + i * passo
        if i % 2 == 0:
            f.ret(1.14, y, 31.37, passo * 0.86, CLARO, MSO_SHAPE.ROUNDED_RECTANGLE)
        f.ret(0.65, y + passo * 0.29, 0.41, 0.41, LARANJA, MSO_SHAPE.OVAL)
        f.txt(1.70, y, 11.2, passo * 0.86, it["responsavel"], 14 if passo > 1.2 else 11, NAVY3, True)
        f.txt(13.1, y, 3.5, passo * 0.86, brl(it["programado"]), 11, NAVY3, True, "c")
        f.txt(19.3, y, 3.5, passo * 0.86, brl(it["realizado"]), 11, NAVY3, True, "c")
        f.txt(25.6 if fisica else 26.92, y, 3.4, passo * 0.86, pct(it["aderencia"]), 17 if passo > 1.2 else 13, "183352", True)
        if fisica:
            f.txt(29.6, y, 3.2, passo * 0.86, pct(it["fisica"]) if it.get("fisica") is not None else "—", 13 if passo > 1.2 else 11, TEAL, True)
    f.ret(1.07, 16.61, 31.75, 1.19, NAVY3)
    fis = f"   |   ADERÊNCIA FÍSICA: {pct(an['fisica'])}" if an.get("fisica") is not None else ""
    rot = "ADERÊNCIA FINANCEIRA" if fis else "ADERÊNCIA GERAL"
    f.txt(1.78, 16.84, 30.3, 0.71, f"{rot}: {pct(an['aderencia'])}{fis}   |   DESVIO: {brl(an['desvio'], sinal=True)}",
          13, "FFFFFF", True, "c")
    f.pe(f"Análise de Performance — Semana {an['semana']}", pagina)


def folha_panorama(f: Folha, at: dict, obra: str, semana: int, pagina: int):
    f.topo("05 · VISÃO GERAL DA PROGRAMAÇÃO SEMANAL", "Panorama Financeiro e Físico das Metas da Obra",
           f"Semana {semana}  •  {obra}  •  Cronograma", "00807C", 30)
    for x, w, rot, v in ((0.99, 15.39, "PRODUÇÃO FINANCEIRA PROGRAMADA", brl(at["meta"])),
                         (16.89, 15.90, "AVANÇO PREVISTO NO CRONOGRAMA DA OBRA", pct(at["avanco"], 4) if at["avanco"] is not None else "—")):
        f.ret(x, 4.85, w, 3.17, "EFF3F8", MSO_SHAPE.ROUNDED_RECTANGLE)
        f.txt(x + 0.66, 5.36, w - 1.2, 0.69, rot, 12, "60738C", True)
        f.txt(x + 0.66, 6.65, w - 1.2, 1.02, v, 23, "1E3555", True)
    f.ret(1.11, 8.71, 15.24, 1.22, "062422")
    f.txt(1.6, 8.95, 14.5, 0.76, "◎   DISTRIBUIÇÃO DA META POR ENGENHEIRO", 13, "FFFFFF", True)
    for x, rot in ((1.63, "RESPONSÁVEL / FRENTE"), (14.43, "META FINANCEIRA"), (20.78, "PARTICIPAÇÃO"), (27.72, "AVANÇO PREVISTO")):
        f.txt(x, 10.21, 6.0, 0.43, rot, 10, CINZA_TXT, True)
    itens = at["itens"]
    passo = min(1.19, (16.55 - 10.83) / max(len(itens), 1))
    for i, it in enumerate(itens):
        y = 10.83 + i * passo
        if i % 2 == 0:
            f.ret(1.36, y, 31.48, passo * 0.93, "EEF2F7", MSO_SHAPE.ROUNDED_RECTANGLE)
        f.ret(0.71, y + passo * 0.3, 0.38, 0.38, LARANJA2)
        f.txt(1.69, y + 0.05, 12.66, passo * 0.45, it["responsavel"], 10, "1E3555", True)
        f.txt(1.69, y + passo * 0.52, 12.5, passo * 0.35, ", ".join(it["frentes"])[:90], 8, CINZA_TXT)
        f.txt(14.59, y, 4.7, passo * 0.93, brl(it["meta"]), 10.5, "1E3555", True)
        f.txt(20.84, y, 2.9, passo * 0.93, pct(it["participacao"]), 10, "1E3555", True)
        f.ret(23.92, y + passo * 0.36, 2.90, 0.35, "D3DCE7")
        if it["participacao"]:
            f.ret(23.92, y + passo * 0.36, max(2.90 * it["participacao"], 0.05), 0.35, BARRA)
        f.txt(28.0, y, 4.5, passo * 0.93, pct(it["avanco"], 4) if it["avanco"] is not None else "—", 10.5, "1E3555", True, "r")
    f.ret(1.36, 16.75, 31.48, 0.62, NAVY3)
    f.txt(1.7, 16.78, 30.8, 0.56, f"MARCO DA SEMANA: Meta financeira de {brl(at['meta'])}  |  Avanço físico previsto de "
                                 f"{pct(at['avanco'], 4) if at['avanco'] is not None else '—'}.", 10, "FFFFFF", True)
    f.pe("Panorama Financeiro e Físico das Metas da Obra", pagina)


def _coluna_marcos(f: Folha, x: float, it: dict):
    w = 15.7
    f.ret(x, 4.55, w, 0.85, NAVY2)
    f.txt(x + 0.3, 4.55, w - 0.6, 0.85, it["responsavel"].upper(), 11, "FFFFFF", True)
    y, frente, k = 5.6, None, 0
    for m in it["marcos"]["itens"]:
        if m["frente"] != frente:
            frente = m["frente"]
            f.txt(x + 0.2, y, w - 0.4, 0.55, frente.upper(), 9, "1E3555", True)
            y += 0.6
        if k % 2 == 0:
            f.ret(x, y, w, 0.74, CLARO2)
        f.txt(x + 0.2, y, w - 4.4, 0.74, m["descricao"][:95], 8.5, "1E3555", quebra=True)
        f.txt(x + w - 4.1, y, 3.9, 0.74, brl(m["valor"]), 9, "1E3555", True, "r")
        y += 0.78
        k += 1
    y = max(y + 0.2, 13.4)
    f.ret(x, y, w, 0.85, NAVY3)
    f.txt(x + 0.3, y, 8, 0.85, "TOTAL DOS MARCOS", 10, "FFFFFF", True)
    f.txt(x + w - 6.3, y, 6.0, 0.85, brl(it["marcos"]["total"]), 11, "FFFFFF", True, "r")
    f.txt(x, y + 0.95, w, 0.5, f"Representatividade na meta semanal: {pct(it['marcos']['representatividade'])}", 9.5, BARRA, True)
    f.txt(x, y + 1.42, w, 0.42, f"Meta financeira da frente: {brl(it['meta'])}", 7.5, CINZA_TXT)


def folha_marcos(f: Folha, itens: list[dict], semana: int, pagina: int):
    f.topo("06 · MARCOS CRÍTICOS E ENTREGAS DA SEMANA", f"Marcos Prioritários — Semana {semana}",
           "Atividades e valores financeiros individuais por engenheiro", tam_titulo=26)
    for k, it in enumerate(itens[:2]):
        _coluna_marcos(f, 0.95 if k == 0 else 17.25, it)
    f.pe("Marcos da Semana Atual", pagina)


# ---------------------------------------------------------------- montagem
def _trocar_paragrafos(slide, regras: list[tuple[re.Pattern, callable]]):
    for sh in slide.shapes:
        frames = [sh.text_frame] if sh.has_text_frame else []
        if sh.shape_type == 6:
            frames += [x.text_frame for x in sh.shapes if x.has_text_frame]
        for tf in frames:
            for p in tf.paragraphs:
                texto = "".join(r.text for r in p.runs)
                novo = texto
                for padrao, troca in regras:
                    novo = padrao.sub(troca, novo)
                if novo != texto and p.runs:
                    p.runs[0].text = novo
                    for r in p.runs[1:]:
                        r.text = ""


def _texto(slide) -> str:
    return " ".join(sh.text_frame.text for sh in slide.shapes if sh.has_text_frame).upper()


def gerar(dados: dict, obra: str, modelo: bytes | None) -> bytes:
    semana = dados["semana"]
    prs = Presentation(BytesIO(modelo)) if modelo else Presentation()
    if not modelo:
        prs.slide_width, prs.slide_height = Cm(33.867), Cm(19.05)
    slides = list(prs.slides)
    capa = slides[0] if slides else None
    encerramento = slides[-1] if len(slides) > 1 and "OBRIGAD" in _texto(slides[-1]) else None
    divisoria = slides[1] if len(slides) > 2 and slides[1].slide_layout != slides[2].slide_layout and len(_texto(slides[1])) < 60 else None
    conteudo = next((s.slide_layout for s in slides[2:] if s is not encerramento), None) \
        or next((lay for lay in prs.slide_layouts if lay.name.upper() == "DEFAULT"), prs.slide_layouts[-1 if modelo else 6])
    manter = {id(x) for x in (capa, divisoria, encerramento) if x is not None}
    # fora os slides de dados da apresentação de referência (as folhas novas entram no lugar)
    lista = prs.slides._sldIdLst
    for sid, sl in zip(list(lista), slides):
        if id(sl) not in manter:
            prs.part.drop_rel(sid.rId)
            lista.remove(sid)
    # os slides mantidos ganham nomes internos altos: os novos (slide4, slide5…) não colidem com eles no arquivo
    from pptx.opc.packuri import PackURI

    for k, sl in enumerate(x for x in (capa, divisoria, encerramento) if x is not None):
        sl.part.partname = PackURI(f"/ppt/slides/slide{9001 + k}.xml")
    obra_up = obra.upper()
    regras = [(re.compile(r"SEMANA\s*\d+", re.I), lambda m: f"SEMANA {semana}" if m.group(0).isupper() else f"Semana {semana}"),
              (re.compile(r"^OBRA\b.*$"), lambda m: obra_up)]
    if capa is not None:
        _trocar_paragrafos(capa, regras)
    if encerramento is not None:
        _trocar_paragrafos(encerramento, [(re.compile(r"^OBRA\b.*$"), lambda m: obra_up)])
    if not modelo:  # capa simples
        f = Folha(prs.slides.add_slide(prs.slide_layouts[6]))
        f.ret(0, 0, 33.867, 19.05, "E8542F")
        f.txt(2.9, 6.6, 28.1, 6, f"{obra_up}\nANÁLISE DE ADERÊNCIA FÍSICA E FINANCEIRA DA PROGRAMAÇÃO SEMANAL - SEMANA {semana}",
              30, "FFFFFF", True, "c", quebra=True)

    pagina = len(prs.slides) - (1 if encerramento is not None else 0)  # as folhas entram antes do encerramento

    def nova() -> Folha:
        nonlocal pagina
        pagina += 1
        return Folha(prs.slides.add_slide(conteudo))

    ant = dados["anteriores"]
    if ant["blocos"]:
        for i in range(0, len(ant["blocos"]), 4):
            folha_anteriores(nova(), ant, ant["blocos"][i:i + 4], obra, semana, pagina)
        folha_ranking(nova(), dados["ranking"], obra, semana, pagina)
    if dados["anterior"]["itens"]:
        folha_anterior(nova(), dados["anterior"], obra, semana, pagina)
    at = dados["atual"]
    if at["itens"]:
        folha_panorama(nova(), at, obra, semana, pagina)
        com_marcos = [x for x in at["itens"] if x["marcos"]["itens"]]
        for i in range(0, len(com_marcos), 2):
            folha_marcos(nova(), com_marcos[i:i + 2], semana, pagina)
    if encerramento is not None:  # o encerramento volta para o fim
        for x in list(lista):
            if prs.part.related_part(x.rId) is encerramento.part:
                lista.remove(x)
                lista.append(x)
                break
    out = BytesIO()
    prs.save(out)
    return out.getvalue()
