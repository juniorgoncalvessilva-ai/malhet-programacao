from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, LargeBinary, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, deferred, mapped_column

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
    # páginas do app liberadas para a pessoa nesta obra (url do menu); vazio = todas as que o papel permite
    paginas: Mapped[list | None] = mapped_column(JSONB)
    concedido_por: Mapped[str] = mapped_column(String(80))
    concedido_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class MarcaObraModel(Base):
    """Identidade da obra nos documentos e na tela: logo da contratada, logo do contratante (cliente) e a cor do
    cliente, que substitui o verde Malhet. Sem logo, os documentos usam a do Malhet."""

    __tablename__ = "marca_obra"
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), primary_key=True)
    cor: Mapped[str | None] = mapped_column(String(9))  # #RRGGBB
    logo_contratada: Mapped[bytes | None] = deferred(mapped_column(LargeBinary))
    tipo_contratada: Mapped[str | None] = mapped_column(String(20))
    logo_contratante: Mapped[bytes | None] = deferred(mapped_column(LargeBinary))
    tipo_contratante: Mapped[str | None] = mapped_column(String(20))
    atualizado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
