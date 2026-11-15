"""Relatos de erro (spec 098): o app envia sozinho o que falhou; o super admin vê agrupado e marca resolvido."""
import time
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.auth import UsuarioAtual, superadmin, usuario_atual
from app.core.db import get_session
from app.modules.erros.application.registrar import registrar
from app.modules.erros.domain.relato import Limite, Relato, limpar
from app.modules.erros.infra.models import ErroGrupoModel, ErroRelatoModel
from app.modules.erros.infra.obras import obra_existe
from app.shared.errors import DomainError, NotFoundError

router = APIRouter(tags=["relatos de erro"])
POR_PESSOA = Limite(40, 60)  # por conta ou IP, por minuto
GERAL = Limite(1500, 3600)  # todos juntos, por hora: um laço de erro não enche o banco


async def usuario_opcional(request: Request) -> UsuarioAtual | None:
    """O erro pode acontecer antes do login (tela de acesso): sem conta, o relato vai anônimo."""
    try:
        return await usuario_atual(request)
    except HTTPException:
        return None


def _ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    return fwd.split(",")[0].strip() or (request.client.host if request.client else "?")


def _obra(request: Request) -> int | None:
    bruto = request.headers.get("x-obra-id", "")
    return int(bruto) if bruto.isdigit() else None


class RelatoIn(BaseModel):
    id_local: str
    origem: str = "web"
    tipo: str = "js"
    mensagem: str | None = None
    local: str | None = None
    acao: str | None = None
    status: int | None = None
    pilha: str | None = None
    comentario: str | None = None
    versao: str | None = None


class LoteIn(BaseModel):
    relatos: list[RelatoIn] = Field(max_length=20)


@router.post("/erros")
def receber(d: LoteIn, request: Request, s: Session = Depends(get_session),
            u: UsuarioAtual | None = Depends(usuario_opcional)):
    """Aceita até 20 relatos de uma vez (a fila do aparelho manda o que guardou sem internet)."""
    agora, chave = time.monotonic(), (u.id if u else f"ip:{_ip(request)}")
    ua, obra = request.headers.get("user-agent"), _obra(request)
    codigos, recusados = [], 0
    for r in d.relatos:
        if not (POR_PESSOA.permite(chave, agora) and GERAL.permite("*", agora)):
            recusados += 1
            continue
        try:
            rel = Relato.de_entrada(**r.model_dump(), navegador=ua)
        except DomainError:
            recusados += 1
            continue
        m = registrar(s, rel, usuario_id=u.id if u else None, usuario_email=u.email if u else None, obra_id=obra,
                      obra_existe=obra_existe)
        codigos.append(m.codigo)
    return {"codigos": codigos, "recusados": recusados}


class ComentarioIn(BaseModel):
    id_local: str
    comentario: str


@router.post("/erros/comentario")
def comentar(d: ComentarioIn, s: Session = Depends(get_session), _: UsuarioAtual | None = Depends(usuario_opcional)):
    """"O que você estava fazendo?" — a pessoa completa um relato que o app já enviou (pelo id do aparelho)."""
    m = s.scalar(select(ErroRelatoModel).where(ErroRelatoModel.id_local == d.id_local.strip()))
    if m is None:
        raise NotFoundError("relato", d.id_local)
    texto = limpar(d.comentario, 1000)
    if not texto:
        raise DomainError("escreva o que você estava fazendo", "comentario")
    m.comentario = texto
    return {"codigo": m.codigo}


def _situacao(g: ErroGrupoModel | None, ultimo: datetime) -> str:
    if g is None or g.resolvido_em is None:
        return "aberto"
    return "voltou" if ultimo > g.resolvido_em else "resolvido"


