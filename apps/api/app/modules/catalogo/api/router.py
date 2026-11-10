from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, ler, planejar
from app.core.db import get_session
from app.modules.catalogo.domain import catalogo as cat
from app.modules.catalogo.infra.models import GrupoAtividadeModel, ItemSimovaModel, TipoAtividadeModel, TipoItemPqModel
from app.shared.errors import DomainError, NotFoundError

router = APIRouter(prefix="/catalogo", tags=["catálogo de atividades (ID Simova)"])


class ItemOut(BaseModel):
    id: int
    tipo_id: int
    numero: int
    codigo: str
    complemento: str
    descricao: str
    item_pq: str | None
    ativo: bool


class TipoOut(BaseModel):
    id: int
    grupo_id: int
    numero: int
    codigo: str
    descricao: str
    unidade: str | None
    ativo: bool
    itens_pq: list[str]
    itens: list[ItemOut] = []


class GrupoOut(BaseModel):
    id: int
    numero: int
    codigo: str
    descricao: str
    ativo: bool
    tipos: list[TipoOut] = []


class GrupoIn(BaseModel):
    descricao: str
    numero: int | None = None
    ativo: bool = True


class TipoIn(BaseModel):
    grupo_id: int
    descricao: str
    unidade: str | None = None
    numero: int | None = None
    ativo: bool = True
    itens_pq: list[str] = []


class ItemIn(BaseModel):
    tipo_id: int
    complemento: str
    item_pq: str | None = None
    ativo: bool = True


class ItemResp(BaseModel):
    item: ItemOut
    criado: bool
    aviso: str | None = None


def _tipo_out(t: TipoAtividadeModel, g: GrupoAtividadeModel, itens: list[ItemSimovaModel]) -> TipoOut:
    return TipoOut(id=t.id, grupo_id=t.grupo_id, numero=t.numero, codigo=cat.codigo_tipo(g.numero, t.numero),
                   descricao=t.descricao, unidade=t.unidade, ativo=t.ativo, itens_pq=[x.item_pq for x in t.itens_pq],
                   itens=[_item_out(i, t, g) for i in itens])


def _item_out(i: ItemSimovaModel, t: TipoAtividadeModel, g: GrupoAtividadeModel) -> ItemOut:
    return ItemOut(id=i.id, tipo_id=i.tipo_id, numero=i.numero, codigo=cat.codigo_item(g.numero, t.numero, i.numero),
                   complemento=i.complemento, descricao=cat.descricao_item(t.descricao, i.complemento),
                   item_pq=i.item_pq, ativo=i.ativo)


def arvore(s: Session, obra_id: int) -> list[GrupoOut]:
    grupos = s.scalars(select(GrupoAtividadeModel).where(GrupoAtividadeModel.obra_id == obra_id)
                       .order_by(GrupoAtividadeModel.numero)).all()
    tipos = s.scalars(select(TipoAtividadeModel).where(TipoAtividadeModel.obra_id == obra_id)
                      .order_by(TipoAtividadeModel.numero)).all()
    itens = s.scalars(select(ItemSimovaModel).where(ItemSimovaModel.obra_id == obra_id)
                      .order_by(ItemSimovaModel.numero)).all()
    por_tipo: dict[int, list[ItemSimovaModel]] = {}
    for i in itens:
        por_tipo.setdefault(i.tipo_id, []).append(i)
    por_grupo: dict[int, list[TipoAtividadeModel]] = {}
    for t in tipos:
        por_grupo.setdefault(t.grupo_id, []).append(t)
    return [GrupoOut(id=g.id, numero=g.numero, codigo=str(g.numero), descricao=g.descricao, ativo=g.ativo,
                     tipos=[_tipo_out(t, g, por_tipo.get(t.id, [])) for t in por_grupo.get(g.id, [])])
            for g in grupos]


