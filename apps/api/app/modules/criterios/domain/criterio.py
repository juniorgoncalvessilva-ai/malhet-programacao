"""Critério de avanço / medição (spec 079): cada item da PQ mede por etapas com o seu peso no valor do item.

Planilha do cliente (aba "CRITÉRIO DE MEDIÇÃO"):
    CRITÉRIO MEDIÇÃO | DESCRITIVO DO CRITÉRIO | ETAPAS | DESCRITIVO DA ETAPA | DESCRITIVO DOCUMENTO | PERCENTUAL CORRESPONDENTE
O descritivo começa pelo item da PQ ("23.1 ESTRUTURA METÁLICA…"): o critério vale para esse item e os de baixo
(23.1.1, 23.1.2…). O mesmo código CMS pode aparecer em itens diferentes — a chave é código + item.

Etapa **sem avanço**: esforço que não mede (ex.: pré-armação do aço fora do local de montagem). Entra na programação,
conta HH e capacidade, mas vale 0% do item — não soma avanço físico nem faturamento.
"""
import re
from dataclasses import dataclass, field

from app.shared.errors import DomainError

_ITEM = re.compile(r"^\s*(\d+(?:\.\d+)*)\.?\s*")
COLUNAS = ("CRITÉRIO MEDIÇÃO", "DESCRITIVO DO CRITÉRIO", "ETAPAS", "DESCRITIVO DA ETAPA", "DESCRITIVO DOCUMENTO", "PERCENTUAL CORRESPONDENTE")


def separar_item(descritivo: str | None) -> tuple[str | None, str]:
    """'23.1\\tESTRUTURA METÁLICA' → ('23.1', 'ESTRUTURA METÁLICA')."""
    t = " ".join((descritivo or "").replace("\t", " ").split())
    m = _ITEM.match(t)
    if not m:
        return None, t
    return m.group(1), t[m.end():].strip() or t


def percentual(v) -> float:
    """0,4 · 40 · '40%' → 0.4 (fração do valor do item)."""
    if v is None or v == "":
        return 0.0
    if isinstance(v, str):
        v = v.replace("%", "").replace(",", ".").strip()
    try:
        x = float(v)
    except (TypeError, ValueError):
        raise DomainError(f"percentual inválido: {v}", "percentual") from None
    if x > 1.0001:
        x = x / 100
    if x < 0 or x > 1.0001:
        raise DomainError("percentual entre 0% e 100%", "percentual")
    return round(x, 6)


@dataclass(frozen=True)
class Etapa:
    numero: int
    nome: str
    percentual: float
    sem_avanco: bool = False
    documento: str | None = None

    def __post_init__(self):
        if not self.nome or len(self.nome) > 120:
            raise DomainError("etapa: nome de 1 a 120 caracteres", "nome")
        if self.sem_avanco and self.percentual:
            raise DomainError(f"a etapa “{self.nome}” é sem avanço: o percentual dela é 0%", "percentual")


@dataclass
class CriterioLido:
    codigo: str
    item_pq: str | None
    descricao: str
    etapas: list[Etapa] = field(default_factory=list)


def soma(etapas: list[Etapa] | list[dict]) -> float:
    return round(sum((e.percentual if isinstance(e, Etapa) else e["percentual"]) or 0 for e in etapas), 6)


def ler_planilha(linhas: list[tuple]) -> tuple[list[CriterioLido], list[str]]:
    """Linhas da aba (sem o cabeçalho) → critérios com as etapas na ordem; avisos do que não fecha 100%."""
    out: dict[tuple[str, str | None], CriterioLido] = {}
    avisos: list[str] = []
    for n, r in enumerate(linhas, start=2):
        r = tuple(r) + (None,) * 6
        codigo = " ".join(str(r[0] or "").split())
        if not codigo:
            continue
        item, desc = separar_item(r[1])
        k = (codigo, item)
        cr = out.setdefault(k, CriterioLido(codigo, item, desc))
        if r[2] in (None, "") and not r[3]:
            continue  # critério sem etapas na planilha
        try:
            num = int(float(r[2])) if r[2] not in (None, "") else len(cr.etapas) + 1
            cr.etapas.append(Etapa(num, " ".join(str(r[3] or f"Etapa {num}").split())[:120], percentual(r[5]),
                                   documento=(str(r[4]).strip() or None) if r[4] else None))
        except DomainError as e:
            avisos.append(f"linha {n}: {e.mensagem}")
    for cr in out.values():
        cr.etapas.sort(key=lambda e: e.numero)
        tot = soma(cr.etapas)
        if cr.etapas and abs(tot - 1) > 0.001:
            avisos.append(f"{cr.codigo} · item {cr.item_pq or '?'}: etapas somam {round(tot * 100, 1):g}% (o esperado é 100%)")
    return list(out.values()), avisos


def criterio_do_item(item_pq: str | None, prefixos: list[str]) -> str | None:
    """O critério que vale para o item: o item da PQ mais específico que o contém (23.1.2 → 23.1)."""
    if not item_pq:
        return None
    melhor = None
    for p in prefixos:
        if p and (item_pq == p or item_pq.startswith(p + ".")) and (melhor is None or len(p) > len(melhor)):
            melhor = p
    return melhor


