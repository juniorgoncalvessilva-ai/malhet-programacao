"""Identificação das pessoas (crachá, NFC, rosto) e as leituras de presença, por obra (spec 063)."""
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class IdentificacaoModel(Base):
    """Como a pessoa é reconhecida no campo. O rosto é só o descritor numérico (nunca a foto) e só com consentimento."""

    __tablename__ = "identificacao_pessoa"
    __table_args__ = (UniqueConstraint("obra_id", "colaborador_id", name="uq_identificacao_pessoa"),
                      UniqueConstraint("obra_id", "codigo", name="uq_identificacao_codigo"),
                      UniqueConstraint("obra_id", "nfc_serial", name="uq_identificacao_nfc"))
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    colaborador_id: Mapped[int] = mapped_column(ForeignKey("colaborador.id", ondelete="CASCADE"), index=True)
    codigo: Mapped[str | None] = mapped_column(String(60))  # QR/código de barras do crachá (além da matrícula)
    nfc_serial: Mapped[str | None] = mapped_column(String(60))
    face_descritor: Mapped[list | None] = mapped_column(JSONB)
    face_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    consentimento_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    consentimento_por: Mapped[str | None] = mapped_column(String(80))
    atualizado_por: Mapped[str | None] = mapped_column(String(80))
    atualizado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class LeituraPresencaModel(Base):
    __tablename__ = "presenca_leitura"
    __table_args__ = (UniqueConstraint("obra_id", "id_local", name="uq_presenca_id_local"),
                      Index("ix_presenca_obra_data", "obra_id", "data"))
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    id_local: Mapped[str] = mapped_column(String(64))
    colaborador_id: Mapped[int] = mapped_column(ForeignKey("colaborador.id", ondelete="CASCADE"), index=True)
    data: Mapped[date] = mapped_column(Date)
    hora: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    meio: Mapped[str] = mapped_column(String(10))
    equipe_id: Mapped[int | None] = mapped_column(ForeignKey("equipe.id", ondelete="SET NULL"))
    dispositivo: Mapped[str | None] = mapped_column(String(120))
    registrado_por: Mapped[str] = mapped_column(String(80))
    # spec 069: dois celulares leram a mesma pessoa no dia → vale a leitura mais cedo; as outras ficam como duplicadas
    valida: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    recebido_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
