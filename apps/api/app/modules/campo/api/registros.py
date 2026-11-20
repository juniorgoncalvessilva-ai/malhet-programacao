"""Spec 119 — registrar no campo uma atividade que não está na programação: frente (CWA) → IWP da WBS (com CWP e grupo)
ou item da PQ → o que foi feito; as fotos vão por `POST /fotos` com alvo = registro."""
from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, ler, programar
from app.core.db import get_session
from app.modules.campo.application import registros as rg
from app.modules.campo.infra.models import FotoCampoModel, RegistroAtividadeModel
from app.modules.frentes.infra.models import AreaFrenteModel
from app.modules.obras.domain.obra import PapelObra
from app.shared.errors import DomainError, NotFoundError
from app.shared.tempo import hoje_local

router = APIRouter(prefix="/campo/registros", tags=["campo (mobile)"])


@router.get("/opcoes")
def opcoes(area_id: int, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """O que dá para escolher na frente: os IWPs da WBS (com CWP, grupo e o texto do item da PQ). Sem WBS: lista vazia —
    a tela oferece a busca na PQ."""
    return {"itens": rg.opcoes(s, c.obra_id, area_id)}


class RegistroIn(BaseModel):
    data: date | None = None
    area_id: int
    wbs_no_id: int | None = None
    item_pq: str | None = Field(None, max_length=40)
    descricao: str = Field(max_length=500)


@router.post("", status_code=201)
def registrar(d: RegistroIn, s: Session = Depends(get_session), c: ContextoObra = Depends(programar)):
    r = rg.registrar(s, c.obra_id, d.area_id, d.wbs_no_id, d.item_pq, d.descricao, d.data, c.usuario.email or c.usuario.id)
    return rg.como_dict(r, s.get(AreaFrenteModel, r.area_id), [])


@router.get("")
def listar(data: date | None = None, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Registros do dia (padrão: hoje), mais novos primeiro, com as fotos."""
    return rg.do_dia(s, c.obra_id, data or hoje_local())


@router.delete("/{rid}", status_code=204)
def excluir(rid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(programar)):
    """Só sem fotos (a foto do book tem o seu caminho de exclusão, com motivo — spec 112) e por quem registrou ou o
    Planejamento."""
    r = s.get(RegistroAtividadeModel, rid)
    if r is None or r.obra_id != c.obra_id:
        raise NotFoundError("Registro", rid)
    if r.criado_por != (c.usuario.email or c.usuario.id) and not c.papel.pode(PapelObra.PLANEJADOR):
        raise DomainError("só quem registrou (ou o Planejamento) exclui o registro")
    if s.scalar(select(FotoCampoModel.id).where(FotoCampoModel.obra_id == c.obra_id, FotoCampoModel.alvo == "registro",
                                                FotoCampoModel.alvo_id == rid)):
        raise DomainError("o registro tem fotos: exclua as fotos antes")
    s.delete(r)
