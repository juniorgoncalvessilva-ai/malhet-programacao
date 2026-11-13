"""Ações 5W2H por obra (spec 064)."""
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class AcaoModel(Base):
    __tablename__ = "acao_5w2h"
    __table_args__ = (UniqueConstraint("obra_id", "numero", name="uq_acao_5w2h_numero"),
                      Index("ix_acao_5w2h_origem", "obra_id", "origem", "origem_id"))
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    numero: Mapped[int] = mapped_column(Integer)
    origem: Mapped[str] = mapped_column(String(12), default="manual")
    origem_id: Mapped[int | None] = mapped_column(Integer)
    origem_texto: Mapped[str | None] = mapped_column(String(200))  # "Auditoria Nº 12 · Inspeção" (para mostrar sem buscar)
    o_que: Mapped[str] = mapped_column(String(600))
    por_que: Mapped[str | None] = mapped_column(String(600))
    onde: Mapped[str | None] = mapped_column(String(200))
    area_id: Mapped[int | None] = mapped_column(ForeignKey("area_frente.id", ondelete="SET NULL"), index=True)
    quando: Mapped[date | None] = mapped_column(Date, index=True)  # prazo
    data_execucao: Mapped[date | None] = mapped_column(Date, index=True)  # dia programado para executar
    quem: Mapped[str | None] = mapped_column(String(150))
    como: Mapped[str | None] = mapped_column(String(600))
    quanto: Mapped[str | None] = mapped_column(String(120))
    acompanhamento: Mapped[str | None] = mapped_column(String(300))  # quem verifica a eficácia
    status: Mapped[str] = mapped_column(String(12), default="aberta", index=True)
    conclusao_texto: Mapped[str | None] = mapped_column(Text)
    concluida_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    eficaz: Mapped[bool | None] = mapped_column(Boolean)
    verificada_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    historico: Mapped[list | None] = mapped_column(JSONB)  # [{em, por, texto}] — a mais nova primeiro
    criado_por: Mapped[str] = mapped_column(String(80))
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
