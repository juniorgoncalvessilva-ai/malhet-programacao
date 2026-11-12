"""Fotos de campo: prova da frente presa a um desvio, a uma restrição ou à linha da programação num dia."""
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, LargeBinary, String, func
from sqlalchemy.orm import Mapped, deferred, mapped_column

from app.core.db import Base


class FotoCampoModel(Base):
    __tablename__ = "foto_campo"
    __table_args__ = (Index("ix_foto_campo_alvo", "obra_id", "alvo", "alvo_id"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    alvo: Mapped[str] = mapped_column(String(10))  # desvio | restricao | linha
    alvo_id: Mapped[int] = mapped_column(Integer)
    data: Mapped[date | None] = mapped_column(Date)  # dia da linha (alvo = linha)
    legenda: Mapped[str | None] = mapped_column(String(300))
    content_type: Mapped[str] = mapped_column(String(40))
    tamanho: Mapped[int] = mapped_column(Integer)
    conteudo: Mapped[bytes] = deferred(mapped_column(LargeBinary))  # no banco: vai no backup
    enviado_por: Mapped[str] = mapped_column(String(80))
    enviado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
