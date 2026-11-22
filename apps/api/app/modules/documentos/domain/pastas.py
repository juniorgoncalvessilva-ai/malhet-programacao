"""Pastas de documentos (spec 129): a organização do vídeo Growarq aplicada ao Malhet, sem mover arquivo nenhum.

- **Pasta-modelo**: o padrão abaixo é a "0000 Nome do Projeto" — imutável no código. Cada obra recebe uma cópia na primeira vez
  que abre Documentos e pode ajustar a dela (renomear, criar, apagar); "restaurar o modelo" devolve o que faltar.
- **Pasta = regra**, não lugar: tipo de documento, disciplina (sigla ou nome) e pacote da LDO. O documento aparece em toda pasta
  cuja regra ele cumpre; o que não cabe em nenhuma vai para "Sem pasta" (com a sugestão de criar). Assim nada se perde numa pasta
  errada e a rastreabilidade continua sendo a do documento (código, revisão, GRD, leituras).
- **Código em tudo**: o código da obra abre o nome de todo arquivo baixado — OBRA_CÓDIGO_Rrev_TE (TE = letra do tipo de emissão).
"""
import re
import unicodedata
from dataclasses import dataclass, field

from app.shared.errors import DomainError

TIPOS_VALIDOS = ("DES", "PRO", "NOR", "ESP", "MEM", "LIS", "IT", "OUT")


@dataclass(frozen=True)
class Regra:
    tipos: tuple[str, ...] = ()
    disciplinas: tuple[str, ...] = ()  # sigla (C) ou nome (CIVIL); vazio = todas
    pacotes: tuple[str, ...] = ()  # trecho do nome do pacote (aba da LDO); vazio = todos

    def __post_init__(self):
        if not (self.tipos or self.disciplinas or self.pacotes):
            raise DomainError("a pasta precisa de uma regra: tipo, disciplina ou pacote", "regra")
        ruins = [t for t in self.tipos if t not in TIPOS_VALIDOS]
        if ruins:
            raise DomainError(f"tipo desconhecido: {', '.join(ruins)}", "tipos")


# subpastas (spec 134): a pasta se abre sozinha nos níveis escolhidos — padronização sem mover arquivo
NIVEIS = {"pacote": "Pacote (aba da LDO)", "frente": "Frente (CWA)", "disciplina": "Disciplina", "tipo": "Tipo de documento",
          "ano": "Ano da revisão"}


def subpastas_padrao(tipos) -> list[str]:
    """Projetos abrem por pacote → frente (CWA) → disciplina; o resto por pacote → disciplina."""
    return ["pacote", "frente", "disciplina"] if "DES" in (tipos or ()) else ["pacote", "disciplina"]


def validar_subpastas(niveis: list[str] | None) -> list[str]:
    out = list(dict.fromkeys(n for n in (niveis or []) if n))
    ruins = [n for n in out if n not in NIVEIS]
    if ruins:
        raise DomainError(f"subpasta desconhecida: {', '.join(ruins)} (use {', '.join(NIVEIS)})", "subpastas")
    if len(out) > 3:
        raise DomainError("no máximo 3 níveis de subpasta", "subpastas")
    return out


NATUREZAS = {"documento": "Documento", "registro": "Registro"}  # registro = evidência do que foi feito (Plano de Arquivamento 6.1)
RETENCAO_PADRAO = "Na obra durante a execução; depois no Data-Book, pelo prazo do contrato"
MEIO_PADRAO = "Digital — acervo da obra no Malhet"


@dataclass(frozen=True)
class PastaModelo:
    codigo: str
    nome: str
    descricao: str
    regra: Regra
    natureza: str = "documento"
    responsavel: str = "Qualidade (CQ da obra)"
    meio: str = MEIO_PADRAO
    retencao: str = RETENCAO_PADRAO


