"""Controle preventivo (spec 073): configuração do etilômetro, aparelhos, eventos (sessões de teste) e testes — por obra."""
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class ConfigPreventivoModel(Base):
    __tablename__ = "preventivo_config"
    __table_args__ = (UniqueConstraint("obra_id", "tipo", name="uq_preventivo_config"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    tipo: Mapped[str] = mapped_column(String(20), default="etilometro")
    config: Mapped[dict] = mapped_column(JSONB)
    atualizado_por: Mapped[str | None] = mapped_column(String(80))
    atualizado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class AparelhoModel(Base):
    __tablename__ = "etilometro_aparelho"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    marca: Mapped[str] = mapped_column(String(80))
    modelo: Mapped[str] = mapped_column(String(80))
    numero_serie: Mapped[str | None] = mapped_column(String(60))
    calibracao_em: Mapped[date | None] = mapped_column(Date)
    validade: Mapped[date | None] = mapped_column(Date)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class EventoPreventivoModel(Base):
    """Uma sessão de testes: aparelho (cópia dos dados do dia), fotos, responsável que assina no início e no fim."""
    __tablename__ = "preventivo_evento"
    __table_args__ = (UniqueConstraint("obra_id", "id_local", name="uq_preventivo_evento_id_local"),
                      UniqueConstraint("obra_id", "numero", name="uq_preventivo_evento_numero"))
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    tipo: Mapped[str] = mapped_column(String(20), default="etilometro")
    numero: Mapped[int] = mapped_column(Integer)
    id_local: Mapped[str] = mapped_column(String(64))
    data: Mapped[date] = mapped_column(Date, index=True)
    local: Mapped[str | None] = mapped_column(String(200))
    aparelho_id: Mapped[int | None] = mapped_column(ForeignKey("etilometro_aparelho.id", ondelete="SET NULL"))
    aparelho: Mapped[dict] = mapped_column(JSONB)  # marca, modelo, série, calibração e validade no dia do evento
    config: Mapped[dict] = mapped_column(JSONB)  # faixas e contraprova usadas neste evento
    responsavel_id: Mapped[int | None] = mapped_column(ForeignKey("colaborador.id", ondelete="SET NULL"))
    responsavel_nome: Mapped[str] = mapped_column(String(150))
    assinatura_inicio: Mapped[dict] = mapped_column(JSONB)
    assinatura_fim: Mapped[dict | None] = mapped_column(JSONB)
    iniciado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    encerrado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(10), default="aberto")  # aberto | encerrado
    observacao: Mapped[str | None] = mapped_column(Text)
    criado_por: Mapped[str] = mapped_column(String(80))
    criado_por_email: Mapped[str | None] = mapped_column(String(150))
    recebido_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TestePreventivoModel(Base):
    __tablename__ = "preventivo_teste"
    __table_args__ = (UniqueConstraint("obra_id", "id_local", name="uq_preventivo_teste_id_local"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    evento_id: Mapped[int] = mapped_column(ForeignKey("preventivo_evento.id", ondelete="CASCADE"), index=True)
    id_local: Mapped[str] = mapped_column(String(64))
    colaborador_id: Mapped[int | None] = mapped_column(ForeignKey("colaborador.id", ondelete="SET NULL"), index=True)
    nome: Mapped[str] = mapped_column(String(150))
    matricula: Mapped[str | None] = mapped_column(String(30))
    funcao: Mapped[str | None] = mapped_column(String(120))
    tentativa: Mapped[int] = mapped_column(Integer, default=1)  # 1 = teste, 2 = contraprova
    valor: Mapped[float | None] = mapped_column(Numeric(6, 3))
    recusa: Mapped[bool] = mapped_column(Boolean, default=False)
    resultado: Mapped[str] = mapped_column(String(10))
    faixa: Mapped[str] = mapped_column(String(80))
    penalidade: Mapped[str | None] = mapped_column(String(200))
    hora: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    leitura: Mapped[str | None] = mapped_column(String(10))  # como o colaborador foi identificado (nfc, qr, facial…)
    assinatura: Mapped[dict | None] = mapped_column(JSONB)
    registrado_por: Mapped[str] = mapped_column(String(80))
    recebido_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
