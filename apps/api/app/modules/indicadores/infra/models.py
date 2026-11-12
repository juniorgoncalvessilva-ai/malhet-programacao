"""Histórico da programação para KPIs (fato linha × dia) e desvios (Pareto) da obra."""
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class FatoProgramacaoModel(Base):
    """Uma linha da programação num dia, como foi emitida (previsto, modo, capacidade nas duas bases) e, ao concluir,
    com o realizado. Cada emissão grava as suas linhas (a anterior deixa de ser vigente); a conclusão regrava a
    revisão vigente com o realizado. Os nomes (equipe, grupo, área…) ficam copiados: o histórico não muda se o
    cadastro mudar."""

    __tablename__ = "programacao_fato"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    programacao_id: Mapped[int] = mapped_column(ForeignKey("programacao.id", ondelete="CASCADE"), index=True)
    linha_id: Mapped[int | None] = mapped_column(ForeignKey("programacao_linha.id", ondelete="SET NULL"), index=True)
    revisao: Mapped[int] = mapped_column(Integer)  # revisão da emissão (0, 1, …)
    vigente: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    concluida: Mapped[bool] = mapped_column(Boolean, default=False)
    conclusao: Mapped[int | None] = mapped_column(Integer)  # nº da conclusão (1; 2… depois de revisão)
    tipo_programacao: Mapped[str] = mapped_column(String(10))
    titulo: Mapped[str] = mapped_column(String(120))
    data: Mapped[date] = mapped_column(Date, index=True)
    semana: Mapped[int] = mapped_column(Integer, index=True)
    n_linha: Mapped[int] = mapped_column(Integer)
    natureza: Mapped[str] = mapped_column(String(1), default="P")
    modo_previsto: Mapped[str] = mapped_column(String(10), default="manual")
    base_capacidade: Mapped[str] = mapped_column(String(8), default="equipe")
    # o que foi programado e o que a capacidade dava
    previsto: Mapped[float | None] = mapped_column(Float)
    qtd_periodo: Mapped[float | None] = mapped_column(Float)
    capacidade: Mapped[float | None] = mapped_column(Float)  # do dia, na base da programação
    capacidade_equipe: Mapped[float | None] = mapped_column(Float)
    capacidade_governa: Mapped[float | None] = mapped_column(Float)
    sugerido: Mapped[float | None] = mapped_column(Float)  # o que o botão "Pela capacidade" daria
    horas_dia: Mapped[float | None] = mapped_column(Float)
    hh_un: Mapped[float | None] = mapped_column(Float)
    hh_previsto: Mapped[float | None] = mapped_column(Float)
    # realizado (na conclusão); HH apropriado = pessoas da equipe programada × jornada × fator do dia (Simova em implantação)
    realizado: Mapped[float | None] = mapped_column(Float)
    hh_realizado_cpu: Mapped[float | None] = mapped_column(Float)  # realizado × HH/un
    hh_equipe: Mapped[float | None] = mapped_column(Float)
    pessoas: Mapped[float | None] = mapped_column(Float)
    jornada: Mapped[float | None] = mapped_column(Float)
    # dimensões (copiadas)
    equipe_id: Mapped[int | None] = mapped_column(Integer)
    equipe: Mapped[str | None] = mapped_column(String(150))
    encarregado: Mapped[str | None] = mapped_column(String(150))
    cracha: Mapped[str | None] = mapped_column(String(40))
    grupo: Mapped[str | None] = mapped_column(String(200))
    codigo_simova: Mapped[str | None] = mapped_column(String(40))
    descricao: Mapped[str | None] = mapped_column(String(400))
    item_pq: Mapped[str | None] = mapped_column(String(40), index=True)
    unidade: Mapped[str | None] = mapped_column(String(20))
    area_id: Mapped[int | None] = mapped_column(Integer)
    area: Mapped[str | None] = mapped_column(String(200))
    local: Mapped[str | None] = mapped_column(String(200))
    wbs_codigo: Mapped[str | None] = mapped_column(String(60))
    id_crono: Mapped[str | None] = mapped_column(String(40))
    gravado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CausaDesvioModel(Base):
    __tablename__ = "causa_desvio"
    __table_args__ = (UniqueConstraint("obra_id", "descricao", name="uq_causa_desvio_obra"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    numero: Mapped[int] = mapped_column(Integer)
    descricao: Mapped[str] = mapped_column(String(150))
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)


class DesvioModel(Base):
    """Linha do Pareto semanal de desvios (aba Detalhamento): o motivo de um item não cumprido."""

    __tablename__ = "desvio"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    data: Mapped[date] = mapped_column(Date, index=True)
    semana: Mapped[int] = mapped_column(Integer, index=True)
    programacao_id: Mapped[int | None] = mapped_column(ForeignKey("programacao.id", ondelete="SET NULL"), index=True)
    linha_id: Mapped[int | None] = mapped_column(ForeignKey("programacao_linha.id", ondelete="SET NULL"), index=True)
    causa_id: Mapped[int] = mapped_column(ForeignKey("causa_desvio.id", ondelete="RESTRICT"), index=True)
    referencia: Mapped[str | None] = mapped_column(String(80))  # coluna ID do Pareto (atividade, documento…)
    descricao: Mapped[str] = mapped_column(String(500))  # Desvio
    frente: Mapped[str | None] = mapped_column(String(200))  # Frente de serviço
    area_id: Mapped[int | None] = mapped_column(ForeignKey("area_frente.id", ondelete="SET NULL"))
    acao: Mapped[str | None] = mapped_column(String(500))
    responsavel: Mapped[str | None] = mapped_column(String(150))
    gerencia: Mapped[str | None] = mapped_column(String(80))  # Responsabilidade - Gerência (contratada / cliente)
    status: Mapped[int] = mapped_column(Integer, default=1)  # 1 pendente · 2 em andamento · 3 concluído
    atividade_impactada: Mapped[str | None] = mapped_column(String(300))
    qtd_nao_cumprida: Mapped[float | None] = mapped_column(Float)
    origem: Mapped[str] = mapped_column(String(10), default="app")  # app | importado
    criado_por: Mapped[str | None] = mapped_column(String(80))
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
