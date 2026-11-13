"""Modelos de auditoria e registros (não conformidades) por obra (spec 064)."""
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class ModeloAuditoriaModel(Base):
    __tablename__ = "auditoria_modelo"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    nome: Mapped[str] = mapped_column(String(120))
    setor: Mapped[str | None] = mapped_column(String(60))
    padrao: Mapped[bool] = mapped_column(Boolean, default=False)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    config: Mapped[dict] = mapped_column(JSONB)
    atualizado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class RegistroAuditoriaModel(Base):
    __tablename__ = "auditoria_registro"
    __table_args__ = (UniqueConstraint("obra_id", "numero", name="uq_auditoria_registro_numero"),
                      UniqueConstraint("obra_id", "id_local", name="uq_auditoria_registro_id_local"))
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    modelo_id: Mapped[int] = mapped_column(ForeignKey("auditoria_modelo.id", ondelete="RESTRICT"), index=True)
    numero: Mapped[int] = mapped_column(Integer)
    tipo: Mapped[str | None] = mapped_column(String(60))
    tipo_registro: Mapped[str | None] = mapped_column(String(120))
    data: Mapped[date] = mapped_column(Date, index=True)
    area_id: Mapped[int | None] = mapped_column(ForeignKey("area_frente.id", ondelete="SET NULL"), index=True)
    local: Mapped[str | None] = mapped_column(String(200))
    area_texto: Mapped[str | None] = mapped_column(String(250))
    equipe_id: Mapped[int | None] = mapped_column(ForeignKey("equipe.id", ondelete="SET NULL"))
    engenheiro: Mapped[str | None] = mapped_column(String(150))
    encarregado: Mapped[str | None] = mapped_column(String(150))
    rac: Mapped[str | None] = mapped_column(String(150))
    nao_conformidade: Mapped[str | None] = mapped_column(Text)
    medida_corretiva: Mapped[str | None] = mapped_column(Text)
    ver_agir: Mapped[bool | None] = mapped_column(Boolean)
    plano_responsavel: Mapped[str | None] = mapped_column(String(150))
    plano_prazo: Mapped[date | None] = mapped_column(Date)
    acompanhamento: Mapped[str | None] = mapped_column(String(300))
    respostas: Mapped[dict | None] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(String(10), default="rascunho", index=True)
    acao_id: Mapped[int | None] = mapped_column(ForeignKey("acao_5w2h.id", ondelete="SET NULL"))
    auditor_id: Mapped[str] = mapped_column(String(80))
    auditor: Mapped[str | None] = mapped_column(String(150))
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    enviado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # spec 072: id gerado no celular (registro feito sem internet) — reenviar a fila não duplica
    id_local: Mapped[str | None] = mapped_column(String(64))
    registrado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # hora do registro no aparelho
