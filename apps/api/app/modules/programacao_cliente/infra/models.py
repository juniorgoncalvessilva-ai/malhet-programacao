"""Área de conferência da programação semanal do cliente (spec 146): a planilha importada, cada linha com os vínculos
ao Malhet e as decisões de quem conferiu (lembradas para a semana seguinte). Nada aqui mexe na programação até "Levar"."""
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class ImportacaoClienteModel(Base):
    __tablename__ = "programacao_cliente_importacao"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    nome_arquivo: Mapped[str] = mapped_column(String(200))
    arquivo_id: Mapped[int | None] = mapped_column(ForeignKey("arquivo.id", ondelete="SET NULL"))  # no acervo (10-programacoes)
    aba: Mapped[str] = mapped_column(String(120))
    abas: Mapped[list] = mapped_column(JSONB, default=list)
    titulo: Mapped[str | None] = mapped_column(String(300))
    inicio: Mapped[date] = mapped_column(Date)
    fim: Mapped[date] = mapped_column(Date)
    avisos: Mapped[list] = mapped_column(JSONB, default=list)
    situacao: Mapped[str] = mapped_column(String(12), default="conferindo")  # conferindo | levada | arquivada
    programacao_id: Mapped[int | None] = mapped_column(ForeignKey("programacao.id", ondelete="SET NULL"))  # para onde foi
    levada_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    levada_por: Mapped[str | None] = mapped_column(String(80))
    criado_por: Mapped[str] = mapped_column(String(80))
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    linhas: Mapped[list["LinhaClienteModel"]] = relationship(cascade="all, delete-orphan", order_by="LinhaClienteModel.ordem")


class LinhaClienteModel(Base):
    __tablename__ = "programacao_cliente_linha"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    importacao_id: Mapped[int] = mapped_column(ForeignKey("programacao_cliente_importacao.id", ondelete="CASCADE"), index=True)
    ordem: Mapped[int] = mapped_column(Integer)
    linha: Mapped[int] = mapped_column(Integer)  # linha da P no Excel
    dados: Mapped[dict] = mapped_column(JSONB)  # o que a planilha traz (LinhaPlanilha.como_dict)
    chave: Mapped[str] = mapped_column(String(300))  # chave da decisão lembrada
    area_id: Mapped[int | None] = mapped_column(ForeignKey("area_frente.id", ondelete="SET NULL"))
    area_sit: Mapped[str | None] = mapped_column(String(10))  # ok | sugerido | None
    area_motivo: Mapped[str | None] = mapped_column(String(300))
    area_opcoes: Mapped[list | None] = mapped_column(JSONB)
    id_crono: Mapped[str | None] = mapped_column(String(40))
    crono_sit: Mapped[str | None] = mapped_column(String(10))
    crono_motivo: Mapped[str | None] = mapped_column(String(300))
    item_pq: Mapped[str | None] = mapped_column(String(40))
    item_sit: Mapped[str | None] = mapped_column(String(10))
    item_motivo: Mapped[str | None] = mapped_column(String(300))
    item_opcoes: Mapped[list | None] = mapped_column(JSONB)  # sugestões pela descrição (com a parecença)
    tipo_id: Mapped[int | None] = mapped_column(ForeignKey("tipo_atividade.id", ondelete="SET NULL"))
    grupo_id: Mapped[int | None] = mapped_column(ForeignKey("grupo_atividade.id", ondelete="SET NULL"))  # item fora do Catálogo
    wbs_no_id: Mapped[int | None] = mapped_column(ForeignKey("wbs_no.id", ondelete="SET NULL"))
    wbs_sit: Mapped[str | None] = mapped_column(String(10))
    wbs_motivo: Mapped[str | None] = mapped_column(String(300))
    equipe_id: Mapped[int | None] = mapped_column(ForeignKey("equipe.id", ondelete="SET NULL"))
    equipe_sit: Mapped[str | None] = mapped_column(String(10))
    equipe_motivo: Mapped[str | None] = mapped_column(String(300))
    equipe_opcoes: Mapped[list | None] = mapped_column(JSONB)
    lembrada: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")  # veio de decisão anterior
    conferida: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")  # alguém confirmou
    ignorar: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")  # não levar
    levada_linha_id: Mapped[int | None] = mapped_column(ForeignKey("programacao_linha.id", ondelete="SET NULL"))


class DecisaoClienteModel(Base):
    """O vínculo escolhido por quem conferiu, pela chave da linha (a mesma atividade na semana seguinte)."""

    __tablename__ = "programacao_cliente_decisao"
    __table_args__ = (UniqueConstraint("obra_id", "chave", name="uq_programacao_cliente_decisao"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    chave: Mapped[str] = mapped_column(String(300))
    area_id: Mapped[int | None] = mapped_column(ForeignKey("area_frente.id", ondelete="SET NULL"))
    item_pq: Mapped[str | None] = mapped_column(String(40))
    grupo_id: Mapped[int | None] = mapped_column(ForeignKey("grupo_atividade.id", ondelete="SET NULL"))
    wbs_no_id: Mapped[int | None] = mapped_column(ForeignKey("wbs_no.id", ondelete="SET NULL"))
    equipe_id: Mapped[int | None] = mapped_column(ForeignKey("equipe.id", ondelete="SET NULL"))
    ignorar: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    por: Mapped[str] = mapped_column(String(80))
    em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
