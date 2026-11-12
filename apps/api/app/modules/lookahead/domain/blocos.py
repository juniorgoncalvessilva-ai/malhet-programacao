"""Look-ahead das equipes: o andar de cada equipe no tempo e pelas frentes, a partir das programações.

Cada dia programado (previsto ou realizado > 0) de uma linha vira um dia da equipe naquela atividade/área. Dias
seguidos da mesma equipe na mesma atividade formam um bloco (cartão); um fim de semana sem nada no meio não quebra o
bloco. Quando duas programações cobrem o mesmo dia (a semanal começa na sexta anterior), vale a mais nova.
"""
from dataclasses import dataclass, field
from datetime import date, timedelta


@dataclass(frozen=True)
class DiaEquipe:
    equipe_id: int
    area_id: int
    atividade: tuple  # chave da atividade (tipo, item simova, item PQ)
    data: date
    previsto: float
    realizado: float | None
    programacao_id: int
    linha_id: int
    inicio_programacao: date


@dataclass
class Bloco:
    equipe_id: int
    area_id: int
    atividade: tuple
    inicio: date
    fim: date
    linha_id: int
    programacao_id: int
    dias: list[DiaEquipe] = field(default_factory=list)

    @property
    def total_previsto(self) -> float:
        return round(sum(d.previsto for d in self.dias), 4)

    @property
    def total_realizado(self) -> float | None:
        r = [d.realizado for d in self.dias if d.realizado is not None]
        return round(sum(r), 4) if r else None


def mais_novo_por_dia(dias: list[DiaEquipe]) -> list[DiaEquipe]:
    """Mesma equipe, atividade e área no mesmo dia em duas programações: fica a de início mais recente."""
    por: dict[tuple, DiaEquipe] = {}
    for d in dias:
        k = (d.equipe_id, d.area_id, d.atividade, d.data)
        if k not in por or d.inicio_programacao > por[k].inicio_programacao:
            por[k] = d
    return list(por.values())


def _so_fim_de_semana(de: date, ate: date) -> bool:
    d = de + timedelta(days=1)
    while d < ate:
        if d.weekday() < 5:
            return False
        d += timedelta(days=1)
    return True


def blocos(dias: list[DiaEquipe]) -> list[Bloco]:
    out: list[Bloco] = []
    chave = lambda d: (d.equipe_id, d.area_id, d.atividade)  # noqa: E731
    for d in sorted(mais_novo_por_dia(dias), key=lambda d: (chave(d), d.data)):
        b = out[-1] if out else None
        if b and (b.equipe_id, b.area_id, b.atividade) == chave(d) and (
                (d.data - b.fim).days == 1 or _so_fim_de_semana(b.fim, d.data)):
            b.fim = d.data
            b.dias.append(d)
        else:
            out.append(Bloco(d.equipe_id, d.area_id, d.atividade, d.data, d.data, d.linha_id, d.programacao_id, [d]))
    return sorted(out, key=lambda b: (b.equipe_id, b.inicio, b.area_id))


def faixas(bs: list[Bloco]) -> dict[int, int]:
    """Faixa (linha visual) de cada bloco dentro da raia: blocos que se sobrepõem no tempo vão para faixas diferentes."""
    out: dict[int, int] = {}
    fim_da_faixa: list[date] = []
    for i, b in sorted(enumerate(bs), key=lambda t: (t[1].inicio, t[1].fim)):
        for f, fim in enumerate(fim_da_faixa):
            if fim < b.inicio:
                fim_da_faixa[f] = b.fim
                out[i] = f
                break
        else:
            fim_da_faixa.append(b.fim)
            out[i] = len(fim_da_faixa) - 1
    return out
