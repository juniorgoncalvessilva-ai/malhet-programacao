from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, ler, planejar
from app.core.db import get_session
from app.modules.catalogo.domain import catalogo as cat
from app.modules.catalogo.domain import unidades as um
from app.modules.cadastros.infra.models import UnidadeMedidaModel  # tabela UNIDADE_MEDIDA do Simova (por obra)
from app.modules.catalogo.infra.models import GrupoAtividadeModel, ItemSimovaModel, TipoAtividadeModel
from app.modules.referencias.infra.pq_gateway import ItemPqInfo, itens_pq, salvar_nome_simplificado
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
    descricao: str  # texto do Simova: nome simplificado, senão a descrição da PQ
    descricao_pq: str | None = None
    nome_simplificado: str | None = None
    unidade: str | None
    quantidade_pq: float | None = None
    pu: float | None = None
    na_pq_vigente: bool = True
    ativo: bool
    unidade_simova: str | None = None  # código UNIDADE_MEDIDA do Simova casado com a unidade da PQ
    itens: list[ItemOut] = []


class GrupoOut(BaseModel):
    id: int
    numero: int
    codigo: str
    descricao: str
    unidade: str | None = None  # código UNIDADE_MEDIDA do Simova
    ativo: bool
    tipos: list[TipoOut] = []


class GrupoIn(BaseModel):
    descricao: str
    numero: int | None = None
    unidade: str | None = None
    ativo: bool = True


class LoteIn(BaseModel):
    texto: str


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


class NomeIn(BaseModel):
    item: str
    nome: str | None = None


class NomesIn(BaseModel):
    itens: list[NomeIn]


class GrupoDoItemIn(BaseModel):
    grupo_id: int | None = None  # None = desvincular


class ItemResp(BaseModel):
    item: ItemOut
    criado: bool
    aviso: str | None = None


