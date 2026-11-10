"""Espelho dos cadastros do Simova (FRENTE.xlsx e OPER.xlsx).

Hierarquia: FRENTE (local) → OPER_GRUPO → OPER (atividade padrão) → FT (programação).
TAREFA = itens do cronograma/AWP (IWP) e CPUs.
"""
from sqlalchemy import ARRAY, Boolean, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class FrenteModel(Base):
    __tablename__ = "frente"
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), primary_key=True)
    codigo: Mapped[str] = mapped_column(String(30), primary_key=True)
    descricao: Mapped[str] = mapped_column(String(200))
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)


class UnidadeMedidaModel(Base):
    __tablename__ = "unidade_medida"
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), primary_key=True)
    codigo: Mapped[str] = mapped_column(String(10), primary_key=True)
    descricao: Mapped[str | None] = mapped_column(String(60))
    sigla: Mapped[str | None] = mapped_column(String(10))


class OperGrupoModel(Base):
    """Grupo de operação. ATENÇÃO: o Simova tem códigos repetidos (28..33) — por isso id surrogate."""

    __tablename__ = "oper_grupo"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    codigo: Mapped[str] = mapped_column(String(30), index=True)
    descricao: Mapped[str] = mapped_column(String(200))
    unidade_medida: Mapped[str | None] = mapped_column(String(10))
    materiais: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    codigo_duplicado: Mapped[bool] = mapped_column(Boolean, default=False)


class OperModel(Base):
    """Atividade padrão. Chave natural no Simova = (grupo, código) — '9.1' existe em 2 grupos."""

    __tablename__ = "oper"
    __table_args__ = (UniqueConstraint("obra_id", "grupo_codigo", "codigo", name="uq_oper_obra_grupo_codigo"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    codigo: Mapped[str] = mapped_column(String(30), index=True)
    descricao: Mapped[str] = mapped_column(String(300))
    grupo_codigo: Mapped[str] = mapped_column(String(30))
    materiais: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    unidade_medida: Mapped[str | None] = mapped_column(String(10))
    hh_prev: Mapped[float | None] = mapped_column(Float)
    insumo: Mapped[str | None] = mapped_column(String(60))
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    tarefa_codigo: Mapped[str | None] = mapped_column(String(120))  # coluna TAREFA do Simova
    # Vínculo com cronograma/PQ/CPU fica em referencias.vinculo_referencia (versionado).
    origem: Mapped[str] = mapped_column(String(10), default="simova")  # simova | app
    pendente_envio_simova: Mapped[bool] = mapped_column(Boolean, default=False)


class TarefaModel(Base):
    __tablename__ = "tarefa"
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), primary_key=True)
    codigo: Mapped[str] = mapped_column(String(120), primary_key=True)
    descricao: Mapped[str] = mapped_column(String(400))
    unidade_medida: Mapped[str | None] = mapped_column(String(10))
    grupos: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    tipos: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)


class MaterialModel(Base):
    __tablename__ = "material"
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), primary_key=True)
    codigo: Mapped[str] = mapped_column(String(30), primary_key=True)
    descricao: Mapped[str] = mapped_column(String(300))
    unidade_medida: Mapped[str | None] = mapped_column(String(10))
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)


class FuncaoModel(Base):
    __tablename__ = "funcao"
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), primary_key=True)
    codigo: Mapped[str] = mapped_column(String(10), primary_key=True)
    descricao: Mapped[str] = mapped_column(String(120))
    tipo_funcao: Mapped[str | None] = mapped_column(String(5))
    operador: Mapped[bool] = mapped_column(Boolean, default=False)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
