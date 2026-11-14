"""Arquivos da obra (spec 082): o conteúdo fica no disco (cache quente) e no provedor de nuvem da obra; aqui só a ficha."""
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class ArquivoModel(Base):
    __tablename__ = "arquivo"
    __table_args__ = (Index("ix_arquivo_fila", "situacao", "proxima_tentativa"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    uid: Mapped[str] = mapped_column(String(32), unique=True)
    tipo: Mapped[str] = mapped_column(String(30))  # foto-linha, anexo-ssma… (zettel.TIPOS)
    pasta: Mapped[str] = mapped_column(String(40))
    nome: Mapped[str] = mapped_column(String(160))  # AAAAMMDDhhmm-TIPO-curto-xxxx.ext
    nome_original: Mapped[str | None] = mapped_column(String(200))
    titulo: Mapped[str | None] = mapped_column(String(300))
    mime: Mapped[str] = mapped_column(String(120))
    tamanho: Mapped[int] = mapped_column(BigInteger)
    sha256: Mapped[str] = mapped_column(String(64))
    sensivel: Mapped[bool] = mapped_column(Boolean, default=False)
    ligacoes: Mapped[dict] = mapped_column(JSONB, default=dict)
    origem: Mapped[str | None] = mapped_column(String(60))  # tabela:id
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    no_disco: Mapped[bool] = mapped_column(Boolean, default=True)
    tem_miniatura: Mapped[bool] = mapped_column(Boolean, default=False)
    # fila: local (só no disco) → enviado (também na nuvem) | erro | sem_nuvem (obra sem provedor / sensível)
    situacao: Mapped[str] = mapped_column(String(12), default="local")
    provedor: Mapped[str | None] = mapped_column(String(12))
    ref_remota: Mapped[str | None] = mapped_column(String(200))
    enviado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    tentativas: Mapped[int] = mapped_column(Integer, default=0)
    erro: Mapped[str | None] = mapped_column(Text)
    proxima_tentativa: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ArmazenamentoObraModel(Base):
    """Provedor de nuvem da obra. O token fica cifrado (infra/segredo.py) e nunca volta para a tela."""
    __tablename__ = "armazenamento_obra"
    __table_args__ = (UniqueConstraint("obra_id", name="uq_armazenamento_obra"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    provedor: Mapped[str] = mapped_column(String(12))
    conta: Mapped[str | None] = mapped_column(String(200))
    token_cifrado: Mapped[str] = mapped_column(Text)
    pastas: Mapped[dict] = mapped_column(JSONB, default=dict)  # caminho → id remoto (Google) e índices
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    dias_no_disco: Mapped[int] = mapped_column(Integer, default=30)
    situacao: Mapped[str] = mapped_column(String(12), default="ok")  # ok | erro | reconectar
    mensagem: Mapped[str | None] = mapped_column(Text)
    conectado_por: Mapped[str] = mapped_column(String(80))
    conectado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    indice_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
