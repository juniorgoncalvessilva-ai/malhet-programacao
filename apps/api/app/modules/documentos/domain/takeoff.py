"""Take-off pelo projeto (spec 124): quantidades lidas do próprio desenho, cada uma com a conta e o lugar de onde veio.

Sem IA e sem adivinhar: o que o projetista escreveu no desenho é a fonte.
- **Quadros** montados pela posição dos textos (o AutoCAD guarda cada célula como um TEXT solto): TABELA DE FERROS
  (N, Ø, Q, UNIT., TOT.), RESUMO AÇO (aço, Ø, TOT., MASSA) e listas de materiais (descrição, quantidade, unidade).
  O resumo é conferido pela massa linear da NBR 7480 e pela soma da tabela de ferros; o total, pela soma das linhas.
- **Anotações** com número e unidade ("147,20m²+10% = 161,92", "869,51kg"), com o rótulo escrito logo acima.
- **Medições do desenho** por camada (comprimento, área fechada) e contagem de blocos — na unidade do desenho, que
  muitas vezes não bate com a escala: o planejador informa o fator ao aceitar.

O planejador aceita, escolhe o item da PQ e a frente, e leva ao IWP. Nada vai à WBS sozinho.
"""
import re
import unicodedata
from collections import defaultdict
from dataclasses import dataclass, field

from app.shared.memoria import num

# NBR 7480: massa linear nominal das barras e fios de aço (kg/m), pelo diâmetro em mm
MASSA_LINEAR = {4.2: 0.109, 5.0: 0.154, 6.3: 0.245, 8.0: 0.395, 10.0: 0.617, 12.5: 0.963, 16.0: 1.578, 20.0: 2.466,
                22.0: 2.984, 25.0: 3.853, 32.0: 6.313, 40.0: 9.865}

TITULO = re.compile(r"^(TABELA\s+DE\s+(FERROS?|A[CÇ]OS?|ARMA[CÇ][AÃ]O)|RESUMO\s+(DE\s+|DO\s+)?A[CÇ]O|"
                    r"QUADRO\s+DE\s+(FERROS?|A[CÇ]OS?|MATERIA\w*|QUANTIDADES?)|LISTA\s+DE\s+MATERIA\w*)\b", re.I)
_NUM_UNID = re.compile(r"(\d[\d.,]*)\s*(m²|m2|m³|m3|kg|t|ml|m)(?![a-z0-9²³])", re.I)
_IGUAL = re.compile(r"=\s*(\d[\d.,]*)\s*(m²|m2|m³|m3|kg|t|ml|m)?(?![a-z0-9²³])", re.I)
UNIDADES = {"m2": "m²", "m²": "m²", "m3": "m³", "m³": "m³", "kg": "kg", "t": "t", "m": "m", "ml": "m"}
UNIDADE_DESENHO = {0: None, 1: "pol", 2: "pé", 4: "mm", 5: "cm", 6: "m"}


@dataclass(frozen=True)
class Texto:
    """Um texto do desenho: x é o centro (o alinhamento do TEXT já foi resolvido na leitura), y a base."""
    x: float
    y: float
    h: float
    texto: str
    camada: str = ""


@dataclass(frozen=True)
class Medida:
    camada: str
    comprimento: float
    area: float
    entidades: int


@dataclass(frozen=True)
class Extraida:
    origem: str  # quadro | anotacao | camada | bloco
    chave: str  # estável entre revisões: compara a rev. 4 com a 3
    descricao: str
    quantidade: float
    unidade: str
    formula: str
    passos: tuple[tuple[str, str, str], ...] = ()
    fontes: tuple[tuple[str, str, str], ...] = ()  # (dado, valor, local no desenho)
    avisos: tuple[str, ...] = ()
    confere: bool | None = None  # quadro conferido pela conta (None = não há como conferir)


@dataclass
class Quadro:
    titulo: str
    colunas: list[str]
    linhas: list[list[str | None]]
    total: str | None = None
    y: float = 0.0
    x: float = 0.0
    lugar: str = ""
    camada: str = ""
    h: float = 1.0


# ---- textos ---------------------------------------------------------------------------------------------------------

def limpar(t: str) -> str:
    """Códigos de controle do AutoCAD: %%C = Ø, %%D = °, %%P = ±, %%% = %."""
    t = (t or "").replace("%%%", "%").replace("%%C", "Ø").replace("%%c", "Ø").replace("%%D", "°").replace("%%d", "°")
    t = t.replace("%%P", "±").replace("%%p", "±").replace("∅", "Ø")
    return re.sub(r"\s+", " ", t).strip()


