"""Documentos controlados da obra (spec 123) — ISO 9001:2015, 7.5 (informação documentada).

- Cada documento tem um código (o do cliente, ex.: 1870AA-C-51890) e uma lista de revisões. A **vigente** é a revisão mais
  nova cuja finalidade libera o uso no campo (para construção, aprovado, liberado, como construído). Revisão em
  aprovação ou para comentários não substitui a vigente; a vigente anterior vira **superada** (nunca é apagada).
- Ordem das revisões: letras (A, B, C… = emissões preliminares) antes dos números (0, 1, 2… = depois de aprovado).
- O carimbo do desenho (atributos do bloco da folha) preenche código, revisão, finalidade, título e data.
- TAGs citadas no desenho (TQ-1870AA-01) sugerem a frente; quem confirma é o Planejamento.
"""
import re
import unicodedata
from dataclasses import dataclass
from datetime import date, datetime

from app.shared.errors import DomainError

TIPOS = {
    "DES": "Desenho / projeto",
    "PRO": "Procedimento",
    "NOR": "Norma",
    "ESP": "Especificação técnica",
    "MEM": "Memorial / memória de cálculo",
    "LIS": "Lista (materiais, equipamentos)",
    "IT": "Instrução de trabalho",
    "OUT": "Outro",
}
DISCIPLINAS = ("CIVIL", "ESTRUTURA", "MECÂNICA", "ELÉTRICA", "TUBULAÇÃO", "INSTRUMENTAÇÃO", "ARQUITETURA", "GERAL",
               "SEGURANÇA", "QUALIDADE", "MEIO AMBIENTE")

# finalidade da emissão → libera o uso no campo?
FINALIDADES = {
    "PARA CONSTRUÇÃO": True,
    "APROVADO": True,
    "LIBERADO": True,
    "LIBERADO PARA EXECUÇÃO": True,
    "COMO CONSTRUÍDO": True,
    "CONFORME CONSTRUÍDO": True,
    "PARA APROVAÇÃO": False,
    "PARA COTAÇÃO": False,
    "CONFORME COMPRADO": False,
    "PARA COMENTÁRIOS": False,
    "PARA CONHECIMENTO": False,
    "PRELIMINAR": False,
    "CANCELADO": False,
}
# "TE — tipo de emissão" das LDOs e carimbos de contrato (letra → finalidade); E e G liberam o uso no campo (spec 128)
TIPO_EMISSAO = {"A": "PRELIMINAR", "B": "PARA APROVAÇÃO", "C": "PARA CONHECIMENTO", "D": "PARA COTAÇÃO",
                "E": "PARA CONSTRUÇÃO", "F": "CONFORME COMPRADO", "G": "CONFORME CONSTRUÍDO", "H": "CANCELADO"}
RELACOES = {"aplica_a": "aplica-se a", "referencia": "referencia", "baseado_em": "baseado em", "substitui": "substitui"}
ALVOS = ("area", "wbs", "grupo", "documento")
SITUACOES = ("vigente", "em_analise", "superada", "cancelada")


def _sem_acento(t: str) -> str:
    return unicodedata.normalize("NFKD", t or "").encode("ascii", "ignore").decode()


def normalizar_codigo(codigo: str | None) -> str:
    c = " ".join((codigo or "").split()).upper()
    if len(c) < 3:
        raise DomainError("informe o código do documento", "codigo")
    return c[:80]


def normalizar_revisao(rev: str | int | float | None) -> str:
    t = str(rev if rev is not None else "").strip().upper()
    if t.endswith(".0") and t[:-2].isdigit():  # número do Excel
        t = t[:-2]
    t = re.sub(r"^(REV\.?|R)\s*", "", t)
    if not t or len(t) > 6:
        raise DomainError("informe a revisão (ex.: A, B, 0, 1)", "revisao")
    return t


