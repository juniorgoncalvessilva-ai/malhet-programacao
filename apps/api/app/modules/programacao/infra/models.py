from datetime import date, datetime

from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class ProgramacaoItemModel(Base):
    """Uma linha da FT_IMPORT_INTERMEDIARIA: encarregado × oper × frente × período."""

    __tablename__ = "programacao_item"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    encarregado_cracha: Mapped[str] = mapped_column(String(20), index=True)
    encarregado_nome: Mapped[str] = mapped_column(String(150))
    grupo_codigo: Mapped[str] = mapped_column(String(30))
    grupo_descricao: Mapped[str] = mapped_column(String(200))
    oper_codigo: Mapped[str] = mapped_column(String(30))
    oper_descricao: Mapped[str] = mapped_column(String(300))
    frente_codigo: Mapped[str] = mapped_column(String(30))
    tarefa_codigo: Mapped[str | None] = mapped_column(String(120))
    observacao: Mapped[str | None] = mapped_column(String(500))
    data_inicio: Mapped[date] = mapped_column(Date, index=True)
    data_fim: Mapped[date] = mapped_column(Date)
    origem: Mapped[str] = mapped_column(String(15))  # cronograma | padrao
    status: Mapped[str] = mapped_column(String(15), default="rascunho")
    indice_hh_por_unidade: Mapped[float | None] = mapped_column(Float)
    vinculo_id: Mapped[int | None] = mapped_column(Integer)
    id_crono: Mapped[str | None] = mapped_column(String(40))
    item_pq: Mapped[str | None] = mapped_column(String(40))
    composicao: Mapped[str | None] = mapped_column(String(40))
    # versões vigentes no momento da programação (rastreabilidade): {"CRONOGRAMA": 3, "PQ": 1, ...}
    versoes: Mapped[dict] = mapped_column(JSONB, default=dict)
    criado_por: Mapped[str] = mapped_column(String(80))
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    exportado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    dias: Mapped[list["ProgramacaoDiaModel"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="ProgramacaoDiaModel.data"
    )


class ProgramacaoDiaModel(Base):
    __tablename__ = "programacao_dia"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("programacao_item.id", ondelete="CASCADE"))
    data: Mapped[date] = mapped_column(Date)
    pe: Mapped[float | None] = mapped_column(Float)  # produção esperada (unidade do grupo)
    hh: Mapped[float | None] = mapped_column(Float)  # homem-hora alocado
