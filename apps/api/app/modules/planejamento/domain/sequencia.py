"""Sequência da programação (spec 054): ordem cronológica das linhas e as ligações entre elas, como no Primavera.

Tipos de ligação (predecessora → sucessora), com defasagem (lag) em dias:
    TI  término → início   a sucessora começa depois que a predecessora termina      (FS)
    II  início  → início   a sucessora começa junto/depois do início da predecessora (SS)
    TT  término → término  a sucessora termina junto/depois do término da predecessora (FF)
    IT  início  → término  a sucessora termina junto/depois do início da predecessora (SF)
A janela de cada linha é o 1º e o último dia com previsto na programação. A conferência aponta a ligação que a janela
não respeita; a ordenação cronológica respeita as ligações (ordem topológica) e, entre linhas livres, o 1º dia.
"""
from dataclasses import dataclass
from datetime import date, timedelta

from app.shared.errors import DomainError

TIPOS = ("TI", "II", "TT", "IT")
ROTULO = {"TI": "término → início", "II": "início → início", "TT": "término → término", "IT": "início → término"}


@dataclass(frozen=True)
class Ligacao:
    de: int  # linha predecessora
    tipo: str
    lag: int = 0

    def __post_init__(self):
        if self.tipo not in TIPOS:
            raise DomainError(f"tipo de ligação inválido: {self.tipo} (use TI, II, TT ou IT)", "tipo")
        if not -365 <= self.lag <= 365:
            raise DomainError("defasagem entre -365 e 365 dias", "lag")


def validar(ligacoes: dict[int, list[Ligacao]], linhas: set[int]) -> None:
    """Predecessoras existem, nenhuma linha depende de si mesma e não há ciclo."""
    for suc, ls in ligacoes.items():
        for lg in ls:
            if lg.de not in linhas or suc not in linhas:
                raise DomainError("ligação com linha que não está na programação", "predecessoras")
            if lg.de == suc:
                raise DomainError("uma linha não pode ser predecessora dela mesma", "predecessoras")
    estado: dict[int, int] = {}

    def visitar(n: int) -> None:
        estado[n] = 1
        for lg in ligacoes.get(n, []):
            if estado.get(lg.de) == 1:
                raise DomainError("as ligações fecham um ciclo (A depende de B que depende de A)", "predecessoras")
            if estado.get(lg.de) is None:
                visitar(lg.de)
        estado[n] = 2

    for n in linhas:
        if estado.get(n) is None:
            visitar(n)


def conferir(lg: Ligacao, pred: tuple[date, date] | None, suc: tuple[date, date] | None) -> str | None:
    """Mensagem quando a janela da sucessora não respeita a ligação (None = ok ou sem previsto para conferir)."""
    if pred is None or suc is None:
        return None
    (pi, pf), (si, sf) = pred, suc
    d = timedelta(days=lg.lag)
    if lg.tipo == "TI" and si <= pf + d:
        return f"começa {si:%d/%m}, antes do término da predecessora ({pf:%d/%m}{f' + {lg.lag} d' if lg.lag else ''})"
    if lg.tipo == "II" and si < pi + d:
        return f"começa {si:%d/%m}, antes do início da predecessora ({pi:%d/%m}{f' + {lg.lag} d' if lg.lag else ''})"
    if lg.tipo == "TT" and sf < pf + d:
        return f"termina {sf:%d/%m}, antes do término da predecessora ({pf:%d/%m}{f' + {lg.lag} d' if lg.lag else ''})"
    if lg.tipo == "IT" and sf < pi + d:
        return f"termina {sf:%d/%m}, antes do início da predecessora ({pi:%d/%m}{f' + {lg.lag} d' if lg.lag else ''})"
    return None


def ordem_cronologica(linhas: list[int], janela: dict[int, tuple[date, date] | None], atual: dict[int, int],
                      ligacoes: dict[int, list[Ligacao]]) -> list[int]:
    """Ordem topológica pelas ligações; entre as liberadas, a que começa antes (sem previsto vai para o fim)."""
    pendentes = {n: {lg.de for lg in ligacoes.get(n, []) if lg.de in linhas} for n in linhas}
    chave = lambda n: (janela[n][0] if janela.get(n) else date.max, atual.get(n, 0), n)  # noqa: E731
    saida: list[int] = []
    feitos: set[int] = set()
    while len(saida) < len(linhas):
        livres = [n for n in linhas if n not in feitos and pendentes[n] <= feitos]
        if not livres:  # não acontece (validar barra ciclos), mas não trava
            livres = [n for n in linhas if n not in feitos]
        n = min(livres, key=chave)
        saida.append(n)
        feitos.add(n)
    return saida