def chave_revisao(rev: str) -> tuple:
    """Letras antes dos números; dentro de cada grupo, a ordem natural (B < C, 2 < 10)."""
    r = normalizar_revisao(rev)
    if r.isdigit():
        return (1, int(r), "")
    return (0, 0, r)


def normalizar_finalidade(txt: str | None) -> str:
    t = " ".join((txt or "").split()).upper()
    if not t:
        return "PARA CONHECIMENTO"
    if t in TIPO_EMISSAO:  # letra do TE (A–H)
        return TIPO_EMISSAO[t]
    m = re.match(r"^([A-H])\s*[-–—]\s*\S", t)  # "E - PARA CONSTRUÇÃO"
    if m:
        return TIPO_EMISSAO[m.group(1)]
    base = _sem_acento(t)
    for f in FINALIDADES:
        if _sem_acento(f) == base:
            return f
    for chave, f in (("CONFORME CONSTRU", "CONFORME CONSTRUÍDO"), ("CONFORME COMPRA", "CONFORME COMPRADO"), ("COTACAO", "PARA COTAÇÃO"),
                     ("CONSTRU", "PARA CONSTRUÇÃO"), ("AS BUILT", "COMO CONSTRUÍDO"), ("COMO CONSTRUIDO", "COMO CONSTRUÍDO"),
                     ("APROVACAO", "PARA APROVAÇÃO"), ("COMENTARIO", "PARA COMENTÁRIOS"), ("CANCEL", "CANCELADO"),
                     ("LIBERAD", "LIBERADO"), ("APROVAD", "APROVADO"), ("CONHECIMENTO", "PARA CONHECIMENTO"),
                     ("INFORMA", "PARA CONHECIMENTO"), ("PRELIMINAR", "PRELIMINAR")):
        if chave in base:
            return f
    return t[:40]


def libera_uso(finalidade: str) -> bool:
    return FINALIDADES.get(normalizar_finalidade(finalidade), False)


@dataclass(frozen=True)
class RevisaoInfo:
    id: int
    revisao: str
    finalidade: str


def vigente(revisoes: list[RevisaoInfo]) -> int | None:
    """Id da revisão vigente: a mais nova que libera o uso; cancelada na mais nova = nenhuma vigente."""
    ordem = sorted(revisoes, key=lambda r: chave_revisao(r.revisao))
    if ordem and normalizar_finalidade(ordem[-1].finalidade) == "CANCELADO":
        return None
    liberadas = [r for r in ordem if libera_uso(r.finalidade)]
    return liberadas[-1].id if liberadas else None


def situacao(r: RevisaoInfo, revisoes: list[RevisaoInfo]) -> str:
    if normalizar_finalidade(r.finalidade) == "CANCELADO":
        return "cancelada"
    v = vigente(revisoes)
    if v == r.id:
        return "vigente"
    if v is not None and chave_revisao(r.revisao) < chave_revisao(next(x for x in revisoes if x.id == v).revisao):
        return "superada"
    if not libera_uso(r.finalidade):
        mais_novas = [x for x in revisoes if chave_revisao(x.revisao) > chave_revisao(r.revisao)]
        return "superada" if mais_novas else "em_analise"
    return "superada"


# ---- carimbo do desenho --------------------------------------------------------------------------------------------

@dataclass(frozen=True)
class Carimbo:
    codigo: str | None = None
    codigo_contratada: str | None = None
    revisao: str | None = None
    finalidade: str | None = None
    titulo: str | None = None
    data: date | None = None
    projeto: str | None = None
    disciplina: str | None = None


