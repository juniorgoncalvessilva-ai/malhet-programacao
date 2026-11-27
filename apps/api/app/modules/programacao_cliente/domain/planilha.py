"""Programação semanal do cliente (spec 146): leitura da planilha no layout da obra ("Programação Semanal - S34", o mesmo do
Excel que o Malhet exporta — `planejamento/application/exportar_cliente.py`).

O cabeçalho é achado pelo nome (não pela letra da coluna): Item, ID Cronograma, Programada/Oportunidade/Emergencial,
Atividade Detalhada, Tipo, Local, CWA, SSMA (técnico, RAC, PTS, ART, PTO, ATA), Responsável, Encarregado, Und., Projeto,
Realizado, Restante, Recursos/Oficiais/Servente/equipamentos, (P)rev./(R)eal, um dia por coluna, ITEM PQ e PU. Cada
atividade ocupa duas linhas: P (previsto) e R (realizado). Linhas sem P/R são títulos: com número no Item = grupo (área,
"CWA 020.01 - YY-1600AA-06 - …"), começando com "CWP" = CWP, sem número = seção. Contas próprias da planilha (peso,
faturamento, aderência) não são lidas: o Malhet calcula as dele.
"""
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date, datetime
from io import BytesIO

from app.shared.errors import DomainError

MAX_LINHAS = 3000


def norm(t) -> str:
    """Sem acento, minúsculo, espaços simples."""
    s = unicodedata.normalize("NFKD", str(t or "")).encode("ascii", "ignore").decode().casefold()
    return " ".join(s.replace("\n", " ").split())


def _txt(v) -> str | None:
    s = " ".join(str(v).split()) if v is not None else ""
    return s if s and s not in ("-", "—", "–") else None


def _num(v) -> float | None:
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace(" ", "")
    if not s or s in ("-", "—"):
        return None
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def _data(v) -> date | None:
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    return None


RE_CODIGO = re.compile(r"^\s*(\d+(?:\.\d+)+)\s+-\s+(.+)$", re.S)  # "9.1.1 - Escavação…" (código do catálogo, exportado pelo Malhet)
RE_CWA = re.compile(r"\bCWA\s+(\d+(?:\.\d+)*)", re.I)
RE_TAG = re.compile(r"\b([A-Z]{2}-\d{3,4}[A-Z]{1,3}(?:-\d+)?)\b")
RE_CWP = re.compile(r"^\s*CWP\s+(?:(\d[\d.]*-\d+)\s*[·\-–]\s*)?(.+)$", re.I)


def separar_codigo(descricao: str) -> tuple[str | None, str]:
    m = RE_CODIGO.match(descricao or "")
    return (m.group(1), m.group(2).strip()) if m else (None, (descricao or "").strip())


def cwa_do_titulo(titulo: str | None) -> tuple[str | None, str | None]:
    """"CWA 020.01 - YY-1600AA-06 - Pavimento…" → ("020.01", "YY-1600AA-06")."""
    if not titulo:
        return None, None
    m, t = RE_CWA.search(titulo), RE_TAG.search(titulo)
    return (m.group(1) if m else None), (t.group(1) if t else None)


def cwp_do_titulo(titulo: str) -> tuple[str | None, str]:
    m = RE_CWP.match(titulo)
    return (m.group(1), m.group(2).strip()) if m else (None, titulo.strip())


def lista_ssma(v) -> tuple[str, ...]:
    """Vários itens vêm separados por " / " (como o Malhet exporta); "RAC 03/07" é um item só."""
    t = _txt(v)
    if not t:
        return ()
    return tuple(x.strip() for x in re.split(r"\s+/\s+|;|\n", t) if x.strip())


def encarregados(v) -> tuple[str, ...]:
    """"Clayton Angelo Gonçalves/ Damião" → dois nomes."""
    t = _txt(v)
    return tuple(x.strip() for x in re.split(r"[/;]", t) if x.strip()) if t else ()


