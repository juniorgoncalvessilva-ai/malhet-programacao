"""Quem pode excluir (por obra) e o histórico de exclusões (spec 112)."""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class PermissaoExclusaoModel(Base):
    __tablename__ = "exclusao_permissao"
    __table_args__ = (UniqueConstraint("obra_id", "usuario_id", name="uq_exclusao_permissao"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    usuario_id: Mapped[str] = mapped_column(String(80), index=True)
    email: Mapped[str | None] = mapped_column(String(320))
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    concedido_por: Mapped[str] = mapped_column(String(320))
    concedido_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RegistroExclusaoModel(Base):
    """Histórico: tipo (auditoria | foto | permissao), o que era (resumo + cópia dos dados), motivo, quem e quando."""

    __tablename__ = "exclusao_registro"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    tipo: Mapped[str] = mapped_column(String(12), index=True)
    referencia: Mapped[str | None] = mapped_column(String(40))  # id do que saiu (ou do usuário, na permissão)
    resumo: Mapped[str] = mapped_column(String(300))
    dados: Mapped[dict | None] = mapped_column(JSONB)  # cópia do registro como estava
    motivo: Mapped[str | None] = mapped_column(String(500))
    por: Mapped[str] = mapped_column(String(80))
    por_email: Mapped[str | None] = mapped_column(String(320))
    em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
