"""Restrições e ações do look-ahead (Plano de Ação 6WLA, aba Ações)."""
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class AcaoRestricaoModel(Base):
    __tablename__ = "acao_restricao"
    __table_args__ = (UniqueConstraint("obra_id", "numero", name="uq_acao_restricao_numero"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    numero: Mapped[int] = mapped_column(Integer)  # Nº
    atividade: Mapped[str | None] = mapped_column(String(80))  # ATIVIDADE (frente de apoio: Implantação, Planejamento…)
    impeditivo: Mapped[bool | None] = mapped_column(Boolean)  # IMPEDITIVO (SIM/NÃO)
    acao: Mapped[str] = mapped_column(String(600))  # AÇÕES
    area_texto: Mapped[str | None] = mapped_column(String(200))  # ÁREA como na planilha
    area_id: Mapped[int | None] = mapped_column(ForeignKey("area_frente.id", ondelete="SET NULL"), index=True)
    referencia: Mapped[str | None] = mapped_column(String(80))  # ID
    reuniao: Mapped[str] = mapped_column(String(20), default="6WLA")
    responsavel: Mapped[str | None] = mapped_column(String(150))
    gerencia: Mapped[str | None] = mapped_column(String(80))
    prazo_inicio: Mapped[date | None] = mapped_column(Date)
    prazo_termino: Mapped[date | None] = mapped_column(Date, index=True)
    reprogramado: Mapped[date | None] = mapped_column(Date)
    reprogramacoes: Mapped[int] = mapped_column(Integer, default=0)  # nº
    conclusao: Mapped[date | None] = mapped_column(Date)
    status1: Mapped[str] = mapped_column(String(10), default="Pendente")
    seis_m: Mapped[str | None] = mapped_column(String(3))
    observacoes: Mapped[str | None] = mapped_column(String(4000))  # histórico: "dd/mm: texto", a mais nova no topo
    # vínculo com o que a restrição trava (opcional)
    linha_id: Mapped[int | None] = mapped_column(ForeignKey("programacao_linha.id", ondelete="SET NULL"), index=True)
    equipe_id: Mapped[int | None] = mapped_column(ForeignKey("equipe.id", ondelete="SET NULL"))
    plano_item_id: Mapped[int | None] = mapped_column(ForeignKey("plano_item.id", ondelete="SET NULL"), index=True)  # plano de 90 dias
    origem: Mapped[str] = mapped_column(String(10), default="app")  # app | importado
    criado_por: Mapped[str | None] = mapped_column(String(80))
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
