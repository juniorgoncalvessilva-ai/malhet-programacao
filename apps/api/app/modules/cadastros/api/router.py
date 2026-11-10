from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.auth import UsuarioAtual, usuario_atual
from app.core.db import get_session
from app.modules.cadastros.infra.models import (
    FrenteModel,
    FuncaoModel,
    MaterialModel,
    OperGrupoModel,
    OperModel,
    TarefaModel,
)
from app.shared.errors import DomainError, NotFoundError

router = APIRouter(prefix="/cadastros", tags=["cadastros (Simova)"])


class FrenteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    codigo: str
    descricao: str
    ativo: bool


class GrupoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    codigo: str
    descricao: str
    unidade_medida: str | None
    materiais: list[str]
    ativo: bool
    codigo_duplicado: bool


class OperOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    codigo: str
    descricao: str
    grupo_codigo: str
    materiais: list[str]
    unidade_medida: str | None
    hh_prev: float | None
    ativo: bool
    tarefa_codigo: str | None
    origem: str
    pendente_envio_simova: bool


class OperIn(BaseModel):
    codigo: str
    descricao: str
    grupo_codigo: str
    unidade_medida: str | None = None
    materiais: list[str] = []
    hh_prev: float | None = None
    tarefa_codigo: str | None = None
    ativo: bool = True


class SimplesOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    codigo: str
    descricao: str


@router.get("/frentes", response_model=list[FrenteOut])
def frentes(s: Session = Depends(get_session), _: UsuarioAtual = Depends(usuario_atual)):
    return s.scalars(select(FrenteModel).order_by(FrenteModel.descricao)).all()


@router.get("/oper-grupos", response_model=list[GrupoOut])
def grupos(s: Session = Depends(get_session), _: UsuarioAtual = Depends(usuario_atual)):
    return s.scalars(select(OperGrupoModel).order_by(OperGrupoModel.id)).all()


@router.get("/opers", response_model=list[OperOut])
def opers(grupo: str | None = None, q: str | None = None, s: Session = Depends(get_session),
          _: UsuarioAtual = Depends(usuario_atual)):
    stmt = select(OperModel)
    if grupo:
        stmt = stmt.where(OperModel.grupo_codigo == grupo)
    if q:
        stmt = stmt.where(or_(OperModel.descricao.ilike(f"%{q}%"), OperModel.codigo.ilike(f"{q}%")))
    return s.scalars(stmt.order_by(OperModel.grupo_codigo, OperModel.codigo)).all()


@router.post("/opers", response_model=OperOut, status_code=201)
def criar_oper(dados: OperIn, s: Session = Depends(get_session), _: UsuarioAtual = Depends(usuario_atual)):
    """Padronização feita na aplicação: a OPER nasce pendente de envio ao Simova."""
    if not s.scalar(select(OperGrupoModel).where(OperGrupoModel.codigo == dados.grupo_codigo).limit(1)):
        raise NotFoundError("OPER_GRUPO", dados.grupo_codigo)
    if s.scalar(select(OperModel).where(OperModel.grupo_codigo == dados.grupo_codigo,
                                        OperModel.codigo == dados.codigo)):
        raise DomainError(f"OPER {dados.grupo_codigo}/{dados.codigo} já existe", "codigo")
    o = OperModel(**dados.model_dump(), origem="app", pendente_envio_simova=True)
    s.add(o)
    s.flush()
    return o


@router.put("/opers/{oper_id}", response_model=OperOut)
def atualizar_oper(oper_id: int, dados: OperIn, s: Session = Depends(get_session),
                   _: UsuarioAtual = Depends(usuario_atual)):
    o = s.get(OperModel, oper_id)
    if o is None:
        raise NotFoundError("OPER", oper_id)
    for k, v in dados.model_dump().items():
        setattr(o, k, v)
    o.pendente_envio_simova = True
    s.flush()
    return o


@router.get("/tarefas", response_model=list[SimplesOut])
def tarefas(q: str | None = None, limite: int = Query(50, le=500), s: Session = Depends(get_session),
            _: UsuarioAtual = Depends(usuario_atual)):
    stmt = select(TarefaModel)
    if q:
        stmt = stmt.where(or_(TarefaModel.codigo.ilike(f"%{q}%"), TarefaModel.descricao.ilike(f"%{q}%")))
    return s.scalars(stmt.order_by(TarefaModel.codigo).limit(limite)).all()


@router.get("/funcoes", response_model=list[SimplesOut])
def funcoes(s: Session = Depends(get_session), _: UsuarioAtual = Depends(usuario_atual)):
    return s.scalars(select(FuncaoModel).order_by(FuncaoModel.codigo)).all()


@router.get("/materiais", response_model=list[SimplesOut])
def materiais(q: str | None = None, limite: int = Query(50, le=500), s: Session = Depends(get_session),
              _: UsuarioAtual = Depends(usuario_atual)):
    stmt = select(MaterialModel)
    if q:
        stmt = stmt.where(MaterialModel.descricao.ilike(f"%{q}%"))
    return s.scalars(stmt.order_by(MaterialModel.descricao).limit(limite)).all()
