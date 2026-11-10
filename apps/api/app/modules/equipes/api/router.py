from fastapi import APIRouter, Depends, File, UploadFile
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, administrar, ler, planejar
from app.core.db import get_session
from app.modules.equipes.application.importar_equipes import importar_equipes
from app.modules.equipes.infra.models import EquipeComposicaoModel, EquipeModel
from app.shared.errors import NotFoundError

router = APIRouter(prefix="/equipes", tags=["equipes"])


class ComposicaoIO(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    recurso: str
    tipo: str = "MOD"
    quantidade: float


class EquipeIn(BaseModel):
    nome: str
    frente_codigo: str | None = None
    encarregado_cracha: str | None = None
    encarregado_nome: str | None = None
    jornada_horas: float = 9.0
    observacao: str | None = None
    ativo: bool = True
    composicao: list[ComposicaoIO] = []


class EquipeOut(EquipeIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    hh_disponivel_dia: float = 0


def _out(e: EquipeModel) -> EquipeOut:
    o = EquipeOut.model_validate(e)
    o.hh_disponivel_dia = round(sum(c.quantidade for c in e.composicao if c.tipo == "MOD") * e.jornada_horas, 2)
    return o


@router.get("", response_model=list[EquipeOut])
def listar(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    return [_out(e) for e in s.scalars(select(EquipeModel).where(EquipeModel.obra_id == c.obra_id).order_by(EquipeModel.nome))]


@router.post("", response_model=EquipeOut, status_code=201)
def criar(d: EquipeIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    e = EquipeModel(**d.model_dump(exclude={"composicao"}), obra_id=c.obra_id,
                    composicao=[EquipeComposicaoModel(**c.model_dump()) for c in d.composicao])
    s.add(e)
    s.flush()
    return _out(e)


@router.put("/{equipe_id}", response_model=EquipeOut)
def atualizar(equipe_id: int, d: EquipeIn, s: Session = Depends(get_session),
              c: ContextoObra = Depends(planejar)):
    e = s.get(EquipeModel, equipe_id)
    if e is None or e.obra_id != c.obra_id:
        raise NotFoundError("Equipe", equipe_id)
    for k, v in d.model_dump(exclude={"composicao"}).items():
        setattr(e, k, v)
    e.composicao = [EquipeComposicaoModel(**c.model_dump()) for c in d.composicao]
    s.flush()
    return _out(e)


@router.delete("/{equipe_id}", status_code=204)
def excluir(equipe_id: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    e = s.get(EquipeModel, equipe_id)
    if e is None or e.obra_id != c.obra_id:
        raise NotFoundError("Equipe", equipe_id)
    s.delete(e)


@router.post("/importar")
def importar(arquivo: UploadFile = File(...), s: Session = Depends(get_session),
             c: ContextoObra = Depends(administrar)):
    """Importa a aba EQUIPES da planilha auxiliar."""
    return {"equipes": importar_equipes(s, c.obra_id, arquivo.file)}
