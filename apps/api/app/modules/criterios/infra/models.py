"""Critérios de medição da obra e as etapas de cada um (spec 079)."""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class CriterioModel(Base):
    __tablename__ = "criterio_medicao"
    __table_args__ = (UniqueConstraint("obra_id", "codigo", "item_pq", name="uq_criterio_medicao"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    codigo: Mapped[str] = mapped_column(String(40))  # CMS M.75.10.000
    item_pq: Mapped[str | None] = mapped_column(String(40))  # 23.1 — vale para ele e os itens de baixo
    descricao: Mapped[str] = mapped_column(String(400))
    origem: Mapped[str] = mapped_column(String(10), default="manual")  # planilha | manual
    atualizado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    etapas: Mapped[list["EtapaCriterioModel"]] = relationship(cascade="all, delete-orphan", lazy="selectin",
                                                              order_by="EtapaCriterioModel.numero")


class EtapaCriterioModel(Base):
    __tablename__ = "criterio_etapa"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    criterio_id: Mapped[int] = mapped_column(ForeignKey("criterio_medicao.id", ondelete="CASCADE"), index=True)
    numero: Mapped[int] = mapped_column(Integer)
    nome: Mapped[str] = mapped_column(String(120))
    documento: Mapped[str | None] = mapped_column(Text)  # o que comprova a etapa na medição
    percentual: Mapped[float] = mapped_column(Float, default=0)  # fração do valor do item (0,4 = 40%)
    sem_avanco: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")  # só esforço/HH
