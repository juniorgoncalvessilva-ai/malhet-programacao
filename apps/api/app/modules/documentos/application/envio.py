"""Enviar documentos e relacionar o que não casou sozinho (spec 132).

`enviar`: o arquivo chega com o tipo escolhido (ou "pelo arquivo") e, quando tiver, a GRD. O Malhet lê o carimbo (DWG/DXF), o
nome e a primeira página do PDF, casa com a LDO (`domain/casamento.py`) e registra a revisão sozinho. O que não casar vai para
"A relacionar" (`documento_recebido`), com o arquivo guardado no acervo e as sugestões. Lá o Planejamento: associa a um documento
da LDO (escolhendo a revisão), cria o documento novo, relaciona a outros documentos (aplica-se a / referencia / baseado em) ou
descarta.
"""
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.arquivos.application import servico as arquivos
from app.modules.arquivos.infra.models import ArquivoModel
from app.modules.documentos.application import servico as sv
from app.modules.documentos.domain import casamento as cs
from app.modules.documentos.domain import documento as dom
from app.modules.documentos.infra.models import DocumentoModel, DocumentoRecebidoModel, DocumentoRevisaoModel, DocumentoVinculoModel
from app.shared.errors import DomainError, NotFoundError


def _refs(s: Session, obra_id: int) -> list[cs.DocRef]:
    docs = list(s.scalars(select(DocumentoModel).where(DocumentoModel.obra_id == obra_id)))
    revs: dict[int, list[DocumentoRevisaoModel]] = {}
    for r in s.scalars(select(DocumentoRevisaoModel).where(DocumentoRevisaoModel.obra_id == obra_id)):
        revs.setdefault(r.documento_id, []).append(r)
    return [cs.DocRef(d.id, d.codigo, d.codigo_contratada, d.titulo,
                      tuple(r.revisao for r in revs.get(d.id, []) if not r.arquivo_id), bool(revs.get(d.id))) for d in docs]


def _texto_pdf(dados: bytes) -> str | None:
    try:
        from app.modules.documentos.infra import pdf as pdf_infra
        return " ".join(t.texto for t in pdf_infra.textos(dados, max_paginas=1))[:20000]
    except Exception:  # noqa: BLE001 — PDF estranho só não ajuda a casar
        return None


def enviar(s: Session, obra_id: int, dados: bytes, nome: str | None, por: str, *, tipo: str | None = None,
           grd_id: int | None = None) -> dict:
    if not dados:
        raise DomainError("arquivo vazio", "arquivo")
    if len(dados) > sv.LIMITE:
        raise DomainError("arquivo maior que 60 MB", "arquivo")
    if tipo and tipo not in dom.TIPOS:
        raise DomainError(f"tipo: {', '.join(dom.TIPOS)}", "tipo")
    ext = sv._extensao(nome, dados)
    leitura = sv.ler_arquivo(nome, dados) if ext in ("dwg", "dxf") else (None, None, [])
    car = dom.ler_carimbo(leitura[1].carimbo) if leitura[1] is not None and leitura[1].carimbo else dom.Carimbo()
    refs = _refs(s, obra_id)
    c = cs.casar(refs, nome=nome, carimbo_codigo=car.codigo, carimbo_contratada=car.codigo_contratada,
                 carimbo_revisao=car.revisao, carimbo_titulo=car.titulo, texto_pdf=_texto_pdf(dados) if ext == "pdf" else None)
    if c.documento_id is None and car.codigo and car.revisao:
        c.codigo_lido, c.revisao, c.como, c.motivo = dom.normalizar_codigo(car.codigo), car.revisao, "carimbo do desenho (documento novo)", None
    if c.motivo is None:
        doc = s.get(DocumentoModel, c.documento_id) if c.documento_id else None
        try:
            r = sv.registrar_revisao(s, obra_id, dados, nome, por, codigo=doc.codigo if doc else c.codigo_lido, revisao=c.revisao,
                                     tipo=tipo or (doc.tipo if doc else None), grd_id=grd_id,
                                     leitura=leitura if leitura[1] is not None else None)
            return {"resultado": "associado", "como": c.como, "documento": r["documento"], "revisao": r["revisao"],
                    "avisos": r["avisos"], "quantidades": r.get("quantidades", 0)}
        except DomainError as e:
            c.motivo = e.mensagem  # ex.: revisão já guardada — vai para relacionar
            c.sugestoes = c.sugestoes or ([{"documento_id": doc.id, "codigo": doc.codigo, "titulo": doc.titulo, "nota": 1.0}] if doc else [])
    a = arquivos.guardar(s, obra_id, dados, sv.MIME_ORIGINAL.get(ext, "application/octet-stream"), "documento",
                         titulo=f"a relacionar · {nome or 'arquivo'}", ligacoes={"situacao": "a relacionar"}, origem="documento",
                         nome_original=nome)
    p = DocumentoRecebidoModel(obra_id=obra_id, arquivo_id=a.id, nome_original=(nome or "")[:200] or None, tipo=tipo,
                               codigo_lido=(c.codigo_lido or "")[:80] or None, revisao_lida=(car.revisao or cs.revisao_no_nome(nome) or "")[:6] or None,
                               titulo_lido=(car.titulo or "")[:300] or None, motivo=(c.motivo or "")[:300], sugestoes=c.sugestoes,
                               grd_id=grd_id, enviado_por=por)
    s.add(p)
    s.flush()
    return {"resultado": "a_relacionar", "id": p.id, "motivo": p.motivo, "sugestoes": c.sugestoes}


