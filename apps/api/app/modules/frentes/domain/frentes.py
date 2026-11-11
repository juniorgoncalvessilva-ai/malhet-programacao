"""Frentes em dois níveis: Local (Novo CMD, Nova Oficina…) → Área (CWA + Ativo/TAG + descrição).

Dois formatos de lista (colada do Excel):
- CWA | Ativo | DESCRICAO CWA | Local (padrão da obra): cada linha é uma área; o Local é o agrupamento, criado pelo
  nome; o Ativo (ED-1800AA-04, "-" = sem ativo) é a TAG;
- CODIGO | DESCRICAO (antigo): código sem ponto = Local; com ponto (CWA) = Área do último Local lido.

Regras:
- CWA repetido na obra recebe sufixo .1, .2… (o Simova exige código único de FRENTE);
- a TAG da descrição é normalizada para o formato do take-off (1800AA-ED-01) para casar quantidades.
"""
import re
from collections import Counter
from dataclasses import dataclass, field

from app.shared.errors import DomainError

_TAG_TIPO_PRIMEIRO = re.compile(r"\b([A-Z]{2,4})-(\d{4}[A-Z]{2})-(\d{1,3})\b")  # ED-1800AA-01
_TAG_AREA_PRIMEIRO = re.compile(r"\b(\d{4}[A-Z]{2})-([A-Z]{2,4})-(\d{1,3})\b")  # 1800AA-ED-01


def normalizar_tag(texto: str | None) -> str | None:
    """Extrai a TAG e devolve no formato do take-off: 1800AA-ED-01 (ou None)."""
    if not texto:
        return None
    t = texto.upper()
    m = _TAG_AREA_PRIMEIRO.search(t)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{int(m.group(3)):02d}"
    m = _TAG_TIPO_PRIMEIRO.search(t)
    if m:
        return f"{m.group(2)}-{m.group(1)}-{int(m.group(3)):02d}"
    return None


def eh_area(codigo: str) -> bool:
    return "." in codigo.strip()


@dataclass
class AreaLida:
    cwa: str
    descricao: str
    codigo: str = ""
    tag: str | None = None
    ativo: str | None = None  # código do ativo como veio (ED-1800AA-04)


@dataclass
class LocalLido:
    codigo: str
    descricao: str
    areas: list[AreaLida] = field(default_factory=list)


_SEM_ATIVO = {"", "-", "–", "—", "N/A", "NA"}


def _celulas(bruta: str) -> list[str]:
    return [" ".join(c.split()) for c in re.split(r"\t|;", bruta)]


def eh_formato_cwa(texto: str) -> bool:
    """Lista com 4 colunas (CWA, Ativo, Descrição, Local)."""
    linhas = [ln for ln in texto.splitlines() if ln.strip()]
    com4 = sum(1 for ln in linhas if len([c for c in _celulas(ln)[:4]]) >= 4 and _celulas(ln)[3])
    return bool(linhas) and com4 >= max(1, len(linhas) // 2)


def interpretar_lista_cwa(texto: str) -> list[LocalLido]:
    """CWA | Ativo | DESCRICAO CWA | Local. Locais na ordem em que aparecem; áreas na ordem da lista."""
    locais: dict[str, LocalLido] = {}
    for n, bruta in enumerate(texto.splitlines(), start=1):
        if not bruta.strip():
            continue
        c = _celulas(bruta) + ["", "", "", ""]
        cwa, ativo, descricao, local = c[0], c[1], c[2], c[3]
        if cwa.upper() == "CWA":
            continue  # cabeçalho
        if not cwa or not local:
            raise DomainError(f"linha {n}: falta CWA ou Local: {bruta.strip()!r}")
        ativo_ok = None if ativo.upper() in _SEM_ATIVO else ativo.upper().replace(" ", "")
        descricao = descricao or ativo_ok or cwa
        chave = local.lower()
        loc = locais.get(chave)
        if loc is None:
            loc = locais[chave] = LocalLido(codigo="", descricao=local)
        loc.areas.append(AreaLida(cwa=validar_codigo(cwa), descricao=descricao, ativo=ativo_ok,
                                  tag=normalizar_tag(ativo_ok) or normalizar_tag(descricao)))
    if not locais:
        raise DomainError("nenhuma frente encontrada no texto")
    lista = list(locais.values())
    atribuir_codigos([a for loc in lista for a in loc.areas])
    return lista


def codigo_de_local(usados: set[str]) -> str:
    """Código Simova para um Local criado pelo nome: L1, L2… (não colide com os CWAs das áreas)."""
    n = 1
    while f"L{n}" in usados:
        n += 1
    return f"L{n}"


def interpretar_lista(texto: str) -> list[LocalLido]:
    """Lê `CODIGO<tab ou ;>DESCRICAO` (antigo) ou `CWA | Ativo | DESCRICAO CWA | Local`. Cabeçalho é ignorado."""
    if eh_formato_cwa(texto):
        return interpretar_lista_cwa(texto)
    locais: list[LocalLido] = []
    for bruta in texto.splitlines():
        if not bruta.strip():
            continue
        partes = re.split(r"\t|;", bruta, maxsplit=1)
        if len(partes) < 2:
            partes = bruta.strip().split(None, 1)
        if len(partes) < 2:
            raise DomainError(f"linha sem código e descrição: {bruta.strip()!r}")
        codigo, descricao = partes[0].strip(), " ".join(partes[1].split())
        if codigo.upper() == "CODIGO":
            continue
        if eh_area(codigo):
            if not locais:
                raise DomainError(f"a área {codigo} vem antes de qualquer local")
            locais[-1].areas.append(AreaLida(cwa=codigo, descricao=descricao, tag=normalizar_tag(descricao)))
        else:
            locais.append(LocalLido(codigo=codigo, descricao=descricao))
    if not locais:
        raise DomainError("nenhuma frente encontrada no texto")
    atribuir_codigos([a for loc in locais for a in loc.areas])
    return locais


def atribuir_codigos(areas: list[AreaLida], ja_usados: set[str] | None = None) -> None:
    """CWA único fica como está; repetido vira cwa.1, cwa.2… (na ordem da lista), sem colidir com ja_usados."""
    usados = set(ja_usados or ())
    conta = Counter(a.cwa for a in areas)
    seq: Counter[str] = Counter()
    for a in areas:
        if conta[a.cwa] == 1 and a.cwa not in usados:
            a.codigo = a.cwa
        else:
            while True:
                seq[a.cwa] += 1
                cand = f"{a.cwa}.{seq[a.cwa]}"
                if cand not in usados:
                    break
            a.codigo = cand
        usados.add(a.codigo)


def validar_codigo(codigo: str) -> str:
    c = codigo.strip()
    if not c or len(c) > 20 or not re.fullmatch(r"[0-9A-Za-z.\-]+", c):
        raise DomainError("código da frente: até 20 caracteres, letras, números, ponto ou hífen", "codigo")
    return c
