"""Perfil da conta (nome de exibição e avatar — vale em todas as obras) e o menu do celular por obra (spec 075)."""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, LargeBinary, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, deferred, mapped_column

from app.core.db import Base


class PerfilUsuarioModel(Base):
    """Da conta, não da obra (como as tabelas do auth-kit): por isso não tem obra_id."""
    __tablename__ = "perfil_usuario"
    usuario_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    nome_exibicao: Mapped[str | None] = mapped_column(String(80))
    telefone: Mapped[str | None] = mapped_column(String(30))
    avatar: Mapped[bytes | None] = deferred(mapped_column(LargeBinary))
    avatar_tipo: Mapped[str | None] = mapped_column(String(30))
    avatar_versao: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    atualizado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class MenuPerfilModel(Base):
    """Menu padrão do celular de um perfil (papel) na obra, definido pelo admin."""
    __tablename__ = "menu_mobile_perfil"
    __table_args__ = (UniqueConstraint("obra_id", "papel", name="uq_menu_mobile_perfil"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    papel: Mapped[str] = mapped_column(String(15))
    menu: Mapped[dict] = mapped_column(JSONB)
    atualizado_por: Mapped[str | None] = mapped_column(String(150))
    atualizado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class MenuPessoalModel(Base):
    """Ajuste da própria pessoa no menu do celular, por obra."""
    __tablename__ = "menu_mobile_pessoal"
    __table_args__ = (UniqueConstraint("obra_id", "usuario_id", name="uq_menu_mobile_pessoal"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    usuario_id: Mapped[str] = mapped_column(String(80), index=True)
    menu: Mapped[dict] = mapped_column(JSONB)
    atualizado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
