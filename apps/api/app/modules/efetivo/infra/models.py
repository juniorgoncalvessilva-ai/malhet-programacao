"""Efetivo da obra: colaboradores (chave = matrícula), importações semanais, movimentos e de-para de funções."""
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class ColaboradorModel(Base):
    """Uma pessoa do efetivo. Reimportar atualiza pela chave (matrícula) e não mexe na equipe."""

    __tablename__ = "colaborador"
    __table_args__ = (UniqueConstraint("obra_id", "chave", name="uq_colaborador_chave"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    chave: Mapped[str] = mapped_column(String(120))  # matrícula (próprio), EMPRESA:matrícula, ou provisória pelo nome
    empresa: Mapped[str] = mapped_column(String(80))
    matricula: Mapped[str | None] = mapped_column(String(20), index=True)
    cracha: Mapped[str | None] = mapped_column(String(20), index=True)  # crachá do Simova
    nome: Mapped[str] = mapped_column(String(150))
    funcao: Mapped[str | None] = mapped_column(String(120))
    funcao_chave: Mapped[str | None] = mapped_column(String(120), index=True)
    dp: Mapped[str | None] = mapped_column(String(20))
    tipo_mo: Mapped[str | None] = mapped_column(String(10))
    status_original: Mapped[str | None] = mapped_column(String(30))
    situacao: Mapped[str] = mapped_column(String(20), index=True)
    mobilizacao_prevista: Mapped[date | None] = mapped_column(Date)
    admissao: Mapped[date | None] = mapped_column(Date)
    demissao: Mapped[date | None] = mapped_column(Date)
    cracha_vale: Mapped[str | None] = mapped_column(String(20))
    rac2: Mapped[bool | None] = mapped_column(Boolean)
    paebm: Mapped[bool | None] = mapped_column(Boolean)
    no_ultimo_arquivo: Mapped[bool] = mapped_column(Boolean, default=True)
    origem: Mapped[str] = mapped_column(String(10), default="efetivo")  # efetivo | simova | manual
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    atualizado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(),
                                                    onupdate=func.now())


class ImportacaoEfetivoModel(Base):
    __tablename__ = "importacao_efetivo"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    arquivo: Mapped[str] = mapped_column(String(255))
    importado_por: Mapped[str] = mapped_column(String(80))
    importado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    resumo: Mapped[dict] = mapped_column(JSONB)  # novos, atualizados, fora_do_arquivo, mudancas de situação…


class MovimentoEfetivoModel(Base):
    """Histórico da mobilização: entrada, mudança de situação/função, entrada e saída de equipe."""

    __tablename__ = "movimento_efetivo"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    colaborador_id: Mapped[int] = mapped_column(ForeignKey("colaborador.id", ondelete="CASCADE"), index=True)
    tipo: Mapped[str] = mapped_column(String(20))  # ENTRADA | SITUACAO | FUNCAO | EQUIPE | FORA_DO_ARQUIVO
    de: Mapped[str | None] = mapped_column(String(150))
    para: Mapped[str | None] = mapped_column(String(150))
    importacao_id: Mapped[int | None] = mapped_column(ForeignKey("importacao_efetivo.id", ondelete="SET NULL"))
    por: Mapped[str] = mapped_column(String(80))
    em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DeParaFuncaoModel(Base):
    """Função do efetivo (como o DP escreve) → função da composição (CPU). Ignorar = indireto/não produz."""

    __tablename__ = "depara_funcao"
    __table_args__ = (UniqueConstraint("obra_id", "funcao_chave", name="uq_depara_funcao"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    funcao_chave: Mapped[str] = mapped_column(String(120))
    funcao: Mapped[str] = mapped_column(String(120))
    recurso: Mapped[str | None] = mapped_column(String(120))  # nome da função na CPU (Pedreiro, Servente…)
    ignorar: Mapped[bool] = mapped_column(Boolean, default=False)
    atualizado_por: Mapped[str | None] = mapped_column(String(80))


class SetorObraModel(Base):
    """Setor da obra (organograma): nome, cor e responsável escolhido no efetivo. Equipes apontam para o setor."""

    __tablename__ = "setor_obra"
    __table_args__ = (UniqueConstraint("obra_id", "nome", name="uq_setor_obra_nome"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    nome: Mapped[str] = mapped_column(String(80))
    cor: Mapped[str | None] = mapped_column(String(9))  # #RRGGBB
    ordem: Mapped[int] = mapped_column(Integer, default=0)
    responsavel_id: Mapped[int | None] = mapped_column(ForeignKey("colaborador.id", ondelete="SET NULL"))


class OrganogramaConfigModel(Base):
    """Um por obra: responsável geral (do efetivo) e cores dos níveis do organograma."""

    __tablename__ = "organograma_config"
    __table_args__ = (UniqueConstraint("obra_id", name="uq_organograma_config_obra"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    responsavel_id: Mapped[int | None] = mapped_column(ForeignKey("colaborador.id", ondelete="SET NULL"))
    cores: Mapped[dict] = mapped_column(JSONB, default=dict)  # {obra, setor, equipe, funcao}: #RRGGBB
