"""Equipes (como na aba EQUIPES da planilha auxiliar): cada equipe é uma frente de trabalho com um
encarregado e uma composição por função/equipamento."""
from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class EquipeModel(Base):
    __tablename__ = "equipe"
    __table_args__ = (UniqueConstraint("obra_id", "nome", name="uq_equipe_obra_nome"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    nome: Mapped[str] = mapped_column(String(120))
    frente_codigo: Mapped[str | None] = mapped_column(String(30))
    encarregado_cracha: Mapped[str | None] = mapped_column(String(20), index=True)
    encarregado_nome: Mapped[str | None] = mapped_column(String(150))
    jornada_horas: Mapped[float] = mapped_column(Float, default=9.0)
    turno: Mapped[str | None] = mapped_column(String(30))  # Diurno, Noturno, Administrativo, Turno A…
    codigo_simova: Mapped[str | None] = mapped_column(String(20), index=True)  # "Código" do cadastro de equipe
    responsavel: Mapped[str | None] = mapped_column(String(150))  # supervisor/engenheiro (coluna Responsável)
    equipamentos: Mapped[str | None] = mapped_column(String(500))  # coluna Equipamento do Simova
    observacao: Mapped[str | None] = mapped_column(String(300))
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    composicao: Mapped[list["EquipeComposicaoModel"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )
    membros: Mapped[list["EquipeMembroModel"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="EquipeMembroModel.nome"
    )


class EquipeComposicaoModel(Base):
    __tablename__ = "equipe_composicao"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    equipe_id: Mapped[int] = mapped_column(ForeignKey("equipe.id", ondelete="CASCADE"))
    recurso: Mapped[str] = mapped_column(String(120))  # mesmo nome do recurso na CPU (Pedreiro, Trator D6…)
    tipo: Mapped[str] = mapped_column(String(5), default="MOD")  # MOD | EQU
    quantidade: Mapped[float] = mapped_column(Float)


class EquipeMembroModel(Base):
    """Funcionário da equipe no Simova (crachá :: nome). Função opcional, para contar oficiais/serventes."""

    __tablename__ = "equipe_membro"
    __table_args__ = (UniqueConstraint("equipe_id", "cracha", name="uq_equipe_membro"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    equipe_id: Mapped[int] = mapped_column(ForeignKey("equipe.id", ondelete="CASCADE"), index=True)
    cracha: Mapped[str] = mapped_column(String(20))
    nome: Mapped[str] = mapped_column(String(150))
    funcao: Mapped[str | None] = mapped_column(String(120))