def natureza(v) -> str:
    t = (_txt(v) or "P")[:1].upper()
    return t if t in ("P", "O", "E") else "P"


@dataclass(frozen=True)
class LinhaPlanilha:
    linha: int  # nº da linha no Excel (a da P)
    descricao: str
    natureza: str = "P"
    item: str | None = None
    id_crono: str | None = None
    codigo_simova: str | None = None  # "9.1.1" quando a planilha veio do Malhet
    tipo: str | None = None
    local: str | None = None
    cwa: str | None = None
    secao: str | None = None
    grupo: str | None = None
    grupo_cwa: str | None = None
    grupo_tag: str | None = None
    cwp_codigo: str | None = None
    cwp: str | None = None
    ssma: dict = field(default_factory=dict)  # tecnico (texto) e rac/pts/art/pto/ata (listas)
    responsavel: str | None = None
    encarregados: tuple[str, ...] = ()
    unidade: str | None = None
    qtd_projeto: float | None = None
    realizado_acumulado: float | None = None
    restante: float | None = None
    recursos: dict = field(default_factory=dict)  # oficiais, servente, equipamentos {nome: qtd}
    previsto: dict = field(default_factory=dict)  # "AAAA-MM-DD" → qtd
    realizado: dict = field(default_factory=dict)
    item_pq: str | None = None
    pu: float | None = None

    @property
    def total_previsto(self) -> float:
        return round(sum(self.previsto.values()), 6)

    @property
    def total_realizado(self) -> float:
        return round(sum(self.realizado.values()), 6)

    def como_dict(self) -> dict:
        d = {k: getattr(self, k) for k in self.__dataclass_fields__}
        d["encarregados"] = list(self.encarregados)
        d["total_previsto"], d["total_realizado"] = self.total_previsto, self.total_realizado
        return d


@dataclass(frozen=True)
class PlanilhaSemanal:
    aba: str
    abas: tuple[dict, ...]  # as abas de programação do arquivo (nome, visível)
    titulo: str | None
    dias: tuple[date, ...]
    linhas: tuple[LinhaPlanilha, ...]
    avisos: tuple[str, ...] = ()

    @property
    def inicio(self) -> date:
        return self.dias[0]

    @property
    def fim(self) -> date:
        return self.dias[-1]


# ---- cabeçalho -----------------------------------------------------------------------------------------------------
CHAVES = (  # (campo, teste no texto normalizado do cabeçalho)
    ("item", lambda t: t == "item"),
    ("id_crono", lambda t: t.startswith("id cronograma") or t == "id"),
    ("natureza", lambda t: t.startswith("programada")),
    ("descricao", lambda t: t.startswith("atividade")),
    ("tipo", lambda t: t == "tipo"),
    ("local", lambda t: t == "local"),
    ("cwa", lambda t: t == "cwa"),
    ("tecnico", lambda t: t.startswith("tecnico de seguranca")),
    ("rac", lambda t: t == "rac"),
    ("pts", lambda t: t == "pts"),
    ("art", lambda t: t == "art"),
    ("pto", lambda t: "(pto)" in t or t == "pto"),
    ("ata", lambda t: "(ata)" in t or t == "ata"),
    ("responsavel", lambda t: t == "responsavel"),
    ("encarregado", lambda t: t.startswith("encarregado")),
    ("unidade", lambda t: t in ("und.", "und", "unid.", "unidade", "un")),
    ("projeto", lambda t: t == "projeto"),
    ("realizado", lambda t: t == "realizado"),
    ("restante", lambda t: t == "restante"),
    ("recursos", lambda t: t == "recursos"),
    ("oficiais", lambda t: t == "oficiais"),
    ("servente", lambda t: t == "servente"),
    ("pr", lambda t: t.startswith("(p)rev")),
    ("total", lambda t: t.startswith("total sem") or t.startswith("total mes")),
    ("item_pq", lambda t: t == "item pq"),
    ("pu", lambda t: t == "pu"),
)


