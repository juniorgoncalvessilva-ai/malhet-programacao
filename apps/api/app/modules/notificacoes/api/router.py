"""Central de notificações (spec 076): as minhas na obra (pelo meu papel ou endereçadas a mim), contagem e marcar lidas."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, ler
from app.core.db import get_session
from app.modules.notificacoes.infra.models import LeituraNotificacaoModel, NotificacaoModel
from app.shared.errors import NotFoundError

router = APIRouter(prefix="/notificacoes", tags=["notificações"])
JANELA = timedelta(days=45)


def _minhas(c: ContextoObra):
    q = select(NotificacaoModel).where(NotificacaoModel.obra_id == c.obra_id,
                                       NotificacaoModel.criada_em >= datetime.now(timezone.utc) - JANELA)
    q = q.where(or_(NotificacaoModel.autor_id.is_(None), NotificacaoModel.autor_id != c.usuario.id))
    if not c.usuario.superadmin:  # o super admin vê todas da obra (para testar tudo — spec 077)
        q = q.where(or_(NotificacaoModel.papeis.contains([c.papel.value]), NotificacaoModel.usuarios.contains([c.usuario.id])))
    return q


def _lidas(s: Session, c: ContextoObra, ids: list[int]) -> dict[int, datetime]:
    if not ids:
        return {}
    return {nid: em for nid, em in s.execute(select(LeituraNotificacaoModel.notificacao_id, LeituraNotificacaoModel.lida_em).where(
        LeituraNotificacaoModel.usuario_id == c.usuario.id, LeituraNotificacaoModel.notificacao_id.in_(ids)))}


@router.get("")
def minhas(so_nao_lidas: bool = False, limite: int = 60, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    ns = list(s.scalars(_minhas(c).order_by(NotificacaoModel.criada_em.desc()).limit(max(1, min(limite, 200)))))
    lidas = _lidas(s, c, [n.id for n in ns])
    out = [{"id": n.id, "tipo": n.tipo, "gravidade": n.gravidade, "titulo": n.titulo, "texto": n.texto, "url": n.url,
            "url_mobile": n.url_mobile, "criada_em": n.criada_em.isoformat(),
            "lida_em": lidas[n.id].isoformat() if n.id in lidas else None} for n in ns]
    return [x for x in out if not x["lida_em"]] if so_nao_lidas else out


@router.get("/contagem")
def contagem(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    sub = _minhas(c).with_only_columns(NotificacaoModel.id).subquery()
    total = s.scalar(select(func.count()).select_from(sub)) or 0
    lidas = s.scalar(select(func.count()).select_from(LeituraNotificacaoModel).where(
        LeituraNotificacaoModel.usuario_id == c.usuario.id, LeituraNotificacaoModel.notificacao_id.in_(select(sub.c.id)))) or 0
    ultima = s.scalar(select(func.max(sub.c.id))) if total else None
    return {"nao_lidas": total - lidas, "ultima_id": ultima}


def _marcar(s: Session, c: ContextoObra, ids: list[int]) -> None:
    if ids:
        s.execute(insert(LeituraNotificacaoModel).values([{"obra_id": c.obra_id, "notificacao_id": i, "usuario_id": c.usuario.id} for i in ids])
                  .on_conflict_do_nothing(constraint="uq_notificacao_lida"))


@router.post("/{nid}/lida")
def lida(nid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    if s.scalar(_minhas(c).where(NotificacaoModel.id == nid).with_only_columns(NotificacaoModel.id)) is None:
        raise NotFoundError("Notificação", nid)
    _marcar(s, c, [nid])
    return contagem(s, c)


@router.post("/lidas")
def todas_lidas(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    _marcar(s, c, list(s.scalars(_minhas(c).with_only_columns(NotificacaoModel.id))))
    return contagem(s, c)
