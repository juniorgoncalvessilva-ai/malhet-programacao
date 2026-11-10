from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, ler, planejar
from app.core.db import get_session
from app.modules.catalogo.domain import catalogo as cat
from app.modules.catalogo.infra.models import GrupoAtividadeModel, ItemSimovaModel, TipoAtividadeModel
from app.modules.referencias.infra.pq_gateway import ItemPqInfo, itens_pq
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
    item_pq: str | None
    descricao: str
    unidade: str | None
    quantidade_pq: float | None = None
    pu: float | None = None
    na_pq_vigente: bool = True
    ativo: bool
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
    """O tipo é um item da PQ: descrição e unidade vêm dela (manual só sem PQ, para cadastros antigos)."""
    grupo_id: int
    item_pq: str | None = None
    descricao: str | None = None
    unidade: str | None = None
    numero: int | None = None
    ativo: bool = True


class VincularIn(BaseModel):
    itens: list[str]


class ItemIn(BaseModel):
    tipo_id: int
    complemento: str
    item_pq: str | None = None
    ativo: bool = True


class ItemResp(BaseModel):
    item: ItemOut
    criado: bool
    aviso: str | None = None


def _tipo_out(t: TipoAtividadeModel, g: GrupoAtividadeModel, itens: list[ItemSimovaModel],
              pq: dict[str, ItemPqInfo] | None = None) -> TipoOut:
    info = (pq or {}).get(t.item_pq) if t.item_pq else None
    info = info if info is not None and info.folha else None  # título da PQ não serve de tipo
    desc = info.descricao if info else t.descricao
    return TipoOut(id=t.id, grupo_id=t.grupo_id, numero=t.numero, codigo=cat.codigo_tipo(g.numero, t.numero),
                   item_pq=t.item_pq, descricao=desc, unidade=(info.unid if info else t.unidade),
                   quantidade_pq=info.quantidade if info else None, pu=info.pu if info else None,
                   na_pq_vigente=bool(info) or not t.item_pq or pq is None, ativo=t.ativo,
                   itens=[_item_out(i, t, g, desc) for i in itens])


def _item_out(i: ItemSimovaModel, t: TipoAtividadeModel, g: GrupoAtividadeModel, desc: str | None = None) -> ItemOut:
    return ItemOut(id=i.id, tipo_id=i.tipo_id, numero=i.numero, codigo=cat.codigo_item(g.numero, t.numero, i.numero),
                   complemento=i.complemento, descricao=cat.descricao_item(desc or t.descricao, i.complemento),
                   item_pq=t.item_pq or i.item_pq, ativo=i.ativo)


