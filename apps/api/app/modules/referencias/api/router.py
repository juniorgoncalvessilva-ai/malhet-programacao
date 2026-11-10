from datetime import date, datetime

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from pydantic import BaseModel, ConfigDict, model_validator
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, administrar, ler, planejar
from app.core.db import get_session
from app.modules.referencias.application import versoes as uc
from app.modules.referencias.infra.models import (
    AtividadeCronogramaModel,
    CpuRecursoModel,
    IndiceEspecificoModel,
    ItemPqModel,
    VersaoReferenciaModel,
    VinculoReferenciaModel,
)
from app.modules.referencias.infra.resolvedor import ResolvedorReferencias
from app.shared.errors import DomainError, NotFoundError

router = APIRouter(prefix="/referencias", tags=["referências (cronograma × PQ × CPU × Simova)"])


class VersaoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    tipo: str
    rotulo: str
    data_base: date | None
    arquivo_origem: str | None
    vigente: bool
    qtd_itens: int
    carregado_por: str
    carregado_em: datetime


class AtividadeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_crono: str
    atividade: str
    area: str | None
    status: str | None
    inicio: datetime | None
    fim: datetime | None
    unid: str | None
    qtd_takeoff: float | None
    item_pq: str | None
    composicao: str | None


class PqOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    item: str
    descricao: str
    unid: str | None
    quantidade: float | None
    pu: float | None
    composicao: str | None
    recurso_governa: str | None
    coef_governa: float | None


class CpuOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    composicao: str
    recurso: str
    tipo: str
    unid_recurso: str | None
    coef_por_unidade: float


class IndiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    codigo: str
    funcao_governa: str
    unid: str | None
    indice_un_dia: float
    ajudante: str | None
    ajudantes_por_oficial: float | None
    fonte: str | None


class VinculoIn(BaseModel):
    id_crono: str | None = None
    item_pq: str | None = None
    composicao: str | None = None
    indice_codigo: str | None = None
    simova_grupo_codigo: str
    simova_oper_codigo: str
    simova_tarefa_codigo: str | None = None
    frente_codigo: str | None = None
    ativo: bool = True

    @model_validator(mode="after")
    def _ao_menos_um(self):
        if not (self.id_crono or self.item_pq):
            raise ValueError("informe a atividade do cronograma (id_crono) ou o item da PQ")
        return self


