"""Frentes (Local → Área). Todo o app referencia por id: editar código/descrição vale para tudo."""
from sqlalchemy import Boolean, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class LocalFrenteModel(Base):
    __tablename__ = "local_frente"
    __table_args__ = (UniqueConstraint("obra_id", "codigo", name="uq_local_frente_codigo"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    codigo: Mapped[str] = mapped_column(String(20))
    descricao: Mapped[str] = mapped_column(String(200))
    ordem: Mapped[int] = mapped_column(Integer, default=0)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)


class AreaFrenteModel(Base):
    __tablename__ = "area_frente"
    __table_args__ = (UniqueConstraint("obra_id", "codigo", name="uq_area_frente_codigo"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    local_id: Mapped[int] = mapped_column(ForeignKey("local_frente.id", ondelete="RESTRICT"), index=True)
    cwa: Mapped[str] = mapped_column(String(20))
    codigo: Mapped[str] = mapped_column(String(20))  # código Simova (CWA ou CWA.sufixo)
    descricao: Mapped[str] = mapped_column(String(250))
    ativo_codigo: Mapped[str | None] = mapped_column(String(40))  # Ativo da lista da obra: ED-1800AA-04
    tag: Mapped[str | None] = mapped_column(String(40), index=True)  # formato do take-off: 1800AA-ED-01
    ordem: Mapped[int] = mapped_column(Integer, default=0)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
