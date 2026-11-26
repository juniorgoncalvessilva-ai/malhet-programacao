"""Portal do encarregado (spec 111): o líder confere a própria equipe por um link da obra (enviado ao grupo do
WhatsApp), entrando com a matrícula e a senha. A senha inicial é 123456 e, no primeiro acesso, ele cria a dele.

Quem pode entrar: o encarregado de uma equipe ativa, o responsável e o supervisor das equipes e os líderes
cadastrados pelo Planejamento (quem não tem a função de encarregado). Cada um vê as equipes que lidera.
"""
import re
from collections import deque
from dataclasses import dataclass

from app.shared.errors import DomainError

SENHA_INICIAL = "123456"
TENTATIVAS = 5  # erros de senha por matrícula/aparelho…
JANELA_S = 15 * 60  # …a cada 15 minutos
HORAS_SESSAO = 12


FUNCOES_DE_LIDER = re.compile(r"ENCARREG|L[IÍ]DER|MESTRE|SUPERVISOR|FEITOR", re.IGNORECASE)
# spec 147: o apontador entra pela rota dele (/apontador/...) — pela função no efetivo ou cadastrado em Acesso dos líderes
FUNCOES_DE_APONTADOR = re.compile(r"APONTADOR|APROPRIADOR", re.IGNORECASE)
PERFIS = ("lider", "apontador")


def normalizar_codigo(valor: object) -> str:
    """Matrícula/crachá como a pessoa digita e como a planilha grava, iguais: "0115532", "115.532", "115532.0" (Excel)
    e " 115532 " → "115532". Letras ficam (crachá de terceiro "T77")."""
    t = re.sub(r"\.0+$", "", str(valor or "").strip())
    t = "".join(ch for ch in t if ch.isalnum()).upper()
    return (t.lstrip("0") or "0") if t else ""


def funcao_de_lider(funcao: str | None) -> bool:
    """Quem tem função de liderança no efetivo entra no link mesmo sem equipe — para pedir a dele (spec 114)."""
    return bool(funcao and FUNCOES_DE_LIDER.search(funcao))


def funcao_de_apontador(funcao: str | None) -> bool:
    return bool(funcao and FUNCOES_DE_APONTADOR.search(funcao))


def validar_pedido(disciplina: str | None, membros: list[str], maximo: int = 80) -> tuple[str, list[str]]:
    d = " ".join((disciplina or "").split()).upper()[:60]
    if len(d) < 2:
        raise DomainError("diga a disciplina da equipe (ex.: FORMA, CONCRETO)", "disciplina")
    vistos: list[str] = []
    for m in membros:
        m = (m or "").strip()
        if m and m not in vistos:
            vistos.append(m)
    if not vistos:
        raise DomainError("aponte ao menos uma pessoa que está com você", "membros")
    if len(vistos) > maximo:
        raise DomainError(f"até {maximo} pessoas por pedido", "membros")
    return d, vistos


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
    meus = {normalizar_codigo(c) for c in codigos} - {""}
    for e in equipes:
        if not e.ativo:
            continue
        if (e.encarregado and normalizar_codigo(e.encarregado) in meus) or colaborador_id in (e.responsavel_id, e.supervisor_id) or e.id in extras:
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
