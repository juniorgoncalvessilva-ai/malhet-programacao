"""ASOs e treinamentos da obra (spec 088). Do ASO guarda-se só tipo, datas e resultado — nunca diagnóstico."""
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class TreinamentoModel(Base):
    """Catálogo de treinamentos da obra (NR-35, NR-10, integração…)."""

    __tablename__ = "treinamento"
    __table_args__ = (UniqueConstraint("obra_id", "nome", name="uq_treinamento_nome"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    nome: Mapped[str] = mapped_column(String(120))
    norma: Mapped[str | None] = mapped_column(String(40))
    validade_meses: Mapped[int] = mapped_column(Integer, default=12)  # 0 = não vence
    carga_horaria: Mapped[float | None] = mapped_column(Float)
    impeditivo: Mapped[bool] = mapped_column(Boolean, default=False)  # sem ele válido a pessoa não trabalha
    todos: Mapped[bool] = mapped_column(Boolean, default=False)  # exigido de todo o efetivo
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)


class TreinamentoFuncaoModel(Base):
    """Exigência por função do efetivo (chave da função, a mesma do de-para)."""

    __tablename__ = "treinamento_funcao"
    __table_args__ = (UniqueConstraint("obra_id", "funcao_chave", "treinamento_id", name="uq_treinamento_funcao"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    funcao_chave: Mapped[str] = mapped_column(String(120), index=True)
    treinamento_id: Mapped[int] = mapped_column(ForeignKey("treinamento.id", ondelete="CASCADE"), index=True)


class ColaboradorTreinamentoModel(Base):
    __tablename__ = "colaborador_treinamento"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    colaborador_id: Mapped[int] = mapped_column(ForeignKey("colaborador.id", ondelete="CASCADE"), index=True)
    treinamento_id: Mapped[int] = mapped_column(ForeignKey("treinamento.id", ondelete="CASCADE"), index=True)
    realizado_em: Mapped[date] = mapped_column(Date)
    valido_ate: Mapped[date | None] = mapped_column(Date)
    entidade: Mapped[str | None] = mapped_column(String(120))  # quem ministrou
    observacao: Mapped[str | None] = mapped_column(String(300))
    registrado_por: Mapped[str] = mapped_column(String(80))
    registrado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AsoModel(Base):
    __tablename__ = "aso"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    colaborador_id: Mapped[int] = mapped_column(ForeignKey("colaborador.id", ondelete="CASCADE"), index=True)
    tipo: Mapped[str] = mapped_column(String(20))
    data_exame: Mapped[date] = mapped_column(Date)
    valido_ate: Mapped[date] = mapped_column(Date)
    resultado: Mapped[str] = mapped_column(String(20))
    clinica: Mapped[str | None] = mapped_column(String(120))
    observacao: Mapped[str | None] = mapped_column(String(300))  # nunca diagnóstico
    registrado_por: Mapped[str] = mapped_column(String(80))
    registrado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
