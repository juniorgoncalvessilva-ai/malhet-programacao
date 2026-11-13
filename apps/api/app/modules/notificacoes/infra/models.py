"""Central de notificações (spec 076): um alerta da obra endereçado a perfis (papéis) e/ou pessoas; cada um marca o que leu."""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class NotificacaoModel(Base):
    __tablename__ = "notificacao"
    __table_args__ = (UniqueConstraint("obra_id", "chave", name="uq_notificacao_chave"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    tipo: Mapped[str] = mapped_column(String(30), index=True)
    gravidade: Mapped[str] = mapped_column(String(10), default="info")  # info | atencao | critico
    titulo: Mapped[str] = mapped_column(String(150))
    texto: Mapped[str | None] = mapped_column(String(500))
    url: Mapped[str | None] = mapped_column(String(200))  # tela do web
    url_mobile: Mapped[str | None] = mapped_column(String(200))  # tela do celular
    papeis: Mapped[list] = mapped_column(JSONB, default=list)  # para quem tem esses papéis na obra
    usuarios: Mapped[list] = mapped_column(JSONB, default=list)  # e/ou para estas pessoas (id da conta)
    autor_id: Mapped[str | None] = mapped_column(String(80))  # quem causou não recebe o próprio aviso
    chave: Mapped[str | None] = mapped_column(String(120))  # evita repetir o mesmo aviso
    criada_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class LeituraNotificacaoModel(Base):
    __tablename__ = "notificacao_lida"
    __table_args__ = (UniqueConstraint("notificacao_id", "usuario_id", name="uq_notificacao_lida"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    notificacao_id: Mapped[int] = mapped_column(ForeignKey("notificacao.id", ondelete="CASCADE"), index=True)
    usuario_id: Mapped[str] = mapped_column(String(80), index=True)
    lida_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