def pu_da_etapa(pu: float | None, pct: float | None, sem_avanco: bool) -> float | None:
    """Valor unitário que a etapa representa: PU do item × peso da etapa; sem avanço = 0 (só esforço)."""
    if pu is None:
        return None
    if sem_avanco:
        return 0.0
    return round(pu * (pct if pct is not None else 1), 6)


# ---- vínculo item da PQ → critério (spec 083) ---------------------------------------------------------------------
# O número do item na planilha de critérios é o do CATÁLOGO de critérios (8.1 MOBILIZAÇÃO…), não o da PQ da obra
# (8.1 Montagem de cabo…). O que liga os dois é o código CMS que a PQ traz em cada item.
_CMS = re.compile(r"([A-Z])\s*\.?\s*(\d+)\s*\.\s*(\d+)(?:\s*\.\s*(\d+))?")
COMO = {"vinculo": "escolhido na linha", "cms": "pelo código CMS", "item": "pelo item da PQ", "cms_grupo": "pelo grupo do código CMS"}


def cms_chave(codigo: str | None) -> tuple | None:
    """'CMS C.05.05.001' · 'CMS.C05.05.001' · 'CMS. E.00.00.015' → ('C', 5, 5, 1). Sem código reconhecível → None."""
    t = (codigo or "").upper().replace("CMS", " ", 1)
    m = _CMS.search(t)
    if not m:
        return None
    return (m.group(1), int(m.group(2)), int(m.group(3)), int(m.group(4) or 0))


def cms_grupos(chave: tuple) -> list[tuple]:
    """Do mais específico ao mais geral, sem a própria chave: C.45.12.001 → C.45.12.000 → C.45.00.000."""
    letra, a, b, c = chave
    out = []
    if c:
        out.append((letra, a, b, 0))
    if b:
        out.append((letra, a, 0, 0))
    return out


@dataclass(frozen=True)
class CriterioRef:
    """O mínimo de um critério para resolver o vínculo (sem banco)."""
    id: int
    codigo: str
    item_pq: str | None
    origem: str  # planilha | manual


def resolver_criterio(item_pq: str | None, cms_do_item: str | None, criterios: list[CriterioRef],
                      vinculo: int | None = None) -> tuple[int | None, str | None, int]:
    """(id do critério, como casou, quantos critérios disputavam) para um item da PQ. Ordem:
    1. vínculo escolhido na linha; 2. código CMS exato (vários com o mesmo código: o primeiro, e avisa);
    3. critério cadastrado à mão para o item (ou um item acima dele); 4. grupo do código CMS (…000).
    Critério da planilha não casa pelo número do item (é numeração do catálogo, não da PQ)."""
    por_id = {c.id: c for c in criterios}
    if vinculo and vinculo in por_id:
        return vinculo, "vinculo", 1
    chave = cms_chave(cms_do_item)
    por_cms: dict[tuple, list[CriterioRef]] = {}
    for c in criterios:
        k = cms_chave(c.codigo)
        if k:
            por_cms.setdefault(k, []).append(c)
    if chave and por_cms.get(chave):
        xs = por_cms[chave]
        return xs[0].id, "cms", len(xs)
    manuais = [c for c in criterios if c.origem == "manual" and c.item_pq]
    p = criterio_do_item(item_pq, [c.item_pq for c in manuais])
    if p:
        return next(c.id for c in manuais if c.item_pq == p), "item", 1
    for g in cms_grupos(chave) if chave else []:
        if por_cms.get(g):
            return por_cms[g][0].id, "cms_grupo", len(por_cms[g])
    return None, None, 0


_VAZIAS = {"para", "com", "sem", "dos", "das", "de", "da", "do", "e", "em", "inclusive", "qualquer", "tipo", "fornecimento", "execucao"}


def palavras(texto: str | None) -> set[str]:
    import unicodedata

    t = unicodedata.normalize("NFKD", texto or "").encode("ascii", "ignore").decode().lower()
    return {w for w in re.findall(r"[a-z0-9]+", t) if len(w) > 2 and w not in _VAZIAS}


def sugerir_por_descricao(descricao: str, titulos: list[str], criterios: list[tuple[int, str]], minimo: float = 0.6) -> int | None:
    """Sugestão (nunca vínculo automático) para item sem critério: o critério cuja descrição mais se parece com a do
    item ou a dos títulos acima dele na PQ — pelo menos 2 palavras em comum e 60% das palavras do critério."""
    alvos = [palavras(descricao)] + [palavras(t) for t in titulos]
    melhor, nota = None, 0.0
    for cid, desc in criterios:
        p = palavras(desc)
        if len(p) < 2:
            continue
        for a in alvos:
            comuns = len(p & a)
            n = comuns / len(p) if comuns >= 2 else 0
            if n > nota:
                melhor, nota = cid, n
    return melhor if nota >= minimo else None
