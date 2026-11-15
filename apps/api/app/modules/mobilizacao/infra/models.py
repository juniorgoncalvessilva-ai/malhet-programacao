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
