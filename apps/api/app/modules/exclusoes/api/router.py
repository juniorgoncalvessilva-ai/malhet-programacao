"""Spec 112 — exclusão de auditorias e fotos do book pelo super admin ou por quem ele habilitou, com histórico."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, ler
from app.core.db import get_session
from app.modules.exclusoes.application import servico as sv
from app.modules.obras.domain.obra import PapelObra
from app.shared.errors import DomainError

router = APIRouter(prefix="/exclusoes", tags=["Exclusões (auditorias e book)"])


class MotivoIn(BaseModel):
    motivo: str = Field(max_length=500)


@router.get("/eu")
def eu(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """O que a tela mostra: a lixeira das auditorias e do book só para quem pode excluir."""
    hab = sv.habilitado(s, c.obra_id, c.usuario.id)
    return {"pode_excluir": c.usuario.superadmin or hab, "superadmin": c.usuario.superadmin, "habilitado": hab}


@router.post("/auditorias/{rid}")
def excluir_auditoria(rid: int, d: MotivoIn, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    return sv.excluir_auditoria(s, c.obra_id, rid, d.motivo, c.usuario.id, c.usuario.email, c.usuario.superadmin)


@router.post("/fotos/{fid}")
def excluir_foto(fid: int, d: MotivoIn, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    sv.excluir_foto(s, c.obra_id, fid, d.motivo, c.usuario.id, c.usuario.email, c.usuario.superadmin)
    return {"ok": True}


@router.get("/permissoes")
def permissoes(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    if not c.usuario.superadmin:
        raise DomainError("só o super admin vê e muda quem pode excluir")
    return sv.permissoes(s, c.obra_id)


class PermissaoIn(BaseModel):
    habilitado: bool


@router.put("/permissoes/{usuario_id}")
def definir(usuario_id: str, d: PermissaoIn, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    sv.definir_permissao(s, c.obra_id, usuario_id, d.habilitado, c.usuario.id, c.usuario.email, c.usuario.superadmin)
    return {"ok": True}


@router.get("/historico")
def historico(tipo: str | None = None, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Todo o processo: o que saiu (com a cópia), quem, quando e por quê; e quem habilitou quem."""
    if not (c.usuario.superadmin or c.papel.pode(PapelObra.ADMIN) or sv.habilitado(s, c.obra_id, c.usuario.id)):
        raise DomainError("o histórico de exclusões é do super admin, do administrador da obra e de quem pode excluir")
    return sv.historico(s, c.obra_id, tipo)
