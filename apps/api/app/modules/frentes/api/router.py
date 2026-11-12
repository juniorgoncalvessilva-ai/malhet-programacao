from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, administrar, ler, planejar
from app.core.db import get_session
from app.modules.frentes.domain.frentes import (
    AreaLida,
    atribuir_codigos,
    codigo_de_local,
    eh_formato_cwa,
    interpretar_lista,
    normalizar_tag,
    validar_codigo,
)
from app.modules.frentes.infra.models import AreaFrenteModel, LocalFrenteModel
from app.shared.errors import DomainError, NotFoundError

from app.modules.wbs.application.p6 import area_tem_wbs, garantir_areas, tirar_area  # noqa: E402

router = APIRouter(prefix="/frentes", tags=["frentes (local → área)"])


class AreaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    local_id: int
    cwa: str
    codigo: str
    descricao: str
    ativo_codigo: str | None = None
    tag: str | None
    no_takeoff: bool = False  # a TAG do Ativo tem quantidade no take-off da PQ vigente
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
    codigo: str = ""  # vazio = automático (L1, L2…)
    descricao: str
    ordem: int | None = None
    ativo: bool = True


class AreaIn(BaseModel):
    local_id: int
    cwa: str
    descricao: str
    codigo: str | None = None  # ignorado: o código é o CWA (CWA repetido ganha sufixo só na exportação do Simova)
    ativo_codigo: str | None = None  # Ativo (ED-1800AA-04); a TAG do take-off sai dele ou da descrição
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


def _ativo(v: str | None) -> str | None:
    t = (v or "").upper().replace(" ", "")
    return None if t in ("", "-", "–", "—", "N/A", "NA") else t[:40]


def _codigos_usados(s: Session, obra_id: int) -> set[str]:
    return set(s.scalars(select(LocalFrenteModel.codigo).where(LocalFrenteModel.obra_id == obra_id))) | \
        _codigos_areas(s, obra_id)


def arvore(s: Session, obra_id: int) -> list[LocalOut]:
    locais = s.scalars(select(LocalFrenteModel).where(LocalFrenteModel.obra_id == obra_id)
                       .order_by(LocalFrenteModel.ordem, LocalFrenteModel.id)).all()
    areas = s.scalars(select(AreaFrenteModel).where(AreaFrenteModel.obra_id == obra_id)
                      .order_by(AreaFrenteModel.ordem, AreaFrenteModel.id)).all()
    from app.modules.referencias.infra.pq_gateway import tags_do_takeoff

    tags = tags_do_takeoff(s, obra_id)
    por_local: dict[int, list[AreaOut]] = {}
    for a in areas:
        o = AreaOut.model_validate(a)
        o.no_takeoff = bool(a.tag and a.tag in tags)
        por_local.setdefault(a.local_id, []).append(o)
    return [LocalOut(**LocalOut.model_validate(loc).model_dump(exclude={"areas"}), areas=por_local.get(loc.id, []))
            for loc in locais]


