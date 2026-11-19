"""Portal do encarregado (spec 111): o líder confere a própria equipe por um link da obra (enviado ao grupo do
WhatsApp), entrando com a matrícula e a senha. A senha inicial é 123456 e, no primeiro acesso, ele cria a dele.

Quem pode entrar: o encarregado de uma equipe ativa, o responsável e o supervisor das equipes e os líderes
cadastrados pelo Planejamento (quem não tem a função de encarregado). Cada um vê as equipes que lidera.
"""
from collections import deque
from dataclasses import dataclass

from app.shared.errors import DomainError

SENHA_INICIAL = "123456"
TENTATIVAS = 5  # erros de senha por matrícula/aparelho…
JANELA_S = 15 * 60  # …a cada 15 minutos
HORAS_SESSAO = 12


def validar_nova_senha(nova: str, repetida: str | None = None) -> str:
    s = (nova or "").strip()
    if repetida is not None and s != (repetida or "").strip():
        raise DomainError("as duas senhas não são iguais", "repetida")
    if not 6 <= len(s) <= 20:
        raise DomainError("a senha tem de 6 a 20 caracteres", "nova")
    if s == SENHA_INICIAL or len(set(s)) == 1 or s in ("123456789", "654321", "012345", "abcdef"):
        raise DomainError("escolha uma senha diferente de 123456 e menos óbvia", "nova")
    return s


@dataclass(frozen=True)
class EquipeDoLider:
    id: int
    encarregado: str | None
    responsavel_id: int | None
    supervisor_id: int | None
    ativo: bool = True


def equipes_do_lider(codigos: set[str], colaborador_id: int, extras: set[int], equipes: list[EquipeDoLider]) -> list[int]:
    """Equipes ativas que a pessoa lidera: é o encarregado (crachá/matrícula), o responsável, o supervisor ou recebeu
    a equipe no cadastro de líderes."""
    out = []
    for e in equipes:
        if not e.ativo:
            continue
        if (e.encarregado and e.encarregado in codigos) or colaborador_id in (e.responsavel_id, e.supervisor_id) or e.id in extras:
            out.append(e.id)
    return out


class Tentativas:
    """Limite de senhas erradas por chave (matrícula + aparelho), em memória (a API roda em um processo)."""

    def __init__(self, maximo: int = TENTATIVAS, janela: float = JANELA_S):
        self.maximo, self.janela = maximo, janela
        self._erros: dict[str, deque] = {}

    def bloqueado(self, chave: str, agora: float) -> bool:
        q = self._erros.get(chave)
        while q and agora - q[0] > self.janela:
            q.popleft()
        return bool(q) and len(q) >= self.maximo

    def errou(self, chave: str, agora: float) -> None:
        self._erros.setdefault(chave, deque()).append(agora)

    def acertou(self, chave: str) -> None:
        self._erros.pop(chave, None)

    def zerar(self) -> None:
        self._erros.clear()
