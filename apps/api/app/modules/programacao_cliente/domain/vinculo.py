"""Vínculos de cada linha da planilha do cliente com o Malhet (spec 146): frente, cronograma, item da PQ, tipo, IWP e equipe.

Regra de sempre: o código confirma (CWA, TAG, ID do cronograma, item da PQ com unidade compatível); nome e descrição só
SUGEREM — nunca ligam sozinhos. A decisão de quem conferiu fica lembrada pela chave da linha (descrição + frente +
unidade): na semana seguinte a mesma atividade já entra ligada.
"""
import re
from dataclasses import dataclass

from app.modules.catalogo.domain.unidades import chave_unidade
from app.modules.programacao_cliente.domain.planilha import norm

OK, SUGERIDO = "ok", "sugerido"
PARECIDO_MIN = 0.3  # parecença mínima para sugerir o item da PQ pela descrição

PARADAS = {"de", "da", "do", "das", "dos", "e", "em", "para", "com", "a", "o", "as", "os", "na", "no", "nas", "nos", "ate",
           "por", "ou", "um", "uma", "plano", "area", "-", "conforme", "projeto", "inclusive"}


def palavras(texto: str | None) -> set[str]:
    return set(_palavras(texto))


def _palavras(texto: str | None) -> dict[str, str]:
    """raiz → a palavra como foi escrita (para mostrar)."""
    t = re.sub(r"\([^)]*\)", " ", norm(texto))  # o que está entre parênteses é o complemento da obra, não o serviço
    out: dict[str, str] = {}
    for w in re.findall(r"[a-z0-9]+", t):
        if w in PARADAS or (w.isdigit() and len(w) < 2) or (not w.isdigit() and len(w) <= 2):
            continue
        out.setdefault(_raiz(w), w)
    return out


def _raiz(w: str) -> str:
    """Raiz simples (bombeado ≈ bombeada ≈ bombeados): sem o plural e a vogal final."""
    if w.isdigit() or len(w) <= 4:
        return w
    if w.endswith("s"):
        w = w[:-1]
    return w[:-1] if w[-1] in "aoe" else w


def unidade_compativel(a: str | None, b: str | None) -> bool | None:
    """None = não dá para saber (falta uma das unidades)."""
    ka, kb = chave_unidade(a), chave_unidade(b)
    if not ka or not kb:
        return None
    return ka == kb or {ka, kb} == {"kg", "t"}


def chave_decisao(descricao: str, frente: str | None, unidade: str | None) -> str:
    """A mesma atividade na semana seguinte: descrição sem o complemento entre parênteses + frente + unidade."""
    return f"{' '.join(sorted(palavras(descricao)))}|{norm(frente)}|{chave_unidade(unidade)}"[:300]


def chave_item(descricao: str, unidade: str | None) -> str:
    """Só o serviço (para lembrar o item da PQ mesmo em outra frente)."""
    return f"{' '.join(sorted(palavras(descricao)))}||{chave_unidade(unidade)}"[:300]


@dataclass(frozen=True)
class ItemPq:
    item: str
    descricao: str
    unidade: str | None


@dataclass(frozen=True)
class Sugestao:
    item: str
    descricao: str
    unidade: str | None
    parecenca: float
    comuns: tuple[str, ...]

    def como_dict(self) -> dict:
        return {"item": self.item, "descricao": self.descricao, "unidade": self.unidade, "parecenca": round(self.parecenca, 3),
                "comuns": list(self.comuns)}


def sugerir_itens(descricao: str, unidade: str | None, itens: list[ItemPq], n: int = 3) -> list[Sugestao]:
    """Itens da PQ com mais palavras em comum (coeficiente de Dice) e unidade compatível. Só sugestão."""
    escritas = _palavras(descricao)
    alvo = set(escritas)
    if not alvo:
        return []
    out = []
    for it in itens:
        if unidade_compativel(unidade, it.unidade) is False:
            continue
        p = palavras(it.descricao)
        comuns = alvo & p
        if not comuns:
            continue
        dice = 2 * len(comuns) / (len(alvo) + len(p))
        if dice >= PARECIDO_MIN:
            out.append(Sugestao(it.item, it.descricao, it.unidade, dice, tuple(sorted(escritas[c] for c in comuns))))
    out.sort(key=lambda x: (-x.parecenca, x.item))
    return out[:n]


