from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, LargeBinary, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, deferred, mapped_column, relationship

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
    anexos: Mapped[list["AnexoSsmaModel"]] = relationship(cascade="all, delete-orphan", lazy="selectin",
                                                         order_by="AnexoSsmaModel.id")


class AnexoSsmaModel(Base):
    """Arquivo do documento (Excel, Word ou PDF). Opcional; vários por item. Guardado no banco (vai no backup)."""

    __tablename__ = "anexo_ssma"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    cadastro_id: Mapped[int] = mapped_column(ForeignKey("cadastro_ssma.id", ondelete="CASCADE"), index=True)
    nome: Mapped[str] = mapped_column(String(200))
    content_type: Mapped[str] = mapped_column(String(120))
    tamanho: Mapped[int] = mapped_column(Integer)
    conteudo: Mapped[bytes] = deferred(mapped_column(LargeBinary))
    enviado_por: Mapped[str] = mapped_column(String(80))
    enviado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
