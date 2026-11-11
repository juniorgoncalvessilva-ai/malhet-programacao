"""Nó da WBS de execução (Área → CWP → Grupo → IWP). Excluir só nó sem filhos e sem programação."""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class WbsNoModel(Base):
    __tablename__ = "wbs_no"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    pai_id: Mapped[int | None] = mapped_column(ForeignKey("wbs_no.id", ondelete="RESTRICT"), index=True)
    tipo: Mapped[str] = mapped_column(String(6))  # area | cwp | grupo | iwp
    seq: Mapped[int] = mapped_column(Integer, default=1)
    area_id: Mapped[int | None] = mapped_column(ForeignKey("area_frente.id", ondelete="RESTRICT"))
    elemento: Mapped[str | None] = mapped_column(String(80))  # CWP: Radier
    complemento: Mapped[str | None] = mapped_column(String(120))  # CWP: Eixo A–B
    grupo_id: Mapped[int | None] = mapped_column(ForeignKey("grupo_atividade.id", ondelete="RESTRICT"))
    tipo_atividade_id: Mapped[int | None] = mapped_column(ForeignKey("tipo_atividade.id", ondelete="RESTRICT"))
    item_pq: Mapped[str | None] = mapped_column(String(40))  # IWP
    quantidade: Mapped[float | None] = mapped_column(Float)  # IWP: vazio = take-off da TAG da área
    id_crono: Mapped[str | None] = mapped_column(String(40), index=True)  # IWP vindo do P6: código da atividade
    origem: Mapped[str] = mapped_column(String(6), default="manual", server_default="manual")  # manual | p6
    chave_p6: Mapped[str | None] = mapped_column(String(400))  # CWP vindo do P6: caminho da WBS abaixo do CWA
    fora_cronograma: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")  # sumiu do P6 vigente
    observacao: Mapped[str | None] = mapped_column(String(300))
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
