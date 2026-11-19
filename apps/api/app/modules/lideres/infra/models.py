"""Link do portal dos líderes por obra e o acesso de cada líder (spec 111)."""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class LiderPortalModel(Base):
    """O link da obra (`/equipe/<codigo>`): trocar o código invalida o link antigo."""

    __tablename__ = "lider_portal"
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), primary_key=True)
    codigo: Mapped[str] = mapped_column(String(24), unique=True, index=True)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LiderAcessoModel(Base):
    """Acesso de um líder: senha (vazia = a inicial 123456), bloqueio, equipes extras e se foi cadastrado à mão
    (líder sem a função de encarregado). Encarregados ganham o registro no primeiro acesso."""

    __tablename__ = "lider_acesso"
    __table_args__ = (UniqueConstraint("obra_id", "colaborador_id", name="uq_lider_acesso"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    colaborador_id: Mapped[int] = mapped_column(ForeignKey("colaborador.id", ondelete="CASCADE"), index=True)
    senha_hash: Mapped[str | None] = mapped_column(String(200))
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    cadastrado: Mapped[bool] = mapped_column(Boolean, default=False)  # incluído na tela de líderes
    equipes: Mapped[list] = mapped_column(JSONB, default=list)  # equipes além das que já lidera
    versao: Mapped[int] = mapped_column(Integer, default=0)  # sobe ao trocar/redefinir/bloquear: derruba as sessões
    ultimo_acesso: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    criado_por: Mapped[str | None] = mapped_column(String(80))
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
