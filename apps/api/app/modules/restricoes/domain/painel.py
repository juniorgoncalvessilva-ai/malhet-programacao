"""Painel das restrições (o mesmo do PAINEL AÇÃO do Excel e da aba Painel da tela) — sem I/O.

- status: todas as ações por STATUS 2
- responsável: pendentes por responsável e status (Atrasado, Reprogramado, No Prazo), os 14 com mais pendências
- semana: pendentes por semana do projeto
- áreas: todas as ações por área e STATUS 1 (Pendente, Concluído, Cancelado), as 15 áreas com mais ações
- 6M: pendentes por classificação 6M
- gerência: todas as ações por gerência
"""
from collections import Counter
from dataclasses import dataclass

ORDEM_STATUS = ("Concluído", "No Prazo", "Reprogramado", "Atrasado", "Cancelado")
STATUS_PENDENTE = ("Atrasado", "Reprogramado", "No Prazo")
STATUS1 = ("Pendente", "Concluído", "Cancelado")


@dataclass(frozen=True)
class LinhaPainel:
    id: int
    status1: str
    status2: str
    responsavel: str | None
    area: str | None
    gerencia: str | None
    seis_m: str | None
    semana: int | None


@dataclass(frozen=True)
class Grupo:
    rotulo: str
    ids: dict[str, tuple[int, ...]]  # série → ids das ações

    def n(self, serie: str) -> int:
        return len(self.ids.get(serie, ()))


def _grupos(linhas: list[LinhaPainel], chave, series: tuple[str, ...], serie_de, limite: int | None = None) -> list[Grupo]:
    cont = Counter(chave(x) for x in linhas)
    nomes = [k for k, _q in cont.most_common(limite)]
    return [Grupo(k, {s: tuple(x.id for x in linhas if chave(x) == k and serie_de(x) == s) for s in series}) for k in nomes]


def painel(linhas: list[LinhaPainel]) -> dict[str, list[Grupo]]:
    pend = [x for x in linhas if x.status1 == "Pendente"]
    st = [s for s in ORDEM_STATUS if any(x.status2 == s for x in linhas)]
    sem = sorted({x.semana for x in pend if x.semana is not None})
    return {
        "status": [Grupo(s, {"total": tuple(x.id for x in linhas if x.status2 == s)}) for s in st],
        "responsavel": _grupos(pend, lambda x: x.responsavel or "—", STATUS_PENDENTE, lambda x: x.status2, 14),
        "semana": [Grupo(f"S{w}", {"total": tuple(x.id for x in pend if x.semana == w)}) for w in sem],
        "areas": _grupos(linhas, lambda x: x.area or "—", STATUS1, lambda x: x.status1, 15),
        "seis_m": _grupos(pend, lambda x: x.seis_m or "", ("total",), lambda _x: "total"),
        "gerencia": _grupos(linhas, lambda x: x.gerencia or "—", ("total",), lambda _x: "total"),
    }
