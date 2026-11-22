"""Casar o arquivo enviado com a lista de documentos (spec 132).

O arquivo chega por tipo (ou "pelo arquivo") e o Malhet procura, nesta ordem, o código do documento: no carimbo do desenho, no
nome do arquivo e no texto da primeira página do PDF — comparando com os códigos do cliente e da contratada que estão na LDO. A
revisão vem do carimbo, do nome ("_R4", "rev B", "Rev.0") ou, se a LDO só tem uma revisão esperando arquivo, dela.

Casou com documento e revisão → associa sozinho. Não casou (ou faltou a revisão) → vai para "A relacionar", com as sugestões
mais parecidas, para o Planejamento ligar à LDO, criar o documento ou relacionar a outros documentos. Nunca chuta: código que não
está na LDO não vira documento novo sozinho (só o do carimbo do desenho, que é informação controlada).
"""
import re
import unicodedata
from dataclasses import dataclass, field


def _norm(t: str | None) -> str:
    s = unicodedata.normalize("NFKD", t or "").encode("ascii", "ignore").decode().upper()
    return re.sub(r"[^A-Z0-9]", "", s)


def _palavras(t: str | None) -> set[str]:
    s = unicodedata.normalize("NFKD", t or "").encode("ascii", "ignore").decode().upper()
    return {w for w in re.findall(r"[A-Z0-9]{3,}", s) if w not in {"PARA", "COM", "DOS", "DAS", "PROJETO", "DETALHADO", "REV"}}


@dataclass(frozen=True)
class DocRef:
    id: int
    codigo: str
    codigo_contratada: str | None
    titulo: str
    revisoes_sem_arquivo: tuple[str, ...] = ()
    tem_revisoes: bool = False


@dataclass
class Casamento:
    documento_id: int | None = None
    codigo_lido: str | None = None  # o que se leu, mesmo sem casar (para mostrar)
    revisao: str | None = None
    como: str = ""  # carimbo · nome do arquivo · texto do PDF · código da contratada
    motivo: str | None = None  # por que foi para "A relacionar"
    sugestoes: list[dict] = field(default_factory=list)


_REV = re.compile(r"(?:^|[\s_\-.(])(?:REV(?:ISAO|ISÃO)?|R)[\s._\-]*([A-Z]{1,2}|\d{1,2})(?=$|[\s_\-.)])", re.I)
_CODIGO_GENERICO = re.compile(r"\b[A-Z0-9]{2,}(?:[-.][A-Z0-9]{1,}){2,}\b")


def revisao_no_nome(nome: str | None) -> str | None:
    base = (nome or "").rsplit("/", 1)[-1]
    base = base.rsplit(".", 1)[0] if "." in base else base
    achados = list(_REV.finditer(base))
    if not achados:
        return None
    r = achados[-1].group(1).upper()
    return str(int(r)) if r.isdigit() else r  # "03" = revisão 3


def _procura(texto: str, docs: list[DocRef]) -> tuple[DocRef | None, str]:
    """O código mais longo da LDO que aparece inteiro no texto (cliente primeiro, depois o da contratada)."""
    alvo = _norm(texto)
    if not alvo:
        return None, ""
    melhor, como, tam = None, "", 0
    for d in docs:
        for cod, rot in ((d.codigo, "código"), (d.codigo_contratada, "código da contratada")):
            c = _norm(cod)
            if len(c) >= 6 and c in alvo and len(c) > tam:
                melhor, como, tam = d, rot, len(c)
    return melhor, como


def sugerir(nome: str | None, titulo: str | None, docs: list[DocRef], limite: int = 5) -> list[dict]:
    """Os documentos da LDO mais parecidos com o nome/título do arquivo (palavras em comum), para escolher na mão."""
    alvo = _palavras(nome) | _palavras(titulo)
    if not alvo:
        return []
    notas = []
    for d in docs:
        comum = alvo & (_palavras(d.titulo) | _palavras(d.codigo))
        if comum:
            notas.append((len(comum) / max(len(alvo), 1), d))
    notas.sort(key=lambda x: -x[0])
    return [{"documento_id": d.id, "codigo": d.codigo, "titulo": d.titulo, "nota": round(n, 2)} for n, d in notas[:limite]]


def casar(docs: list[DocRef], *, nome: str | None, carimbo_codigo: str | None = None, carimbo_contratada: str | None = None,
          carimbo_revisao: str | None = None, carimbo_titulo: str | None = None, texto_pdf: str | None = None) -> Casamento:
    c = Casamento()
    achado, como = None, ""
    for fonte, texto in (("carimbo", " ".join(x for x in (carimbo_codigo, carimbo_contratada) if x)),
                         ("nome do arquivo", nome or ""), ("texto do PDF", texto_pdf or "")):
        achado, rot = _procura(texto, docs)
        if achado:
            como = f"{rot} no {fonte}" if fonte != "texto do PDF" else f"{rot} no texto do PDF"
            break
    if achado is None:
        base = (nome or "").rsplit("/", 1)[-1]
        base = base.rsplit(".", 1)[0] if "." in base else base
        lido = carimbo_codigo or (m.group(0) if (m := _CODIGO_GENERICO.search(base.upper())) else None)
        c.codigo_lido = lido
        c.motivo = (f"o código {lido} não está na lista de documentos" if lido else "não achei o código do documento no arquivo")
        c.sugestoes = sugerir(nome, carimbo_titulo, docs)
        return c
    c.documento_id, c.codigo_lido, c.como = achado.id, achado.codigo, como
    rev = carimbo_revisao or revisao_no_nome(nome)
    if rev is None and len(achado.revisoes_sem_arquivo) == 1:
        rev = achado.revisoes_sem_arquivo[0]
        c.como += f" · revisão {rev} esperando arquivo na LDO"
    if rev is None:
        c.motivo = f"achei o documento {achado.codigo}, mas não a revisão (no carimbo, no nome como _R4/rev B, ou única na LDO)"
        c.sugestoes = [{"documento_id": achado.id, "codigo": achado.codigo, "titulo": achado.titulo, "nota": 1.0}]
        return c
    c.revisao = rev
    return c
