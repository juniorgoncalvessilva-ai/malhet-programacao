from datetime import datetime

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.core.auth import UsuarioAtual, resolver_contexto, superadmin, usuario_atual
from app.core.db import get_session
from app.modules.obras.application.acessos import ConcederIn, conceder_acesso, criar_obra
from app.modules.obras.domain.obra import DadosObra, PapelObra
from app.modules.obras.infra.contas_authkit import ContasAuthKit
from app.modules.obras.infra.models import AcessoObraModel, ObraModel
from app.shared.errors import DomainError, NotFoundError

router = APIRouter(tags=["obras e acessos"])


class ObraIn(BaseModel):
    codigo: str = Field(max_length=12)
    nome: str
    contrato: str | None = None
    cliente: str | None = None
    ativa: bool = True


class ObraOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    codigo: str
    nome: str
    contrato: str | None
    cliente: str | None
    ativa: bool
    criado_em: datetime


class MinhaObraOut(ObraOut):
    paginas: list[str] | None = None  # páginas liberadas (vazio = todas as do papel)
    paginas_mobile: list[str] | None = None  # telas do celular liberadas (vazio = todas as do papel) — spec 066
    cor: str | None = None  # cor do cliente (marca da obra) no lugar do verde Malhet
    papel: PapelObra


class ObraAdminOut(ObraOut):
    usuarios: int = 0


class AcessoIn(BaseModel):
    email: str
    papel: PapelObra
    cracha: str | None = None
    senha_inicial: str | None = None
    paginas: list[str] | None = None


class AcessoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    obra_id: int
    usuario_id: str
    email: str
    papel: PapelObra
    cracha: str | None
    paginas: list[str] | None = None
    paginas_mobile: list[str] | None = None
    concedido_por: str
    concedido_em: datetime


class ConcederResp(BaseModel):
    acesso: AcessoOut
    conta_criada: bool
    senha_redefinida: bool = False


def _contas(request: Request) -> ContasAuthKit:
    return ContasAuthKit(request.app.state.auth)


# ---- quem sou / minhas obras ---------------------------------------------------------------
@router.get("/obras/minhas", response_model=list[MinhaObraOut])
def minhas(s: Session = Depends(get_session), u: UsuarioAtual = Depends(usuario_atual)):
    from app.modules.obras.infra.models import MarcaObraModel

    cores = dict(s.execute(select(MarcaObraModel.obra_id, MarcaObraModel.cor)).all())
    if u.superadmin:
        obras = s.scalars(select(ObraModel).where(ObraModel.ativa.is_(True)).order_by(ObraModel.codigo))
        return [MinhaObraOut(**ObraOut.model_validate(o).model_dump(), papel=PapelObra.ADMIN, cor=cores.get(o.id)) for o in obras]
    q = (select(ObraModel, AcessoObraModel.papel, AcessoObraModel.paginas, AcessoObraModel.paginas_mobile)
         .join(AcessoObraModel, AcessoObraModel.obra_id == ObraModel.id)
         .where(AcessoObraModel.usuario_id == u.id, ObraModel.ativa.is_(True)).order_by(ObraModel.codigo))
    return [MinhaObraOut(**ObraOut.model_validate(o).model_dump(), papel=PapelObra(p), paginas=pg or None, paginas_mobile=pm or None,
                         cor=cores.get(o.id))
            for o, p, pg, pm in s.execute(q)]


@router.get("/eu")
def eu(u: UsuarioAtual = Depends(usuario_atual)):
    return {"id": u.id, "email": u.email, "superadmin": u.superadmin}


# ---- super admin: obras ------------------------------------------------------------------------
@router.get("/admin/obras", response_model=list[ObraAdminOut])
def todas(s: Session = Depends(get_session), _: UsuarioAtual = Depends(superadmin)):
    cont = dict(s.execute(select(AcessoObraModel.obra_id, func.count()).group_by(AcessoObraModel.obra_id)).all())
    return [ObraAdminOut(**ObraOut.model_validate(o).model_dump(), usuarios=cont.get(o.id, 0))
            for o in s.scalars(select(ObraModel).order_by(ObraModel.codigo))]


@router.post("/admin/obras", response_model=ObraOut, status_code=201)
def nova(d: ObraIn, s: Session = Depends(get_session), u: UsuarioAtual = Depends(superadmin)):
    return criar_obra(s, DadosObra(d.codigo, d.nome, d.contrato, d.cliente), u.id)


@router.put("/admin/obras/{obra_id}", response_model=ObraOut)
def editar(obra_id: int, d: ObraIn, s: Session = Depends(get_session), _: UsuarioAtual = Depends(superadmin)):
    o = s.get(ObraModel, obra_id)
    if o is None:
        raise NotFoundError("Obra", obra_id)
    DadosObra(d.codigo, d.nome, d.contrato, d.cliente)  # valida
    outra = s.scalar(select(ObraModel).where(ObraModel.codigo == d.codigo.strip().upper(), ObraModel.id != obra_id))
    if outra:
        raise DomainError(f"já existe obra com o código {d.codigo}", "codigo")
    o.codigo, o.nome, o.contrato, o.cliente, o.ativa = d.codigo.strip().upper(), d.nome.strip(), d.contrato, d.cliente, d.ativa
    s.flush()
    return o


