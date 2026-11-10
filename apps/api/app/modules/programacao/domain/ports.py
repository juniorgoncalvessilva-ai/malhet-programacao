"""Portas (interfaces) do módulo de programação. Implementações ficam em infra/."""
from dataclasses import dataclass, field
from datetime import date
from typing import Protocol

from app.modules.programacao.domain.capacidade import MembroEquipe
from app.modules.programacao.domain.item_programacao import ItemProgramacao


@dataclass(frozen=True)
class OperInfo:
    """Linguagem publicada por cadastros + referências (sem acoplar ao ORM).

    Já vem resolvida contra as versões VIGENTES de cronograma/PQ/CPU/índices.
    """

    grupo_codigo: str
    grupo_descricao: str
    codigo: str
    descricao: str
    tarefa_codigo: str | None = None
    vinculo_id: int | None = None
    id_crono: str | None = None
    item_pq: str | None = None
    composicao: str | None = None
    indice_hh_por_unidade: float | None = None
    versoes: dict[str, int] = field(default_factory=dict)


class ProgramacaoRepository(Protocol):
    def salvar(self, item: ItemProgramacao, criado_por: str) -> ItemProgramacao: ...
    def atualizar_status(self, item: ItemProgramacao) -> None: ...
    def obter(self, item_id: int) -> ItemProgramacao | None: ...
    def do_encarregado(self, cracha: str, inicio: date, fim: date) -> list[ItemProgramacao]: ...
    def do_periodo(self, inicio: date, fim: date, status: str | None = None) -> list[ItemProgramacao]: ...
    def excluir(self, item_id: int) -> None: ...


class CatalogoGateway(Protocol):
    def oper(self, grupo_codigo: str, oper_codigo: str, vinculo_id: int | None = None) -> OperInfo | None: ...
    def frente_existe(self, codigo: str) -> bool: ...
    def equipe(self, encarregado_cracha: str) -> list[MembroEquipe]: ...
