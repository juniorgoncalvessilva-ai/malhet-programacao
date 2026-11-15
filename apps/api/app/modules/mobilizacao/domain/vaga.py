"""Vaga de contratação (spec 089): o Planejamento abre a vaga (função padronizada, quantidade, quando a obra precisa) e o
RH atende abrindo processos de mobilização ligados a ela.

Situação derivada:
- CANCELADA quando cancelada;
- PREENCHIDA quando os mobilizados alcançam a quantidade;
- EM_ATENDIMENTO quando há processo aberto;
- ABERTA nos demais casos.
Saldo = quantidade − mobilizados − em processo (o que o RH ainda precisa iniciar). Desistência devolve a posição ao saldo.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime
from enum import StrEnum
from statistics import mean

from app.shared.errors import DomainError
from app.shared.memoria import Fonte, Memoria, Passo, num


class SituacaoVaga(StrEnum):
    ABERTA = "ABERTA"
    EM_ATENDIMENTO = "EM_ATENDIMENTO"
    PREENCHIDA = "PREENCHIDA"
    CANCELADA = "CANCELADA"

    @property
    def rotulo(self) -> str:
        return {"ABERTA": "Aberta", "EM_ATENDIMENTO": "Em atendimento", "PREENCHIDA": "Preenchida",
                "CANCELADA": "Cancelada"}[self.value]


@dataclass(frozen=True)
class Vaga:
    funcao: str
    quantidade: int
    necessario_em: date | None = None

    def __post_init__(self) -> None:
        if not self.funcao.strip():
            raise DomainError("escolha a função da vaga", "funcao")
        if not 1 <= self.quantidade <= 500:
            raise DomainError("quantidade entre 1 e 500", "quantidade")


@dataclass(frozen=True)
class Ocupacao:
    quantidade: int
    mobilizados: int
    em_processo: int
    desistencias: int = 0
    cancelada: bool = False

    @property
    def saldo(self) -> int:
        return max(0, self.quantidade - self.mobilizados - self.em_processo)

    @property
    def situacao(self) -> SituacaoVaga:
        if self.cancelada:
            return SituacaoVaga.CANCELADA
        if self.mobilizados >= self.quantidade:
            return SituacaoVaga.PREENCHIDA
        return SituacaoVaga.EM_ATENDIMENTO if self.em_processo else SituacaoVaga.ABERTA

    def aceita_processo(self) -> None:
        if self.cancelada:
            raise DomainError("a vaga está cancelada", "vaga_id")
        if self.saldo <= 0:
            raise DomainError(f"a vaga já tem {self.mobilizados} mobilizado(s) e {self.em_processo} em processo para "
                              f"{self.quantidade} posição(ões): aumente a quantidade ou abra outra vaga", "vaga_id")


def proximo_codigo(codigos: list[str]) -> str:
    nums = [int(m.group(1)) for c in codigos if (m := re.fullmatch(r"RQ-(\d+)", c or ""))]
    return f"RQ-{(max(nums) if nums else 0) + 1:04d}"


@dataclass(frozen=True)
class VagaResumo:
    codigo: str
    funcao: str
    ocupacao: Ocupacao
    aberta_em: datetime
    necessario_em: date | None
    preenchida_em: datetime | None  # saída do crachá do último mobilizado que completou a vaga


def resumo(vagas: list[VagaResumo], hoje: date) -> dict[str, Memoria]:
    ativas = [v for v in vagas if v.ocupacao.situacao in (SituacaoVaga.ABERTA, SituacaoVaga.EM_ATENDIMENTO)]
    saldo = sum(v.ocupacao.saldo for v in ativas)
    posicoes = sum(v.ocupacao.quantidade - v.ocupacao.mobilizados for v in ativas)
    atrasadas = [v for v in ativas if v.necessario_em and v.necessario_em < hoje]
    preench = [(v, (v.preenchida_em - v.aberta_em).total_seconds() / 86400) for v in vagas
               if v.ocupacao.situacao == SituacaoVaga.PREENCHIDA and v.preenchida_em]
    media = mean(d for _, d in preench) if preench else None
    return {
        "vagas_abertas": Memoria(
            chave="vagas_abertas", titulo="Vagas abertas", valor=str(len(ativas)),
            formula="vagas não canceladas e ainda não preenchidas",
            passos=(Passo("Posições a preencher", "Σ (quantidade − mobilizados)", str(posicoes)),
                    Passo("Sem processo iniciado (saldo)", "Σ (quantidade − mobilizados − em processo)", str(saldo), True)),
            fontes=tuple(Fonte(v.codigo, f"{v.funcao}: {v.ocupacao.mobilizados}/{v.ocupacao.quantidade}", "vaga") for v in ativas[:60])),
        "vagas_saldo": Memoria(
            chave="vagas_saldo", titulo="Posições sem processo iniciado", valor=str(saldo),
            formula="Σ (quantidade − mobilizados − em processo) das vagas abertas: o que o RH ainda precisa iniciar",
            passos=tuple(Passo(v.codigo, f"{v.ocupacao.quantidade} − {v.ocupacao.mobilizados} − {v.ocupacao.em_processo}",
                               str(v.ocupacao.saldo)) for v in ativas[:30]),
            fontes=tuple(Fonte(v.codigo, v.funcao, "vaga") for v in ativas[:60])),
        "vagas_atrasadas": Memoria(
            chave="vagas_atrasadas", titulo="Vagas com a data da obra vencida", valor=str(len(atrasadas)),
            formula=f"vagas abertas com 'obra precisa em' antes de hoje ({hoje:%d/%m/%Y})",
            fontes=tuple(Fonte(v.codigo, f"precisava em {v.necessario_em:%d/%m/%Y}", v.funcao) for v in atrasadas[:60])),
        "vagas_tempo": Memoria(
            chave="vagas_tempo", titulo="Tempo médio para preencher a vaga", valor=f"{num(media, 1)} d" if media is not None else "—",
            formula="média dos dias entre a abertura da vaga e o crachá do último mobilizado que a completou",
            passos=(Passo("Vagas preenchidas", "", str(len(preench))),
                    Passo("Média", " + ".join(num(d, 1) for _, d in preench[:10]) + (" …" if len(preench) > 10 else ""),
                          f"{num(media, 1)} d" if media is not None else "—", True)),
            fontes=tuple(Fonte(v.codigo, f"{num(d, 1)} d", v.funcao) for v, d in preench[:60])),
    }
