"""Spec 111 — `/lideres` (Planejamento: link e acesso dos líderes) e `/portal/{codigo}` (o link aberto no celular do
encarregado; sem conta do Malhet: sessão própria pela matrícula e senha, cabeçalho X-Portal-Token)."""
from fastapi import APIRouter, Depends, Header, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core import mudancas
from app.core.auth import ContextoObra, ler, planejar
from app.core.db import get_session
from app.modules.lideres.application import gestao, portal as pt

router = APIRouter(prefix="/lideres", tags=["Líderes (portal do encarregado)"])
publico = APIRouter(prefix="/portal", tags=["Portal do encarregado"])


@router.get("")
def listar(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Quem pode entrar no endereço fixo dos encarregados (spec 115: `/encarregado`, sem link por obra)."""
    return {"endereco": "/encarregado", "lideres": gestao.listar(s, c.obra_id)}


class LiderIn(BaseModel):
    colaborador_id: int
    equipes: list[int] = []


@router.post("", status_code=201)
def cadastrar(d: LiderIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    gestao.cadastrar(s, c.obra_id, d.colaborador_id, d.equipes, c.usuario.id)
    return {"ok": True}


class EditarIn(BaseModel):
    equipes: list[int] | None = None
    ativo: bool | None = None


@router.put("/{colaborador_id}")
def editar(colaborador_id: int, d: EditarIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    gestao.editar(s, c.obra_id, colaborador_id, d.equipes, d.ativo)
    return {"ok": True}


@router.post("/{colaborador_id}/redefinir")
def redefinir(colaborador_id: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    gestao.redefinir(s, c.obra_id, colaborador_id)
    return {"ok": True, "senha": "123456"}


@router.get("/pedidos")
def pedidos(situacao: str | None = "pendente", s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Pedidos de equipe dos líderes (spec 114): `situacao` vazia = todos."""
    return gestao.pedidos(s, c.obra_id, situacao or None)


class AprovarIn(BaseModel):
    nome: str | None = Field(None, max_length=120)  # vazio = o nome no padrão da obra


@router.post("/pedidos/{pid}/aprovar")
def aprovar(pid: int, d: AprovarIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    return gestao.aprovar_pedido(s, c.obra_id, pid, d.nome, c.usuario.id, c.usuario.email)


class RecusarIn(BaseModel):
    motivo: str = Field(max_length=500)


@router.post("/pedidos/{pid}/recusar")
def recusar(pid: int, d: RecusarIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    gestao.recusar_pedido(s, c.obra_id, pid, d.motivo, c.usuario.id, c.usuario.email)
    return {"ok": True}


@router.delete("/{colaborador_id}", status_code=204)
def remover(colaborador_id: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    gestao.remover(s, c.obra_id, colaborador_id)


# ---- portal (público): endereço fixo dos encarregados (spec 115) ------------------------------------------------
def _ip(request: Request) -> str:
    return (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "") or "?").split(",")[0].strip()


def _mudou(token: str | None) -> None:
    mudancas.registrar(str(pt.obra_do_token(token)))  # as telas do Planejamento da obra se atualizam


@publico.get("/link/{codigo}")
def link_antigo(codigo: str, s: Session = Depends(get_session)):
    """Links por obra enviados antes do endereço fixo: devolvem a obra, para abrir já com a marca dela."""
    return {"obra_id": pt.portal(s, codigo).obra_id}


@publico.get("/marca/{obra_id}")
def marca(obra_id: int, s: Session = Depends(get_session)):
    """Nome da obra e a marca da empresa (spec 113): a tela abre com a cor e a logo da contratada, não do Malhet."""
    from app.modules.obras.infra.models import MarcaObraModel, ObraModel
    from app.shared.errors import NotFoundError

    obra = s.get(ObraModel, obra_id)
    if obra is None:
        raise NotFoundError("obra", obra_id)
    m = s.get(MarcaObraModel, obra_id)
    logos = [q for q in ("contratada", "contratante") if m is not None and getattr(m, f"tipo_{q}")]
    return {"obra": obra.nome,
            "marca": {"cor": m.cor if m else None, "contratada": m.nome_contratada if m else None,
                      "contratante": m.nome_contratante if m else None, "logos": logos,
                      "versao": int(m.atualizado_em.timestamp()) if m and m.atualizado_em else 0}}


@publico.get("/marca/{obra_id}/logo/{qual}")
def logo(obra_id: int, qual: str, s: Session = Depends(get_session)):
    from fastapi import Response

    from app.modules.obras.infra.models import MarcaObraModel
    from app.shared.errors import NotFoundError

    m = s.get(MarcaObraModel, obra_id) if qual in ("contratada", "contratante") else None
    tipo = getattr(m, f"tipo_{qual}") if m else None
    if not tipo:
        raise NotFoundError("logo", qual)
    return Response(getattr(m, f"logo_{qual}"), media_type=tipo, headers={"Cache-Control": "public, max-age=3600"})


class EntrarIn(BaseModel):
    matricula: str = Field(max_length=30)
    senha: str = Field(max_length=60)
    obra_id: int | None = None  # a matrícula está em mais de uma obra: a escolhida


@publico.post("/entrar")
def entrar(d: EntrarIn, request: Request, s: Session = Depends(get_session)):
    return pt.entrar(s, d.matricula, d.senha, _ip(request), d.obra_id)


class SenhaIn(BaseModel):
    nova: str = Field(max_length=60)
    repetida: str = Field(max_length=60)


@publico.post("/senha")
def senha(d: SenhaIn, s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    return pt.trocar_senha(s, x_portal_token, d.nova, d.repetida)


@publico.get("/equipes")
def equipes(s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    return {**pt.minhas_equipes(s, x_portal_token), "obra_id": pt.obra_do_token(x_portal_token)}


@publico.get("/buscar")
def buscar(q: str = "", s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    return pt.buscar(s, x_portal_token, q)


class IncluirIn(BaseModel):
    equipe_id: int
    cracha: str = Field(max_length=30)


@publico.post("/incluir")
def incluir(d: IncluirIn, s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    r = pt.incluir(s, x_portal_token, d.equipe_id, d.cracha)
    _mudou(x_portal_token)
    return r


class TransferirIn(BaseModel):
    equipe_id: int
    cracha: str = Field(max_length=30)
    para_equipe_id: int | None = None  # vazio = não sabe para onde foi (fica sem equipe)


@publico.post("/transferir")
def transferir(d: TransferirIn, s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    r = pt.transferir(s, x_portal_token, d.equipe_id, d.cracha, d.para_equipe_id)
    _mudou(x_portal_token)
    return r


class PedidoIn(BaseModel):
    disciplina: str = Field(max_length=60)
    membros: list[str] = Field(max_length=200)  # matrículas/crachás
    observacao: str | None = Field(None, max_length=500)


@publico.post("/pedidos")
def pedir(d: PedidoIn, s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    """Reivindicar equipe (spec 114): fica pendente até o Planejamento/administrador aprovar."""
    r = pt.pedir_equipe(s, x_portal_token, d.disciplina, d.membros, d.observacao)
    _mudou(x_portal_token)
    return r


@publico.delete("/pedidos/{pid}", status_code=204)
def cancelar(pid: int, s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    pt.cancelar_pedido(s, x_portal_token, pid)
