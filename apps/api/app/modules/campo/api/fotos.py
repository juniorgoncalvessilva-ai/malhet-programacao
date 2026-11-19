"""Fotos de campo: enviar (celular), listar, ver e excluir."""
from datetime import date

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, ler, programar
from app.core.db import get_session
from app.modules.campo.application.arquivos import conteudo as conteudo_da_foto
from app.modules.campo.application.arquivos import nova_foto
from app.modules.campo.domain.foto import LIMITE, validar_alvo
from app.modules.campo.infra.models import FotoCampoModel
from app.modules.obras.domain.obra import PapelObra
from app.shared.errors import DomainError, NotFoundError

router = APIRouter(prefix="/fotos", tags=["fotos de campo"])


def _alvo_existe(s: Session, obra_id: int, alvo: str, alvo_id: int) -> None:
    if alvo == "desvio":
        from app.modules.indicadores.infra.models import DesvioModel as M
    elif alvo == "restricao":
        from app.modules.restricoes.infra.models import AcaoRestricaoModel as M
    elif alvo == "auditoria":
        from app.modules.auditorias.infra.models import RegistroAuditoriaModel as M
    elif alvo == "acao":
        from app.modules.acoes.infra.models import AcaoModel as M
    elif alvo == "evento":
        from app.modules.preventivos.infra.models import EventoPreventivoModel as M
    elif alvo == "registro":  # atividade fora da programação (spec 119)
        from app.modules.campo.infra.models import RegistroAtividadeModel as M
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
def enviar(alvo: str = Form(...), alvo_id: int = Form(...), data: date | None = Form(None),
                 legenda: str | None = Form(None), arquivo: UploadFile = File(...),
                 s: Session = Depends(get_session), c: ContextoObra = Depends(programar)):
    alvo = validar_alvo(alvo)
    _alvo_existe(s, c.obra_id, alvo, alvo_id)
    conteudo = arquivo.file.read(LIMITE + 1)
    f = nova_foto(s, c.obra_id, alvo, alvo_id, data, " ".join((legenda or "").split())[:300] or None, conteudo, c.usuario.id)
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


_ROTULO = {"linha": "atividade", "registro": "atividade", "desvio": "ocorrencia", "restricao": "restricao",
           "auditoria": "auditoria", "acao": "acao-5w2h", "evento": "preventivo"}


def _area_da_foto(s: Session, f: FotoCampoModel) -> int | None:
    """Frente de onde a foto é, para o nome do arquivo baixado (spec 119)."""
    from app.modules.planejamento.infra.models import LinhaProgramacaoModel

    if f.alvo == "linha":
        ln = s.get(LinhaProgramacaoModel, f.alvo_id)
        return ln.area_id if ln else None
    modelos = {"registro": ("app.modules.campo.infra.models", "RegistroAtividadeModel"),
               "desvio": ("app.modules.indicadores.infra.models", "DesvioModel"),
               "restricao": ("app.modules.restricoes.infra.models", "AcaoRestricaoModel"),
               "auditoria": ("app.modules.auditorias.infra.models", "RegistroAuditoriaModel"),
               "acao": ("app.modules.acoes.infra.models", "AcaoModel")}
    if f.alvo not in modelos:
        return None
    import importlib

    mod, nome = modelos[f.alvo]
    x = s.get(getattr(importlib.import_module(mod), nome), f.alvo_id)
    aid = getattr(x, "area_id", None) if x else None
    if aid is None and f.alvo == "desvio" and x is not None and x.linha_id:
        ln = s.get(LinhaProgramacaoModel, x.linha_id)
        aid = ln.area_id if ln else None
    return aid


def nome_para_baixar(s: Session, f: FotoCampoModel, ext: str) -> str:
    """AAAAMMDD-HHMM-<frente>-<tipo>-<id>.jpg — quem baixa vê quando e onde sem abrir a foto."""
    import re
    import unicodedata
    from zoneinfo import ZoneInfo

    from app.modules.frentes.infra.models import AreaFrenteModel

    quando = f.enviado_em.astimezone(ZoneInfo("America/Sao_Paulo")) if f.enviado_em else None
    dia = f.data.strftime("%Y%m%d") if f.data else (quando.strftime("%Y%m%d") if quando else "")
    hora = quando.strftime("%H%M") if quando else ""
    aid = _area_da_foto(s, f)
    a = s.get(AreaFrenteModel, aid) if aid else None
    partes = [dia + (f"-{hora}" if hora else ""), a.codigo if a else "", _ROTULO.get(f.alvo, f.alvo), str(f.id)]
    nome = "-".join(x for x in partes if x)
    nome = unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode()
    return re.sub(r"[^A-Za-z0-9._-]+", "-", nome).strip("-") + f".{ext}"


@router.get("/{fid}/arquivo")
def arquivo(fid: int, mini: bool = False, baixar: bool = False, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """`?mini=true`: miniatura de até 480 px (≈30 KB) para listas e o book — o original só ao abrir a foto (spec 082).
    `?baixar=true`: o original como anexo, com nome de data, frente e tipo (spec 119)."""
    f = _foto(s, c, fid)
    mini = mini and not baixar
    dados = conteudo_da_foto(s, f, mini=mini)
    tipo = "image/jpeg" if mini else f.content_type
    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[tipo]
    if baixar:
        return Response(dados, media_type=tipo, headers={"Content-Disposition": f'attachment; filename="{nome_para_baixar(s, f, ext)}"',
                                                         "Cache-Control": "private, max-age=86400"})
    return Response(dados, media_type=tipo, headers={"Content-Disposition": f'inline; filename="foto-{f.id}{"-mini" if mini else ""}.{ext}"',
                                                     "Cache-Control": "private, max-age=86400"})


@router.delete("/{fid}", status_code=204)
def excluir(fid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(programar)):
    f = _foto(s, c, fid)
    if f.enviado_por != c.usuario.id and not c.papel.pode(PapelObra.PLANEJADOR):
        raise DomainError("só quem enviou (ou o planejamento) exclui a foto")
    # spec 112: toda exclusão de foto vai para o histórico de exclusões
    from app.modules.exclusoes.application.servico import _foto_dados, registrar
    from app.modules.exclusoes.domain.exclusao import resumo_foto

    registrar(s, c.obra_id, "foto", str(f.id), resumo_foto(f.alvo, f.legenda, f.data.strftime("%d/%m/%Y") if f.data else None),
              _foto_dados(f), "excluída por quem enviou / Planejamento", c.usuario.id, c.usuario.email)
    s.delete(f)
