"""Fotos de campo: enviar (celular), listar, ver e excluir."""
from datetime import date

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, ler, programar
from app.core.db import get_session
from app.modules.campo.domain.foto import LIMITE, tipo_da_imagem, validar_alvo
from app.modules.campo.infra.models import FotoCampoModel
from app.modules.obras.domain.obra import PapelObra
from app.shared.errors import DomainError, NotFoundError

router = APIRouter(prefix="/fotos", tags=["fotos de campo"])


def _alvo_existe(s: Session, obra_id: int, alvo: str, alvo_id: int) -> None:
    if alvo == "desvio":
        from app.modules.indicadores.infra.models import DesvioModel as M
    elif alvo == "restricao":
        from app.modules.restricoes.infra.models import AcaoRestricaoModel as M
    else:
        from app.modules.planejamento.infra.models import LinhaProgramacaoModel, ProgramacaoModel

        ln = s.get(LinhaProgramacaoModel, alvo_id)
        p = s.get(ProgramacaoModel, ln.programacao_id) if ln else None
        if p is None or p.obra_id != obra_id:
            raise NotFoundError("Linha", alvo_id)
        return
    x = s.get(M, alvo_id)
    if x is None or x.obra_id != obra_id:
        raise NotFoundError(alvo.capitalize(), alvo_id)


def _out(f: FotoCampoModel) -> dict:
    return {"id": f.id, "alvo": f.alvo, "alvo_id": f.alvo_id, "data": f.data.isoformat() if f.data else None,
            "legenda": f.legenda, "tamanho": f.tamanho, "enviado_por": f.enviado_por,
            "enviado_em": f.enviado_em.isoformat() if f.enviado_em else None}


def fotos_de(s: Session, obra_id: int, alvo: str, ids: list[int]) -> dict[int, list[int]]:
    """Ids das fotos de cada alvo (para as listas mostrarem quantas fotos cada item tem)."""
    out: dict[int, list[int]] = {}
    if not ids:
        return out
    for fid, aid in s.execute(select(FotoCampoModel.id, FotoCampoModel.alvo_id).where(
            FotoCampoModel.obra_id == obra_id, FotoCampoModel.alvo == alvo, FotoCampoModel.alvo_id.in_(ids))
            .order_by(FotoCampoModel.id)):
        out.setdefault(aid, []).append(fid)
    return out


@router.post("", status_code=201)
async def enviar(alvo: str = Form(...), alvo_id: int = Form(...), data: date | None = Form(None),
                 legenda: str | None = Form(None), arquivo: UploadFile = File(...),
                 s: Session = Depends(get_session), c: ContextoObra = Depends(programar)):
    alvo = validar_alvo(alvo)
    _alvo_existe(s, c.obra_id, alvo, alvo_id)
    conteudo = await arquivo.read(LIMITE + 1)
    f = FotoCampoModel(obra_id=c.obra_id, alvo=alvo, alvo_id=alvo_id, data=data,
                       legenda=" ".join((legenda or "").split())[:300] or None, content_type=tipo_da_imagem(conteudo),
                       tamanho=len(conteudo), conteudo=conteudo, enviado_por=c.usuario.id)
    s.add(f)
    s.flush()
    s.refresh(f)
    return _out(f)


@router.get("")
def listar(alvo: str, alvo_id: int, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    validar_alvo(alvo)
    return [_out(f) for f in s.scalars(select(FotoCampoModel).where(
        FotoCampoModel.obra_id == c.obra_id, FotoCampoModel.alvo == alvo, FotoCampoModel.alvo_id == alvo_id)
        .order_by(FotoCampoModel.id))]


@router.get("/book")
def book(de: date | None = None, ate: date | None = None, tipo: str | None = None, area_id: int | None = None,
         s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Book de fotos (spec 062): fotos das atividades (frente, atividade, dia de execução), das ocorrências e das
    restrições, mais novas primeiro."""
    from app.modules.campo.application.book import montar_book

    return montar_book(s, c.obra_id, de, ate, tipo, area_id)


def _foto(s: Session, c: ContextoObra, fid: int) -> FotoCampoModel:
    f = s.get(FotoCampoModel, fid)
    if f is None or f.obra_id != c.obra_id:
        raise NotFoundError("Foto", fid)
    return f


@router.get("/{fid}/arquivo")
def arquivo(fid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    f = _foto(s, c, fid)
    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[f.content_type]
    return Response(f.conteudo, media_type=f.content_type,
                    headers={"Content-Disposition": f'inline; filename="foto-{f.id}.{ext}"', "Cache-Control": "private, max-age=86400"})


@router.delete("/{fid}", status_code=204)
def excluir(fid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(programar)):
    f = _foto(s, c, fid)
    if f.enviado_por != c.usuario.id and not c.papel.pode(PapelObra.PLANEJADOR):
        raise DomainError("só quem enviou (ou o planejamento) exclui a foto")
    s.delete(f)
