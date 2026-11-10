"""Programação semanal/mensal no formato da obra: cabeçalho → linhas (área × tipo) → valores por dia (P/R).

As linhas apontam por id para área, tipo e item Simova: editar frentes/catálogo vale para todas as programações
abertas. A emissão guarda uma foto (snapshot) — o documento emitido não muda depois.
"""
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class ProgramacaoModel(Base):
    __tablename__ = "programacao"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    tipo: Mapped[str] = mapped_column(String(10))  # SEMANAL | MENSAL
    inicio: Mapped[date] = mapped_column(Date)
    fim: Mapped[date] = mapped_column(Date)
    titulo: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(12), default="rascunho")  # rascunho | emitida
    revisao: Mapped[int] = mapped_column(Integer, default=0)  # nº de emissões feitas
    criado_por: Mapped[str] = mapped_column(String(80))
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    linhas: Mapped[list["LinhaProgramacaoModel"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="LinhaProgramacaoModel.ordem")


class LinhaProgramacaoModel(Base):
    __tablename__ = "programacao_linha"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    programacao_id: Mapped[int] = mapped_column(ForeignKey("programacao.id", ondelete="CASCADE"), index=True)
    area_id: Mapped[int] = mapped_column(ForeignKey("area_frente.id", ondelete="RESTRICT"), index=True)
    tipo_id: Mapped[int] = mapped_column(ForeignKey("tipo_atividade.id", ondelete="RESTRICT"), index=True)
    item_simova_id: Mapped[int | None] = mapped_column(ForeignKey("item_simova.id", ondelete="RESTRICT"))
    item_pq: Mapped[str | None] = mapped_column(String(40))
    id_crono: Mapped[str | None] = mapped_column(String(40))
    equipe_id: Mapped[int | None] = mapped_column(ForeignKey("equipe.id", ondelete="SET NULL"))
    qtd_projeto: Mapped[float | None] = mapped_column(Float)  # manual; vazio = take-off da TAG
    qtd_periodo: Mapped[float | None] = mapped_column(Float)  # quanto se prevê fazer nesta semana/mês
    natureza: Mapped[str] = mapped_column(String(1), default="P", server_default="P")  # Programada|Oportunidade|Emergencial
    responsavel: Mapped[str | None] = mapped_column(String(150))
    observacao: Mapped[str | None] = mapped_column(String(300))
    # SSMA (preenchido pela segurança)
    ssma_tecnico: Mapped[str | None] = mapped_column(String(150))
    ssma_rac: Mapped[str | None] = mapped_column(String(60))
    ssma_pts: Mapped[str | None] = mapped_column(String(60))
    ssma_art: Mapped[str | None] = mapped_column(String(60))
    ssma_pto: Mapped[str | None] = mapped_column(String(60))
    ssma_ata: Mapped[str | None] = mapped_column(String(60))
    ordem: Mapped[int] = mapped_column(Integer, default=0)
    valores: Mapped[list["ValorDiaModel"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="ValorDiaModel.data")


class ValorDiaModel(Base):
    __tablename__ = "programacao_valor"
    __table_args__ = (UniqueConstraint("linha_id", "data", name="uq_valor_linha_data"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    linha_id: Mapped[int] = mapped_column(ForeignKey("programacao_linha.id", ondelete="CASCADE"), index=True)
    data: Mapped[date] = mapped_column(Date)
    previsto: Mapped[float | None] = mapped_column(Float)
    realizado: Mapped[float | None] = mapped_column(Float)


class EmissaoModel(Base):
    """Cada emissão (rev. 0, 1, …) congela a programação como foi impressa/enviada."""

    __tablename__ = "programacao_emissao"
    __table_args__ = (UniqueConstraint("programacao_id", "revisao", name="uq_emissao_revisao"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    programacao_id: Mapped[int] = mapped_column(ForeignKey("programacao.id", ondelete="CASCADE"), index=True)
    revisao: Mapped[int] = mapped_column(Integer)
    emitida_por: Mapped[str] = mapped_column(String(80))
    emitida_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    foto: Mapped[dict] = mapped_column(JSONB)
