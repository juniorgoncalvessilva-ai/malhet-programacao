"""Aderência física e financeira da programação semanal (spec 104).

Financeiro de uma linha = quantidade × PU do item da PQ (etapa do critério: PU × peso; sem avanço = 0). Por responsável
(o "engenheiro" da apresentação) e por semana:
- programado = Σ previsto × PU · realizado = Σ realizado × PU · saldo = realizado − programado · aderência = realizado ÷ programado;
- físico: atividades cumpridas (realizado ≥ previsto) ÷ atividades programadas.
Semanas sem programação no sistema entram pelo histórico (valores da apresentação anterior, tomados como reais).
A semana N mostra: as anteriores (até N−2, por responsável), o ranking acumulado, a semana anterior (N−1) e a meta da
semana N (financeira, avanço previsto sobre o valor do contrato, distribuição e marcos prioritários).
Só regra aqui: sem banco, sem arquivo.
"""
import re
import unicodedata
from dataclasses import dataclass, field

from app.shared.errors import DomainError

SEM_RESPONSAVEL = "Sem responsável"


# ---------------------------------------------------------------- formatação (padrão das apresentações)
def brl(v: float | None, sinal: bool = False) -> str:
    """1234.5 → "R$ 1.234,50"; com sinal: "- R$ 1.234,50" / "+ R$ 1.234,50"."""
    if v is None:
        return "—"
    s = f"{abs(v):,.2f}".replace(",", "§").replace(".", ",").replace("§", ".")
    if not sinal:
        return f"{'-' if v < 0 else ''}R$ {s}" if v < 0 else f"R$ {s}"
    return f"{'- ' if v < 0 else '+ '}R$ {s}"


def pct(v: float | None, casas: int = 2) -> str:
    if v is None:
        return "—"
    return f"{v * 100:.{casas}f}%".replace(".", ",")


def chave_nome(nome: str | None) -> str:
    """GILBERTO CASSIMIRO FERREIRA = Gilberto Cassimiro Ferreira (sem acento, maiúsculo, espaços únicos)."""
    t = unicodedata.normalize("NFKD", nome or "").encode("ascii", "ignore").decode().upper()
    return " ".join(re.sub(r"[^A-Z0-9/ ]", " ", t).split())


def nome_exibicao(nome: str) -> str:
    """Nome do responsável como na apresentação: só a 1ª letra de cada palavra maiúscula (de/da/do minúsculos)."""
    pequenas = {"de", "da", "do", "das", "dos", "e"}
    ps = " ".join(nome.split()).lower().split(" ")
    return " ".join(p if (i and p in pequenas) else p[:1].upper() + p[1:] for i, p in enumerate(ps))


def ader(programado: float | None, realizado: float | None) -> float | None:
    if realizado is None or not programado:
        return None
    return realizado / programado


# ---------------------------------------------------------------- registros por semana × responsável
@dataclass(frozen=True)
class Registro:
    semana: int
    responsavel: str
    programado: float
    realizado: float | None = None  # None = ainda sem realizado (só a meta)
    origem: str = "sistema"  # sistema | historico
    atividades: int = 0  # físico: programadas
    cumpridas: int = 0  # físico: realizado ≥ previsto

    def __post_init__(self):
        if self.semana < 1 or self.semana > 999:
            raise DomainError("semana inválida", "semana")
        if not (self.responsavel or "").strip():
            raise DomainError("responsável vazio", "responsavel")
        if self.programado < 0 or (self.realizado is not None and self.realizado < 0):
            raise DomainError("valor negativo", "programado")


def _soma(regs: list[Registro]) -> dict:
    p = sum(r.programado for r in regs)
    tem_real = any(r.realizado is not None for r in regs)
    rr = sum(r.realizado or 0 for r in regs) if tem_real else None
    at, cu = sum(r.atividades for r in regs), sum(r.cumpridas for r in regs)
    return {"programado": round(p, 2), "realizado": round(rr, 2) if rr is not None else None,
            "saldo": round(rr - p, 2) if rr is not None else None, "aderencia": ader(p, rr),
            "atividades": at, "cumpridas": cu, "fisica": (cu / at) if at else None}


def _agrupar(regs: list[Registro]) -> dict[str, list[Registro]]:
    """Por responsável (nome normalizado), mantendo o nome mais "bonito" (com minúsculas) para exibir."""
    out: dict[str, list[Registro]] = {}
    for r in regs:
        out.setdefault(chave_nome(r.responsavel), []).append(r)
    return out