@dataclass(frozen=True)
class Area:
    id: int
    codigo: str
    cwa: str
    descricao: str
    ativo_codigo: str | None
    tag: str | None
    local: str | None = None


def _cod(t: str | None) -> str:
    return re.sub(r"[^a-z0-9.]", "", norm(t))


def casar_area(areas: list[Area], *, cwa: str | None, grupo_cwa: str | None, grupo_tag: str | None, local: str | None,
               cwp_codigo: str | None, grupo: str | None) -> tuple[int | None, str | None, str, list[int]]:
    """(área, situação, motivo, candidatas). Código/TAG únicos confirmam; nome sugere."""
    tentativas = [c for c in (cwa, grupo_cwa, (cwp_codigo or "").split("-")[0] or None) if c]
    for c in tentativas:
        k = _cod(c)
        mesmas = [a for a in areas if _cod(a.codigo) == k]
        if len(mesmas) == 1:
            return mesmas[0].id, OK, f"código da frente {mesmas[0].codigo} = {c}", []
        mesmas = [a for a in areas if _cod(a.cwa) == k]
        if len(mesmas) == 1:
            return mesmas[0].id, OK, f"CWA {c}", []
        if len(mesmas) > 1:
            if grupo_tag:
                t = _cod(grupo_tag)
                com_tag = [a for a in mesmas if t in (_cod(a.ativo_codigo), _cod(a.tag))]
                if len(com_tag) == 1:
                    return com_tag[0].id, OK, f"CWA {c} + TAG {grupo_tag}", []
            return mesmas[0].id, SUGERIDO, f"CWA {c} tem {len(mesmas)} frentes: confirme", [a.id for a in mesmas]
    if grupo_tag:
        t = _cod(grupo_tag)
        com_tag = [a for a in areas if t and t in (_cod(a.ativo_codigo), _cod(a.tag))]
        if len(com_tag) == 1:
            return com_tag[0].id, OK, f"TAG {grupo_tag}", []
    nomes = [x for x in (local, grupo) if x]
    for nome in nomes:
        n = norm(nome)
        if len(n) < 3:
            continue
        parecidas = [a for a in areas if n == norm(a.descricao) or (len(n) >= 5 and n in norm(a.descricao))
                     or (a.local and n == norm(a.local))]
        if parecidas:
            return parecidas[0].id, SUGERIDO, f"nome parecido com '{nome}': confirme", [a.id for a in parecidas[:8]]
    return None, None, "frente não encontrada: escolha", []


@dataclass(frozen=True)
class Equipe:
    id: int
    nome: str
    encarregado: str | None


def _nome(t: str | None) -> list[str]:
    t = re.sub(r"^\s*\d+\s*::\s*", "", t or "")
    return [w for w in re.findall(r"[a-z]+", norm(t)) if len(w) > 1 and w not in PARADAS]


def casar_equipe(equipes: list[Equipe], nomes: tuple[str, ...]) -> tuple[int | None, str | None, str, list[int]]:
    """O encarregado escrito na planilha ("Clayton Angelo Gonçalves", "Wilson Porcino") → a equipe dele. Todas as palavras
    do nome escrito no nome do encarregado, e uma equipe só, confirma."""
    if not nomes:
        return None, None, "sem encarregado na planilha", []
    primeiro = _nome(nomes[0])
    if not primeiro:
        return None, None, "sem encarregado na planilha", []
    achadas = [e for e in equipes if e.encarregado and set(primeiro) <= set(_nome(e.encarregado))]
    if not achadas and len(primeiro) > 1:  # primeiro + último nome
        par = {primeiro[0], primeiro[-1]}
        achadas = [e for e in equipes if e.encarregado and par <= set(_nome(e.encarregado))]
    extra = f" (a planilha traz {len(nomes)} encarregados: {', '.join(nomes)})" if len(nomes) > 1 else ""
    if len(achadas) == 1:
        return achadas[0].id, (OK if len(nomes) == 1 else SUGERIDO), f"encarregado {nomes[0]}{extra}", []
    if achadas:
        return achadas[0].id, SUGERIDO, f"{nomes[0]} lidera {len(achadas)} equipes: confirme{extra}", [e.id for e in achadas]
    return None, None, f"equipe de {nomes[0]} não encontrada{extra}", []
