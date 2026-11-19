"""Fotos de campo: prova da frente presa a um desvio, a uma restrição ou à linha da programação num dia."""
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, LargeBinary, String, func
from sqlalchemy.orm import Mapped, deferred, mapped_column

from app.core.db import Base


class FotoCampoModel(Base):
    __tablename__ = "foto_campo"
    __table_args__ = (Index("ix_foto_campo_alvo", "obra_id", "alvo", "alvo_id"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    alvo: Mapped[str] = mapped_column(String(10))  # desvio | restricao | linha
    alvo_id: Mapped[int] = mapped_column(Integer)
    data: Mapped[date | None] = mapped_column(Date)  # dia da linha (alvo = linha)
    legenda: Mapped[str | None] = mapped_column(String(300))
    content_type: Mapped[str] = mapped_column(String(40))
    tamanho: Mapped[int] = mapped_column(Integer)
    conteudo: Mapped[bytes | None] = deferred(mapped_column(LargeBinary, nullable=True))  # legado: a fila move para `arquivo`
    arquivo_id: Mapped[int | None] = mapped_column(ForeignKey("arquivo.id", ondelete="SET NULL"), index=True)  # spec 082
    enviado_por: Mapped[str] = mapped_column(String(80))
    enviado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RegistroAtividadeModel(Base):
    """Atividade feita no campo que não está na programação (spec 119): frente (CWA), IWP da WBS ou item da PQ, e o
    que foi feito em texto livre. As fotos vão em `foto_campo` com alvo = registro."""

    __tablename__ = "registro_atividade"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    data: Mapped[date] = mapped_column(Date, index=True)
    area_id: Mapped[int] = mapped_column(ForeignKey("area_frente.id", ondelete="RESTRICT"), index=True)
    wbs_no_id: Mapped[int | None] = mapped_column(ForeignKey("wbs_no.id", ondelete="SET NULL"))
    item_pq: Mapped[str | None] = mapped_column(String(40))
    descricao_item: Mapped[str | None] = mapped_column(String(300))  # texto do IWP/item da PQ no momento do registro
    descricao: Mapped[str] = mapped_column(String(500))  # o que foi feito, nas palavras de quem registrou
    criado_por: Mapped[str] = mapped_column(String(80))
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
