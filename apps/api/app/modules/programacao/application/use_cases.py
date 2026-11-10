"""Casos de uso (comandos) da programação. Consultas simples ficam direto no router (CQRS leve)."""
from dataclasses import dataclass, field
from datetime import date

from app.modules.programacao.domain import capacidade
from app.modules.programacao.domain.capacidade import OcupacaoDia
from app.modules.programacao.domain.item_programacao import DiaPlano, ItemProgramacao, Origem
from app.modules.programacao.domain.ports import CatalogoGateway, ProgramacaoRepository
from app.shared.errors import DomainError, NotFoundError


@dataclass(frozen=True)
class DiaIn:
    data: date
    pe: float | None = None
    hh: float | None = None


@dataclass(frozen=True)
class CriarItemIn:
    encarregado_cracha: str
    encarregado_nome: str
    grupo_codigo: str
    oper_codigo: str
    frente_codigo: str
    data_inicio: date
    data_fim: date
    dias: list[DiaIn]
    tarefa_codigo: str | None = None
    observacao: str | None = None
    vinculo_id: int | None = None
    permitir_excesso: bool = False


@dataclass
class CriarItemOut:
    item: ItemProgramacao
    hh_disponivel_dia: float
    ocupacao: list[OcupacaoDia] = field(default_factory=list)
    avisos: list[str] = field(default_factory=list)


class CriarItemProgramacao:
    def __init__(self, repo: ProgramacaoRepository, catalogo: CatalogoGateway):
        self.repo = repo
        self.catalogo = catalogo

    def executar(self, dados: CriarItemIn, usuario: str) -> CriarItemOut:
        oper = self.catalogo.oper(dados.grupo_codigo, dados.oper_codigo, dados.vinculo_id)
        if oper is None:
            raise NotFoundError("OPER", f"{dados.grupo_codigo}/{dados.oper_codigo}")
        if not self.catalogo.frente_existe(dados.frente_codigo):
            raise NotFoundError("FRENTE", dados.frente_codigo)

        tarefa = dados.tarefa_codigo or oper.tarefa_codigo
        item = ItemProgramacao(
            encarregado_cracha=dados.encarregado_cracha,
            encarregado_nome=dados.encarregado_nome,
            grupo_codigo=oper.grupo_codigo,
            grupo_descricao=oper.grupo_descricao,
            oper_codigo=oper.codigo,
            oper_descricao=oper.descricao,
            frente_codigo=dados.frente_codigo,
            data_inicio=dados.data_inicio,
            data_fim=dados.data_fim,
            origem=Origem.deduzir(oper.id_crono, oper.item_pq),
            dias=tuple(DiaPlano(d.data, d.pe, d.hh) for d in dados.dias),
            tarefa_codigo=tarefa,
            observacao=dados.observacao,
            indice_hh_por_unidade=oper.indice_hh_por_unidade,
            vinculo_id=oper.vinculo_id,
            id_crono=oper.id_crono,
            item_pq=oper.item_pq,
            composicao=oper.composicao,
            versoes=oper.versoes,
        ).com_hh_calculado()

        avisos: list[str] = []
        if oper.vinculo_id is None:
            avisos.append("OPER sem vínculo com cronograma/PQ/CPU: cadastre em Referências › Vínculos.")
        elif oper.indice_hh_por_unidade is None:
            avisos.append("Vínculo sem CPU/índice na versão vigente: HH não foi calculado a partir do PE.")

        equipe = self.catalogo.equipe(dados.encarregado_cracha)
        hh_disp = capacidade.hh_disponivel(equipe)
        existentes = self.repo.do_encarregado(dados.encarregado_cracha, dados.data_inicio, dados.data_fim)
        ocup = capacidade.ocupacao([*existentes, item], hh_disp)

        if not equipe:
            avisos.append("Encarregado sem equipe cadastrada: capacidade não verificada.")
        else:
            excedidos = [o for o in ocup if o.excedido]
            if excedidos and not dados.permitir_excesso:
                dias = ", ".join(f"{o.data:%d/%m} ({o.hh_programado}/{o.hh_disponivel} HH)" for o in excedidos)
                raise DomainError(f"Capacidade da equipe excedida em: {dias}", "dias")
            if excedidos:
                avisos.append("Programação acima da capacidade (permitido pelo usuário).")

        salvo = self.repo.salvar(item, criado_por=usuario)
        return CriarItemOut(salvo, hh_disp, ocup, avisos)


class AprovarItem:
    def __init__(self, repo: ProgramacaoRepository):
        self.repo = repo

    def executar(self, item_id: int) -> ItemProgramacao:
        item = self.repo.obter(item_id)
        if item is None:
            raise NotFoundError("Item de programação", item_id)
        aprovado = item.aprovar()
        self.repo.atualizar_status(aprovado)
        return aprovado


class ExcluirItem:
    def __init__(self, repo: ProgramacaoRepository):
        self.repo = repo

    def executar(self, item_id: int) -> None:
        item = self.repo.obter(item_id)
        if item is None:
            raise NotFoundError("Item de programação", item_id)
        if item.status == "exportado":
            raise DomainError("item já exportado ao Simova não pode ser excluído")
        self.repo.excluir(item_id)
