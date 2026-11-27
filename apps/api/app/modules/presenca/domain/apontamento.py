"""Falta e empréstimo do dia (spec 152): o que o apontador registra além da presença, e os números que saem disso.

Falta: quem não veio, com o motivo (justificada ou não). Empréstimo: a pessoa é de uma equipe, mas trabalhou hoje em outra —
fica na equipe dela, com a justificativa; o dia conta na equipe que recebeu. Presença lida no crachá/rosto é prova e não
vira falta."""
from collections import Counter
from dataclasses import dataclass

from app.shared.errors import DomainError
from app.shared.memoria import Fonte, Memoria, Passo, num

# motivo → (rótulo, justificada)
MOTIVOS_FALTA: dict[str, tuple[str, bool]] = {
    "nao_compareceu": ("Não compareceu", False),
    "atestado": ("Atestado médico", True),
    "folga": ("Folga / compensação", True),
    "ferias": ("Férias", True),
    "afastado": ("Afastado (INSS/acidente)", True),
    "treinamento": ("Treinamento / integração", True),
    "outro": ("Outro motivo", False),
}


def _texto(t: str | None, limite: int = 300) -> str | None:
    return " ".join((t or "").split())[:limite] or None


@dataclass(frozen=True)
class Falta:
    motivo: str
    observacao: str | None = None

    def __post_init__(self):
        if self.motivo not in MOTIVOS_FALTA:
            raise DomainError("escolha o motivo da falta", "motivo")
        obs = _texto(self.observacao)
        if self.motivo == "outro" and (not obs or len(obs) < 3):
            raise DomainError("descreva o motivo da falta", "observacao")
        object.__setattr__(self, "observacao", obs)

    @property
    def rotulo(self) -> str:
        return MOTIVOS_FALTA[self.motivo][0]

    @property
    def justificada(self) -> bool:
        return MOTIVOS_FALTA[self.motivo][1]


@dataclass(frozen=True)
class Emprestimo:
    de_equipe_id: int | None
    para_equipe_id: int
    justificativa: str

    def __post_init__(self):
        if not self.para_equipe_id:
            raise DomainError("escolha a equipe que recebe a pessoa", "para_equipe_id")
        if self.de_equipe_id and self.de_equipe_id == self.para_equipe_id:
            raise DomainError("a pessoa já é desta equipe: não é empréstimo", "para_equipe_id")
        j = _texto(self.justificativa)
        if not j or len(j) < 5:
            raise DomainError("escreva a justificativa do empréstimo", "justificativa")
        object.__setattr__(self, "justificativa", j)


@dataclass(frozen=True)
class FaltaDia:
    nome: str
    equipe: str | None
    motivo: str


@dataclass(frozen=True)
class EmprestimoDia:
    nome: str
    de: str | None
    para: str
    justificativa: str


def memorias(faltas: list[FaltaDia], emprestimos: list[EmprestimoDia], esperados: int, origem: str) -> dict:
    """Números do período com a conta: faltas (justificadas ou não, por motivo e por equipe) e empréstimos (cedidos/recebidos)."""
    por_motivo = Counter(f.motivo for f in faltas)
    just = sum(1 for f in faltas if MOTIVOS_FALTA.get(f.motivo, ("", False))[1])
    taxa = round(100 * len(faltas) / esperados, 1) if esperados else None
    m_faltas = Memoria(
        chave="faltas", titulo="Faltas apontadas", valor=str(len(faltas)),
        formula="faltas = pessoas apontadas como falta (uma por pessoa e dia); taxa = faltas ÷ pessoas esperadas",
        passos=(*(Passo(MOTIVOS_FALTA.get(k, (k, False))[0], str(v), str(v)) for k, v in por_motivo.most_common()),
                Passo("Justificadas", str(just), str(just)), Passo("Sem justificativa", str(len(faltas) - just), str(len(faltas) - just), True),
                Passo("Taxa de falta", f"{len(faltas)} ÷ {esperados} × 100", f"{num(taxa, 1)}%" if taxa is not None else "—", True)),
        fontes=(Fonte("Faltas", str(len(faltas)), origem, "presenca_falta"),
                Fonte("Pessoas esperadas", str(esperados), "Equipes ativas × dias", None)))
    cedidos = Counter(e.de or "Sem equipe" for e in emprestimos)
    recebidos = Counter(e.para for e in emprestimos)
    m_emp = Memoria(
        chave="emprestimos", titulo="Empréstimos entre equipes", valor=str(len(emprestimos)),
        formula="empréstimo = pessoa que trabalhou no dia numa equipe que não é a dela (com justificativa)",
        passos=(*(Passo(f"{k} recebeu", str(v), str(v)) for k, v in recebidos.most_common(10)),
                *(Passo(f"{k} cedeu", str(v), str(v)) for k, v in cedidos.most_common(10))),
        fontes=(Fonte("Empréstimos", str(len(emprestimos)), origem, "presenca_emprestimo"),))
    return {"faltas": m_faltas.como_dict(), "emprestimos": m_emp.como_dict(), "taxa_falta": taxa, "justificadas": just,
            "por_motivo": [{"motivo": k, "rotulo": MOTIVOS_FALTA.get(k, (k, False))[0], "qtd": v} for k, v in por_motivo.most_common()],
            "recebidos": [{"equipe": k, "qtd": v} for k, v in recebidos.most_common()],
            "cedidos": [{"equipe": k, "qtd": v} for k, v in cedidos.most_common()]}