# a pasta-modelo do Malhet (ordem = código): o processo do contrato, da LDO ao que é complementar
MODELO: tuple[PastaModelo, ...] = (
    PastaModelo("10", "Contrato e listas (LDO)", "Listas de documentos, contrato, aditivos e listas de materiais", Regra(tipos=("LIS",))),
    PastaModelo("20", "Projetos", "Desenhos e projetos de todas as disciplinas, por pacote e revisão", Regra(tipos=("DES",)),
                responsavel="Engenharia / Planejamento"),
    PastaModelo("30", "Especificações e memoriais", "Especificações técnicas, memoriais descritivos e de cálculo", Regra(tipos=("ESP", "MEM"))),
    PastaModelo("40", "Procedimentos e instruções", "Procedimentos executivos e instruções de trabalho", Regra(tipos=("PRO", "IT"))),
    PastaModelo("50", "Normas", "Normas técnicas e de segurança de referência", Regra(tipos=("NOR",))),
    PastaModelo("60", "Documentos complementares", "ARTs, laudos, relatórios e outros", Regra(tipos=("OUT",)), natureza="registro"),
)


def _n(t: str | None) -> str:
    s = unicodedata.normalize("NFKD", t or "").encode("ascii", "ignore").decode().upper()
    return " ".join(re.sub(r"[^A-Z0-9]+", " ", s).split())


@dataclass(frozen=True)
class DocInfo:
    tipo: str
    disciplina: str | None = None
    disciplina_sigla: str | None = None
    pacote: str | None = None


def pertence(doc: DocInfo, regra: Regra) -> bool:
    if regra.tipos and doc.tipo not in regra.tipos:
        return False
    if regra.disciplinas:
        alvo = {_n(doc.disciplina), _n(doc.disciplina_sigla)} - {""}
        if not alvo & {_n(d) for d in regra.disciplinas}:
            return False
    if regra.pacotes:
        p = _n(doc.pacote)
        if not p or not any(_n(x) in p for x in regra.pacotes):
            return False
    return True


def validar_natureza(n: str | None) -> str:
    n = (n or "documento").strip().lower()
    if n not in NATUREZAS:
        raise DomainError("natureza: documento ou registro", "natureza")
    return n


def validar_nome(nome: str) -> str:
    nome = " ".join((nome or "").split())
    if len(nome) < 3:
        raise DomainError("dê um nome à pasta (3 letras ou mais)", "nome")
    return nome[:80]


def proximo_codigo(usados: list[str]) -> str:
    """Códigos de 10 em 10, como o modelo: a pasta nova entra no fim (70, 80…)."""
    nums = [int(c) for c in usados if c.isdigit()]
    return f"{(max(nums, default=0) // 10 + 1) * 10:02d}"


def sugestao_para(docs_sem_pasta: list[DocInfo]) -> dict | None:
    """Quando há documento sem pasta, sugere a pasta pelo tipo mais comum entre eles."""
    if not docs_sem_pasta:
        return None
    conta: dict[str, int] = {}
    for d in docs_sem_pasta:
        conta[d.tipo] = conta.get(d.tipo, 0) + 1
    tipo = max(conta, key=conta.get)
    base = next((m for m in MODELO if tipo in m.regra.tipos), None)
    return {"nome": base.nome if base else f"Documentos {tipo}", "tipos": [tipo], "documentos": conta[tipo]}


@dataclass
class Contagem:
    documentos: int = 0
    vigentes: int = 0
    ultima: str | None = None  # ISO da última revisão registrada
    pacotes: dict[str, int] = field(default_factory=dict)
    disciplinas: dict[str, int] = field(default_factory=dict)


def nome_padrao(obra: str, codigo: str, revisao: str | None, te: str | None = None) -> str:
    """OBRA_CÓDIGO_Rrev_TE, sem espaço nem acento — o nome de todo arquivo que sai do Malhet (spec 129)."""
    def limpo(t: str) -> str:
        return re.sub(r"[^A-Za-z0-9.-]+", "-", unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode()).strip("-")
    partes = [limpo(obra), limpo(codigo)] + ([f"R{limpo(revisao)}"] if revisao else []) + ([te] if te else [])
    return "_".join(p for p in partes if p)
