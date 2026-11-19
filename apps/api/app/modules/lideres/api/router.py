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


# ---- portal (público, pelo link) -----------------------------------------------------------------------------
def _ip(request: Request) -> str:
    return (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "") or "?").split(",")[0].strip()


@publico.get("/{codigo}")
def info(codigo: str, s: Session = Depends(get_session)):
    """Nome da obra e a marca da empresa (spec 113): o link abre com a cor e a logo da contratada, não do Malhet."""
    from app.modules.obras.infra.models import MarcaObraModel, ObraModel

    p = pt.portal(s, codigo)
    obra = s.get(ObraModel, p.obra_id)
    m = s.get(MarcaObraModel, p.obra_id)
    logos = [q for q in ("contratada", "contratante") if m is not None and getattr(m, f"tipo_{q}")]
    return {"obra": obra.nome if obra else "",
            "marca": {"cor": m.cor if m else None, "contratada": m.nome_contratada if m else None,
                      "contratante": m.nome_contratante if m else None, "logos": logos,
                      "versao": int(m.atualizado_em.timestamp()) if m and m.atualizado_em else 0}}


@publico.get("/{codigo}/logo/{qual}")
def logo(codigo: str, qual: str, s: Session = Depends(get_session)):
    """Logo da contratada/contratante pelo link (sem login): é a identidade da empresa na tela do encarregado."""
    from fastapi import Response

    from app.modules.obras.infra.models import MarcaObraModel
    from app.shared.errors import NotFoundError

    if qual not in ("contratada", "contratante"):
        raise NotFoundError("logo", qual)
    p = pt.portal(s, codigo)
    m = s.get(MarcaObraModel, p.obra_id)
    tipo = getattr(m, f"tipo_{qual}") if m else None
    if not tipo:
        raise NotFoundError("logo", qual)
    return Response(getattr(m, f"logo_{qual}"), media_type=tipo, headers={"Cache-Control": "public, max-age=3600"})


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


class PedidoIn(BaseModel):
    disciplina: str = Field(max_length=60)
    membros: list[str] = Field(max_length=200)  # matrículas/crachás
    observacao: str | None = Field(None, max_length=500)


@publico.post("/{codigo}/pedidos")
def pedir(codigo: str, d: PedidoIn, s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    """Reivindicar equipe (spec 114): fica pendente até o Planejamento/administrador aprovar."""
    r = pt.pedir_equipe(s, codigo, x_portal_token, d.disciplina, d.membros, d.observacao)
    mudancas.registrar(str(pt.portal(s, codigo).obra_id))
    return r


@publico.delete("/{codigo}/pedidos/{pid}", status_code=204)
def cancelar(codigo: str, pid: int, s: Session = Depends(get_session), x_portal_token: str | None = Header(None)):
    pt.cancelar_pedido(s, codigo, x_portal_token, pid)
