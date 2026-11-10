from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class ObraModel(Base):
    __tablename__ = "obra"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    codigo: Mapped[str] = mapped_column(String(12), unique=True)
    nome: Mapped[str] = mapped_column(String(200))
    contrato: Mapped[str | None] = mapped_column(String(200))
    cliente: Mapped[str | None] = mapped_column(String(200))
    ativa: Mapped[bool] = mapped_column(Boolean, default=True)
    criado_por: Mapped[str] = mapped_column(String(80))
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AcessoObraModel(Base):
    """Usuário (auth-kit, auth_users.id) com papel numa obra."""

    __tablename__ = "acesso_obra"
    __table_args__ = (UniqueConstraint("obra_id", "usuario_id", name="uq_acesso_obra_usuario"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    usuario_id: Mapped[str] = mapped_column(String(36), index=True)
    email: Mapped[str] = mapped_column(String(320))
    papel: Mapped[str] = mapped_column(String(15))
    cracha: Mapped[str | None] = mapped_column(String(20))  # crachá Simova quando for encarregado
    concedido_por: Mapped[str] = mapped_column(String(80))
    concedido_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
