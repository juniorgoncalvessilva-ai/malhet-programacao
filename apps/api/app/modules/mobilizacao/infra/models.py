"""Processos de mobilização (spec 087): uma aquisição de mão de obra da solicitação ao crachá, com as passagens por
etapa (entrada/saída) e as metas da obra em dias."""
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class ProcessoMobilizacaoModel(Base):
    __tablename__ = "mobilizacao_processo"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    colaborador_id: Mapped[int | None] = mapped_column(ForeignKey("colaborador.id", ondelete="SET NULL"), index=True)
    nome: Mapped[str] = mapped_column(String(150))
    funcao: Mapped[str | None] = mapped_column(String(120))
    funcao_chave: Mapped[str | None] = mapped_column(String(120), index=True)
    vaga_id: Mapped[int | None] = mapped_column(ForeignKey("mobilizacao_vaga.id", ondelete="SET NULL"), index=True)
    empresa: Mapped[str] = mapped_column(String(80))
    requisicao: Mapped[str | None] = mapped_column(String(40))  # nº da requisição/vaga
    necessario_em: Mapped[date | None] = mapped_column(Date)  # data em que a obra precisa da pessoa
    treinamento_antes: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(20), index=True)
    etapa_atual: Mapped[str] = mapped_column(String(30))
    motivo_desistencia: Mapped[str | None] = mapped_column(String(300))
    observacao: Mapped[str | None] = mapped_column(String(500))
    criado_por: Mapped[str] = mapped_column(String(80))
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    passagens: Mapped[list["PassagemMobilizacaoModel"]] = relationship(
        cascade="all, delete-orphan", order_by="PassagemMobilizacaoModel.id", lazy="selectin")


class PassagemMobilizacaoModel(Base):
    __tablename__ = "mobilizacao_passagem"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    processo_id: Mapped[int] = mapped_column(ForeignKey("mobilizacao_processo.id", ondelete="CASCADE"), index=True)
    etapa: Mapped[str] = mapped_column(String(30))
    entrou_em: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    saiu_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    concluido_por: Mapped[str | None] = mapped_column(String(80))
    observacao: Mapped[str | None] = mapped_column(String(300))


class MetaMobilizacaoModel(Base):
    __tablename__ = "mobilizacao_meta"
    __table_args__ = (UniqueConstraint("obra_id", "meta", name="uq_mobilizacao_meta"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    meta: Mapped[str] = mapped_column(String(30))
    dias: Mapped[float] = mapped_column(Float)


class VagaModel(Base):
    """Vaga aberta pelo Planejamento (spec 089): a janela de contratação que o RH atende com processos de mobilização."""

    __tablename__ = "mobilizacao_vaga"
    __table_args__ = (UniqueConstraint("obra_id", "codigo", name="uq_mobilizacao_vaga_codigo"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    codigo: Mapped[str] = mapped_column(String(20))  # RQ-0001
    funcao: Mapped[str] = mapped_column(String(120))
    funcao_chave: Mapped[str] = mapped_column(String(120), index=True)
    empresa: Mapped[str] = mapped_column(String(80))
    quantidade: Mapped[int] = mapped_column(Integer)
    necessario_em: Mapped[date | None] = mapped_column(Date)
    destino: Mapped[str | None] = mapped_column(String(150))  # frente, equipe ou setor
    solicitante: Mapped[str | None] = mapped_column(String(120))
    justificativa: Mapped[str | None] = mapped_column(String(500))
    aberta_por: Mapped[str] = mapped_column(String(80))
    aberta_em: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    cancelada_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    motivo_cancelamento: Mapped[str | None] = mapped_column(String(300))


class TreinamentoPrevistoModel(Base):
    """O que o contrato prevê de treinamento por função (dias e horas) — base para medir o tempo gasto (spec 089)."""

    __tablename__ = "mobilizacao_treinamento_previsto"
    __table_args__ = (UniqueConstraint("obra_id", "funcao_chave", name="uq_mobilizacao_treino_previsto"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    funcao_chave: Mapped[str] = mapped_column(String(120))
    funcao: Mapped[str] = mapped_column(String(120))
    dias: Mapped[float | None] = mapped_column(Float)
    horas: Mapped[float | None] = mapped_column(Float)
    clausula: Mapped[str | None] = mapped_column(String(200))  # item/cláusula do contrato
