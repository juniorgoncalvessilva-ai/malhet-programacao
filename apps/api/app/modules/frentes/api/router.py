from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, administrar, ler, planejar
from app.core.db import get_session
from app.modules.frentes.domain.frentes import AreaLida, atribuir_codigos, interpretar_lista, normalizar_tag, validar_codigo
from app.modules.frentes.infra.models import AreaFrenteModel, LocalFrenteModel
from app.shared.errors import DomainError, NotFoundError

router = APIRouter(prefix="/frentes", tags=["frentes (local → área)"])


class AreaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    local_id: int
    cwa: str
    codigo: str
    descricao: str
    tag: str | None
    ordem: int
    ativo: bool


class LocalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    codigo: str
    descricao: str
    ordem: int
    ativo: bool
    areas: list[AreaOut] = []


class LocalIn(BaseModel):
    codigo: str
    descricao: str
    ordem: int | None = None
    ativo: bool = True


class AreaIn(BaseModel):
    local_id: int
    cwa: str
    descricao: str
    codigo: str | None = None  # vazio = automático (CWA ou CWA.sufixo)
    ordem: int | None = None
    ativo: bool = True


class ImportarIn(BaseModel):
    texto: str


def _local(s: Session, c: ContextoObra, local_id: int) -> LocalFrenteModel:
    loc = s.get(LocalFrenteModel, local_id)
    if loc is None or loc.obra_id != c.obra_id:
        raise NotFoundError("Local", local_id)
    return loc


def _codigos_areas(s: Session, obra_id: int, exceto: int | None = None) -> set[str]:
    q = select(AreaFrenteModel.codigo).where(AreaFrenteModel.obra_id == obra_id)
    if exceto:
        q = q.where(AreaFrenteModel.id != exceto)
    return set(s.scalars(q))


def _codigo_area(s: Session, obra_id: int, cwa: str, pedido: str | None, exceto: int | None = None) -> str:
    usados = _codigos_areas(s, obra_id, exceto)
    if pedido and pedido.strip():
        cod = validar_codigo(pedido)
        if cod in usados:
            raise DomainError(f"já existe área com o código {cod}", "codigo")
        return cod
    a = AreaLida(cwa=validar_codigo(cwa), descricao="")
    atribuir_codigos([a], usados)
    return a.codigo


def arvore(s: Session, obra_id: int) -> list[LocalOut]:
    locais = s.scalars(select(LocalFrenteModel).where(LocalFrenteModel.obra_id == obra_id)
                       .order_by(LocalFrenteModel.ordem, LocalFrenteModel.id)).all()
    areas = s.scalars(select(AreaFrenteModel).where(AreaFrenteModel.obra_id == obra_id)
                      .order_by(AreaFrenteModel.ordem, AreaFrenteModel.id)).all()
    por_local: dict[int, list[AreaOut]] = {}
    for a in areas:
        por_local.setdefault(a.local_id, []).append(AreaOut.model_validate(a))
    return [LocalOut(**LocalOut.model_validate(loc).model_dump(exclude={"areas"}), areas=por_local.get(loc.id, []))
            for loc in locais]