@router.get("/erros")
def grupos(situacao: str = "abertos", origem: str | None = None, busca: str | None = None,
           s: Session = Depends(get_session), _: UsuarioAtual = Depends(superadmin)):
    """Erros agrupados (iguais juntos), do mais recente para o mais antigo, com quantas vezes e quantas pessoas."""
    E = ErroRelatoModel
    q = (select(E.grupo, func.count(E.id), func.count(func.distinct(E.usuario_id)), func.count(func.distinct(E.obra_id)),
                func.min(E.ocorrido_em), func.max(E.ocorrido_em), func.max(E.id),
                func.count(func.nullif(E.comentario, "")))
         .group_by(E.grupo).order_by(func.max(E.ocorrido_em).desc()))
    if origem:
        q = q.where(E.origem == origem)
    if busca:
        termo = f"%{busca.strip()}%"
        q = q.where(E.mensagem.ilike(termo) | E.local.ilike(termo) | E.acao.ilike(termo) | E.codigo.ilike(termo)
                    | E.comentario.ilike(termo))
    linhas = s.execute(q.limit(500)).all()
    estado = {g.grupo: g for g in s.scalars(select(ErroGrupoModel).where(ErroGrupoModel.grupo.in_([r[0] for r in linhas])))}
    ultimos = {m.id: m for m in s.scalars(select(E).where(E.id.in_([r[6] for r in linhas])))}
    limite_24h = datetime.now(timezone.utc) - timedelta(hours=24)
    out, abertos, recentes = [], 0, 0
    for grupo, n, pessoas, obras, primeiro, ultimo, ultimo_id, comentarios in linhas:
        sit = _situacao(estado.get(grupo), ultimo)
        abertos += sit != "resolvido"
        recentes += ultimo >= limite_24h
        if situacao == "abertos" and sit == "resolvido" or situacao == "resolvidos" and sit != "resolvido":
            continue
        m, g = ultimos[ultimo_id], estado.get(grupo)
        out.append({"grupo": grupo, "situacao": sit, "ocorrencias": n, "pessoas": pessoas, "obras": obras,
                    "comentarios": comentarios, "primeiro": primeiro, "ultimo": ultimo, "codigo": m.codigo,
                    "origem": m.origem, "tipo": m.tipo, "mensagem": m.mensagem, "local": m.local, "acao": m.acao,
                    "status": m.status, "nota": g.nota if g else None, "resolvido_por": g.resolvido_por if g else None})
    return {"grupos": out, "resumo": {"abertos": abertos, "ultimas_24h": recentes, "grupos": len(linhas)}}


@router.get("/erros/resumo")
def resumo(s: Session = Depends(get_session), _: UsuarioAtual = Depends(superadmin)):
    """Quantos grupos estão abertos (para o aviso no menu do super admin)."""
    E = ErroRelatoModel
    ultimos = s.execute(select(E.grupo, func.max(E.ocorrido_em)).group_by(E.grupo)).all()
    estado = {g.grupo: g for g in s.scalars(select(ErroGrupoModel))}
    return {"abertos": sum(_situacao(estado.get(g), u) != "resolvido" for g, u in ultimos)}


@router.get("/erros/grupos/{grupo}")
def detalhe(grupo: str, s: Session = Depends(get_session), _: UsuarioAtual = Depends(superadmin)):
    from app.modules.obras.infra.models import ObraModel

    E = ErroRelatoModel
    itens = list(s.scalars(select(E).where(E.grupo == grupo).order_by(E.ocorrido_em.desc()).limit(50)))
    if not itens:
        raise NotFoundError("grupo de erros", grupo)
    nomes = {o.id: f"{o.codigo} · {o.nome}" for o in s.scalars(select(ObraModel).where(ObraModel.id.in_({m.obra_id for m in itens if m.obra_id})))}
    g = s.get(ErroGrupoModel, grupo)
    return {
        "grupo": grupo, "situacao": _situacao(g, itens[0].ocorrido_em), "nota": g.nota if g else None,
        "resolvido_em": g.resolvido_em if g else None, "resolvido_por": g.resolvido_por if g else None,
        "ocorrencias": [{"codigo": m.codigo, "ocorrido_em": m.ocorrido_em, "origem": m.origem, "tipo": m.tipo,
                         "mensagem": m.mensagem, "local": m.local, "acao": m.acao, "status": m.status, "pilha": m.pilha,
                         "comentario": m.comentario, "versao": m.versao, "navegador": m.navegador,
                         "obra": nomes.get(m.obra_id) if m.obra_id else None, "usuario": m.usuario_email} for m in itens],
    }


class ResolverIn(BaseModel):
    nota: str | None = None


@router.put("/erros/grupos/{grupo}/resolver")
def resolver(grupo: str, d: ResolverIn, s: Session = Depends(get_session), u: UsuarioAtual = Depends(superadmin)):
    if s.scalar(select(ErroRelatoModel.id).where(ErroRelatoModel.grupo == grupo).limit(1)) is None:
        raise NotFoundError("grupo de erros", grupo)
    g = s.get(ErroGrupoModel, grupo) or ErroGrupoModel(grupo=grupo)
    g.resolvido_em, g.resolvido_por, g.nota = datetime.now(timezone.utc), u.email or u.id, limpar(d.nota, 500) or None
    s.add(g)
    return {"grupo": grupo, "situacao": "resolvido"}


@router.delete("/erros/grupos/{grupo}/resolver")
def reabrir(grupo: str, s: Session = Depends(get_session), _: UsuarioAtual = Depends(superadmin)):
    g = s.get(ErroGrupoModel, grupo)
    if g is not None:
        g.resolvido_em = None
    return {"grupo": grupo, "situacao": "aberto"}
