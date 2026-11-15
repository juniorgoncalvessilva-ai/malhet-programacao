"""Relatos de erro (spec 098). É um registro do sistema, não um dado da obra: `obra_id` é opcional (o erro pode
acontecer no login, antes de escolher a obra) e fica nulo se a obra for apagada. Só o super admin lê."""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class ErroRelatoModel(Base):
    __tablename__ = "erro_relato"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_local: Mapped[str] = mapped_column(String(64), unique=True)  # gerado no aparelho: reenviar não duplica
    codigo: Mapped[str] = mapped_column(String(10), index=True)  # E-3F9A2C, o que a pessoa cita
    grupo: Mapped[str] = mapped_column(String(16), index=True)  # erros iguais
    origem: Mapped[str] = mapped_column(String(10))  # web | campo | nativo | api
    tipo: Mapped[str] = mapped_column(String(10))  # js | promessa | tela | api | servidor | manual
    mensagem: Mapped[str] = mapped_column(String(500), default="")
    local: Mapped[str] = mapped_column(String(200), default="/")  # tela de onde partiu
    acao: Mapped[str] = mapped_column(String(200), default="")  # chamada que falhou
    status: Mapped[int | None] = mapped_column(Integer)
    pilha: Mapped[str] = mapped_column(Text, default="")
    comentario: Mapped[str] = mapped_column(String(1000), default="")  # o que a pessoa fazia (opcional)
    versao: Mapped[str] = mapped_column(String(40), default="")
    navegador: Mapped[str] = mapped_column(String(80), default="")
    obra_id: Mapped[int | None] = mapped_column(ForeignKey("obra.id", ondelete="SET NULL"), index=True)
    usuario_id: Mapped[str | None] = mapped_column(String(80), index=True)
    usuario_email: Mapped[str | None] = mapped_column(String(150))  # para a equipe poder falar com a pessoa
    ocorrido_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class ErroGrupoModel(Base):
    """Situação de um grupo de erros iguais: resolvido por quem e quando. Erro novo depois disso = "voltou"."""
    __tablename__ = "erro_grupo"
    grupo: Mapped[str] = mapped_column(String(16), primary_key=True)
    resolvido_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolvido_por: Mapped[str | None] = mapped_column(String(150))
    nota: Mapped[str | None] = mapped_column(String(500))
