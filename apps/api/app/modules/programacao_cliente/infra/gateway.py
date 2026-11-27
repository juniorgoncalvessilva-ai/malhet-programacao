"""O que a conferência precisa ler dos outros módulos (spec 146), carregado uma vez por importação: frentes, equipes,
itens da PQ vigente, IDs do cronograma vigente, tipos do Catálogo (pelo item da PQ e pelo código g.t), IWPs da WBS e a
CPU (HH/un e índice) — só pela linguagem publicada de cada módulo."""
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.catalogo.infra.models import GrupoAtividadeModel, TipoAtividadeModel
from app.modules.equipes.infra.models import EquipeModel
from app.modules.frentes.infra.models import AreaFrenteModel, LocalFrenteModel
from app.modules.programacao_cliente.domain import vinculo as v
from app.modules.referencias.infra.models import AtividadeCronogramaModel, VersaoReferenciaModel
from app.modules.referencias.infra.pq_gateway import ItemPqInfo, itens_pq


@dataclass
class Referencias:
    areas: list[v.Area]
    area_por_id: dict[int, v.Area]
    equipes: list[v.Equipe]
    equipe_por_id: dict[int, v.Equipe]
    pq: dict[str, ItemPqInfo]
    pq_folhas: list[v.ItemPq]
    cronograma: dict[str, str]  # id → atividade
    tipo_por_item: dict[str, TipoAtividadeModel]
    tipo_por_codigo: dict[str, TipoAtividadeModel]  # "9.1" → tipo
    grupos: dict[int, GrupoAtividadeModel]
    vigentes: dict[str, int]
    _iwps: dict = field(default_factory=dict)


def carregar(s: Session, obra_id: int) -> Referencias:
    locais = {x.id: x.descricao for x in s.scalars(select(LocalFrenteModel).where(LocalFrenteModel.obra_id == obra_id))}
    areas = [v.Area(a.id, a.codigo, a.cwa, a.descricao, a.ativo_codigo, a.tag, locais.get(a.local_id))
             for a in s.scalars(select(AreaFrenteModel).where(AreaFrenteModel.obra_id == obra_id, AreaFrenteModel.ativo.is_(True))
                                .order_by(AreaFrenteModel.ordem, AreaFrenteModel.codigo))]
    equipes = [v.Equipe(e.id, e.nome, e.encarregado_nome)
               for e in s.scalars(select(EquipeModel).where(EquipeModel.obra_id == obra_id, EquipeModel.ativo.is_(True))
                                  .order_by(EquipeModel.nome))]
    pq = itens_pq(s, obra_id)
    vig = {t: i for t, i in s.execute(select(VersaoReferenciaModel.tipo, VersaoReferenciaModel.id).where(
        VersaoReferenciaModel.obra_id == obra_id, VersaoReferenciaModel.vigente.is_(True)))}
    crono = {}
    if "CRONOGRAMA" in vig:
        crono = {a.id_crono: a.atividade for a in s.scalars(select(AtividadeCronogramaModel).where(
            AtividadeCronogramaModel.versao_id == vig["CRONOGRAMA"]))}
    grupos = {g.id: g for g in s.scalars(select(GrupoAtividadeModel).where(GrupoAtividadeModel.obra_id == obra_id))}
    # o item da PQ é de um tipo só na obra (índice único): vale também o tipo inativo — o ativo vem por último e ganha
    tipos = sorted(s.scalars(select(TipoAtividadeModel).where(TipoAtividadeModel.obra_id == obra_id)), key=lambda t: bool(t.ativo))
    return Referencias(
        areas=areas, area_por_id={a.id: a for a in areas}, equipes=equipes, equipe_por_id={e.id: e for e in equipes}, pq=pq,
        pq_folhas=[v.ItemPq(i.item, i.texto_simova if i.nome_simplificado else i.descricao, i.unid) for i in pq.values() if i.folha],
        cronograma=crono, tipo_por_item={t.item_pq: t for t in tipos if t.item_pq},
        tipo_por_codigo={f"{grupos[t.grupo_id].numero}.{t.numero}": t for t in tipos if t.grupo_id in grupos},
        grupos=grupos, vigentes=vig)


def iwps(s: Session, obra_id: int, ref: Referencias, area_id: int, item_pq: str) -> list[dict]:
    """IWPs ativos da frente com o item, com o CWP (para casar pelo CWP da planilha)."""
    from app.modules.wbs.infra.gateway import itens_da_area

    if area_id not in ref._iwps:
        ref._iwps[area_id] = itens_da_area(s, obra_id, area_id)
    return [x for x in ref._iwps[area_id] if x["item_pq"] == item_pq]


def cpu(s: Session, obra_id: int, ref: Referencias, itens: set[str]):
    from app.modules.referencias.infra.cpu_gateway import CpuGateway

    return CpuGateway(s, obra_id, ref.vigentes).por_itens(itens)