def _achar_cabecalho(linhas: list[tuple]) -> int | None:
    for i, r in enumerate(linhas[:40]):
        ts = {norm(c) for c in r if c is not None}
        if any(t.startswith("atividade") for t in ts) and any(t.startswith("id cronograma") for t in ts):
            return i
    return None


def _mapa(linhas: list[tuple], cab: int) -> tuple[dict[str, int], dict[int, date], dict[int, str]]:
    col: dict[str, int] = {}
    for r in linhas[cab:cab + 5]:  # o cabeçalho ocupa até 5 linhas (SSMA e dias embaixo)
        for j, c in enumerate(r):
            t = norm(c)
            if not t:
                continue
            for campo, ok in CHAVES:
                if campo not in col and ok(t):
                    col[campo] = j
                    break
    if "descricao" not in col or "pr" not in col:
        raise DomainError("não achei as colunas 'Atividade Detalhada' e '(P)rev. (R)eal' na aba", "arquivo")
    dias: dict[int, date] = {}
    fim_dias = col.get("total", 10 ** 6)
    for r in linhas[cab:cab + 5]:
        for j, c in enumerate(r):
            if col["pr"] < j < fim_dias and (d := _data(c)) is not None:
                dias.setdefault(j, d)
    equip: dict[int, str] = {}
    if "servente" in col:
        for j in range(col["servente"] + 1, col["pr"] + 1):
            t = _txt(linhas[cab][j]) if j < len(linhas[cab]) else None
            if t and not norm(t).startswith(("chuva", "(p)rev")):
                equip[j] = t
    return col, dict(sorted(dias.items())), equip


def _cel(r: tuple, col: dict[str, int], campo: str):
    j = col.get(campo)
    return r[j] if j is not None and j < len(r) else None


def abas_de_programacao(wb) -> list[dict]:
    out = []
    for ws in wb.worksheets:
        if "program" not in norm(ws.title):
            continue
        out.append({"nome": ws.title, "visivel": ws.sheet_state == "visible"})
    return out


