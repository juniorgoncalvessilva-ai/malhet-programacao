from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.programacao.domain.item_programacao import (
    DiaPlano,
    ItemProgramacao,
    Origem,
    Status,
)
from app.modules.programacao.infra.models import ProgramacaoDiaModel, ProgramacaoItemModel


def _to_domain(m: ProgramacaoItemModel) -> ItemProgramacao:
    return ItemProgramacao(
        id=m.id,
        encarregado_cracha=m.encarregado_cracha,
        encarregado_nome=m.encarregado_nome,
        grupo_codigo=m.grupo_codigo,
        grupo_descricao=m.grupo_descricao,
        oper_codigo=m.oper_codigo,
        oper_descricao=m.oper_descricao,
        frente_codigo=m.frente_codigo,
        tarefa_codigo=m.tarefa_codigo,
        observacao=m.observacao,
        data_inicio=m.data_inicio,
        data_fim=m.data_fim,
        origem=Origem(m.origem),
        status=Status(m.status),
        indice_hh_por_unidade=m.indice_hh_por_unidade,
        vinculo_id=m.vinculo_id,
        id_crono=m.id_crono,
        item_pq=m.item_pq,
        composicao=m.composicao,
        versoes=dict(m.versoes or {}),
        dias=tuple(DiaPlano(d.data, d.pe, d.hh) for d in m.dias),
    )


class SqlProgramacaoRepository:
    def __init__(self, session: Session):
        self.s = session

    def salvar(self, item: ItemProgramacao, criado_por: str) -> ItemProgramacao:
        m = ProgramacaoItemModel(
            encarregado_cracha=item.encarregado_cracha,
            encarregado_nome=item.encarregado_nome,
            grupo_codigo=item.grupo_codigo,
            grupo_descricao=item.grupo_descricao,
            oper_codigo=item.oper_codigo,
            oper_descricao=item.oper_descricao,
            frente_codigo=item.frente_codigo,
            tarefa_codigo=item.tarefa_codigo,
            observacao=item.observacao,
            data_inicio=item.data_inicio,
            data_fim=item.data_fim,
            origem=item.origem.value,
            status=item.status.value,
            indice_hh_por_unidade=item.indice_hh_por_unidade,
            vinculo_id=item.vinculo_id,
            id_crono=item.id_crono,
            item_pq=item.item_pq,
            composicao=item.composicao,
            versoes=dict(item.versoes),
            criado_por=criado_por,
            dias=[ProgramacaoDiaModel(data=d.data, pe=d.pe, hh=d.hh) for d in item.dias],
        )
        self.s.add(m)
        self.s.flush()
        return _to_domain(m)

    def atualizar_status(self, item: ItemProgramacao) -> None:
        m = self.s.get(ProgramacaoItemModel, item.id)
        if m is None:
            return
        m.status = item.status.value
        if item.status == Status.EXPORTADO:
            m.exportado_em = datetime.now(timezone.utc)
        self.s.flush()

    def obter(self, item_id: int) -> ItemProgramacao | None:
        m = self.s.get(ProgramacaoItemModel, item_id)
        return _to_domain(m) if m else None

    def do_encarregado(self, cracha: str, inicio: date, fim: date) -> list[ItemProgramacao]:
        q = select(ProgramacaoItemModel).where(
            ProgramacaoItemModel.encarregado_cracha == cracha,
            ProgramacaoItemModel.data_inicio <= fim,
            ProgramacaoItemModel.data_fim >= inicio,
        )
        return [_to_domain(m) for m in self.s.scalars(q)]

    def do_periodo(self, inicio: date, fim: date, status: str | None = None) -> list[ItemProgramacao]:
        q = select(ProgramacaoItemModel).where(
            ProgramacaoItemModel.data_inicio <= fim, ProgramacaoItemModel.data_fim >= inicio
        )
        if status:
            q = q.where(ProgramacaoItemModel.status == status)
        q = q.order_by(ProgramacaoItemModel.encarregado_nome, ProgramacaoItemModel.oper_codigo)
        return [_to_domain(m) for m in self.s.scalars(q)]

    def excluir(self, item_id: int) -> None:
        m = self.s.get(ProgramacaoItemModel, item_id)
        if m:
            self.s.delete(m)
            self.s.flush()