def listar(s: Session, obra_id: int) -> list[dict]:
    xs = list(s.scalars(select(DocumentoRecebidoModel).where(DocumentoRecebidoModel.obra_id == obra_id,
                                                             DocumentoRecebidoModel.situacao == "pendente").order_by(DocumentoRecebidoModel.id.desc())))
    mimes = dict(s.execute(select(ArquivoModel.id, ArquivoModel.mime).where(ArquivoModel.id.in_([x.arquivo_id for x in xs if x.arquivo_id] or [0]))).all())
    return [{"id": x.id, "nome": x.nome_original, "tipo": x.tipo, "codigo_lido": x.codigo_lido, "revisao_lida": x.revisao_lida,
             "titulo_lido": x.titulo_lido, "motivo": x.motivo, "sugestoes": x.sugestoes or [], "grd_id": x.grd_id,
             "mime": mimes.get(x.arquivo_id), "enviado_por": x.enviado_por, "enviado_em": x.enviado_em.isoformat() if x.enviado_em else None}
            for x in xs]


def _pendente(s: Session, obra_id: int, rid: int) -> DocumentoRecebidoModel:
    x = s.get(DocumentoRecebidoModel, rid)
    if x is None or x.obra_id != obra_id or x.situacao != "pendente":
        raise NotFoundError("arquivo a relacionar", rid)
    return x


def _relacionar(s: Session, obra_id: int, doc_id: int, relacionar_a: list[int], relacao: str, por: str) -> int:
    feitos = 0
    for alvo in relacionar_a or []:
        if alvo == doc_id:
            continue
        try:
            sv.vincular(s, obra_id, doc_id, relacao, "documento", alvo, por)
            feitos += 1
        except DomainError:
            pass  # ligação repetida não é erro aqui
    return feitos


def _resolver(s: Session, obra_id: int, x: DocumentoRecebidoModel, por: str, *, codigo: str, revisao: str, finalidade: str | None,
              titulo: str | None, tipo: str | None, relacionar_a: list[int], relacao: str) -> dict:
    a = s.get(ArquivoModel, x.arquivo_id) if x.arquivo_id else None
    if a is None:
        raise DomainError("o arquivo não está mais no acervo", "arquivo")
    dados = arquivos.abrir(s, a)
    r = sv.registrar_revisao(s, obra_id, dados, x.nome_original, por, codigo=codigo, revisao=revisao, finalidade=finalidade,
                             titulo=titulo, tipo=tipo or x.tipo, grd_id=x.grd_id)
    x.situacao, x.documento_id, x.revisao_id = "associado", r["documento"]["id"], r["revisao"]["id"]
    x.resolvido_por, x.resolvido_em = por, datetime.now(timezone.utc)
    s.flush()
    arquivos.apagar(s, a)  # a revisão guardou a própria cópia no acervo
    ligados = _relacionar(s, obra_id, r["documento"]["id"], relacionar_a, relacao, por)
    return {"documento": r["documento"], "revisao": r["revisao"], "relacionados": ligados}


def associar(s: Session, obra_id: int, rid: int, por: str, *, documento_id: int, revisao: str, finalidade: str | None = None,
             relacionar_a: list[int] | None = None, relacao: str = "referencia") -> dict:
    """Liga o arquivo a um documento que já está na LDO, como a revisão informada."""
    x = _pendente(s, obra_id, rid)
    d = sv.obter(s, obra_id, documento_id)
    return _resolver(s, obra_id, x, por, codigo=d.codigo, revisao=dom.normalizar_revisao(revisao), finalidade=finalidade, titulo=None,
                     tipo=None, relacionar_a=relacionar_a or [], relacao=relacao)


def criar(s: Session, obra_id: int, rid: int, por: str, *, codigo: str, titulo: str, revisao: str, tipo: str | None = None,
          finalidade: str | None = None, relacionar_a: list[int] | None = None, relacao: str = "referencia") -> dict:
    """Documento que não estava na LDO: entra na lista com o arquivo como revisão e, se quiser, ligado a outros documentos."""
    x = _pendente(s, obra_id, rid)
    cod = dom.normalizar_codigo(codigo)
    if s.scalar(select(DocumentoModel.id).where(DocumentoModel.obra_id == obra_id, DocumentoModel.codigo == cod)):
        raise DomainError(f"{cod} já está na lista: use associar", "codigo")
    if len((titulo or "").strip()) < 3:
        raise DomainError("informe o título do documento", "titulo")
    return _resolver(s, obra_id, x, por, codigo=cod, revisao=dom.normalizar_revisao(revisao), finalidade=finalidade,
                     titulo=titulo.strip(), tipo=tipo, relacionar_a=relacionar_a or [], relacao=relacao)


def descartar(s: Session, obra_id: int, rid: int, por: str) -> None:
    x = _pendente(s, obra_id, rid)
    a = s.get(ArquivoModel, x.arquivo_id) if x.arquivo_id else None
    x.situacao, x.resolvido_por, x.resolvido_em, x.arquivo_id = "descartado", por, datetime.now(timezone.utc), None
    s.flush()
    if a is not None:
        arquivos.apagar(s, a)


def arquivo(s: Session, obra_id: int, rid: int) -> tuple[bytes, str, str]:
    x = _pendente(s, obra_id, rid)
    a = s.get(ArquivoModel, x.arquivo_id) if x.arquivo_id else None
    if a is None:
        raise NotFoundError("arquivo", rid)
    return arquivos.abrir(s, a), a.mime, x.nome_original or a.nome


__all__ = ["enviar", "listar", "associar", "criar", "descartar", "arquivo", "DocumentoVinculoModel"]
