from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class PlanoItemModel(Base):
    """Atividade pensada no plano de 90 dias (Spec 043)."""
    __tablename__ = "plano_item"
    __table_args__ = (UniqueConstraint("obra_id", "numero", name="uq_plano_item_numero"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    numero: Mapped[int] = mapped_column(Integer)  # P90-0001
    descricao: Mapped[str] = mapped_column(String(300))
    area_id: Mapped[int | None] = mapped_column(ForeignKey("area_frente.id", ondelete="RESTRICT"), index=True)
    wbs_no_id: Mapped[int | None] = mapped_column(ForeignKey("wbs_no.id", ondelete="SET NULL"), index=True)  # IWP
    tipo_id: Mapped[int | None] = mapped_column(ForeignKey("tipo_atividade.id", ondelete="SET NULL"))
    id_crono: Mapped[str | None] = mapped_column(String(40))
    equipe_id: Mapped[int | None] = mapped_column(ForeignKey("equipe.id", ondelete="SET NULL"))
    inicio: Mapped[date] = mapped_column(Date, index=True)
    fim: Mapped[date] = mapped_column(Date, index=True)
    quantidade: Mapped[float | None] = mapped_column(Float)
    responsavel: Mapped[str | None] = mapped_column(String(150))
    marco: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")  # pull planning: é um marco
    marco_id: Mapped[int | None] = mapped_column(ForeignKey("plano_item.id", ondelete="SET NULL"))  # marco que puxa
    analisado: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")  # restrições levantadas
    analisado_em: Mapped[date | None] = mapped_column(Date)
    observacao: Mapped[str | None] = mapped_column(String(600))
    criado_por: Mapped[str | None] = mapped_column(String(80))
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
