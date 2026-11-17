"""Aderência semanal (spec 104): o histórico das semanas que não estão no sistema e o modelo de apresentação da obra."""
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class AderenciaHistoricoModel(Base):
    """Semana × responsável que veio de fora (apresentação anterior ou digitado): valores tomados como reais.
    Semana com programação emitida no sistema usa o sistema; o histórico fica guardado."""
    __tablename__ = "aderencia_historico"
    __table_args__ = (UniqueConstraint("obra_id", "semana", "responsavel_chave", name="uq_aderencia_historico"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    semana: Mapped[int] = mapped_column(Integer, index=True)
    responsavel: Mapped[str] = mapped_column(String(150))
    responsavel_chave: Mapped[str] = mapped_column(String(150))
    programado: Mapped[float] = mapped_column(Float)
    realizado: Mapped[float | None] = mapped_column(Float)  # None = só a meta (sem realizado)
    origem: Mapped[str] = mapped_column(String(30), default="apresentacao")  # apresentacao | manual
    arquivo: Mapped[str | None] = mapped_column(String(200))  # de qual apresentação veio
    criado_por: Mapped[str | None] = mapped_column(String(150))
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ModeloApresentacaoModel(Base):
    """Modelo (.pptx) das apresentações da obra: mestre, fundos, capa, divisória e encerramento da contratada.
    Obra sem modelo usa o de outra obra da mesma contratada (padrão da empresa)."""
    __tablename__ = "apresentacao_modelo"
    __table_args__ = (UniqueConstraint("obra_id", name="uq_apresentacao_modelo_obra"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    arquivo_id: Mapped[int | None] = mapped_column(ForeignKey("arquivo.id", ondelete="SET NULL"))
    nome: Mapped[str] = mapped_column(String(200))
    contratada: Mapped[str | None] = mapped_column(String(80))  # nome da contratada quando foi enviado
    enviado_por: Mapped[str | None] = mapped_column(String(150))
    enviado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