def arvore(s: Session, obra_id: int) -> list[GrupoOut]:
    grupos = s.scalars(select(GrupoAtividadeModel).where(GrupoAtividadeModel.obra_id == obra_id)
                       .order_by(GrupoAtividadeModel.numero)).all()
    tipos = s.scalars(select(TipoAtividadeModel).where(TipoAtividadeModel.obra_id == obra_id)
                      .order_by(TipoAtividadeModel.numero)).all()
    itens = s.scalars(select(ItemSimovaModel).where(ItemSimovaModel.obra_id == obra_id)
                      .order_by(ItemSimovaModel.numero)).all()
    pq = itens_pq(s, obra_id, {t.item_pq for t in tipos if t.item_pq})
    por_tipo: dict[int, list[ItemSimovaModel]] = {}
    for i in itens:
        por_tipo.setdefault(i.tipo_id, []).append(i)
    por_grupo: dict[int, list[TipoAtividadeModel]] = {}
    for t in tipos:
        por_grupo.setdefault(t.grupo_id, []).append(t)
    return [GrupoOut(id=g.id, numero=g.numero, codigo=str(g.numero), descricao=g.descricao, ativo=g.ativo,
                     tipos=[_tipo_out(t, g, por_tipo.get(t.id, []), pq) for t in por_grupo.get(g.id, [])])
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


@router.delete("/grupos/{gid}", status_code=204)
def excluir_grupo(gid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    g = _grupo(s, c, gid)
    if s.scalar(select(func.count()).select_from(TipoAtividadeModel).where(TipoAtividadeModel.grupo_id == g.id)):
        raise DomainError("o grupo tem itens da PQ vinculados: desvincule-os antes")
    s.delete(g)


# ---- tipos = itens da PQ vinculados ao grupo ------------------------------------------------------
def _novo_tipo(s: Session, obra_id: int, g: GrupoAtividadeModel, item_pq: str | None, descricao: str | None,
               unidade: str | None, numero: int | None = None, ativo: bool = True) -> TipoAtividadeModel:
    nums = list(s.scalars(select(TipoAtividadeModel.numero).where(TipoAtividadeModel.grupo_id == g.id)))
    n = cat.validar_numero(numero, "numero") if numero else cat.proximo_numero(nums)
    if n in nums:
        raise DomainError(f"já existe o tipo {g.numero}.{n}", "numero")
    if item_pq:
        outro = s.scalar(select(TipoAtividadeModel).where(TipoAtividadeModel.obra_id == obra_id,
                                                          TipoAtividadeModel.item_pq == item_pq))
        if outro is not None:
            og = s.get(GrupoAtividadeModel, outro.grupo_id)
            raise DomainError(f"o item {item_pq} já é o tipo {cat.codigo_tipo(og.numero, outro.numero)}", "item_pq")
        info = itens_pq(s, obra_id, {item_pq}).get(item_pq)
        if info is None and not descricao:
            raise DomainError(f"o item {item_pq} não está na PQ vigente", "item_pq")
        if info is not None and not info.folha:
            raise DomainError(f"{item_pq} é um título da PQ: escolha um item com unidade", "item_pq")
        if info is not None:
            descricao, unidade = info.descricao, info.unid
    if not (descricao or "").strip():
        raise DomainError("escolha um item da PQ", "item_pq")
    t = TipoAtividadeModel(obra_id=obra_id, grupo_id=g.id, numero=n, item_pq=item_pq or None,
                           descricao=descricao.strip()[:500], unidade=(unidade or "").strip() or None, ativo=ativo)
    s.add(t)
    s.flush()
    return t


@router.post("/grupos/{gid}/itens-pq")
def vincular_itens_pq(gid: int, d: VincularIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Vincula itens da PQ ao grupo: cada item vira um tipo (ID Simova g.t) com a descrição da PQ."""
    g = _grupo(s, c, gid)
    criados, avisos = [], []
    for item in dict.fromkeys(x.strip() for x in d.itens if x and x.strip()):
        try:
            t = _novo_tipo(s, c.obra_id, g, item, None, None)
            criados.append(cat.codigo_tipo(g.numero, t.numero))
        except DomainError as e:
            avisos.append(str(e))
    return {"criados": criados, "avisos": avisos}


@router.post("/tipos", response_model=TipoOut, status_code=201)
def criar_tipo(d: TipoIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    g = _grupo(s, c, d.grupo_id)
    t = _novo_tipo(s, c.obra_id, g, (d.item_pq or "").strip() or None, d.descricao, d.unidade, d.numero, d.ativo)
    return _tipo_out(t, g, [], itens_pq(s, c.obra_id, {t.item_pq} if t.item_pq else set()))


@router.put("/tipos/{tid}", response_model=TipoOut)
def editar_tipo(tid: int, d: TipoIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Muda o grupo, o número (o ID Simova) ou a situação. A descrição é a da PQ."""
    t = _tipo(s, c, tid)
    g = _grupo(s, c, d.grupo_id)
    numero = d.numero or t.numero
    if (g.id, numero) != (t.grupo_id, t.numero) and s.scalar(
            select(TipoAtividadeModel).where(TipoAtividadeModel.grupo_id == g.id, TipoAtividadeModel.numero == numero,
                                             TipoAtividadeModel.id != tid)):
        raise DomainError(f"já existe o tipo {g.numero}.{numero}", "numero")
    t.grupo_id, t.numero, t.ativo = g.id, cat.validar_numero(numero, "numero"), d.ativo
    if not t.item_pq and (d.item_pq or "").strip():  # cadastro antigo: passa a apontar para a PQ
        info = itens_pq(s, c.obra_id, {d.item_pq.strip()}).get(d.item_pq.strip())
        if info is None or not info.folha:
            raise DomainError(f"o item {d.item_pq} não é um item da PQ vigente", "item_pq")
        t.item_pq, t.descricao, t.unidade = info.item, info.descricao[:500], info.unid
    elif not t.item_pq and d.descricao:
        t.descricao, t.unidade = d.descricao.strip()[:500], (d.unidade or "").strip() or None
    s.flush()
    itens = s.scalars(select(ItemSimovaModel).where(ItemSimovaModel.tipo_id == t.id).order_by(ItemSimovaModel.numero)).all()
    return _tipo_out(t, g, list(itens), itens_pq(s, c.obra_id, {t.item_pq} if t.item_pq else set()))


@router.delete("/tipos/{tid}", status_code=204)
def desvincular_tipo(tid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Desvincula o item da PQ do grupo (só se nenhuma programação usa o tipo)."""
    from app.modules.planejamento.infra.models import LinhaProgramacaoModel

    t = _tipo(s, c, tid)
    if s.scalar(select(func.count()).select_from(LinhaProgramacaoModel).where(LinhaProgramacaoModel.tipo_id == t.id)):
        raise DomainError("o tipo está em programações: inative-o em vez de desvincular")
    for i in s.scalars(select(ItemSimovaModel).where(ItemSimovaModel.tipo_id == t.id)):
        s.delete(i)
    s.flush()
    s.delete(t)


# ---- itens (tipo + complemento) -----------------------------------------------------------------
def obter_ou_criar_item(s: Session, obra_id: int, tipo: TipoAtividadeModel, complemento: str,
                        item_pq: str | None) -> tuple[ItemSimovaModel, bool, str | None]:
    """Complemento novo cria g.t.n; repetido reaproveita. O item fica preso ao primeiro item de PQ usado."""
    item_pq = tipo.item_pq or item_pq  # tipo ligado à PQ: o complemento herda o item
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
    item.item_pq, item.ativo = t.item_pq or (d.item_pq or "").strip() or None, d.ativo
    s.flush()
    return _item_out(item, t, s.get(GrupoAtividadeModel, t.grupo_id))


@router.get("/contagem")
def contagem(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    def n(m):
        return s.scalar(select(func.count()).select_from(m).where(m.obra_id == c.obra_id))
    return {"grupos": n(GrupoAtividadeModel), "tipos": n(TipoAtividadeModel), "itens": n(ItemSimovaModel)}