def _chave(k: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", _sem_acento(k).upper())


def _data(txt: str | None) -> date | None:
    if not txt:
        return None
    for fmt in ("%d/%m/%y", "%d/%m/%Y", "%Y-%m-%d", "%d.%m.%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(txt.strip(), fmt).date()
        except ValueError:
            continue
    return None


def ler_carimbo(atributos: dict[str, str]) -> Carimbo:
    """Atributos do bloco do carimbo → campos do documento. Os nomes variam por cliente; casa pelo sentido.
    Revisões listadas em colunas (1a_REV, 2A_REV…) não contam: vale o campo REVISÃO."""
    a = {_chave(k): (v or "").strip() for k, v in atributos.items() if (v or "").strip()}

    def pega(*opcoes: str, evitar: tuple[str, ...] = ()) -> str | None:
        for o in opcoes:
            for k, v in a.items():
                if (k == o or k.startswith(o)) and not any(e in k for e in evitar):
                    return v
        return None

    codigo = pega("NUMEROVALE", "NVALE", "NUMEROCLIENTE", "NUMERODOCLIENTE", "CODIGOCLIENTE", "NDOCUMENTO", "NUMERODOCUMENTO",
                  "NUMERODODESENHO", "NUMERO", "DOCUMENTO", "DESENHO", evitar=("CONTRAT", "PROJ", "SE", "FOLHA"))
    contratada = pega("NUMERODACONTRATADA", "NCONTRATADA", "CODIGOCONTRATADA", "NUMEROCONTRATADA")
    revisao = a.get("REVISAO") or a.get("REV") or pega("REVISAOATUAL", "REVATUAL")
    finalidade = pega("DESCRICAODAREVISAO", "FINALIDADE", "EMISSAO", "STATUS", evitar=("EMIS",)) or pega("DESCRICAODAREVISAO")
    partes = [pega("TITULODODESENHO", "TITULO"), pega("SUBTITULO1"), pega("SUBTITULO2"), pega("SUBTITULO3")]
    titulo = " – ".join(p for p in partes if p) or None
    datas = [k for k in a if k.startswith("DATA")]
    return Carimbo(codigo=codigo, codigo_contratada=contratada,
                   revisao=normalizar_revisao(revisao) if revisao else None,
                   finalidade=normalizar_finalidade(finalidade) if finalidade else None,
                   titulo=titulo[:300] if titulo else None, data=_data(a.get(datas[0]) if datas else None),
                   projeto=pega("PROJETO", evitar=("FASE", "PROJ.")), disciplina=pega("DISCIPLINA"))


def parece_carimbo(atributos: dict[str, str]) -> bool:
    ks = {_chave(k) for k, v in atributos.items() if (v or "").strip()}
    return len(ks) >= 5 and any(k.startswith("REV") for k in ks) and any("NUMERO" in k or "TITULO" in k for k in ks)


TAG = re.compile(r"\b([A-Z]{2,3})-?(\d{4}[A-Z]{2})-(\d{2,3})\b")


def tags_no_texto(textos: list[str]) -> list[str]:
    """TAGs de equipamento/área citadas no desenho (TQ-1870AA-01, ED-1870AA-06), sem repetir, na ordem."""
    vistos: dict[str, None] = {}
    for t in textos:
        for m in TAG.finditer((t or "").upper()):
            vistos[f"{m.group(1)}-{m.group(2)}-{m.group(3)}"] = None
    return list(vistos)


def casa_tag(tag: str, *textos_da_frente: str | None) -> bool:
    """A frente casa com a TAG pela forma do ativo/TAG/descrição (com ou sem hífen, ordem do take-off ou do desenho)."""
    m = TAG.match(tag)
    if not m:
        return False
    a, b, c = m.groups()
    formas = {f"{a}-{b}-{c}", f"{b}-{a}-{c}", f"{a}{b}{c}", f"{b}{a}{c}"}
    alvo = " ".join(_sem_acento(t or "").upper() for t in textos_da_frente)
    compacto = alvo.replace(" ", "")
    return any(f in alvo or f.replace("-", "") in compacto.replace("-", "") for f in formas)


def numero_grd(sentido: str, seq: int, ano: int) -> str:
    if sentido not in ("recebida", "emitida"):
        raise DomainError("GRD recebida ou emitida", "sentido")
    return f"GRD-{'R' if sentido == 'recebida' else 'E'}-{ano}-{seq:04d}"
