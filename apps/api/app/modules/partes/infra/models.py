"""Partes da obra (contratada, contratante, fiscalização, projetos) e os responsáveis de cada uma (spec 139)."""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class ParteObraModel(Base):
    __tablename__ = "parte_obra"
    __table_args__ = (UniqueConstraint("obra_id", "papel", name="uq_parte_obra_papel"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    papel: Mapped[str] = mapped_column(String(12))  # contratada | contratante | fiscalizacao | projetos
    nome: Mapped[str] = mapped_column(String(80))


class ResponsavelObraModel(Base):
    __tablename__ = "responsavel_obra"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    papel: Mapped[str] = mapped_column(String(12))
    nome: Mapped[str] = mapped_column(String(150))
    funcao: Mapped[str | None] = mapped_column(String(120))  # cargo na obra (ex.: Engenheiro de planejamento)
    colaborador_id: Mapped[int | None] = mapped_column(ForeignKey("colaborador.id", ondelete="SET NULL"), index=True)  # contratada
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    criado_por: Mapped[str] = mapped_column(String(150))
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
