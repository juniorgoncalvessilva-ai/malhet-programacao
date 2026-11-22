"""Textos de um PDF de projeto com a posição (pdfminer.six, MIT) — spec 131. Cada "palavra-célula" vira um `Texto` como o TEXT
do DXF, e o mesmo leitor de quadros (tabela de ferros, resumo de aço, listas) e de anotações serve para o PDF.

Só funciona quando o PDF tem camada de texto (plotado com fonte TrueType, ou com o texto pesquisável). PDF em que o texto virou
desenho (fonte SHX, imagem escaneada) não tem o que ler: a tela diz isso e o DWG/DXF continua sendo a fonte segura.
"""
import io

from app.modules.documentos.domain.takeoff import Texto


def textos(pdf: bytes, max_paginas: int = 20) -> list[Texto]:
    from pdfminer.high_level import extract_pages
    from pdfminer.layout import LAParams, LTChar, LTTextContainer, LTTextLine

    out: list[Texto] = []
    params = LAParams(char_margin=1.0, line_margin=0.2, word_margin=0.2)
    for n, pagina in enumerate(extract_pages(io.BytesIO(pdf), laparams=params, maxpages=max_paginas)):
        deslocamento = n * 100_000.0  # páginas não se misturam nos quadros
        linhas = []
        for el in pagina:
            if isinstance(el, LTTextContainer):
                linhas += [x for x in el if isinstance(x, LTTextLine)]
        for linha in linhas:
            atual: list = []
            for ch in linha:
                if not isinstance(ch, LTChar):
                    continue
                if atual and (ch.x0 - atual[-1].x1) > 0.8 * max(ch.height, 1):  # espaço de coluna, não de palavra
                    out.append(_texto(atual, deslocamento))
                    atual = []
                atual.append(ch)
            if atual:
                out.append(_texto(atual, deslocamento))
    return [t for t in out if t.texto.strip()]


def _texto(chars, deslocamento: float) -> Texto:
    x0, x1 = chars[0].x0, chars[-1].x1
    y0 = min(c.y0 for c in chars)
    h = max(c.height for c in chars) or 1.0
    return Texto(x=(x0 + x1) / 2, y=y0 - deslocamento, h=h, texto="".join(c.get_text() for c in chars).strip(), camada="PDF")
