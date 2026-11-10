"""Sequenciador serial por equipe — portado do script de sequência (programação serial).

Cada equipe faz uma atividade por vez. Começa primeiro quem pode começar antes, respeitando
predecessoras TI (término→início) e II (início→início) com defasagem em dias de referência.
Ciclos: o que sobra fica com início/fim 0, na ordem original.
"""
from dataclasses import dataclass, field
from enum import StrEnum


class TipoLigacao(StrEnum):
    TI = "TI"
    II = "II"


@dataclass(frozen=True)
class Predecessora:
    numero: int
    tipo: TipoLigacao = TipoLigacao.TI
    lag: float = 0.0  # já em dias de referência


@dataclass(frozen=True)
class AtividadeSeq:
    numero: int
    duracao: float  # dias de referência
    equipe: str | None = None
    predecessoras: tuple[Predecessora, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class ResultadoSeq:
    inicio: dict[int, float]
    fim: dict[int, float]
    sequencia_na_equipe: dict[int, int]
    em_ciclo: tuple[int, ...] = ()


def sequenciar(atividades: list[AtividadeSeq]) -> ResultadoSeq:
    at = {a.numero: a for a in atividades}
    preds = {n: [p for p in a.predecessoras if p.numero in at and p.numero != n] for n, a in at.items()}
    S: dict[int, float] = {}
    E: dict[int, float] = {}
    livre: dict[str, float] = {}
    cont: dict[str, int] = {}
    seq: dict[int, int] = {}
    pend = set(at)
    ciclo: tuple[int, ...] = ()
    while pend:
        cand = []
        for n in pend:
            if all(p.numero in E for p in preds[n]):
                es = max([0.0] + [(S[p.numero] if p.tipo == TipoLigacao.II else E[p.numero]) + p.lag for p in preds[n]])
                eq = at[n].equipe
                ini = max(es, livre.get(eq, 0.0)) if eq else es
                cand.append((ini, es, n))
        if not cand:
            ciclo = tuple(sorted(pend))
            for n in ciclo:
                S[n] = E[n] = 0.0
            break
        ini, _, n = min(cand)
        S[n], E[n] = ini, ini + at[n].duracao
        pend.discard(n)
        eq = at[n].equipe
        if eq:
            livre[eq] = E[n]
            cont[eq] = cont.get(eq, 0) + 1
            seq[n] = cont[eq]
    return ResultadoSeq(S, E, seq, ciclo)


def producao_com_sequencia(
    capacidade: float, inicio_ref: float, fim_ref: float, fatores_acumulados: list[float]
) -> list[float]:
    """Prev D (com sequência): capacidade × sobreposição da janela [início, fim] com cada dia de referência."""
    out, anterior = [], 0.0
    for fk in fatores_acumulados:
        out.append(round(capacidade * max(0.0, min(fk, fim_ref) - max(anterior, inicio_ref)), 2))
        anterior = fk
    return out
