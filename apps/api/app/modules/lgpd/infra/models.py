"""LGPD (spec 074): termo versionado por obra, aceites do colaborador, evidências das assinaturas e registro de acesso."""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, LargeBinary, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, deferred, mapped_column

from app.core.db import Base


class TermoLgpdModel(Base):
    __tablename__ = "lgpd_termo"
    __table_args__ = (UniqueConstraint("obra_id", "versao", name="uq_lgpd_termo_versao"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    versao: Mapped[int] = mapped_column(Integer)
    titulo: Mapped[str] = mapped_column(String(150))
    texto: Mapped[str] = mapped_column(Text)
    finalidades: Mapped[list] = mapped_column(JSONB)
    hash: Mapped[str] = mapped_column(String(64))
    vigente: Mapped[bool] = mapped_column(Boolean, default=True)
    criado_por: Mapped[str] = mapped_column(String(150))
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AceiteLgpdModel(Base):
    """Resposta do colaborador ao termo (aceite de cada finalidade ou recusa), com a assinatura e onde/quando foi colhida."""
    __tablename__ = "lgpd_aceite"
    __table_args__ = (UniqueConstraint("obra_id", "id_local", name="uq_lgpd_aceite_id_local"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    id_local: Mapped[str] = mapped_column(String(64))
    colaborador_id: Mapped[int] = mapped_column(ForeignKey("colaborador.id", ondelete="CASCADE"), index=True)
    nome: Mapped[str] = mapped_column(String(150))
    matricula: Mapped[str | None] = mapped_column(String(30))
    termo_id: Mapped[int] = mapped_column(ForeignKey("lgpd_termo.id", ondelete="RESTRICT"))
    versao: Mapped[int] = mapped_column(Integer)
    termo_hash: Mapped[str] = mapped_column(String(64))
    escolhas: Mapped[dict] = mapped_column(JSONB)
    assinatura: Mapped[dict | None] = mapped_column(JSONB)  # meio, hora, código do crachá ou desenho
    hora: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    precisao: Mapped[float | None] = mapped_column(Float)
    dispositivo: Mapped[str | None] = mapped_column(String(200))
    coletado_por: Mapped[str] = mapped_column(String(80))
    coletado_por_email: Mapped[str | None] = mapped_column(String(150))
    hash: Mapped[str] = mapped_column(String(64))
    revogado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revogado_por: Mapped[str | None] = mapped_column(String(150))
    motivo_revogacao: Mapped[str | None] = mapped_column(String(300))
    recebido_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class EvidenciaAssinaturaModel(Base):
    """Prova de uma assinatura: quem, como (rosto/crachá/tela), quando, onde e — só com o aceite — a foto do momento."""
    __tablename__ = "assinatura_evidencia"
    __table_args__ = (UniqueConstraint("obra_id", "id_local", name="uq_assinatura_evidencia_id_local"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    id_local: Mapped[str] = mapped_column(String(64))
    origem: Mapped[str] = mapped_column(String(30), index=True)  # etilometro_teste | etilometro_inicio | etilometro_fim | lgpd_aceite
    origem_id_local: Mapped[str] = mapped_column(String(64), index=True)
    documento: Mapped[str | None] = mapped_column(String(200))  # "Etilômetro Nº 3 · 1º teste" etc.
    colaborador_id: Mapped[int | None] = mapped_column(ForeignKey("colaborador.id", ondelete="SET NULL"), index=True)
    nome: Mapped[str] = mapped_column(String(150))
    matricula: Mapped[str | None] = mapped_column(String(30))
    meio: Mapped[str] = mapped_column(String(10))
    hora: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    distancia: Mapped[float | None] = mapped_column(Float)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    precisao: Mapped[float | None] = mapped_column(Float)
    dispositivo: Mapped[str | None] = mapped_column(String(200))
    desenho: Mapped[str | None] = mapped_column(Text)
    foto: Mapped[bytes | None] = deferred(mapped_column(LargeBinary))
    foto_tipo: Mapped[str | None] = mapped_column(String(30))
    observacao: Mapped[str | None] = mapped_column(String(300))  # ex.: foto descartada por falta de aceite
    hash: Mapped[str] = mapped_column(String(64))
    registrado_por: Mapped[str] = mapped_column(String(80))
    recebido_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AcessoEvidenciaModel(Base):
    """Quem abriu a foto de uma assinatura ou gerou o relatório, e quando (art. 37 da LGPD)."""
    __tablename__ = "assinatura_acesso"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    evidencia_id: Mapped[int | None] = mapped_column(ForeignKey("assinatura_evidencia.id", ondelete="CASCADE"), index=True)
    acao: Mapped[str] = mapped_column(String(20))  # ver_foto | relatorio
    usuario_id: Mapped[str] = mapped_column(String(80))
    email: Mapped[str | None] = mapped_column(String(150))
    em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
