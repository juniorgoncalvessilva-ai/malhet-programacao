"""Agregado ItemProgramacao: uma atividade (OPER) programada para um encarregado numa frente.

Regras (entidade rica, imutável — métodos retornam clones):
- período de no máximo 7 dias (a FT do Simova tem uma coluna por dia da semana);
- cada dia programado precisa estar dentro do período e não pode repetir;
- origem 'cronograma' exige a atividade do cronograma (id_crono); 'pq' exige o item da PQ;
- PE e HH não podem ser negativos e ao menos um dia precisa ter PE ou HH;
- com índice da CPU (HH/un), o HH faltante é derivado do PE: HH = PE × índice.
"""
from __future__ import annotations

from dataclasses import dataclass, field, replace
from datetime import date
from enum import StrEnum

from app.shared.errors import DomainError

DIAS_SEMANA = ("SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO", "DOMINGO")
MAX_DIAS_PERIODO = 7


class Origem(StrEnum):
    CRONOGRAMA = "cronograma"  # atividade do cronograma vigente (P6)
    PQ = "pq"  # atividade fora do cronograma, só item da PQ
    PADRAO = "padrao"  # OPER padrão do Simova sem vínculo (encarregado sem programação)

    @classmethod
    def deduzir(cls, id_crono: str | None, item_pq: str | None) -> "Origem":
        if id_crono:
            return cls.CRONOGRAMA
        if item_pq:
            return cls.PQ
        return cls.PADRAO


class Status(StrEnum):
    RASCUNHO = "rascunho"
    APROVADO = "aprovado"
    EXPORTADO = "exportado"


@dataclass(frozen=True)
class DiaPlano:
    data: date
    pe: float | None = None
    hh: float | None = None

    def __post_init__(self) -> None:
        if self.pe is not None and self.pe < 0:
            raise DomainError("PE não pode ser negativo", "pe")
        if self.hh is not None and self.hh < 0:
            raise DomainError("HH não pode ser negativo", "hh")

    @property
    def dia_semana(self) -> str:
        return DIAS_SEMANA[self.data.weekday()]

    @property
    def vazio(self) -> bool:
        return not self.pe and not self.hh


@dataclass(frozen=True)
class ItemProgramacao:
    encarregado_cracha: str
    encarregado_nome: str
    grupo_codigo: str
    grupo_descricao: str
    oper_codigo: str
    oper_descricao: str
    frente_codigo: str
    data_inicio: date
    data_fim: date
    origem: Origem
    dias: tuple[DiaPlano, ...] = field(default_factory=tuple)
    tarefa_codigo: str | None = None
    observacao: str | None = None
    indice_hh_por_unidade: float | None = None
    status: Status = Status.RASCUNHO
    # Referências (vínculo cronograma × PQ × CPU) e versões vigentes usadas
    vinculo_id: int | None = None
    id_crono: str | None = None
    item_pq: str | None = None
    composicao: str | None = None
    versoes: dict[str, int] = field(default_factory=dict)
    id: int | None = None

    def __post_init__(self) -> None:
        self._validar()

    # ---- regras -------------------------------------------------------------
    def _validar(self) -> None:
        for nome in ("encarregado_cracha", "encarregado_nome", "grupo_codigo", "oper_codigo", "frente_codigo"):
            if not getattr(self, nome):
                raise DomainError(f"{nome} é obrigatório", nome)
        if self.data_fim < self.data_inicio:
            raise DomainError("data_fim anterior à data_inicio", "data_fim")
        if (self.data_fim - self.data_inicio).days + 1 > MAX_DIAS_PERIODO:
            raise DomainError("período maior que 7 dias (a FT do Simova é semanal)", "data_fim")
        datas = [d.data for d in self.dias]
        if len(datas) != len(set(datas)):
            raise DomainError("dia programado em duplicidade", "dias")
        for d in self.dias:
            if not (self.data_inicio <= d.data <= self.data_fim):
                raise DomainError(f"dia {d.data.isoformat()} fora do período", "dias")
        if all(d.vazio for d in self.dias):
            raise DomainError("informe PE ou HH em pelo menos um dia", "dias")
        if self.origem == Origem.CRONOGRAMA and not self.id_crono:
            raise DomainError("item do cronograma precisa da atividade (id_crono)", "id_crono")
        if self.origem == Origem.PQ and not self.item_pq:
            raise DomainError("item fora do cronograma precisa do item da PQ", "item_pq")
        if self.indice_hh_por_unidade is not None and self.indice_hh_por_unidade <= 0:
            raise DomainError("índice HH/un da CPU deve ser positivo", "indice_hh_por_unidade")

    # ---- comportamento ------------------------------------------------------
    def com_hh_calculado(self) -> ItemProgramacao:
        """Deriva HH = PE × índice da CPU nos dias em que o HH não foi informado."""
        if not self.indice_hh_por_unidade:
            return self
        dias = tuple(
            replace(d, hh=round(d.pe * self.indice_hh_por_unidade, 2)) if d.hh is None and d.pe else d
            for d in self.dias
        )
        return replace(self, dias=dias)

    def hh_no_dia(self, data: date) -> float:
        return sum(d.hh or 0 for d in self.dias if d.data == data)

    def aprovar(self) -> ItemProgramacao:
        if self.status != Status.RASCUNHO:
            raise DomainError(f"só itens em rascunho podem ser aprovados (atual: {self.status})")
        return replace(self, status=Status.APROVADO)

    def marcar_exportado(self) -> ItemProgramacao:
        if self.status != Status.APROVADO:
            raise DomainError("só itens aprovados podem ser exportados ao Simova")
        return replace(self, status=Status.EXPORTADO)