def _sem_acento(t: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", t) if unicodedata.category(c) != "Mn").upper()


def numero(t: str | None, decimal_ponto: bool = False) -> float | None:
    """'6.3' (diâmetro) · '1.234,5' · '161,92' · '869,51kg' → número; texto sem número → None."""
    if t is None:
        return None
    m = re.search(r"-?\d[\d.,]*", str(t))
    if not m:
        return None
    s = m.group(0).rstrip(".,")
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:
        s = s.replace(",", ".")
    elif "." in s and not decimal_ponto and re.fullmatch(r"\d{1,3}(\.\d{3})+", s):
        s = s.replace(".", "")  # 1.250 = mil duzentos e cinquenta
    try:
        return float(s)
    except ValueError:
        return None


def diametro(t: str | None) -> float | None:
    v = numero(t, decimal_ponto=True)
    return float(v) if v is not None else None


def _rotulo_diam(d: float) -> str:
    return f"Ø{num(d, 1)}"


# ---- quadros pela posição dos textos ---------------------------------------------------------------------------------

def _linhas_por_y(textos: list[Texto], tol: float) -> list[list[Texto]]:
    linhas: list[list[Texto]] = []
    for t in sorted(textos, key=lambda t: -t.y):
        if linhas and abs(linhas[-1][0].y - t.y) <= tol:
            linhas[-1].append(t)
        else:
            linhas.append([t])
    return [sorted(l, key=lambda t: t.x) for l in linhas]


def montar_quadros(textos: list[Texto]) -> list[Quadro]:
    """Cada título conhecido abre um quadro: a primeira linha abaixo é o cabeçalho (define as colunas pelo centro de
    cada texto), as linhas seguintes vão até um espaço maior que o normal, outro título ou a linha de TOTAL."""
    quadros = []
    for tit in [t for t in textos if TITULO.match(limpar(t.texto))]:
        h = tit.h or 1.0
        faixa = [t for t in textos if t is not tit and t.y < tit.y - 0.2 * h and tit.y - t.y < 120 * h
                 and tit.x - 30 * h <= t.x <= tit.x + 40 * h]
        linhas = _linhas_por_y(faixa, 0.6 * h)
        # cabeçalho: a primeira linha logo abaixo com 2+ textos que não são números (pula subtítulo como "CORTE C-C")
        k = next((i for i, ln in enumerate(linhas[:4]) if len(ln) >= 2 and tit.y - ln[0].y <= 8 * h
                  and sum(numero(x.texto) is None for x in ln) >= len(ln) / 2), None)
        if k is None or len(linhas) < k + 2:
            continue
        linhas = linhas[k:]
        cab = linhas[0]
        centros = [t.x for t in cab]
        # margem do quadro: pela letra (DXF) ou pelo espaço médio entre colunas (PDF, onde a escala letra × coluna muda)
        passo_col = (max(centros) - min(centros)) / max(len(centros) - 1, 1)
        ini, fim = min(centros) - max(4 * h, 0.6 * passo_col), max(centros) + max(6 * h, 0.8 * passo_col)
        q = Quadro(titulo=limpar(tit.texto), colunas=[limpar(t.texto) for t in cab], linhas=[], y=tit.y, x=tit.x,
                   camada=tit.camada, h=h, lugar=f"quadro \"{limpar(tit.texto)}\" (x {num(tit.x, 0)}, y {num(tit.y, 0)})")
        passo = None
        anterior = cab[0].y
        for ln in linhas[1:]:
            ln = [t for t in ln if ini <= t.x <= fim]
            if not ln:
                continue
            gap = anterior - ln[0].y
            if passo is not None and gap > 1.6 * passo:
                break
            if any(TITULO.match(limpar(t.texto)) for t in ln):
                break
            passo = passo or gap
            anterior = ln[0].y
            celulas: list[str | None] = [None] * len(cab)
            for t in ln:
                i = min(range(len(centros)), key=lambda k: abs(centros[k] - t.x))
                celulas[i] = limpar(t.texto) if celulas[i] is None else f"{celulas[i]} {limpar(t.texto)}"
            if any("TOTAL" in _sem_acento(c or "") for c in celulas):
                q.total = next((c for c in reversed(celulas) if c and numero(c) is not None and "TOTAL" not in _sem_acento(c)), None)
                break
            q.linhas.append(celulas)
        if q.linhas:
            quadros.append(q)
    return quadros


def _col(q: Quadro, *chaves: str) -> int | None:
    """Coluna pelo cabeçalho; as chaves vêm em ordem de preferência (DESCRIÇÃO antes de ITEM)."""
    nomes = [_sem_acento(c) for c in q.colunas]
    for k in chaves:
        for i, n in enumerate(nomes):
            if n == k or n.startswith(k):
                return i
    return None


def _cel(lin: list[str | None], i: int | None) -> str | None:
    return lin[i] if i is not None and i < len(lin) else None


@dataclass
class _Ferro:
    n: str
    d: float
    q: float | None
    unit_cm: float | None
    tot_m: float
    linha: int
    confere: bool | None


def _ferros(q: Quadro) -> tuple[list[_Ferro], list[str]]:
    iN, iD, iQ, iU, iT = _col(q, "N", "POS"), _col(q, "Ø", "DIAM", "BIT"), _col(q, "Q"), _col(q, "UNIT", "COMP"), _col(q, "TOT")
    out, avisos = [], []
    if iD is None or iT is None:
        return out, avisos
    for k, lin in enumerate(q.linhas, start=1):
        d, tot = diametro(_cel(lin, iD)), numero(_cel(lin, iT))
        if d is None or tot is None:
            continue
        qt, un = numero(_cel(lin, iQ)), numero(_cel(lin, iU))
        conf = None
        if qt is not None and un is not None:
            conf = abs(qt * un / 100 - tot) <= max(1.0, 0.01 * tot)
            if not conf:
                avisos.append(f"N{_cel(lin, iN) or k}: {num(qt, 0)} × {num(un, 0)} cm = {num(qt * un / 100)} m, a tabela diz {num(tot)} m")
        out.append(_Ferro(_cel(lin, iN) or str(k), d, qt, un, tot, k, conf))
    return out, avisos


def _aco(q: Quadro, ferros: list[_Ferro]) -> list[Extraida]:
    """RESUMO AÇO: uma quantidade (kg) por aço e diâmetro, conferida pela NBR 7480 e pela tabela de ferros."""
    iA, iD, iT, iM = _col(q, "ACO", "TIPO"), _col(q, "Ø", "DIAM", "BIT"), _col(q, "TOT", "COMP"), _col(q, "MASSA", "PESO")
    if iD is None or iM is None:
        return []
    por_d: dict[float, float] = defaultdict(float)
    linhas_d: dict[float, list[str]] = defaultdict(list)
    for f in ferros:
        por_d[f.d] += f.tot_m
        linhas_d[f.d].append(f"N{f.n}")
    out, soma = [], 0.0
    for k, lin in enumerate(q.linhas, start=1):
        d, massa = diametro(_cel(lin, iD)), numero(_cel(lin, iM))
        if d is None or massa is None:
            continue
        soma += massa
        aco = (_cel(lin, iA) or "aço").upper().replace(" ", "")
        tot = numero(_cel(lin, iT))
        kgm = MASSA_LINEAR.get(round(d, 1))
        passos, avisos, conf = [], [], None
        if tot is not None and kgm:
            calc = tot * kgm
            conf = abs(calc - massa) <= max(1.5, 0.03 * massa)
            passos.append((f"{_rotulo_diam(d)}: comprimento × massa linear (NBR 7480)", f"{num(tot)} m × {num(kgm, 3)} kg/m",
                           f"{num(calc)} kg"))
            if not conf:
                avisos.append(f"{_rotulo_diam(d)}: {num(tot)} m × {num(kgm, 3)} kg/m = {num(calc)} kg, o resumo diz {num(massa)} kg")
        if d in por_d and tot is not None:
            ok = abs(por_d[d] - tot) <= max(1.0, 0.01 * tot)
            passos.append((f"tabela de ferros {', '.join(linhas_d[d])}", " + ".join(num(f.tot_m) for f in ferros if f.d == d) + " m",
                           f"{num(por_d[d])} m"))
            if not ok:
                avisos.append(f"{_rotulo_diam(d)}: a tabela de ferros soma {num(por_d[d])} m, o resumo diz {num(tot)} m")
            conf = ok if conf is None else (conf and ok)
        out.append(Extraida(
            origem="quadro", chave=f"aço {aco} {_rotulo_diam(d)}", descricao=f"Aço {aco} {_rotulo_diam(d)} mm",
            quantidade=massa, unidade="kg", formula="massa do resumo de aço do desenho" + (" (conferida)" if conf else ""),
            passos=tuple(passos), avisos=tuple(avisos), confere=conf,
            fontes=((f"{q.titulo}, linha {k}", f"{aco} {_rotulo_diam(d)} · {num(tot) if tot is not None else '—'} m · {num(massa)} kg", q.lugar),)))
    if q.total is not None and out:
        tot = numero(q.total)
        if tot is not None and abs(tot - soma) > max(1.0, 0.005 * tot):
            out = [Extraida(**{**e.__dict__, "avisos": e.avisos + (f"as linhas somam {num(soma)} kg, o TOTAL do quadro diz {num(tot)} kg",),
                               "confere": False}) for e in out]
    return out


def _aco_pela_tabela(q: Quadro, ferros: list[_Ferro]) -> list[Extraida]:
    """Só a tabela de ferros, sem resumo: a massa sai do comprimento × massa linear (NBR 7480)."""
    por_d: dict[float, list[_Ferro]] = defaultdict(list)
    for f in ferros:
        por_d[f.d].append(f)
    out = []
    for d, fs in sorted(por_d.items()):
        kgm = MASSA_LINEAR.get(round(d, 1))
        if not kgm:
            continue
        tot = sum(f.tot_m for f in fs)
        out.append(Extraida(
            origem="quadro", chave=f"aço {_rotulo_diam(d)}", descricao=f"Aço {_rotulo_diam(d)} mm (pela tabela de ferros)",
            quantidade=round(tot * kgm, 2), unidade="kg", formula="Σ comprimento total das posições × massa linear (NBR 7480)",
            passos=((f"posições {', '.join('N' + f.n for f in fs)}", " + ".join(num(f.tot_m) for f in fs) + " m", f"{num(tot)} m"),
                    ("massa", f"{num(tot)} m × {num(kgm, 3)} kg/m", f"{num(tot * kgm)} kg")),
            fontes=tuple((f"{q.titulo}, linha {f.linha}", f"N{f.n} {_rotulo_diam(d)} · {num(f.tot_m)} m", q.lugar) for f in fs),
            confere=all(f.confere is not False for f in fs)))
    return out


def _lista(q: Quadro) -> list[Extraida]:
    """Lista de materiais: descrição, quantidade e unidade por linha."""
    iQ, iU = _col(q, "QUANT", "QTD", "QTDE", "QT"), _col(q, "UN")
    if iQ is None:
        return []
    iDesc = _col(q, "DESCR", "MATERIA", "ITEM", "ESPECIF")
    if iDesc is None:
        iDesc = max((i for i in range(len(q.colunas)) if i not in (iQ, iU)),
                    key=lambda i: sum(len(l[i] or "") for l in q.linhas), default=None)
    out = []
    for k, lin in enumerate(q.linhas, start=1):
        qt, desc = numero(_cel(lin, iQ)), _cel(lin, iDesc)
        if qt is None or not desc:
            continue
        un = _cel(lin, iU) or "un"
        out.append(Extraida(origem="quadro", chave=f"{_sem_acento(q.titulo)[:30]} · {desc[:80]}", descricao=desc[:300],
                            quantidade=qt, unidade=UNIDADES.get(un.lower(), un)[:20], formula="quantidade da lista do desenho",
                            fontes=((f"{q.titulo}, linha {k}", " · ".join(c for c in lin if c), q.lugar),)))
    return out


def ler_quadros(textos: list[Texto]) -> tuple[list[Extraida], list[Quadro]]:
    quadros = montar_quadros(textos)
    out: list[Extraida] = []
    ferros_por_quadro: dict[int, tuple[list[_Ferro], list[str]]] = {}
    for i, q in enumerate(quadros):
        if _sem_acento(q.titulo).startswith("TABELA"):
            ferros_por_quadro[i] = _ferros(q)
    for i, q in enumerate(quadros):
        t = _sem_acento(q.titulo)
        if t.startswith("RESUMO") or (_col(q, "MASSA", "PESO") is not None and _col(q, "Ø", "DIAM", "BIT") is not None):
            # o resumo usa a tabela de ferros mais próxima acima dele (mesma coluna do desenho)
            perto = [j for j in ferros_por_quadro if quadros[j].y > q.y and abs(quadros[j].x - q.x) < 40 * q.h]
            j = min(perto, key=lambda j: quadros[j].y - q.y) if perto else None
            ferros, av = ferros_por_quadro.get(j, ([], [])) if j is not None else ([], [])
            linhas = _aco(q, ferros)
            if av:
                linhas = [Extraida(**{**e.__dict__, "avisos": e.avisos + tuple(av)}) for e in linhas]
            if j is not None:
                ferros_por_quadro[j] = ([], [])  # já entrou pelo resumo: não conta duas vezes
            out += linhas
        elif i not in ferros_por_quadro:
            out += _lista(q)
    for j, (ferros, av) in ferros_por_quadro.items():
        if ferros:
            linhas = _aco_pela_tabela(quadros[j], ferros)
            out += [Extraida(**{**e.__dict__, "avisos": e.avisos + tuple(av)}) for e in linhas] if av else linhas
    return _unicas(out), quadros


# ---- anotações com número e unidade ---------------------------------------------------------------------------------

def ler_anotacoes(textos: list[Texto], quadros: list[Quadro]) -> list[Extraida]:
    """Texto solto com número e unidade de quantidade. Com '=', vale o resultado; o rótulo é o texto logo acima."""
    dentro = set()
    for q in quadros:
        for t in textos:
            h = t.h or 1
            if q.x - 30 * h <= t.x <= q.x + 40 * h and q.y - 120 * h < t.y <= q.y:
                dentro.add(id(t))
    out = []
    for t in textos:
        if id(t) in dentro:
            continue
        s = limpar(t.texto)
        if len(s) > 60 or TITULO.match(s):
            continue
        m = _IGUAL.search(s)
        m_un = _NUM_UNID.search(s)
        if m:
            valor, un = numero(m.group(1)), (m.group(2) or (m_un.group(2) if m_un else None))
        elif m_un and m_un.start() <= 1:
            valor, un = numero(m_un.group(1)), m_un.group(2)
        else:
            continue
        if valor is None or not un:
            continue
        unidade = UNIDADES.get(un.lower(), un)
        h = t.h or 1
        acima = [r for r in textos if r is not t and 0 < r.y - t.y <= 3 * h and abs(r.x - t.x) <= 12 * h
                 and not _NUM_UNID.search(limpar(r.texto)[:2])]
        rot = min(acima, key=lambda r: (r.y - t.y) + abs(r.x - t.x) / 4, default=None)
        rotulo = limpar(rot.texto) if rot else f"anotação em {unidade}"
        out.append(Extraida(
            origem="anotacao", chave=f"{_sem_acento(rotulo)[:60]} [{unidade}]", descricao=f"{rotulo}: {s}"[:300],
            quantidade=valor, unidade=unidade, formula="valor escrito no desenho" + (" (resultado da conta anotada)" if m else ""),
            passos=((rotulo, s, f"{num(valor)} {unidade}"),),
            fontes=(("texto do desenho", s, f"camada {t.camada} (x {num(t.x, 0)}, y {num(t.y, 0)})"),)))
    return _unicas(out)


# ---- medições por camada e blocos ------------------------------------------------------------------------------------

def ler_medidas(medidas: list[Medida], blocos: dict[str, int], insunits: int | None) -> list[Extraida]:
    und = UNIDADE_DESENHO.get(insunits or 0)
    aviso = (f"unidade declarada no desenho: {und} — confira a escala e informe o fator ao aceitar" if und
             else "o desenho não declara a unidade — informe o fator ao aceitar")
    u = und or "un. desenho"
    out = []
    for m in sorted(medidas, key=lambda m: m.camada):
        if m.comprimento > 0:
            out.append(Extraida(origem="camada", chave=f"camada {m.camada} · comprimento", descricao=f"Comprimento na camada {m.camada}",
                                quantidade=round(m.comprimento, 3), unidade=u, formula="Σ comprimento de linhas, polilinhas e arcos da camada",
                                fontes=(("camada", m.camada, f"{m.entidades} entidades no modelo"),), avisos=(aviso,)))
        if m.area > 0:
            out.append(Extraida(origem="camada", chave=f"camada {m.camada} · área", descricao=f"Área fechada na camada {m.camada}",
                                quantidade=round(m.area, 3), unidade=f"{u}²" if und else u,
                                formula="Σ área de polilinhas fechadas e hachuras da camada",
                                fontes=(("camada", m.camada, f"{m.entidades} entidades no modelo"),), avisos=(aviso,)))
    for nome, n in sorted(blocos.items()):
        out.append(Extraida(origem="bloco", chave=f"bloco {nome}", descricao=f"Bloco {nome}", quantidade=float(n), unidade="un",
                            formula="contagem das inserções do bloco no modelo", fontes=(("bloco", nome, f"{n} inserções"),)))
    return out


def _unicas(xs: list[Extraida]) -> list[Extraida]:
    """Mesma chave duas vezes (dois quadros iguais em cortes diferentes) ganha #2, #3 — a chave segue estável."""
    vistos: dict[str, int] = defaultdict(int)
    out = []
    for e in xs:
        vistos[e.chave] += 1
        out.append(e if vistos[e.chave] == 1 else Extraida(**{**e.__dict__, "chave": f"{e.chave} #{vistos[e.chave]}"}))
    return out


def extrair(textos: list[Texto], medidas: list[Medida] | None = None, blocos: dict[str, int] | None = None,
            insunits: int | None = None) -> list[Extraida]:
    quadros_q, quadros = ler_quadros(textos)
    return quadros_q + ler_anotacoes(textos, quadros) + ler_medidas(medidas or [], blocos or {}, insunits)


# ---- comparação, ordem e sugestão --------------------------------------------------------------------------------------------

def _un(u: str | None) -> str:
    u = (u or "").strip().lower().replace("²", "2").replace("³", "3").replace(".", "")
    return {"ml": "m", "un": "un", "und": "un", "pc": "un", "pç": "un", "peca": "un", "peça": "un", "ton": "t"}.get(u, u)


def fator_de_conversao(unidade_desenho: str, unidade_item: str | None) -> float | None:
    """Fator para levar a quantidade do desenho à unidade do item da PQ; None = unidades que não se convertem."""
    a, b = _un(unidade_desenho), _un(unidade_item)
    if not b or a == b:
        return 1.0
    return {("kg", "t"): 0.001, ("t", "kg"): 1000.0, ("cm", "m"): 0.01, ("mm", "m"): 0.001}.get((a, b))


def ordem_natural(chave: str) -> tuple:
    """'aço CA50 Ø6,3' antes de 'aço CA50 Ø10' (números pelo valor)."""
    partes = re.split(r"(\d+(?:,\d+)?)", chave)
    return tuple((0, float(p.replace(",", "."))) if re.fullmatch(r"\d+(?:,\d+)?", p) else (1, p.lower()) for p in partes if p)


def delta(atual: float, anterior: float | None) -> float | None:
    return None if anterior is None else round(atual - anterior, 4)


_PALAVRAS_ACO = ("ACO", "ARMACAO", "ARMADURA", "CA-50", "CA50", "CA-60", "CA60", "VERGALHAO")


def _tokens(t: str) -> set[str]:
    return {w for w in re.findall(r"[A-Z0-9]{3,}", _sem_acento(t)) if w not in {"PARA", "COM", "DOS", "DAS", "DE"}}


def sugerir_item(e_descricao: str, e_unidade: str, itens: list[tuple[str, str, str | None]]) -> str | None:
    """Item da PQ mais parecido (descrição + unidade igual). Só sugere: o planejador confirma (mesma regra da spec 083)."""
    alvo = _sem_acento(e_descricao)
    un = (e_unidade or "").lower().replace("²", "2").replace("³", "3")
    melhor, nota_m = None, 0.0
    tk = _tokens(e_descricao)
    for item, descricao, unid in itens:
        u = (unid or "").lower().replace("²", "2").replace("³", "3")
        if un and u and u != un:
            continue
        d = _sem_acento(descricao)
        nota = len(tk & _tokens(descricao))
        if alvo.startswith("ACO") and any(p in d for p in _PALAVRAS_ACO):
            nota += 3
            if "CA60" in alvo.replace("-", "") and "CA60" in d.replace("-", ""):
                nota += 1
            if "CA50" in alvo.replace("-", "") and "CA50" in d.replace("-", ""):
                nota += 1
        if "FORMA" in alvo and "FORMA" in d:
            nota += 3
        if nota > nota_m:
            melhor, nota_m = item, nota
    return melhor if nota_m >= 2 else None
