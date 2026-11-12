"""Unidades de medida do Simova (aba UNIDADE_MEDIDA) e o lote de grupos no layout OPER_GRUPO.

A unidade do tipo vem do item da PQ ("m3", "M³", "m2", "un"…); o Simova quer o código ("007"). A tabela da obra
nasce com a do Simova e o casamento ignora caixa, acento, expoente (³ = 3) e ponto.
"""
import re
import unicodedata

from app.shared.errors import DomainError

UNIDADES_PADRAO: tuple[tuple[str, str], ...] = (
    ("001", "un"), ("002", "pç"), ("003", "cj"), ("004", "vb"), ("005", "m"), ("006", "m²"), ("007", "m³"),
    ("008", "kg"), ("009", "t"), ("010", "L"), ("011", "HH"), ("012", "EH"), ("013", "h"), ("014", "dia"),
    ("015", "mês"), ("016", "pt"), ("017", "kW"), ("018", "%"), ("019", "dm³"),
)

# grafias comuns na PQ → grafia da tabela do Simova
SINONIMOS = {"und": "un", "unid": "un", "u": "un", "pc": "pc", "peca": "pc", "conj": "cj", "verba": "vb", "ml": "m",
             "m1": "m", "ton": "t", "tf": "t", "l": "l", "litro": "l", "hr": "h", "hora": "h", "mes": "mes",
             "kva": "kw", "pto": "pt", "ponto": "pt"}


def chave_unidade(texto: str | None) -> str:
    t = (texto or "").strip().replace("²", "2").replace("³", "3")
    t = unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode().casefold()
    t = re.sub(r"[\s.]", "", t)
    return SINONIMOS.get(t, t)


def codigo_unidade(texto: str | None, tabela: dict[str, str]) -> str | None:
    """Código Simova da unidade (tabela = código → descrição)."""
    k = chave_unidade(texto)
    if not k:
        return None
    for cod, desc in tabela.items():
        if chave_unidade(desc) == k or cod == (texto or "").strip():
            return cod
    return None


def validar_codigo_unidade(cod: str | None) -> str | None:
    c = (cod or "").strip()
    if not c:
        return None
    if not c.isdigit() or len(c) > 3:
        raise DomainError(f"código de unidade inválido: {cod} (use 001 a 999)", "unidade")
    return c.zfill(3)


def _linhas(texto: str) -> list[list[str]]:
    out = []
    for ln in (texto or "").splitlines():
        if not ln.strip():
            continue
        partes = [p.strip() for p in (ln.split("\t") if "\t" in ln else re.split(r"\s*[;|]\s*", ln))]
        out.append(partes)
    return out


def interpretar_grupos(texto: str) -> list[tuple[int, str, str | None]]:
    """Linhas `CODIGO  DESCRICAO  UNIDADE_MEDIDA` (copiadas do Excel; também aceita ; ou |). Cabeçalho é ignorado."""
    out, vistos = [], set()
    for i, p in enumerate(_linhas(texto), start=1):
        if p[0].strip().upper() == "CODIGO":
            continue
        if not p[0].isdigit():
            raise DomainError(f"linha {i}: o código do grupo deve ser número ({p[0]!r})", "texto")
        n = int(p[0])
        if n in vistos:
            raise DomainError(f"linha {i}: grupo {n} repetido", "texto")
        vistos.add(n)
        desc = " ".join((p[1] if len(p) > 1 else "").split())
        if len(desc) < 2:
            raise DomainError(f"linha {i}: falta a descrição do grupo {n}", "texto")
        out.append((n, desc[:120], validar_codigo_unidade(p[2] if len(p) > 2 else None)))
    if not out:
        raise DomainError("cole as linhas CODIGO · DESCRICAO · UNIDADE_MEDIDA", "texto")
    return out


def interpretar_unidades(texto: str) -> list[tuple[str, str]]:
    out = []
    for i, p in enumerate(_linhas(texto), start=1):
        if p[0].strip().upper() == "CODIGO":
            continue
        cod = validar_codigo_unidade(p[0])
        desc = " ".join((p[1] if len(p) > 1 else "").split())
        if not cod or not desc:
            raise DomainError(f"linha {i}: use CODIGO e DESCRICAO", "texto")
        out.append((cod, desc[:20]))
    if not out:
        raise DomainError("cole as linhas CODIGO · DESCRICAO", "texto")
    return out
