"""Itens de referência versionados: CRONOGRAMA (P6), PQ, CPU, ÍNDICES e SIMOVA.

Cada carga gera uma VersaoReferencia; só uma versão por tipo é VIGENTE. Os itens carregados
pertencem à versão. O VÍNCULO usa chaves estáveis (id_crono, item_pq, composição, OPER Simova),
então sobrevive à troca de versão e é resolvido contra as versões vigentes.
"""
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base

TIPOS_REFERENCIA = ("CRONOGRAMA", "PQ", "CPU", "INDICES", "SIMOVA")


class VersaoReferenciaModel(Base):
    __tablename__ = "versao_referencia"
    __table_args__ = (
        Index("uq_versao_vigente_por_obra_tipo", "obra_id", "tipo", unique=True, postgresql_where=text("vigente")),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    tipo: Mapped[str] = mapped_column(String(15), index=True)
    rotulo: Mapped[str] = mapped_column(String(120))  # ex.: "Rev. 12 - P6 02/11/2026"
    data_base: Mapped[date | None] = mapped_column(Date)
    arquivo_origem: Mapped[str | None] = mapped_column(String(255))
    observacao: Mapped[str | None] = mapped_column(String(500))
    vigente: Mapped[bool] = mapped_column(Boolean, default=False)
    qtd_itens: Mapped[int] = mapped_column(Integer, default=0)
    carregado_por: Mapped[str] = mapped_column(String(80))
    carregado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AtividadeCronogramaModel(Base):
    __tablename__ = "atividade_cronograma"
    __table_args__ = (UniqueConstraint("versao_id", "id_crono"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    versao_id: Mapped[int] = mapped_column(ForeignKey("versao_referencia.id", ondelete="CASCADE"), index=True)
    id_crono: Mapped[str] = mapped_column(String(40), index=True)
    atividade: Mapped[str] = mapped_column(String(400))
    area: Mapped[str | None] = mapped_column(String(200))  # CWA
    tag: Mapped[str | None] = mapped_column(String(120))  # IWP/TAG
    wbs: Mapped[str | None] = mapped_column(String(200))
    detalhe_wbs: Mapped[str | None] = mapped_column(String(200))
    status: Mapped[str | None] = mapped_column(String(30))
    inicio: Mapped[datetime | None] = mapped_column(DateTime)
    fim: Mapped[datetime | None] = mapped_column(DateTime)
    os: Mapped[str | None] = mapped_column(String(20))
    unid: Mapped[str | None] = mapped_column(String(20))
    qtd_takeoff: Mapped[float | None] = mapped_column(Float)
    fonte_qtd: Mapped[str | None] = mapped_column(String(60))
    realizado: Mapped[float | None] = mapped_column(Float)
    item_pq: Mapped[str | None] = mapped_column(String(40))
    composicao: Mapped[str | None] = mapped_column(String(40))
    recurso_governa: Mapped[str | None] = mapped_column(String(120))
    coef_governa: Mapped[float | None] = mapped_column(Float)
    horas_crono: Mapped[float | None] = mapped_column(Float)
    # estrutura do Primavera, nível a nível: [{"nome", "codigo" (wbs_short_name), "ordem" (seq_num acumulado)}]
    # (o nome da WBS pode ter " / ", então o caminho não é guardado como texto separado por barra)
    wbs_niveis: Mapped[list | None] = mapped_column(JSONB)
    ordem_p6: Mapped[int | None] = mapped_column(Integer, index=True)  # posição da atividade na estrutura do P6


class ItemPqModel(Base):
    __tablename__ = "item_pq"
    __table_args__ = (UniqueConstraint("versao_id", "item"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    versao_id: Mapped[int] = mapped_column(ForeignKey("versao_referencia.id", ondelete="CASCADE"), index=True)
    item: Mapped[str] = mapped_column(String(40), index=True)
    descricao: Mapped[str] = mapped_column(String(500))
    unid: Mapped[str | None] = mapped_column(String(20))
    quantidade: Mapped[float | None] = mapped_column(Float)
    pu: Mapped[float | None] = mapped_column(Float)
    peso_profis: Mapped[float | None] = mapped_column(Float)
    grupo: Mapped[str | None] = mapped_column(String(200))
    subgrupo: Mapped[str | None] = mapped_column(String(200))
    composicao: Mapped[str | None] = mapped_column(String(40))
    recurso_governa: Mapped[str | None] = mapped_column(String(120))
    coef_governa: Mapped[float | None] = mapped_column(Float)
    # estrutura da aba PQ: títulos (níveis 1–4) e itens medidos (folhas)
    nivel: Mapped[int] = mapped_column(Integer, default=5, server_default="5")
    folha: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"), index=True)
    ordem: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    codigo_atividade: Mapped[str | None] = mapped_column(String(20))  # K.TT.UU.VVV.WWW
    criterio: Mapped[str | None] = mapped_column(String(40))  # CMS C.05.05.001
    total: Mapped[float | None] = mapped_column(Float)


class CpuRecursoModel(Base):
    """Linha da CPU: composição × recurso (MOD/EQU) com coeficiente por unidade (h/un)."""

    __tablename__ = "cpu_recurso"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    versao_id: Mapped[int] = mapped_column(ForeignKey("versao_referencia.id", ondelete="CASCADE"), index=True)
    composicao: Mapped[str] = mapped_column(String(40), index=True)
    recurso: Mapped[str] = mapped_column(String(120))
    tipo: Mapped[str] = mapped_column(String(5))  # MOD | EQU
    unid_recurso: Mapped[str | None] = mapped_column(String(10))
    coef_por_unidade: Mapped[float] = mapped_column(Float)


class IndiceEspecificoModel(Base):
    __tablename__ = "indice_especifico"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    versao_id: Mapped[int] = mapped_column(ForeignKey("versao_referencia.id", ondelete="CASCADE"), index=True)
    codigo: Mapped[str] = mapped_column(String(120))
    funcao_governa: Mapped[str] = mapped_column(String(120))
    unid: Mapped[str | None] = mapped_column(String(20))
    indice_un_dia: Mapped[float] = mapped_column(Float)  # un/dia por pessoa (jornada de referência)
    ajudante: Mapped[str | None] = mapped_column(String(120))
    ajudantes_por_oficial: Mapped[float | None] = mapped_column(Float)
    fonte: Mapped[str | None] = mapped_column(String(200))


class VinculoReferenciaModel(Base):
    """O 'local para vincular': atividade do cronograma ↔ item PQ ↔ CPU ↔ índice ↔ Simova.

    Pelo menos um entre id_crono e item_pq (atividade fora do cronograma = só PQ).
    """

    __tablename__ = "vinculo_referencia"
    __table_args__ = (UniqueConstraint("obra_id", "simova_grupo_codigo", "simova_oper_codigo", "id_crono", "item_pq",
                                       name="uq_vinculo"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    id_crono: Mapped[str | None] = mapped_column(String(40), index=True)
    item_pq: Mapped[str | None] = mapped_column(String(40), index=True)
    composicao: Mapped[str | None] = mapped_column(String(40))
    indice_codigo: Mapped[str | None] = mapped_column(String(120))  # índice específico (substitui a CPU)
    simova_grupo_codigo: Mapped[str] = mapped_column(String(30))
    simova_oper_codigo: Mapped[str] = mapped_column(String(30))
    simova_tarefa_codigo: Mapped[str | None] = mapped_column(String(120))
    frente_codigo: Mapped[str | None] = mapped_column(String(30))
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    atualizado_por: Mapped[str] = mapped_column(String(80))
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class PqQuantidadeTagModel(Base):
    """Take-off (aba MC FRENTES): quantidade de cada item de PQ por TAG (1800AA-ED-01)."""

    __tablename__ = "pq_quantidade_tag"
    __table_args__ = (UniqueConstraint("versao_id", "item", "tag", name="uq_pq_qtd_tag"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    versao_id: Mapped[int] = mapped_column(ForeignKey("versao_referencia.id", ondelete="CASCADE"), index=True)
    item: Mapped[str] = mapped_column(String(40), index=True)
    tag: Mapped[str] = mapped_column(String(40), index=True)
    quantidade: Mapped[float] = mapped_column(Float)
    unid: Mapped[str | None] = mapped_column(String(20))


class CpuServicoModel(Base):
    """CPU da obra: item da PQ → composição principal e custo unitário (relatório de composições)."""

    __tablename__ = "cpu_servico"
    __table_args__ = (UniqueConstraint("versao_id", "item", name="uq_cpu_servico"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    versao_id: Mapped[int] = mapped_column(ForeignKey("versao_referencia.id", ondelete="CASCADE"), index=True)
    item: Mapped[str] = mapped_column(String(40), index=True)  # normalizado (1.8.3.1.2)
    item_original: Mapped[str] = mapped_column(String(40))  # como no relatório (1.08.03.01.02)
    descricao: Mapped[str] = mapped_column(String(500))
    unid: Mapped[str | None] = mapped_column(String(20))
    quantidade: Mapped[float | None] = mapped_column(Float)
    composicao: Mapped[str] = mapped_column(String(40), index=True)
    custo_unitario: Mapped[float | None] = mapped_column(Float)


class CpuComposicaoModel(Base):
    """Cabeçalho de cada composição (principal ou auxiliar) da CPU da obra."""

    __tablename__ = "cpu_composicao"
    __table_args__ = (UniqueConstraint("versao_id", "codigo", name="uq_cpu_composicao"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    versao_id: Mapped[int] = mapped_column(ForeignKey("versao_referencia.id", ondelete="CASCADE"), index=True)
    codigo: Mapped[str] = mapped_column(String(40), index=True)
    descricao: Mapped[str] = mapped_column(String(500))
    custo: Mapped[float | None] = mapped_column(Float)
    recurso_governa: Mapped[str | None] = mapped_column(String(120))
    coef_governa: Mapped[float | None] = mapped_column(Float)
    hh_por_unidade: Mapped[float | None] = mapped_column(Float)
