"""Documentos controlados (spec 123): lista de documentos (LDO), revisões com os arquivos no acervo, ligações
Zettelkasten, GRDs e o registro de quem abriu qual revisão (ISO 9001:2015, 7.5)."""
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class DocumentoModel(Base):
    __tablename__ = "documento"
    __table_args__ = (UniqueConstraint("obra_id", "codigo", name="uq_documento_codigo"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    codigo: Mapped[str] = mapped_column(String(80))  # código do cliente (ex.: 1870AA-C-51890)
    codigo_contratada: Mapped[str | None] = mapped_column(String(80))
    titulo: Mapped[str] = mapped_column(String(300))
    tipo: Mapped[str] = mapped_column(String(4), default="DES")  # DES | PRO | NOR | ESP | MEM | LIS | IT | OUT
    disciplina: Mapped[str | None] = mapped_column(String(40))
    projeto: Mapped[str | None] = mapped_column(String(150))
    origem: Mapped[str] = mapped_column(String(10), default="manual")  # ldo | carimbo | manual
    pacote: Mapped[str | None] = mapped_column(String(80))  # aba da LDO (spec 128): "1870CC - CMD"
    local_texto: Mapped[str | None] = mapped_column(String(200))  # "Observações" da LDO: CWA/local como o cliente escreveu
    disciplina_sigla: Mapped[str | None] = mapped_column(String(6))
    observacao: Mapped[str | None] = mapped_column(String(500))
    criado_por: Mapped[str] = mapped_column(String(150))
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DocumentoRevisaoModel(Base):
    __tablename__ = "documento_revisao"
    __table_args__ = (UniqueConstraint("documento_id", "revisao", name="uq_documento_revisao"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    documento_id: Mapped[int] = mapped_column(ForeignKey("documento.id", ondelete="CASCADE"), index=True)
    revisao: Mapped[str] = mapped_column(String(6))
    finalidade: Mapped[str] = mapped_column(String(40))  # PARA CONSTRUÇÃO, PARA APROVAÇÃO…
    data_emissao: Mapped[date | None] = mapped_column(Date)
    nome_original: Mapped[str | None] = mapped_column(String(200))
    arquivo_id: Mapped[int | None] = mapped_column(ForeignKey("arquivo.id", ondelete="SET NULL"))  # como veio
    pdf_arquivo_id: Mapped[int | None] = mapped_column(ForeignKey("arquivo.id", ondelete="SET NULL"))
    png_arquivo_id: Mapped[int | None] = mapped_column(ForeignKey("arquivo.id", ondelete="SET NULL"))
    dxf_arquivo_id: Mapped[int | None] = mapped_column(ForeignKey("arquivo.id", ondelete="SET NULL"))
    carimbo: Mapped[dict | None] = mapped_column(JSONB)  # atributos lidos do carimbo
    tags: Mapped[list | None] = mapped_column(JSONB)  # TAGs citadas no desenho
    avisos: Mapped[list | None] = mapped_column(JSONB)
    grd_id: Mapped[int | None] = mapped_column(ForeignKey("grd.id", ondelete="SET NULL"))  # GRD em que chegou
    # da LDO (spec 128): por que revisou, quando a LDO foi enviada, se o projeto foi apresentado e a quem, e qual LDO listou
    motivo: Mapped[str | None] = mapped_column(String(300))
    ldo_enviada_em: Mapped[date | None] = mapped_column(Date)
    apresentado: Mapped[bool | None] = mapped_column(Boolean)
    apresentado_para: Mapped[str | None] = mapped_column(String(150))
    ldo: Mapped[str | None] = mapped_column(String(100))
    enviado_por: Mapped[str] = mapped_column(String(150))
    enviado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DocumentoVinculoModel(Base):
    """Ligação Zettelkasten: o documento aplica-se a uma frente/IWP/grupo, ou referencia/baseia-se em outro documento."""

    __tablename__ = "documento_vinculo"
    __table_args__ = (UniqueConstraint("documento_id", "relacao", "alvo_tipo", "alvo_id", name="uq_documento_vinculo"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    documento_id: Mapped[int] = mapped_column(ForeignKey("documento.id", ondelete="CASCADE"), index=True)
    relacao: Mapped[str] = mapped_column(String(12))  # aplica_a | referencia | baseado_em | substitui
    alvo_tipo: Mapped[str] = mapped_column(String(10))  # area | wbs | grupo | documento
    alvo_id: Mapped[int] = mapped_column(Integer, index=True)
    sugerido: Mapped[bool] = mapped_column(Boolean, default=False)  # veio da TAG do desenho; falta confirmar
    criado_por: Mapped[str] = mapped_column(String(150))
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class GrdModel(Base):
    """Guia de remessa de documentos: o que chegou (do cliente/projetista) ou saiu (para fornecedor, campo)."""

    __tablename__ = "grd"
    __table_args__ = (UniqueConstraint("obra_id", "numero", name="uq_grd_numero"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    numero: Mapped[str] = mapped_column(String(40))
    numero_externo: Mapped[str | None] = mapped_column(String(80))  # número da GRD de quem mandou
    sentido: Mapped[str] = mapped_column(String(9))  # recebida | emitida
    data: Mapped[date] = mapped_column(Date)
    remetente: Mapped[str] = mapped_column(String(150))
    destinatario: Mapped[str] = mapped_column(String(150))
    observacao: Mapped[str | None] = mapped_column(Text)
    ciente_por: Mapped[str | None] = mapped_column(String(150))  # quem deu ciência do recebimento
    ciente_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    criado_por: Mapped[str] = mapped_column(String(150))
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class GrdItemModel(Base):
    __tablename__ = "grd_item"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    grd_id: Mapped[int] = mapped_column(ForeignKey("grd.id", ondelete="CASCADE"), index=True)
    documento_id: Mapped[int] = mapped_column(ForeignKey("documento.id", ondelete="CASCADE"), index=True)
    revisao_id: Mapped[int | None] = mapped_column(ForeignKey("documento_revisao.id", ondelete="SET NULL"))
    revisao: Mapped[str] = mapped_column(String(6))
    finalidade: Mapped[str] = mapped_column(String(40))
    ordem: Mapped[int] = mapped_column(Integer, default=0)


class DocumentoLeituraModel(Base):
    """Quem abriu qual revisão, quando e por onde (computador, app de campo, link do encarregado)."""

    __tablename__ = "documento_leitura"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    revisao_id: Mapped[int] = mapped_column(ForeignKey("documento_revisao.id", ondelete="CASCADE"), index=True)
    quem: Mapped[str] = mapped_column(String(150))
    via: Mapped[str] = mapped_column(String(8))  # web | campo | portal
    formato: Mapped[str] = mapped_column(String(8))  # png | pdf | original | dxf
    em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TakeoffProjetoModel(Base):
    """Quantidade lida do desenho de uma revisão (spec 124): quadro, anotação, camada ou bloco, com a memória da conta.
    O planejador aceita (item da PQ, frente, fator) e leva ao IWP; a revisão nova reaproveita as decisões pela chave."""

    __tablename__ = "takeoff_projeto"
    __table_args__ = (UniqueConstraint("revisao_id", "chave", name="uq_takeoff_projeto_chave"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    documento_id: Mapped[int] = mapped_column(ForeignKey("documento.id", ondelete="CASCADE"), index=True)
    revisao_id: Mapped[int] = mapped_column(ForeignKey("documento_revisao.id", ondelete="CASCADE"), index=True)
    origem: Mapped[str] = mapped_column(String(10))  # quadro | anotacao | camada | bloco
    chave: Mapped[str] = mapped_column(String(200))
    descricao: Mapped[str] = mapped_column(String(300))
    quantidade: Mapped[float] = mapped_column(Float)
    unidade: Mapped[str] = mapped_column(String(20))
    memoria: Mapped[dict | None] = mapped_column(JSONB)  # fórmula, passos e fontes (local no desenho)
    avisos: Mapped[list | None] = mapped_column(JSONB)
    confere: Mapped[bool | None] = mapped_column(Boolean)
    item_sugerido: Mapped[str | None] = mapped_column(String(40))
    item_pq: Mapped[str | None] = mapped_column(String(40))
    area_id: Mapped[int | None] = mapped_column(ForeignKey("area_frente.id", ondelete="SET NULL"))
    fator: Mapped[float] = mapped_column(Float, default=1.0, server_default="1")
    situacao: Mapped[str] = mapped_column(String(10), default="extraido", server_default="extraido")  # extraido | aceito | descartado
    decidido_por: Mapped[str | None] = mapped_column(String(150))
    decidido_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    wbs_no_id: Mapped[int | None] = mapped_column(ForeignKey("wbs_no.id", ondelete="SET NULL"))  # IWP que recebeu
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DocumentoPastaModel(Base):
    """Pasta de documentos da obra (spec 129): cópia da pasta-modelo do Malhet, ajustável. Pasta é regra (tipos, disciplinas,
    pacotes), não lugar — o documento aparece em toda pasta cuja regra cumpre; nenhum arquivo é movido."""

    __tablename__ = "documento_pasta"
    __table_args__ = (UniqueConstraint("obra_id", "codigo", name="uq_documento_pasta_codigo"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    obra_id: Mapped[int] = mapped_column(ForeignKey("obra.id", ondelete="CASCADE"), index=True)
    codigo: Mapped[str] = mapped_column(String(6))  # 10, 20… (ordem)
    nome: Mapped[str] = mapped_column(String(80))
    descricao: Mapped[str | None] = mapped_column(String(200))
    tipos: Mapped[list | None] = mapped_column(JSONB)
    disciplinas: Mapped[list | None] = mapped_column(JSONB)
    pacotes: Mapped[list | None] = mapped_column(JSONB)
    do_modelo: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    criado_por: Mapped[str] = mapped_column(String(150))
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
