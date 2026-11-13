"""Plano de ação 5W2H (spec 064): o quê, por quê, onde, quando, quem, como e quanto. Nasce de uma auditoria, de uma
ocorrência, de uma restrição, da reunião ou à mão; vai para a reunião de ações das frentes e para a programação das
ações (dia de execução). Fecha só com evidência; quem acompanha verifica a eficácia.

Situações: aberta → andamento → verificacao (concluída com evidência, aguardando eficácia) → concluida | (não eficaz) aberta;
cancelada a qualquer momento antes de concluir (com motivo).
"""
from dataclasses import dataclass
from datetime import date

from app.shared.errors import DomainError

ORIGENS = ("auditoria", "ocorrencia", "restricao", "reuniao", "manual")
STATUS = ("aberta", "andamento", "verificacao", "concluida", "cancelada")
ROTULO_STATUS = {"aberta": "Aberta", "andamento": "Em andamento", "verificacao": "Aguardando verificação",
                 "concluida": "Concluída", "cancelada": "Cancelada"}
ABERTAS = ("aberta", "andamento")


@dataclass(frozen=True)
class Acao5W2H:
    o_que: str
    quem: str | None
    quando: date | None
    por_que: str | None = None
    onde: str | None = None
    como: str | None = None
    quanto: str | None = None

    def __post_init__(self):
        if len((self.o_que or "").strip()) < 3:
            raise DomainError("descreva o que será feito (O quê)", "o_que")
        if not (self.quem or "").strip():
            raise DomainError("informe quem faz (Quem)", "quem")
        if self.quando is None:
            raise DomainError("informe o prazo (Quando)", "quando")
        for campo, limite in (("o_que", 600), ("por_que", 600), ("onde", 200), ("como", 600), ("quanto", 120), ("quem", 150)):
            v = getattr(self, campo)
            if v and len(v) > limite:
                raise DomainError(f"{campo.replace('_', ' ')}: no máximo {limite} caracteres", campo)


def farol(status: str, quando: date | None, hoje: date) -> str:
    """Situação para o quadro: vencida (aberta com prazo passado), vence hoje/amanhã, no prazo, ou a própria situação."""
    if status not in ABERTAS or quando is None:
        return status
    dias = (quando - hoje).days
    return "vencida" if dias < 0 else "vence_logo" if dias <= 1 else "no_prazo"


def preenchidos(a: dict) -> int:
    """Quantos dos 7 campos do 5W2H estão preenchidos."""
    return sum(1 for k in ("o_que", "por_que", "onde", "quando", "quem", "como", "quanto") if a.get(k))


def proxima(status: str, evento: str, *, eficaz: bool | None = None) -> str:
    """Máquina de estados da ação."""
    if status in ("concluida", "cancelada"):
        raise DomainError(f"ação {ROTULO_STATUS[status].lower()}: não muda mais")
    if evento == "andamento":
        if status not in ABERTAS:
            raise DomainError("só ação aberta entra em andamento")
        return "andamento"
    if evento == "concluir":
        if status not in ABERTAS:
            raise DomainError("ação já concluída: falta só a verificação de eficácia")
        return "verificacao"
    if evento == "verificar":
        if status != "verificacao":
            raise DomainError("só ação concluída é verificada")
        return "concluida" if eficaz else "aberta"
    if evento == "cancelar":
        return "cancelada"
    raise DomainError(f"evento desconhecido: {evento}")
