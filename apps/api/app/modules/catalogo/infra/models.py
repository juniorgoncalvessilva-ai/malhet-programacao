"""Catálogo Grupo → Tipo → Item Simova. O ID Simova sai dos números (g.t / g.t.n)."""
from sqlalchemy import Boolean, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

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
    __table_args__ = (UniqueConstraint("grupo_id", "numero", name="uq_tipo_atividade_numero"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    grupo_id: Mapped[int] = mapped_column(ForeignKey("grupo_atividade.id", ondelete="RESTRICT"), index=True)
    numero: Mapped[int] = mapped_column(Integer)
    descricao: Mapped[str] = mapped_column(String(120))
    unidade: Mapped[str | None] = mapped_column(String(20))
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    itens_pq: Mapped[list["TipoItemPqModel"]] = relationship(cascade="all, delete-orphan", lazy="selectin",
                                                           order_by="TipoItemPqModel.item_pq")


class TipoItemPqModel(Base):
    """Itens de PQ que o tipo pode usar (o programador escolhe um na linha)."""

    __tablename__ = "tipo_item_pq"
    __table_args__ = (UniqueConstraint("tipo_id", "item_pq", name="uq_tipo_item_pq"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tipo_id: Mapped[int] = mapped_column(ForeignKey("tipo_atividade.id", ondelete="CASCADE"), index=True)
    item_pq: Mapped[str] = mapped_column(String(40))


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