@router.get("", response_model=list[LocalOut])
def listar(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    return arvore(s, c.obra_id)


@router.post("/locais", response_model=LocalOut, status_code=201)
def criar_local(d: LocalIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    cod = validar_codigo(d.codigo)
    if s.scalar(select(LocalFrenteModel).where(LocalFrenteModel.obra_id == c.obra_id, LocalFrenteModel.codigo == cod)):
        raise DomainError(f"já existe local com o código {cod}", "codigo")
    ordem = d.ordem if d.ordem is not None else (s.scalar(select(func.max(LocalFrenteModel.ordem))
                                                          .where(LocalFrenteModel.obra_id == c.obra_id)) or 0) + 1
    loc = LocalFrenteModel(obra_id=c.obra_id, codigo=cod, descricao=" ".join(d.descricao.split()), ordem=ordem, ativo=d.ativo)
    s.add(loc)
    s.flush()
    return LocalOut.model_validate(loc)


@router.put("/locais/{local_id}", response_model=LocalOut)
def editar_local(local_id: int, d: LocalIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    loc = _local(s, c, local_id)
    cod = validar_codigo(d.codigo)
    outro = s.scalar(select(LocalFrenteModel).where(LocalFrenteModel.obra_id == c.obra_id,
                                                    LocalFrenteModel.codigo == cod, LocalFrenteModel.id != local_id))
    if outro:
        raise DomainError(f"já existe local com o código {cod}", "codigo")
    loc.codigo, loc.descricao, loc.ativo = cod, " ".join(d.descricao.split()), d.ativo
    if d.ordem is not None:
        loc.ordem = d.ordem
    s.flush()
    return next(x for x in arvore(s, c.obra_id) if x.id == loc.id)


@router.post("/areas", response_model=AreaOut, status_code=201)
def criar_area(d: AreaIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    _local(s, c, d.local_id)
    ordem = d.ordem if d.ordem is not None else (s.scalar(select(func.max(AreaFrenteModel.ordem))
                                                          .where(AreaFrenteModel.local_id == d.local_id)) or 0) + 1
    a = AreaFrenteModel(obra_id=c.obra_id, local_id=d.local_id, cwa=validar_codigo(d.cwa),
                        codigo=_codigo_area(s, c.obra_id, d.cwa, d.codigo), descricao=" ".join(d.descricao.split()),
                        tag=normalizar_tag(d.descricao), ordem=ordem, ativo=d.ativo)
    s.add(a)
    s.flush()
    return a


@router.put("/areas/{area_id}", response_model=AreaOut)
def editar_area(area_id: int, d: AreaIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    a = s.get(AreaFrenteModel, area_id)
    if a is None or a.obra_id != c.obra_id:
        raise NotFoundError("Área", area_id)
    _local(s, c, d.local_id)
    a.local_id, a.cwa = d.local_id, validar_codigo(d.cwa)
    a.codigo = _codigo_area(s, c.obra_id, d.cwa, d.codigo or a.codigo, exceto=area_id)
    a.descricao, a.tag, a.ativo = " ".join(d.descricao.split()), normalizar_tag(d.descricao), d.ativo
    if d.ordem is not None:
        a.ordem = d.ordem
    s.flush()
    return a


@router.delete("/areas/{area_id}", status_code=204)
def excluir_area(area_id: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    from app.modules.planejamento.infra.models import LinhaProgramacaoModel

    a = s.get(AreaFrenteModel, area_id)
    if a is None or a.obra_id != c.obra_id:
        raise NotFoundError("Área", area_id)
    if s.scalar(select(func.count()).select_from(LinhaProgramacaoModel).where(LinhaProgramacaoModel.area_id == area_id)):
        raise DomainError("área usada em programação: desative em vez de excluir")
    s.delete(a)


@router.delete("/locais/{local_id}", status_code=204)
def excluir_local(local_id: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    loc = _local(s, c, local_id)
    if s.scalar(select(func.count()).select_from(AreaFrenteModel).where(AreaFrenteModel.local_id == local_id)):
        raise DomainError("o local tem áreas: mova ou exclua as áreas antes")
    s.delete(loc)


@router.post("/importar", response_model=list[LocalOut])
def importar(d: ImportarIn, s: Session = Depends(get_session), c: ContextoObra = Depends(administrar)):
    """Cola a lista CODIGO⇥DESCRICAO. Locais casam pelo código; áreas pelo CWA + descrição (as novas ganham código)."""
    lidos = interpretar_lista(d.texto)
    locais = {x.codigo: x for x in s.scalars(select(LocalFrenteModel).where(LocalFrenteModel.obra_id == c.obra_id))}
    areas = list(s.scalars(select(AreaFrenteModel).where(AreaFrenteModel.obra_id == c.obra_id)))
    existentes = {(a.cwa, a.descricao.lower()): a for a in areas}
    usados = {a.codigo for a in areas}
    novas: list[tuple[LocalFrenteModel, AreaLida, int]] = []
    for i, ll in enumerate(lidos, start=1):
        loc = locais.get(ll.codigo)
        if loc is None:
            loc = LocalFrenteModel(obra_id=c.obra_id, codigo=validar_codigo(ll.codigo), descricao=ll.descricao, ordem=i)
            s.add(loc)
            s.flush()
            locais[loc.codigo] = loc
        else:
            loc.descricao, loc.ordem = ll.descricao, i
        for j, al in enumerate(ll.areas, start=1):
            a = existentes.get((al.cwa, al.descricao.lower()))
            if a:
                a.local_id, a.ordem, a.tag = loc.id, j, al.tag
            else:
                novas.append((loc, al, j))
    atribuir_codigos([al for _, al, _ in novas], usados)  # CWA repetido (inclusive com os existentes) ganha sufixo
    for loc, al, j in novas:
        s.add(AreaFrenteModel(obra_id=c.obra_id, local_id=loc.id, cwa=al.cwa, codigo=al.codigo, descricao=al.descricao,
                              tag=al.tag, ordem=j, ativo=True))
    s.flush()
    return arvore(s, c.obra_id)
