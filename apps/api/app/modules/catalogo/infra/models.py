"""Catálogo Grupo → Tipo (= item da PQ) → Item Simova. O ID Simova sai dos números (g.t / g.t.n).

O tipo não é digitado: é um item da PQ do contrato vinculado a um grupo. Descrição e unidade vêm da PQ vigente.
"""
from sqlalchemy import Boolean, ForeignKey, Index, Integer, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class GrupoAtividadeModel(Base):
    __tablename__ = "grupo_atividade"
    __table_args__ = (UniqueConstraint("obra_id", "numero", name="uq_grupo_atividade_numero"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    numero: Mapped[int] = mapped_column(Integer)
    descricao: Mapped[str] = mapped_column(String(120))
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)


class TipoAtividadeModel(Base):
    __tablename__ = "tipo_atividade"
    __table_args__ = (
        UniqueConstraint("grupo_id", "numero", name="uq_tipo_atividade_numero"),
        Index("uq_tipo_atividade_item_pq", "obra_id", "item_pq", unique=True,
              postgresql_where=text("item_pq IS NOT NULL")),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    grupo_id: Mapped[int] = mapped_column(ForeignKey("grupo_atividade.id", ondelete="RESTRICT"), index=True)
    numero: Mapped[int] = mapped_column(Integer)
    item_pq: Mapped[str | None] = mapped_column(String(40))  # o tipo É este item da PQ (um item, um grupo)
    descricao: Mapped[str] = mapped_column(String(500))  # cópia da PQ no vínculo (a tela mostra a da PQ vigente)
    unidade: Mapped[str | None] = mapped_column(String(20))
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)


class ItemSimovaModel(Base):
    """Tipo + texto complementar = item com ID próprio (g.t.n)."""

    __tablename__ = "item_simova"
    __table_args__ = (
        UniqueConstraint("tipo_id", "numero", name="uq_item_simova_numero"),
        UniqueConstraint("tipo_id", "complemento_chave", name="uq_item_simova_complemento"),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    tipo_id: Mapped[int] = mapped_column(ForeignKey("tipo_atividade.id", ondelete="RESTRICT"), index=True)
    numero: Mapped[int] = mapped_column(Integer)
    complemento: Mapped[str] = mapped_column(String(120))
    complemento_chave: Mapped[str] = mapped_column(String(120))
    item_pq: Mapped[str | None] = mapped_column(String(40))  # preso ao item de PQ do primeiro uso
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
