"""Programação semanal do cliente (spec 146): importar para conferir, ligar, comparar e levar à programação."""
from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, ler, planejar
from app.core.db import get_session
from app.modules.planejamento.infra.models import ProgramacaoModel
from app.modules.programacao_cliente.application import conferencia as cf
from app.modules.programacao_cliente.application import levar as lv
from app.modules.programacao_cliente.domain import planilha as pl
from app.modules.programacao_cliente.infra import gateway as gw
from app.modules.programacao_cliente.infra.models import ImportacaoClienteModel
from app.shared.errors import NotFoundError

router = APIRouter(prefix="/programacao-cliente", tags=["programação do cliente"])
LIMITE = 20 * 1024 * 1024


def _por(c: ContextoObra) -> str:
    return (c.usuario.email or c.usuario.id)[:80]


def _ler(arquivo: UploadFile) -> bytes:
    dados = arquivo.file.read(LIMITE + 1)
    if len(dados) > LIMITE:
        from app.shared.errors import DomainError

        raise DomainError("planilha maior que 20 MB", "arquivo")
    return dados


@router.get("")
def listar(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    q = select(ImportacaoClienteModel).where(ImportacaoClienteModel.obra_id == c.obra_id).order_by(ImportacaoClienteModel.id.desc())
    return [cf.resumo(i) for i in s.scalars(q.limit(60))]


@router.get("/opcoes")
def opcoes(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Listas para trocar o vínculo na conferência: frentes, equipes e grupos do Catálogo."""
    ref = gw.carregar(s, c.obra_id)
    return {"areas": [{"id": a.id, "rotulo": f"{a.codigo} · {a.descricao}", "local": a.local} for a in ref.areas],
            "equipes": [{"id": e.id, "rotulo": e.nome + (f" — {e.encarregado.split('::')[-1].strip()}" if e.encarregado else "")}
                        for e in ref.equipes],
            "grupos": [{"id": g.id, "rotulo": f"{g.numero} · {g.descricao}"} for g in sorted(ref.grupos.values(), key=lambda g: g.numero) if g.ativo]}


@router.post("/previa")
def previa(arquivo: UploadFile = File(...), aba: str | None = Form(None), s: Session = Depends(get_session),
           c: ContextoObra = Depends(planejar)):
    """Só lê: as abas de programação do arquivo, a escolhida, o período e quantas atividades. Não grava nada."""
    p = pl.ler(_ler(arquivo), aba or None)
    return {"aba": p.aba, "abas": list(p.abas), "titulo": p.titulo, "inicio": p.inicio.isoformat(), "fim": p.fim.isoformat(),
            "atividades": len(p.linhas), "grupos": len({x.grupo for x in p.linhas if x.grupo}), "avisos": list(p.avisos)}


@router.post("", status_code=201)
def importar(arquivo: UploadFile = File(...), aba: str | None = Form(None), s: Session = Depends(get_session),
             c: ContextoObra = Depends(planejar)):
    imp = cf.importar(s, c.obra_id, _ler(arquivo), arquivo.filename or "planilha.xlsx", aba or None, _por(c))
    return cf.visao(s, c.obra_id, imp)


@router.get("/{iid}")
def ver(iid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    return cf.visao(s, c.obra_id, cf.obter(s, c.obra_id, iid))


@router.delete("/{iid}", status_code=204)
def excluir(iid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Tira a planilha da conferência; o que já foi levado continua na programação, e as decisões lembradas ficam."""
    s.delete(cf.obter(s, c.obra_id, iid))


class EditarIn(BaseModel):
    model_config = {"extra": "forbid"}
    area_id: int | None = None
    item_pq: str | None = None
    grupo_id: int | None = None
    wbs_no_id: int | None = None
    equipe_id: int | None = None
    id_crono: str | None = None
    ignorar: bool | None = None
    aplicar_iguais: bool = True


@router.put("/{iid}/linhas/{lid}")
def editar(iid: int, lid: int, d: EditarIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    imp = cf.obter(s, c.obra_id, iid)
    mud = d.model_dump(exclude_unset=True)
    r = cf.editar(s, c.obra_id, imp, lid, mud, _por(c))
    return {**r, "conferencia": cf.visao(s, c.obra_id, imp)}


class ConfirmarIn(BaseModel):
    ids: list[int] | None = None  # None = todas
    campos: list[str] | None = None  # area | item | wbs | equipe (None = todos)


@router.post("/{iid}/confirmar")
def confirmar(iid: int, d: ConfirmarIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    imp = cf.obter(s, c.obra_id, iid)
    n = cf.confirmar(s, c.obra_id, imp, d.ids, d.campos, _por(c))
    return {"confirmadas": n, "conferencia": cf.visao(s, c.obra_id, imp)}


class GrupoIn(BaseModel):
    grupo_id: int
    ids: list[int] | None = None


@router.post("/{iid}/grupo")
def grupo(iid: int, d: GrupoIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Grupo do Catálogo para os itens da PQ que ainda não têm tipo (o tipo é criado ao levar)."""
    imp = cf.obter(s, c.obra_id, iid)
    n = cf.grupo_em_lote(s, c.obra_id, imp, d.grupo_id, d.ids, _por(c))
    return {"linhas": n, "conferencia": cf.visao(s, c.obra_id, imp)}


@router.post("/{iid}/revincular")
def revincular(iid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Liga de novo as linhas ainda não conferidas (depois de cadastrar frente, item, equipe ou IWP)."""
    imp = cf.obter(s, c.obra_id, iid)
    cf.vincular(s, c.obra_id, imp)
    return cf.visao(s, c.obra_id, imp)


@router.get("/{iid}/destinos")
def destinos(iid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    return lv.destinos(s, c.obra_id, cf.obter(s, c.obra_id, iid))


@router.get("/{iid}/comparar/{pid}")
def comparar(iid: int, pid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    p = s.get(ProgramacaoModel, pid)
    if p is None or p.obra_id != c.obra_id:
        raise NotFoundError("Programação", pid)
    return lv.comparar(s, c.obra_id, cf.obter(s, c.obra_id, iid), p)


class LevarIn(BaseModel):
    destino: str  # existente | nova — perguntado a cada vez
    programacao_id: int | None = None
    ids: list[int] | None = None  # None = todas as prontas
    trazer_realizado: bool = True
    atualizar_existentes: bool = False
    reabrir: bool = False


@router.post("/{iid}/levar")
def levar(iid: int, d: LevarIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    from app.modules.catalogo.api.router import _novo_tipo
    from app.modules.catalogo.infra.models import GrupoAtividadeModel
    from app.modules.planejamento.api.router import LinhaIn, nova_linha

    def criar_linha(p: ProgramacaoModel, campos: dict) -> int:
        return nova_linha(p.id, LinhaIn(**campos), s, c)["id"]

    def criar_tipo(grupo_id: int, item_pq: str) -> int:
        from app.modules.catalogo.infra.models import TipoAtividadeModel

        ja = s.scalar(select(TipoAtividadeModel).where(TipoAtividadeModel.obra_id == c.obra_id, TipoAtividadeModel.item_pq == item_pq))
        if ja is not None:  # já está no Catálogo (criado agora há pouco ou inativo): é o mesmo tipo
            return ja.id
        g = s.get(GrupoAtividadeModel, grupo_id)
        if g is None or g.obra_id != c.obra_id:
            raise NotFoundError("Grupo", grupo_id)
        return _novo_tipo(s, c.obra_id, g, item_pq, None, None).id

    imp = cf.obter(s, c.obra_id, iid)
    r = lv.levar(s, c.obra_id, imp, destino=d.destino, programacao_id=d.programacao_id, ids=d.ids, trazer_realizado=d.trazer_realizado,
                 atualizar_existentes=d.atualizar_existentes, reabrir=d.reabrir, por=_por(c), criar_linha=criar_linha, criar_tipo=criar_tipo)
    return {**r, "conferencia": cf.visao(s, c.obra_id, imp)}
