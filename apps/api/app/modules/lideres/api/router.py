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
    p = gestao.garantir_portal(s, c.obra_id)
    return {"link": {"codigo": p.codigo, "ativo": p.ativo}, "lideres": gestao.listar(s, c.obra_id)}


class LinkIn(BaseModel):
    ativo: bool


@router.put("/link")
def ligar_link(d: LinkIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    p = gestao.garantir_portal(s, c.obra_id)
    p.ativo = d.ativo
    return {"codigo": p.codigo, "ativo": p.ativo}


@router.post("/link/novo")
def trocar_link(s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Link novo: o antigo para de funcionar (ex.: vazou para fora do grupo)."""
    p = gestao.novo_link(s, c.obra_id)
    return {"codigo": p.codigo, "ativo": p.ativo}


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


@router.delete("/{colaborador_id}", status_code=204)
def remover(colaborador_id: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    gestao.remover(s, c.obra_id, colaborador_id)


# ---- portal (público, pelo link) -----------------------------------------------------------------------------
def _ip(request: Request) -> str:
    return (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "") or "?").split(",")[0].strip()


@publico.get("/{codigo}")
def info(codigo: str, s: Session = Depends(get_session)):
    from app.modules.obras.infra.models import ObraModel

    p = pt.portal(s, codigo)
    obra = s.get(ObraModel, p.obra_id)
    return {"obra": obra.nome if obra else ""}


class EntrarIn(BaseModel):
    matricula: str = Field(max_length=30)
    senha: str = Field(max_length=60)


@publico.post("/{codigo}/entrar")
def entrar(codigo: str, d: EntrarIn, request: Request, s: Session = Depends(get_session)):
    return pt.entrar(s, codigo, d.matricula, d.senha, _ip(request))


class SenhaIn(BaseModel):
    nova: str = Field(max_length=60)
    repetida: str = Field(max_length=60)


@publico.post("/{codigo}/senha")
def senha(codigo: str, d: SenhaIn, s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    return pt.trocar_senha(s, codigo, x_portal_token, d.nova, d.repetida)


@publico.get("/{codigo}/equipes")
def equipes(codigo: str, s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    return pt.minhas_equipes(s, codigo, x_portal_token)


@publico.get("/{codigo}/buscar")
def buscar(codigo: str, q: str = "", s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    return pt.buscar(s, codigo, x_portal_token, q)


class IncluirIn(BaseModel):
    equipe_id: int
    cracha: str = Field(max_length=30)


@publico.post("/{codigo}/incluir")
def incluir(codigo: str, d: IncluirIn, s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    r = pt.incluir(s, codigo, x_portal_token, d.equipe_id, d.cracha)
    mudancas.registrar(str(pt.portal(s, codigo).obra_id))  # as telas do Planejamento se atualizam
    return r


class TransferirIn(BaseModel):
    equipe_id: int
    cracha: str = Field(max_length=30)
    para_equipe_id: int | None = None  # vazio = não sabe para onde foi (fica sem equipe)


@publico.post("/{codigo}/transferir")
def transferir(codigo: str, d: TransferirIn, s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    r = pt.transferir(s, codigo, x_portal_token, d.equipe_id, d.cracha, d.para_equipe_id)
    mudancas.registrar(str(pt.portal(s, codigo).obra_id))
    return r