@router.get("", response_model=list[LocalOut])
def listar(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    return arvore(s, c.obra_id)


@router.post("/locais", response_model=LocalOut, status_code=201)
def criar_local(d: LocalIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    cod = validar_codigo(d.codigo) if d.codigo.strip() else codigo_de_local(_codigos_usados(s, c.obra_id))
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
    cod = validar_codigo(d.codigo) if d.codigo.strip() else loc.codigo
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
                        codigo=_codigo_area(s, c.obra_id, d.cwa, None), descricao=" ".join(d.descricao.split()),
                        ativo_codigo=_ativo(d.ativo_codigo),
                        tag=normalizar_tag(_ativo(d.ativo_codigo)) or normalizar_tag(d.descricao), ordem=ordem, ativo=d.ativo)
    s.add(a)
    s.flush()
    garantir_areas(s, c.obra_id)  # a área nova já aparece na WBS de execução
    return a


@router.put("/areas/{area_id}", response_model=AreaOut)
def editar_area(area_id: int, d: AreaIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    a = s.get(AreaFrenteModel, area_id)
    if a is None or a.obra_id != c.obra_id:
        raise NotFoundError("Área", area_id)
    _local(s, c, d.local_id)
    cwa = validar_codigo(d.cwa)
    if cwa != a.cwa:  # mudou o CWA: o código acompanha (com sufixo só se repetir)
        a.codigo = _codigo_area(s, c.obra_id, cwa, None, exceto=area_id)
    a.local_id, a.cwa = d.local_id, cwa
    a.descricao, a.ativo = " ".join(d.descricao.split()), d.ativo
    a.ativo_codigo = _ativo(d.ativo_codigo)
    a.tag = normalizar_tag(a.ativo_codigo) or normalizar_tag(d.descricao)
    if d.ordem is not None:
        a.ordem = d.ordem
    s.flush()
    garantir_areas(s, c.obra_id)  # reativada: volta para a WBS
    return a


@router.delete("/areas/{area_id}", status_code=204)
def excluir_area(area_id: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    from app.modules.planejamento.infra.models import LinhaProgramacaoModel

    a = s.get(AreaFrenteModel, area_id)
    if a is None or a.obra_id != c.obra_id:
        raise NotFoundError("Área", area_id)
    if s.scalar(select(func.count()).select_from(LinhaProgramacaoModel).where(LinhaProgramacaoModel.area_id == area_id)):
        raise DomainError("área usada em programação: desative em vez de excluir")
    tirar_area(s, c.obra_id, area_id)
    s.delete(a)


@router.delete("")
def excluir_todas(s: Session = Depends(get_session), c: ContextoObra = Depends(administrar)):
    """Exclui todas as frentes da obra. Área já usada em programação fica (as programações apontam para ela),
    e o local dela também."""
    from app.modules.planejamento.infra.models import LinhaProgramacaoModel

    usadas = set(s.scalars(select(LinhaProgramacaoModel.area_id).join(AreaFrenteModel,
                                                                         AreaFrenteModel.id == LinhaProgramacaoModel.area_id)
                           .where(AreaFrenteModel.obra_id == c.obra_id)))
    areas = list(s.scalars(select(AreaFrenteModel).where(AreaFrenteModel.obra_id == c.obra_id)))
    n_areas = 0
    for a in areas:
        if a.id not in usadas and not area_tem_wbs(s, c.obra_id, a.id):
            tirar_area(s, c.obra_id, a.id)
            s.delete(a)
            n_areas += 1
    s.flush()
    com_area = set(s.scalars(select(AreaFrenteModel.local_id).where(AreaFrenteModel.obra_id == c.obra_id)))
    n_locais = 0
    for loc in s.scalars(select(LocalFrenteModel).where(LocalFrenteModel.obra_id == c.obra_id)):
        if loc.id not in com_area:
            s.delete(loc)
            n_locais += 1
    s.flush()
    return {"areas_excluidas": n_areas, "locais_excluidos": n_locais, "areas_mantidas": len(usadas)}


@router.delete("/locais/{local_id}", status_code=204)
def excluir_local(local_id: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    loc = _local(s, c, local_id)
    if s.scalar(select(func.count()).select_from(AreaFrenteModel).where(AreaFrenteModel.local_id == local_id)):
        raise DomainError("o local tem áreas: mova ou exclua as áreas antes")
    s.delete(loc)


@router.post("/importar", response_model=list[LocalOut])
def importar(d: ImportarIn, s: Session = Depends(get_session), c: ContextoObra = Depends(administrar)):
    """Cola a lista da obra: `CWA | Ativo | DESCRICAO CWA | Local` (ou o antigo `CODIGO | DESCRICAO`).

    Locais casam pelo código (formato antigo) ou pelo nome; os novos pelo nome ganham código L1, L2…
    Áreas casam pelo CWA + Ativo, depois CWA + TAG, depois CWA + descrição: reimportar atualiza sem duplicar.
    """
    lidos = interpretar_lista(d.texto)
    formato_cwa = eh_formato_cwa(d.texto)
    todos_locais = list(s.scalars(select(LocalFrenteModel).where(LocalFrenteModel.obra_id == c.obra_id)))
    por_codigo = {x.codigo: x for x in todos_locais}
    por_nome = {" ".join(x.descricao.split()).lower(): x for x in todos_locais}
    areas = list(s.scalars(select(AreaFrenteModel).where(AreaFrenteModel.obra_id == c.obra_id)))
    chaves: dict[tuple, AreaFrenteModel] = {}
    for a in areas:
        for k in ((a.cwa, "ativo", a.ativo_codigo), (a.cwa, "tag", a.tag), (a.cwa, "desc", a.descricao.lower())):
            if k[2]:
                chaves.setdefault(k, a)
    usados = {a.codigo for a in areas} | set(por_codigo)
    casadas: set[int] = set()
    da_lista: set[int] = set()
    novas: list[tuple[LocalFrenteModel, AreaLida, int]] = []
    for i, ll in enumerate(lidos, start=1):
        loc = por_codigo.get(ll.codigo) if ll.codigo else por_nome.get(ll.descricao.lower())
        if loc is None:
            cod = validar_codigo(ll.codigo) if ll.codigo else codigo_de_local(usados)
            loc = LocalFrenteModel(obra_id=c.obra_id, codigo=cod, descricao=ll.descricao, ordem=i)
            s.add(loc)
            s.flush()
            por_codigo[cod], por_nome[ll.descricao.lower()] = loc, loc
            usados.add(cod)
        else:
            loc.descricao, loc.ordem = ll.descricao, i
        da_lista.add(loc.id)
        for j, al in enumerate(ll.areas, start=1):
            a = next((x for k in ((al.cwa, "ativo", al.ativo), (al.cwa, "tag", al.tag), (al.cwa, "desc", al.descricao.lower()))
                      if k[2] and (x := chaves.get(k)) is not None and x.id not in casadas), None)
            if a:
                casadas.add(a.id)
                a.local_id, a.ordem, a.descricao = loc.id, j, al.descricao
                a.ativo_codigo, a.tag = al.ativo or a.ativo_codigo, al.tag or a.tag
            else:
                novas.append((loc, al, j))
    if formato_cwa:
        # na lista nova o Local é só o agrupamento: locais antigos (1, 2, S2…) que ficaram vazios saem, e o código
        # deles volta a ficar livre para a área de mesmo CWA
        s.flush()
        com_area = set(s.scalars(select(AreaFrenteModel.local_id).where(AreaFrenteModel.obra_id == c.obra_id)))
        com_area |= {loc.id for loc, _, _ in novas}
        for loc in todos_locais:
            if loc.id not in da_lista and loc.id not in com_area:
                usados.discard(loc.codigo)
                s.delete(loc)
        s.flush()
    atribuir_codigos([al for _, al, _ in novas], usados)  # CWA repetido (inclusive com os existentes) ganha sufixo
    for loc, al, j in novas:
        s.add(AreaFrenteModel(obra_id=c.obra_id, local_id=loc.id, cwa=al.cwa, codigo=al.codigo, descricao=al.descricao,
                              ativo_codigo=al.ativo, tag=al.tag, ordem=j, ativo=True))
    s.flush()
    garantir_areas(s, c.obra_id)  # áreas novas da lista já entram na WBS de execução
    return arvore(s, c.obra_id)
