"""Partes da obra (gerências) e responsáveis — Configurar › Partes e responsáveis (spec 139)."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, ler, planejar
from app.core.db import get_session
from app.modules.partes.application import partes as uc

router = APIRouter(prefix="/partes", tags=["partes da obra"])


@router.get("")
def listar(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    return uc.listar(s, c.obra_id)


class ParteIn(BaseModel):
    nome: str | None = Field(None, max_length=80)


@router.put("/{papel}")
def definir(papel: str, d: ParteIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    return uc.definir_parte(s, c.obra_id, papel, d.nome)


class ResponsavelIn(BaseModel):
    papel: str
    nome: str | None = Field(None, max_length=150)
    funcao: str | None = Field(None, max_length=120)
    colaborador_id: int | None = None


@router.post("/responsaveis", status_code=201)
def incluir(d: ResponsavelIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    return uc.incluir(s, c.obra_id, c.usuario.id, d.papel, d.nome, d.funcao, d.colaborador_id)


class EditarIn(BaseModel):
    nome: str | None = Field(None, max_length=150)
    funcao: str | None = Field(None, max_length=120)
    ativo: bool = True


@router.put("/responsaveis/{rid}")
def editar(rid: int, d: EditarIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    return uc.editar(s, c.obra_id, rid, d.nome, d.funcao, d.ativo)


@router.delete("/responsaveis/{rid}", status_code=204)
def excluir(rid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    uc.excluir(s, c.obra_id, rid)


@router.get("/padronizar")
def padronizar_previa(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Prévia: gerências antigas que viram a padronizada e responsáveis já usados que ainda não estão na lista."""
    return uc.padronizar(s, c.obra_id, aplicar=False)


@router.post("/padronizar")
def padronizar(s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    return uc.padronizar(s, c.obra_id, aplicar=True)