def _rotulo(regs: list[Registro]) -> str:
    nomes = [r.responsavel for r in regs]
    return next((n for n in nomes if n != n.upper()), nome_exibicao(nomes[0]))


@dataclass(frozen=True)
class Painel:
    semana: int
    anteriores: dict = field(default_factory=dict)
    ranking: dict = field(default_factory=dict)
    anterior: dict = field(default_factory=dict)


def montar_painel(regs: list[Registro], semana: int, ultimas: int = 4) -> Painel:
    """Semanas anteriores (≤ N−2), ranking acumulado delas e a semana anterior (N−1)."""
    ant = [r for r in regs if r.semana <= semana - 2 and r.realizado is not None]
    semanas = sorted({r.semana for r in ant})
    mostradas = semanas[-ultimas:]
    blocos = []
    for k, lst in _agrupar(ant).items():
        por_sem = {s: _soma([r for r in lst if r.semana == s]) for s in mostradas}
        blocos.append({"responsavel": _rotulo(lst), "chave": k,
                       "linhas": [{"semana": s, **por_sem[s]} for s in mostradas if por_sem[s]["programado"] or por_sem[s]["realizado"]],
                       "total": _soma(lst)})
    blocos.sort(key=lambda b: -b["total"]["programado"])
    for i, b in enumerate(blocos, 1):
        b["posicao"] = i
    geral = _soma(ant)
    anteriores = {"semanas": semanas, "mostradas": mostradas, "blocos": blocos, "geral": geral}
    ranking = {"semanas": semanas, "itens": [{"posicao": b["posicao"], "responsavel": b["responsavel"], **b["total"]} for b in blocos],
               "geral": geral}
    ult = [r for r in regs if r.semana == semana - 1]
    linhas = sorted(({"responsavel": _rotulo(lst), **_soma(lst)} for lst in _agrupar(ult).values()),
                    key=lambda x: -x["programado"])
    tot = _soma(ult)
    anterior = {"semana": semana - 1, "itens": linhas, **tot,
                "desvio": tot["saldo"], "origem": sorted({r.origem for r in ult})}
    return Painel(semana, anteriores, ranking, anterior)


# ---------------------------------------------------------------- meta da semana e marcos
@dataclass(frozen=True)
class Atividade:
    responsavel: str
    frente: str  # Local / Área da programação
    descricao: str
    valor: float  # previsto × PU


def marcos(atividades: list[Atividade], meta: float, alvo: float = 0.8, maximo: int = 8) -> dict:
    """Marcos prioritários: as atividades de maior valor até cobrir `alvo` da meta (no máximo `maximo`), na ordem da frente."""
    ordem = sorted((a for a in atividades if a.valor > 0), key=lambda a: -a.valor)
    escolhidas, soma = [], 0.0
    for a in ordem:
        if len(escolhidas) >= maximo or (meta and soma >= alvo * meta):
            break
        escolhidas.append(a)
        soma += a.valor
    pos = {id(a): i for i, a in enumerate(atividades)}
    escolhidas.sort(key=lambda a: (a.frente, pos[id(a)]))
    return {"itens": [{"frente": a.frente, "descricao": a.descricao, "valor": round(a.valor, 2)} for a in escolhidas],
            "total": round(soma, 2), "representatividade": (soma / meta) if meta else None}


def meta_da_semana(atividades: list[Atividade], valor_contrato: float | None) -> dict:
    """Meta financeira da semana N, a participação e o avanço previsto (meta ÷ valor do contrato) de cada responsável."""
    total = sum(a.valor for a in atividades)
    por: dict[str, list[Atividade]] = {}
    for a in atividades:
        por.setdefault(chave_nome(a.responsavel), []).append(a)
    itens = []
    for lst in por.values():
        meta = sum(a.valor for a in lst)
        frentes = list(dict.fromkeys(a.frente for a in lst))
        nome = next((a.responsavel for a in lst if a.responsavel != a.responsavel.upper()), nome_exibicao(lst[0].responsavel))
        itens.append({"responsavel": nome, "frentes": frentes, "meta": round(meta, 2),
                      "participacao": (meta / total) if total else None,
                      "avanco": (meta / valor_contrato) if valor_contrato else None,
                      "marcos": marcos(lst, meta)})
    itens.sort(key=lambda x: -x["meta"])
    return {"meta": round(total, 2), "valor_contrato": valor_contrato,
            "avanco": (total / valor_contrato) if valor_contrato else None, "itens": itens}