class VinculoOut(VinculoIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    atualizado_por: str
    atualizado_em: datetime


class VinculoResolvidoOut(BaseModel):
    vinculo_id: int
    id_crono: str | None
    atividade: str | None
    item_pq: str | None
    descricao_pq: str | None
    composicao: str | None
    unid: str | None
    qtd: float | None
    recurso_governa: str | None
    indice_orcado_un_dia: float | None
    indice_especifico: str | None
    hh_por_unidade: float | None
    pendencias: list[str]


def _vigente(s: Session, obra_id: int, tipo: str) -> int:
    vid = ResolvedorReferencias(s, obra_id).versoes_vigentes().get(tipo)
    if vid is None:
        raise DomainError(f"não há versão vigente de {tipo}")
    return vid


# ---- versões -----------------------------------------------------------------------------
@router.get("/versoes", response_model=list[VersaoOut])
def listar_versoes(tipo: str | None = None, s: Session = Depends(get_session),
                   c: ContextoObra = Depends(ler)):
    q = select(VersaoReferenciaModel).where(VersaoReferenciaModel.obra_id == c.obra_id)
    if tipo:
        q = q.where(VersaoReferenciaModel.tipo == tipo)
    return s.scalars(q.order_by(VersaoReferenciaModel.tipo, VersaoReferenciaModel.id.desc())).all()


@router.post("/versoes/carregar")
def carregar(arquivo: UploadFile = File(...), rotulo: str = Form(...), tipos: str = Form("CRONOGRAMA,PQ,CPU,INDICES"),
             data_base: date | None = Form(None), ativar: bool = Form(True), s: Session = Depends(get_session),
             c: ContextoObra = Depends(administrar)):
    """Carrega a planilha auxiliar (abas ATIVIDADES, PQ, RECURSOS, ÍNDICES) como novas versões."""
    res = uc.carregar_planilha_auxiliar(
        s, c.obra_id, arquivo.file, nome_arquivo=arquivo.filename or "", rotulo=rotulo, usuario=c.usuario.id,
        tipos=[t.strip().upper() for t in tipos.split(",") if t.strip()], data_base=data_base, ativar=ativar)
    return {"versoes": res.versoes, "contagem": res.contagem, "avisos": res.avisos}


@router.post("/versoes/{versao_id}/ativar", response_model=VersaoOut)
def ativar(versao_id: int, s: Session = Depends(get_session), c: ContextoObra = Depends(administrar)):
    return uc.ativar_versao(s, versao_id, c.obra_id)


@router.get("/vigentes")
def vigentes(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    ids = ResolvedorReferencias(s, c.obra_id).versoes_vigentes()
    vs = s.scalars(select(VersaoReferenciaModel).where(VersaoReferenciaModel.id.in_(ids.values()))).all()
    return {v.tipo: VersaoOut.model_validate(v) for v in vs}


# ---- itens das versões vigentes ----------------------------------------------------------
@router.get("/atividades", response_model=list[AtividadeOut])
def atividades(q: str | None = None, area: str | None = None, limite: int = Query(100, le=1000),
               s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    stmt = select(AtividadeCronogramaModel).where(AtividadeCronogramaModel.versao_id == _vigente(s, c.obra_id, "CRONOGRAMA"))
    if q:
        stmt = stmt.where(or_(AtividadeCronogramaModel.id_crono.ilike(f"%{q}%"),
                              AtividadeCronogramaModel.atividade.ilike(f"%{q}%")))
    if area:
        stmt = stmt.where(AtividadeCronogramaModel.area == area)
    return s.scalars(stmt.order_by(AtividadeCronogramaModel.inicio).limit(limite)).all()


@router.get("/areas", response_model=list[str])
def areas(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    q = (select(AtividadeCronogramaModel.area).where(AtividadeCronogramaModel.versao_id == _vigente(s, c.obra_id, "CRONOGRAMA"))
         .distinct().order_by(AtividadeCronogramaModel.area))
    return [a for a in s.scalars(q) if a]


@router.get("/pq", response_model=list[PqOut])
def pq(q: str | None = None, limite: int = Query(100, le=1000), s: Session = Depends(get_session),
       c: ContextoObra = Depends(ler)):
    stmt = select(ItemPqModel).where(ItemPqModel.versao_id == _vigente(s, c.obra_id, "PQ"), ItemPqModel.folha.is_(True))
    if q:
        stmt = stmt.where(or_(ItemPqModel.item.ilike(f"{q}%"), ItemPqModel.descricao.ilike(f"%{q}%")))
    return s.scalars(stmt.order_by(ItemPqModel.id).limit(limite)).all()


@router.get("/cpu/{composicao}", response_model=list[CpuOut])
def cpu(composicao: str, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    return s.scalars(select(CpuRecursoModel).where(CpuRecursoModel.versao_id == _vigente(s, c.obra_id, "CPU"),
                                                   CpuRecursoModel.composicao == composicao)).all()


@router.get("/indices", response_model=list[IndiceOut])
def indices(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    return s.scalars(select(IndiceEspecificoModel).where(
        IndiceEspecificoModel.versao_id == _vigente(s, c.obra_id, "INDICES"))).all()


# ---- vínculos ----------------------------------------------------------------------------
@router.get("/vinculos", response_model=list[VinculoOut])
def listar_vinculos(grupo: str | None = None, oper: str | None = None, id_crono: str | None = None,
                    s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    q = select(VinculoReferenciaModel).where(VinculoReferenciaModel.obra_id == c.obra_id)
    if grupo:
        q = q.where(VinculoReferenciaModel.simova_grupo_codigo == grupo)
    if oper:
        q = q.where(VinculoReferenciaModel.simova_oper_codigo == oper)
    if id_crono:
        q = q.where(VinculoReferenciaModel.id_crono == id_crono)
    return s.scalars(q.order_by(VinculoReferenciaModel.id)).all()


@router.post("/vinculos", response_model=VinculoOut, status_code=201)
def criar_vinculo(dados: VinculoIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    v = VinculoReferenciaModel(**dados.model_dump(), obra_id=c.obra_id, atualizado_por=c.usuario.id)
    s.add(v)
    s.flush()
    return v


@router.put("/vinculos/{vinculo_id}", response_model=VinculoOut)
def atualizar_vinculo(vinculo_id: int, dados: VinculoIn, s: Session = Depends(get_session),
                      c: ContextoObra = Depends(planejar)):
    v = s.get(VinculoReferenciaModel, vinculo_id)
    if v is None or v.obra_id != c.obra_id:
        raise NotFoundError("Vínculo", vinculo_id)
    for k, val in dados.model_dump().items():
        setattr(v, k, val)
    v.atualizado_por = c.usuario.id
    s.flush()
    return v


@router.delete("/vinculos/{vinculo_id}", status_code=204)
def excluir_vinculo(vinculo_id: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    v = s.get(VinculoReferenciaModel, vinculo_id)
    if v is None or v.obra_id != c.obra_id:
        raise NotFoundError("Vínculo", vinculo_id)
    s.delete(v)


@router.get("/vinculos/{vinculo_id}/resolver", response_model=VinculoResolvidoOut)
def resolver(vinculo_id: int, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    v = s.get(VinculoReferenciaModel, vinculo_id)
    if v is None or v.obra_id != c.obra_id:
        raise NotFoundError("Vínculo", vinculo_id)
    r = ResolvedorReferencias(s, c.obra_id).resolver(v)
    return VinculoResolvidoOut(**{**r.__dict__, "pendencias": list(r.pendencias)})