def _grupo(s: Session, c: ContextoObra, gid: int) -> GrupoAtividadeModel:
    g = s.get(GrupoAtividadeModel, gid)
    if g is None or g.obra_id != c.obra_id:
        raise NotFoundError("Grupo", gid)
    return g


def _tipo(s: Session, c: ContextoObra, tid: int) -> TipoAtividadeModel:
    t = s.get(TipoAtividadeModel, tid)
    if t is None or t.obra_id != c.obra_id:
        raise NotFoundError("Tipo", tid)
    return t


@router.get("", response_model=list[GrupoOut])
def listar(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    return arvore(s, c.obra_id)


# ---- grupos ---------------------------------------------------------------------------------------
@router.post("/grupos", response_model=GrupoOut, status_code=201)
def criar_grupo(d: GrupoIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    nums = list(s.scalars(select(GrupoAtividadeModel.numero).where(GrupoAtividadeModel.obra_id == c.obra_id)))
    n = cat.validar_numero(d.numero, "numero") if d.numero else cat.proximo_numero(nums)
    if n in nums:
        raise DomainError(f"já existe o grupo {n}", "numero")
    g = GrupoAtividadeModel(obra_id=c.obra_id, numero=n, descricao=cat.validar_descricao(d.descricao), ativo=d.ativo)
    s.add(g)
    s.flush()
    return GrupoOut(id=g.id, numero=g.numero, codigo=str(g.numero), descricao=g.descricao, ativo=g.ativo)


@router.put("/grupos/{gid}", response_model=GrupoOut)
def editar_grupo(gid: int, d: GrupoIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    g = _grupo(s, c, gid)
    if d.numero and d.numero != g.numero:
        if s.scalar(select(GrupoAtividadeModel).where(GrupoAtividadeModel.obra_id == c.obra_id,
                                                      GrupoAtividadeModel.numero == d.numero)):
            raise DomainError(f"já existe o grupo {d.numero}", "numero")
        g.numero = cat.validar_numero(d.numero, "numero")
    g.descricao, g.ativo = cat.validar_descricao(d.descricao), d.ativo
    s.flush()
    return next(x for x in arvore(s, c.obra_id) if x.id == g.id)


# ---- tipos ----------------------------------------------------------------------------------------
def _salvar_itens_pq(t: TipoAtividadeModel, itens: list[str]) -> None:
    alvo = sorted({x.strip() for x in itens if x and x.strip()})
    atuais = {x.item_pq: x for x in t.itens_pq}
    t.itens_pq = [atuais.get(x) or TipoItemPqModel(item_pq=x) for x in alvo]


@router.post("/tipos", response_model=TipoOut, status_code=201)
def criar_tipo(d: TipoIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    g = _grupo(s, c, d.grupo_id)
    nums = list(s.scalars(select(TipoAtividadeModel.numero).where(TipoAtividadeModel.grupo_id == g.id)))
    n = cat.validar_numero(d.numero, "numero") if d.numero else cat.proximo_numero(nums)
    if n in nums:
        raise DomainError(f"já existe o tipo {g.numero}.{n}", "numero")
    t = TipoAtividadeModel(obra_id=c.obra_id, grupo_id=g.id, numero=n, descricao=cat.validar_descricao(d.descricao),
                           unidade=(d.unidade or "").strip() or None, ativo=d.ativo)
    _salvar_itens_pq(t, d.itens_pq)
    s.add(t)
    s.flush()
    return _tipo_out(t, g, [])


@router.put("/tipos/{tid}", response_model=TipoOut)
def editar_tipo(tid: int, d: TipoIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    t = _tipo(s, c, tid)
    g = _grupo(s, c, d.grupo_id)
    numero = d.numero or t.numero
    if (g.id, numero) != (t.grupo_id, t.numero) and s.scalar(
            select(TipoAtividadeModel).where(TipoAtividadeModel.grupo_id == g.id, TipoAtividadeModel.numero == numero,
                                             TipoAtividadeModel.id != tid)):
        raise DomainError(f"já existe o tipo {g.numero}.{numero}", "numero")
    t.grupo_id, t.numero = g.id, cat.validar_numero(numero, "numero")
    t.descricao, t.unidade, t.ativo = cat.validar_descricao(d.descricao), (d.unidade or "").strip() or None, d.ativo
    _salvar_itens_pq(t, d.itens_pq)
    s.flush()
    itens = s.scalars(select(ItemSimovaModel).where(ItemSimovaModel.tipo_id == t.id).order_by(ItemSimovaModel.numero)).all()
    return _tipo_out(t, g, list(itens))


# ---- itens (tipo + complemento) -----------------------------------------------------------------
def obter_ou_criar_item(s: Session, obra_id: int, tipo: TipoAtividadeModel, complemento: str,
                        item_pq: str | None) -> tuple[ItemSimovaModel, bool, str | None]:
    """Complemento novo cria g.t.n; repetido reaproveita. O item fica preso ao primeiro item de PQ usado."""
    texto = cat.validar_descricao(cat.limpar_texto(complemento).strip("() "), "complemento")
    chave = cat.chave_complemento(texto)
    item = s.scalar(select(ItemSimovaModel).where(ItemSimovaModel.tipo_id == tipo.id,
                                                  ItemSimovaModel.complemento_chave == chave))
    aviso = None
    if item is None:
        nums = list(s.scalars(select(ItemSimovaModel.numero).where(ItemSimovaModel.tipo_id == tipo.id)))
        item = ItemSimovaModel(obra_id=obra_id, tipo_id=tipo.id, numero=cat.proximo_numero(nums), complemento=texto,
                               complemento_chave=chave, item_pq=item_pq or None, ativo=True)
        s.add(item)
        s.flush()
        return item, True, None
    if item_pq and item.item_pq and item.item_pq != item_pq:
        aviso = (f"este complemento já está ligado ao item de PQ {item.item_pq}; "
                 f"para usar o {item_pq}, escreva um complemento diferente")
    elif item_pq and not item.item_pq:
        item.item_pq = item_pq
    return item, False, aviso


@router.post("/itens", response_model=ItemResp)
def criar_item(d: ItemIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    t = _tipo(s, c, d.tipo_id)
    g = s.get(GrupoAtividadeModel, t.grupo_id)
    item, criado, aviso = obter_ou_criar_item(s, c.obra_id, t, d.complemento, d.item_pq)
    return ItemResp(item=_item_out(item, t, g), criado=criado, aviso=aviso)


@router.put("/itens/{iid}", response_model=ItemOut)
def editar_item(iid: int, d: ItemIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    item = s.get(ItemSimovaModel, iid)
    if item is None or item.obra_id != c.obra_id:
        raise NotFoundError("Item", iid)
    t = _tipo(s, c, item.tipo_id)
    texto = cat.validar_descricao(cat.limpar_texto(d.complemento).strip("() "), "complemento")
    chave = cat.chave_complemento(texto)
    if s.scalar(select(ItemSimovaModel).where(ItemSimovaModel.tipo_id == t.id, ItemSimovaModel.complemento_chave == chave,
                                              ItemSimovaModel.id != iid)):
        raise DomainError("já existe item com esse complemento neste tipo", "complemento")
    item.complemento, item.complemento_chave = texto, chave
    item.item_pq, item.ativo = (d.item_pq or "").strip() or None, d.ativo
    s.flush()
    return _item_out(item, t, s.get(GrupoAtividadeModel, t.grupo_id))


@router.get("/contagem")
def contagem(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    def n(m):
        return s.scalar(select(func.count()).select_from(m).where(m.obra_id == c.obra_id))
    return {"grupos": n(GrupoAtividadeModel), "tipos": n(TipoAtividadeModel), "itens": n(ItemSimovaModel)}