# ---------------------------------------------------------------- leitura da apresentação anterior
@dataclass(frozen=True)
class Texto:
    x: float  # cm
    y: float
    texto: str


_DINHEIRO = re.compile(r"^([+-])?\s*R\$\s*([\d.]+,\d{2})$")
_SEMANA = re.compile(r"Semanas?\s+(\d{1,3})\b", re.I)


def dinheiro(t: str) -> float | None:
    m = _DINHEIRO.match(" ".join(t.split()))
    if not m:
        return None
    v = float(m.group(2).replace(".", "").replace(",", "."))
    return -v if m.group(1) == "-" else v


def _linhas(textos: list[Texto], tol: float = 0.35) -> list[list[Texto]]:
    out: list[list[Texto]] = []
    for t in sorted(textos, key=lambda t: (t.y, t.x)):
        if out and abs(out[-1][0].y - t.y) <= tol:
            out[-1].append(t)
        else:
            out.append([t])
    return [sorted(ln, key=lambda t: t.x) for ln in out]


def ler_historico(slides: list[list[Texto]]) -> list[Registro]:
    """Valores das semanas que a apresentação anterior traz (tomados como reais):
    - blocos por responsável ("1º  NOME" + linhas "S27 | programado | realizado | saldo | ader.");
    - a semana anterior ("Semana 31" + RESPONSÁVEL | PLANEJADO | REALIZADO);
    - a meta da semana ("Semana 32" + META FINANCEIRA): só o programado.
    A mesma semana × responsável aparece uma vez (a primeira leitura vale)."""
    vistos: dict[tuple[int, str], Registro] = {}

    def guardar(r: Registro) -> None:
        vistos.setdefault((r.semana, chave_nome(r.responsavel)), r)

    for textos in slides:
        textos = [t for t in textos if t.texto.strip()]
        tudo = " ".join(t.texto for t in textos).upper()
        # blocos por responsável
        cabecalhos = [(t, m.group(1)) for t in textos if (m := re.match(r"^\s*\d+\s*º\s+(.+?)\s*$", t.texto)) and not dinheiro(t.texto)]
        if cabecalhos:
            for ln in _linhas(textos):
                # blocos lado a lado caem na mesma linha: cada "S27" abre um trecho com os valores que vêm depois dele
                trechos: list[tuple[Texto, int, list[float]]] = []
                for t in ln:
                    m = re.match(r"^S(\d{1,3})$", t.texto.strip())
                    if m:
                        trechos.append((t, int(m.group(1)), []))
                    elif trechos and (v := dinheiro(t.texto)) is not None:
                        trechos[-1][2].append(v)
                for t0, n, valores in trechos:
                    acima = [(t, nm) for t, nm in cabecalhos if t.y < t0.y and abs(t.x - t0.x) < 3]
                    if len(valores) >= 2 and acima:
                        nome = max(acima, key=lambda c: c[0].y)[1]
                        guardar(Registro(n, nome, valores[0], valores[1], "historico"))
            continue
        sem = _SEMANA.search(" ".join(t.texto for t in textos if "SEMANA" in t.texto.upper() and "•" in t.texto) or tudo)
        if not sem:
            continue
        n = int(sem.group(1))
        celulas = {chave_nome(t.texto) for t in textos}
        meta = "META FINANCEIRA" in celulas  # cabeçalho da coluna (os marcos citam "meta financeira" no texto)
        if not meta and not ({"PLANEJADO", "REALIZADO"} <= celulas):
            continue
        for ln in _linhas(textos):
            nomes = [t for t in ln if re.search(r"[A-Za-zÀ-ú]{3}", t.texto) and dinheiro(t.texto) is None and "%" not in t.texto]
            valores = [v for v in (dinheiro(t.texto) for t in ln) if v is not None]
            if not nomes or not valores:
                continue
            nome = nomes[0].texto.strip()
            if chave_nome(nome) in ("RESPONSAVEL", "RESPONSAVEL / FRENTE", "TOTAL DOS MARCOS") or nome.isupper() and len(nome.split()) < 2:
                continue
            if meta:
                guardar(Registro(n, nome, valores[0], None, "historico"))
            elif len(valores) >= 2:
                guardar(Registro(n, nome, valores[0], valores[1], "historico"))
    return sorted(vistos.values(), key=lambda r: (r.semana, chave_nome(r.responsavel)))