def _tipo_out(t: TipoAtividadeModel, g: GrupoAtividadeModel, itens: list[ItemSimovaModel],
              pq: dict[str, ItemPqInfo] | None = None, tab: dict[str, str] | None = None) -> TipoOut:
    info = (pq or {}).get(t.item_pq) if t.item_pq else None
    info = info if info is not None and info.folha else None  # título da PQ não serve de tipo
    desc = info.texto_simova if info else t.descricao
    return TipoOut(id=t.id, grupo_id=t.grupo_id, numero=t.numero, codigo=cat.codigo_tipo(g.numero, t.numero),
                   item_pq=t.item_pq, descricao=desc, descricao_pq=info.descricao if info else None,
                   nome_simplificado=info.nome_simplificado if info else None, unidade=(info.unid if info else t.unidade),
                   quantidade_pq=info.quantidade if info else None, pu=info.pu if info else None,
                   na_pq_vigente=bool(info) or not t.item_pq or pq is None, ativo=t.ativo,
                   unidade_simova=um.codigo_unidade(info.unid if info else t.unidade, tab) if tab else None,
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
    tab = tabela_unidades(s, obra_id)
    return [GrupoOut(id=g.id, numero=g.numero, codigo=str(g.numero), descricao=g.descricao, unidade=g.unidade, ativo=g.ativo,
                     tipos=[_tipo_out(t, g, por_tipo.get(t.id, []), pq, tab) for t in por_grupo.get(g.id, [])])
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
    g = GrupoAtividadeModel(obra_id=c.obra_id, numero=n, descricao=cat.validar_descricao(d.descricao), ativo=d.ativo,
                            unidade=_unidade_valida(s, c.obra_id, d.unidade))
    s.add(g)
    s.flush()
    return GrupoOut(id=g.id, numero=g.numero, codigo=str(g.numero), descricao=g.descricao, unidade=g.unidade, ativo=g.ativo)


@router.put("/grupos/{gid}", response_model=GrupoOut)
def editar_grupo(gid: int, d: GrupoIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    g = _grupo(s, c, gid)
    if d.numero and d.numero != g.numero:
        if s.scalar(select(GrupoAtividadeModel).where(GrupoAtividadeModel.obra_id == c.obra_id,
                                                      GrupoAtividadeModel.numero == d.numero)):
            raise DomainError(f"já existe o grupo {d.numero}", "numero")
        g.numero = cat.validar_numero(d.numero, "numero")
    g.descricao, g.ativo = cat.validar_descricao(d.descricao), d.ativo
    g.unidade = _unidade_valida(s, c.obra_id, d.unidade)
    s.flush()
    return next(x for x in arvore(s, c.obra_id) if x.id == g.id)


# ---- unidades de medida (aba UNIDADE_MEDIDA do Simova) e grupos em massa (layout OPER_GRUPO) ----------------
def unidades(s: Session, obra_id: int) -> list[UnidadeMedidaModel]:
    lista = list(s.scalars(select(UnidadeMedidaModel).where(UnidadeMedidaModel.obra_id == obra_id)
                           .order_by(UnidadeMedidaModel.codigo)))
    if not lista:
        from sqlalchemy.dialects.postgresql import insert

        s.execute(insert(UnidadeMedidaModel).values([{"obra_id": obra_id, "codigo": c, "descricao": d}
                                                     for c, d in um.UNIDADES_PADRAO])
                  .on_conflict_do_nothing(index_elements=["obra_id", "codigo"]))
        s.flush()
        lista = list(s.scalars(select(UnidadeMedidaModel).where(UnidadeMedidaModel.obra_id == obra_id)
                               .order_by(UnidadeMedidaModel.codigo)))
    return lista


def tabela_unidades(s: Session, obra_id: int) -> dict[str, str]:
    return {u.codigo: u.descricao or "" for u in unidades(s, obra_id)}


def _unidade_valida(s: Session, obra_id: int, cod: str | None) -> str | None:
    c = um.validar_codigo_unidade(cod)
    if c and c not in tabela_unidades(s, obra_id):
        raise DomainError(f"unidade {c} não está na tabela UNIDADE_MEDIDA da obra", "unidade")
    return c


@router.get("/unidades")
def listar_unidades(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    return [{"codigo": u.codigo, "descricao": u.descricao or ""} for u in unidades(s, c.obra_id)]


@router.post("/unidades/lote")
def lote_unidades(d: LoteIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Cola CODIGO · DESCRICAO (aba UNIDADE_MEDIDA do Simova): inclui as novas e atualiza a descrição das existentes."""
    atuais = {u.codigo: u for u in unidades(s, c.obra_id)}
    n = 0
    for cod, desc in um.interpretar_unidades(d.texto):
        if cod in atuais:
            atuais[cod].descricao = desc
        else:
            s.add(UnidadeMedidaModel(obra_id=c.obra_id, codigo=cod, descricao=desc))
        n += 1
    s.flush()
    return {"salvas": n}


@router.post("/grupos/lote")
def lote_grupos(d: LoteIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Grupos em massa no layout OPER_GRUPO (CODIGO · DESCRICAO · UNIDADE_MEDIDA), colados do Excel. O código é o
    número do grupo: se já existe, atualiza descrição e unidade; senão, cria."""
    linhas = um.interpretar_grupos(d.texto)
    tab = tabela_unidades(s, c.obra_id)
    fora = sorted({u for _n, _d, u in linhas if u and u not in tab})
    if fora:
        raise DomainError(f"unidade(s) fora da tabela UNIDADE_MEDIDA: {', '.join(fora)} — inclua-as antes", "texto")
    atuais = {g.numero: g for g in s.scalars(select(GrupoAtividadeModel).where(GrupoAtividadeModel.obra_id == c.obra_id))}
    criados = atualizados = 0
    for n, desc, unid in linhas:
        g = atuais.get(cat.validar_numero(n, "codigo"))
        if g is None:
            s.add(GrupoAtividadeModel(obra_id=c.obra_id, numero=n, descricao=cat.validar_descricao(desc), unidade=unid, ativo=True))
            criados += 1
        else:
            g.descricao, g.unidade = cat.validar_descricao(desc), unid
            atualizados += 1
    s.flush()
    return {"criados": criados, "atualizados": atualizados}


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
            descricao, unidade = info.texto_simova, info.unid
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
        t.item_pq, t.descricao, t.unidade = info.item, info.texto_simova[:500], info.unid
    elif not t.item_pq and d.descricao:
        t.descricao, t.unidade = d.descricao.strip()[:500], (d.unidade or "").strip() or None
    s.flush()
    itens = s.scalars(select(ItemSimovaModel).where(ItemSimovaModel.tipo_id == t.id).order_by(ItemSimovaModel.numero)).all()
    return _tipo_out(t, g, list(itens), itens_pq(s, c.obra_id, {t.item_pq} if t.item_pq else set()))


@router.delete("/tipos/{tid}", status_code=204)
def desvincular_tipo(tid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Desvincula o item da PQ do grupo (só se nenhuma programação usa o tipo)."""
    from app.modules.planejamento.infra.models import LinhaProgramacaoModel

    from app.modules.planejamento.infra.models import ProgramacaoModel
    from app.modules.wbs.infra.models import WbsNoModel

    t = _tipo(s, c, tid)
    usos = list(s.execute(select(ProgramacaoModel.titulo, func.count()).join(
        LinhaProgramacaoModel, LinhaProgramacaoModel.programacao_id == ProgramacaoModel.id).where(
        LinhaProgramacaoModel.tipo_id == t.id).group_by(ProgramacaoModel.titulo)))
    if usos:
        onde = "; ".join(f"{titulo} ({n} linha{'s' if n > 1 else ''})" for titulo, n in usos[:5])
        raise DomainError(f"o item {t.item_pq or t.descricao[:40]} está em programação: {onde}. Exclua essas linhas "
                          "(programação em rascunho) ou inative o item em vez de excluir")
    # IWPs da WBS de execução que apontam para o tipo (vieram do P6 ou foram criados à mão) saem junto:
    # nenhum está em programação (verificado acima); a próxima sincronização com o P6 não os recria sem o vínculo
    iwps = list(s.scalars(select(WbsNoModel).where(WbsNoModel.obra_id == c.obra_id, WbsNoModel.tipo_atividade_id == t.id)))
    for n in iwps:
        s.delete(n)
    for i in s.scalars(select(ItemSimovaModel).where(ItemSimovaModel.tipo_id == t.id)):
        s.delete(i)
    s.flush()
    s.delete(t)
    s.flush()


# ---- nome simplificado do item da PQ e vínculo de um item a um grupo -----------------------------------
@router.put("/nomes-simplificados")
def salvar_nomes(d: NomesIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Nome simplificado dos itens da PQ (texto curto do Simova). Vazio volta para a descrição da PQ. O tipo vinculado
    ao item (e os itens complementares dele) passam a usar o nome no Simova."""
    salvos = 0
    for x in d.itens:
        item = x.item.strip()
        nome = cat.limpar_texto(x.nome)
        if nome:
            nome = cat.validar_descricao(nome, "nome simplificado", 120)
        info = itens_pq(s, c.obra_id, {item}).get(item)
        if info is None or not info.folha:
            raise DomainError(f"{item} não é um item da PQ vigente", "item")
        salvar_nome_simplificado(s, c.obra_id, item, nome or None)
        t = s.scalar(select(TipoAtividadeModel).where(TipoAtividadeModel.obra_id == c.obra_id,
                                                      TipoAtividadeModel.item_pq == item))
        if t is not None:
            t.descricao = (nome or info.descricao)[:500]
        salvos += 1
    s.flush()
    return {"salvos": salvos}


@router.put("/itens-pq/{item}/grupo")
def grupo_do_item(item: str, d: GrupoDoItemIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Liga um único item da PQ a um grupo, troca de grupo (novo número no grupo de destino) ou desvincula."""
    item = item.strip()
    t = s.scalar(select(TipoAtividadeModel).where(TipoAtividadeModel.obra_id == c.obra_id,
                                                  TipoAtividadeModel.item_pq == item))
    if d.grupo_id is None:
        if t is not None:
            desvincular_tipo(t.id, s, c)
        return {"codigo": None}
    g = _grupo(s, c, d.grupo_id)
    if t is None:
        t = _novo_tipo(s, c.obra_id, g, item, None, None)
    elif t.grupo_id != g.id:
        nums = list(s.scalars(select(TipoAtividadeModel.numero).where(TipoAtividadeModel.grupo_id == g.id)))
        t.grupo_id, t.numero = g.id, cat.proximo_numero(nums)
        s.flush()
    return {"codigo": cat.codigo_tipo(g.numero, t.numero)}


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


@router.delete("/itens/{iid}", status_code=204)
def excluir_item(iid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Exclui o item complementar (g.t.n) que nenhuma programação usa."""
    from app.modules.planejamento.infra.models import LinhaProgramacaoModel

    i = s.get(ItemSimovaModel, iid)
    if i is None or i.obra_id != c.obra_id:
        raise NotFoundError("Item", iid)
    if s.scalar(select(func.count()).select_from(LinhaProgramacaoModel).where(LinhaProgramacaoModel.item_simova_id == i.id)):
        raise DomainError("o item complementar está em programação: inative-o em vez de excluir")
    s.delete(i)


@router.get("/contagem")
def contagem(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    def n(m):
        return s.scalar(select(func.count()).select_from(m).where(m.obra_id == c.obra_id))
    return {"grupos": n(GrupoAtividadeModel), "tipos": n(TipoAtividadeModel), "itens": n(ItemSimovaModel)}
