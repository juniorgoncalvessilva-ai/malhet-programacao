"""Equipamentos da obra, a mobilização/desmobilização e o apontamento do dia (spec 147)."""
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class EquipamentoModel(Base):
    __tablename__ = "equipamento"
    __table_args__ = (UniqueConstraint("obra_id", "chave", name="uq_equipamento_chave"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    chave: Mapped[str] = mapped_column(String(60))  # TAG (ou placa, ou chassi) sem pontuação
    nome: Mapped[str] = mapped_column(String(120))
    tipo: Mapped[str | None] = mapped_column(String(40))  # Maquinário | Veículo Leve | …
    placa: Mapped[str | None] = mapped_column(String(20))
    tag: Mapped[str | None] = mapped_column(String(40))
    chassi: Mapped[str | None] = mapped_column(String(40))
    operador_id: Mapped[int | None] = mapped_column(ForeignKey("colaborador.id", ondelete="SET NULL"), index=True)
    operador_texto: Mapped[str | None] = mapped_column(String(120))  # como veio da planilha
    situacao: Mapped[str] = mapped_column(String(16), default="nao_mobilizado")
    mobilizado_em: Mapped[date | None] = mapped_column(Date)
    desmobilizado_em: Mapped[date | None] = mapped_column(Date)
    observacao: Mapped[str | None] = mapped_column(String(300))
    na_ultima_planilha: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    atualizado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class EquipamentoMovimentoModel(Base):
    """Histórico: cadastro, mobilização, desmobilização e troca de operador — quem, quando e por quê."""

    __tablename__ = "equipamento_movimento"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    equipamento_id: Mapped[int] = mapped_column(ForeignKey("equipamento.id", ondelete="CASCADE"), index=True)
    tipo: Mapped[str] = mapped_column(String(16))  # cadastro | mobilizacao | desmobilizacao | operador
    data: Mapped[date] = mapped_column(Date)
    texto: Mapped[str | None] = mapped_column(String(300))
    por: Mapped[str] = mapped_column(String(150))
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class EquipamentoApontamentoModel(Base):
    """O dia do equipamento, marcado pelo apontador: operando, à disposição, parado ou em manutenção."""

    __tablename__ = "equipamento_apontamento"
    __table_args__ = (UniqueConstraint("obra_id", "equipamento_id", "data", name="uq_equipamento_apontamento_dia"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    equipamento_id: Mapped[int] = mapped_column(ForeignKey("equipamento.id", ondelete="CASCADE"), index=True)
    data: Mapped[date] = mapped_column(Date, index=True)
    situacao: Mapped[str] = mapped_column(String(12))
    horas: Mapped[float | None] = mapped_column(Float)
    equipe_id: Mapped[int | None] = mapped_column(ForeignKey("equipe.id", ondelete="SET NULL"))
    operador_id: Mapped[int | None] = mapped_column(ForeignKey("colaborador.id", ondelete="SET NULL"))
    observacao: Mapped[str | None] = mapped_column(String(300))
    por: Mapped[str] = mapped_column(String(150))
    atualizado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
