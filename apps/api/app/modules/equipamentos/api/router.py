"""Equipamentos da obra (spec 147): cadastro pela planilha, operador do efetivo, mobilização/desmobilização e o dia."""
from datetime import date

from fastapi import APIRouter, Depends, File, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, ler, planejar, programar
from app.core.db import get_session
from app.modules.equipamentos.application import equipamentos as uc
from app.shared.tempo import hoje_local

router = APIRouter(prefix="/equipamentos", tags=["equipamentos"])


def _por(c: ContextoObra) -> str:
    return (c.usuario.email or c.usuario.id)[:150]


@router.get("")
def listar(data: date | None = None, situacao: str | None = None, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    return uc.listar(s, c.obra_id, data, situacao)


@router.get("/por-operador")
def por_operador(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Equipamentos de cada pessoa do efetivo (a tela do efetivo mostra ao lado do operador)."""
    return {str(k): v for k, v in uc.por_operador(s, c.obra_id).items()}


@router.post("/planilha/previa")
def previa(arquivo: UploadFile = File(...), s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    return uc.previa(s, c.obra_id, arquivo.file.read())


@router.post("/planilha")
def importar(arquivo: UploadFile = File(...), s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    return uc.importar(s, c.obra_id, arquivo.file.read(), _por(c))


class EquipamentoIn(BaseModel):
    nome: str = Field(max_length=120)
    tipo: str | None = Field(None, max_length=40)
    placa: str | None = Field(None, max_length=20)
    tag: str | None = Field(None, max_length=40)
    chassi: str | None = Field(None, max_length=40)
    observacao: str | None = Field(None, max_length=300)
    operador_id: int | None = None


@router.post("", status_code=201)
def criar(d: EquipamentoIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    return uc.criar(s, c.obra_id, d.model_dump(), _por(c))


class EditarIn(BaseModel):
    nome: str | None = Field(None, max_length=120)
    tipo: str | None = Field(None, max_length=40)
    placa: str | None = Field(None, max_length=20)
    tag: str | None = Field(None, max_length=40)
    chassi: str | None = Field(None, max_length=40)
    observacao: str | None = Field(None, max_length=300)


@router.put("/{eid}")
def editar(eid: int, d: EditarIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    return uc.editar(s, c.obra_id, eid, d.model_dump())


@router.delete("/{eid}", status_code=204)
def excluir(eid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    uc.excluir(s, c.obra_id, eid)


class MovimentoIn(BaseModel):
    data: date | None = None
    texto: str | None = Field(None, max_length=300)


@router.post("/{eid}/mobilizar")
def mobilizar(eid: int, d: MovimentoIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    return uc.mobilizar(s, c.obra_id, eid, d.data or hoje_local(), d.texto, _por(c))


@router.post("/{eid}/desmobilizar")
def desmobilizar(eid: int, d: MovimentoIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    return uc.desmobilizar(s, c.obra_id, eid, d.data or hoje_local(), d.texto, _por(c))


class OperadorIn(BaseModel):
    colaborador_id: int | None = None


@router.put("/{eid}/operador")
def operador(eid: int, d: OperadorIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    return uc.definir_operador(s, c.obra_id, eid, d.colaborador_id, _por(c))


@router.get("/{eid}/movimentos")
def movimentos(eid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    return uc.movimentos(s, c.obra_id, eid)


class ApontamentoIn(BaseModel):
    data: date | None = None
    situacao: str = Field(max_length=12)
    horas: float | None = None
    equipe_id: int | None = None
    observacao: str | None = Field(None, max_length=300)


@router.put("/{eid}/dia")
def apontar(eid: int, d: ApontamentoIn, s: Session = Depends(get_session), c: ContextoObra = Depends(programar)):
    return uc.apontar(s, c.obra_id, eid, d.data or hoje_local(), d.situacao, d.horas, d.equipe_id, d.observacao, _por(c))
