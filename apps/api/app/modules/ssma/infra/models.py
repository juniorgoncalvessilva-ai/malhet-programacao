from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class CadastroSsmaModel(Base):
    """Técnicos, RAC, PTS, ART, ATA (segurança) e PTO (planejamento) da obra."""

    __tablename__ = "cadastro_ssma"
    __table_args__ = (UniqueConstraint("obra_id", "tipo", "codigo", name="uq_cadastro_ssma"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    tipo: Mapped[str] = mapped_column(String(10), index=True)
    codigo: Mapped[str] = mapped_column(String(150))  # nome do técnico ou número do documento
    descricao: Mapped[str | None] = mapped_column(String(300))  # o que cobre (frente, atividade, empresa…)
    validade: Mapped[date | None] = mapped_column(Date)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