def ler(dados: bytes, aba: str | None = None) -> PlanilhaSemanal:
    from openpyxl import load_workbook

    try:
        wb = load_workbook(BytesIO(dados), data_only=True, read_only=True)
    except Exception as e:  # noqa: BLE001 — arquivo que não é Excel
        raise DomainError(f"não consegui abrir a planilha ({type(e).__name__})", "arquivo") from e
    abas = abas_de_programacao(wb)
    if aba:
        if aba not in wb.sheetnames:
            raise DomainError(f"a aba '{aba}' não está no arquivo", "aba")
        ws = wb[aba]
    else:
        candidatas = [a for a in abas if a["visivel"]] or abas
        if not candidatas:
            raise DomainError("nenhuma aba de programação no arquivo (nome com 'Programação')", "arquivo")
        ws = wb[candidatas[0]["nome"]]
        if len(candidatas) > 1:  # mais de uma visível: a da semana mais recente
            def ultimo_dia(nome: str) -> date:
                ls = list(wb[nome].iter_rows(max_row=40, values_only=True))
                cab = _achar_cabecalho(ls)
                if cab is None:
                    return date.min
                try:
                    return max(_mapa(ls, cab)[1].values(), default=date.min)
                except DomainError:
                    return date.min
            ws = wb[max((a["nome"] for a in candidatas), key=ultimo_dia)]
    linhas = list(ws.iter_rows(values_only=True, max_row=MAX_LINHAS))
    cab = _achar_cabecalho(linhas)
    if cab is None:
        raise DomainError(f"aba '{ws.title}': não achei o cabeçalho (Atividade Detalhada, ID Cronograma)", "arquivo")
    col, dias_col, equip = _mapa(linhas, cab)
    if not dias_col:
        raise DomainError(f"aba '{ws.title}': não achei as datas dos dias depois de (P)rev./(R)eal", "arquivo")
    textos = [t for r in linhas[:cab] for c in r if isinstance(c, str) and (t := _txt(c))]
    titulo = max(textos, key=len, default=None)  # o nome da obra/contrato no topo

    out: list[LinhaPlanilha] = []
    avisos: list[str] = []
    secao = grupo = cwp = cwp_cod = g_cwa = g_tag = None
    ultima: dict | None = None
    for i in range(cab + 1, len(linhas)):
        r = linhas[i]
        if not r:
            continue
        nr = i + 1
        pr = norm(_cel(r, col, "pr"))[:1]
        desc = _txt(_cel(r, col, "descricao"))
        if pr == "r":
            if ultima is not None and ultima["linha"] == nr - 1:
                ultima["realizado"] = {d.isoformat(): q for j, d in dias_col.items()
                                       if (q := _num(r[j] if j < len(r) else None))}
            continue
        if pr == "p" and desc:
            if ultima is not None:
                out.append(LinhaPlanilha(**ultima))
            codigo, texto = separar_codigo(desc)
            ss = {"tecnico": _txt(_cel(r, col, "tecnico"))}
            for k in ("rac", "pts", "art", "pto", "ata"):
                ss[k] = list(lista_ssma(_cel(r, col, k)))
            rec = {"oficiais": _num(_cel(r, col, "oficiais")), "servente": _num(_cel(r, col, "servente")),
                   "equipamentos": {nome: q for j, nome in equip.items() if (q := _num(r[j] if j < len(r) else None))}}
            ultima = dict(
                linha=nr, descricao=texto[:400], codigo_simova=codigo, natureza=natureza(_cel(r, col, "natureza")),
                item=_txt(_cel(r, col, "item")), id_crono=_txt(_cel(r, col, "id_crono")), tipo=_txt(_cel(r, col, "tipo")),
                local=_txt(_cel(r, col, "local")), cwa=_txt(_cel(r, col, "cwa")), secao=secao, grupo=grupo,
                grupo_cwa=g_cwa, grupo_tag=g_tag, cwp=cwp, cwp_codigo=cwp_cod, ssma=ss,
                responsavel=_txt(_cel(r, col, "responsavel")), encarregados=encarregados(_cel(r, col, "encarregado")),
                unidade=_txt(_cel(r, col, "unidade")), qtd_projeto=_num(_cel(r, col, "projeto")),
                realizado_acumulado=_num(_cel(r, col, "realizado")), restante=_num(_cel(r, col, "restante")), recursos=rec,
                previsto={d.isoformat(): q for j, d in dias_col.items() if (q := _num(r[j] if j < len(r) else None))},
                realizado={}, item_pq=_txt(_cel(r, col, "item_pq")), pu=_num(_cel(r, col, "pu")))
            if any(q < 0 for q in ultima["previsto"].values()):
                avisos.append(f"linha {nr}: previsto negativo ignorado")
                ultima["previsto"] = {k: v for k, v in ultima["previsto"].items() if v > 0}
            continue
        if desc and not pr:  # título
            item = _cel(r, col, "item")
            if desc.upper().startswith("CWP"):
                cwp_cod, cwp = cwp_do_titulo(desc)
            elif item is not None and _num(item) is not None and float(_num(item)).is_integer():
                grupo, cwp, cwp_cod = desc, None, None
                g_cwa, g_tag = cwa_do_titulo(desc)
            else:
                secao = desc
    if ultima is not None:
        out.append(LinhaPlanilha(**ultima))
    if not out:
        raise DomainError(f"aba '{ws.title}': nenhuma atividade (linha P) encontrada", "arquivo")
    return PlanilhaSemanal(aba=ws.title, abas=tuple(abas), titulo=titulo, dias=tuple(dias_col.values()), linhas=tuple(out),
                           avisos=tuple(avisos))