@router.get("/admin/usuarios")
def usuarios(s: Session = Depends(get_session), _: UsuarioAtual = Depends(superadmin)):
    """Contas do auth-kit com as obras de cada uma."""
    contas = s.execute(text("SELECT id, email, roles, status, email_verified_at IS NOT NULL AS verificado, "
                            "mfa_enabled, created_at FROM auth_users ORDER BY email")).mappings().all()
    acessos = s.execute(select(AcessoObraModel.usuario_id, ObraModel.codigo, AcessoObraModel.papel)
                        .join(ObraModel, ObraModel.id == AcessoObraModel.obra_id)).all()
    por = {}
    for uid, cod, papel in acessos:
        por.setdefault(uid, []).append({"obra": cod, "papel": papel})
    import json
    return [{**dict(c), "roles": json.loads(c["roles"] or "[]"), "obras": por.get(c["id"], [])} for c in contas]


# ---- acessos (super admin ou admin da obra) -------------------------------------------------
def _admin_da_obra(s: Session, u: UsuarioAtual, obra_id: int) -> None:
    resolver_contexto(s, u, obra_id, PapelObra.ADMIN)


@router.get("/obras/{obra_id}/acessos", response_model=list[AcessoOut])
def acessos(obra_id: int, s: Session = Depends(get_session), u: UsuarioAtual = Depends(usuario_atual)):
    _admin_da_obra(s, u, obra_id)
    return s.scalars(select(AcessoObraModel).where(AcessoObraModel.obra_id == obra_id).order_by(AcessoObraModel.email)).all()


@router.post("/obras/{obra_id}/acessos", response_model=ConcederResp, status_code=201)
async def conceder(obra_id: int, d: AcessoIn, request: Request, s: Session = Depends(get_session),
                   u: UsuarioAtual = Depends(usuario_atual)):
    _admin_da_obra(s, u, obra_id)
    out = await conceder_acesso(s, _contas(request), obra_id,
                                ConcederIn(d.email, d.papel, d.cracha, d.senha_inicial), u.id, superadmin=u.superadmin)
    if d.paginas is not None:  # "Alterar" (papel/crachá/senha) não apaga as páginas liberadas
        out.acesso.paginas = _paginas(d.paginas)
    s.flush()
    return ConcederResp(acesso=AcessoOut.model_validate(out.acesso), conta_criada=out.conta_criada,
                        senha_redefinida=out.senha_redefinida)


def _paginas(paginas: list[str] | None, prefixo: str = "/app/") -> list[str] | None:
    """Lista de páginas (url do menu, ex.: /app/programacoes ou /m/lancar). Vazia = todas as do papel."""
    lista = sorted({p.strip() for p in (paginas or []) if p and p.strip().startswith(prefixo)})
    if len(lista) > 60:
        raise DomainError("páginas demais", "paginas")
    return lista or None


class PaginasIn(BaseModel):
    paginas: list[str] | None = None
    paginas_mobile: list[str] | None = None
    so_mobile: bool = False  # true: muda só as telas do celular (a lista do web fica como está)


@router.put("/obras/{obra_id}/acessos/{acesso_id}/paginas", response_model=AcessoOut)
def paginas(obra_id: int, acesso_id: int, d: PaginasIn, s: Session = Depends(get_session), u: UsuarioAtual = Depends(usuario_atual)):
    """Quais páginas a pessoa vê nesta obra (a programação vigente fica sempre aberta)."""
    _admin_da_obra(s, u, obra_id)
    a = s.get(AcessoObraModel, acesso_id)
    if a is None or a.obra_id != obra_id:
        raise NotFoundError("Acesso", acesso_id)
    if d.so_mobile:
        a.paginas_mobile = _paginas(d.paginas_mobile, "/m/")
    else:
        a.paginas = _paginas(d.paginas)
        if d.paginas_mobile is not None:
            a.paginas_mobile = _paginas(d.paginas_mobile, "/m/")
    s.flush()
    return a


@router.delete("/obras/{obra_id}/acessos/{acesso_id}", status_code=204)
def revogar(obra_id: int, acesso_id: int, s: Session = Depends(get_session), u: UsuarioAtual = Depends(usuario_atual)):
    _admin_da_obra(s, u, obra_id)
    a = s.get(AcessoObraModel, acesso_id)
    if a is None or a.obra_id != obra_id:
        raise NotFoundError("Acesso", acesso_id)
    if a.usuario_id == u.id:
        raise DomainError("você não pode remover o próprio acesso")
    s.delete(a)
