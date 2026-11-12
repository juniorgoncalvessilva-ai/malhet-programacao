from datetime import date, datetime

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, ler, negar
from app.core.db import get_session
from app.modules.obras.domain.obra import PapelObra
from app.modules.ssma.domain.cadastro import TIPOS_COM_ANEXO, ItemCadastro, TipoCadastro, validar_anexo
from app.modules.ssma.infra.models import AnexoSsmaModel, CadastroSsmaModel
from app.shared.errors import DomainError, NotFoundError

router = APIRouter(prefix="/ssma", tags=["SSMA: cadastros das listas suspensas"])


class CadastroIn(BaseModel):
    tipo: TipoCadastro
    codigo: str
    descricao: str | None = None
    validade: date | None = None
    ativo: bool = True


class AnexoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nome: str
    content_type: str
    tamanho: int
    enviado_por: str
    enviado_em: datetime


class CadastroOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    tipo: str
    codigo: str
    descricao: str | None
    validade: date | None
    ativo: bool
    em_uso: int = 0
    aceita_anexo: bool = False
    anexos: list[AnexoOut] = []


def _pode_editar(c: ContextoObra, tipo: TipoCadastro) -> None:
    if tipo.do_planejamento:
        if not c.papel.pode(PapelObra.PLANEJADOR):
            raise negar("o PTO é cadastrado pelo Planejamento")
    elif not c.papel.edita_ssma:
        raise negar("só a segurança (ou o planejamento) cadastra os itens de SSMA")


def _uso(s: Session, obra_id: int, m: CadastroSsmaModel) -> int:
    from app.modules.planejamento.infra.models import LinhaProgramacaoModel, ProgramacaoModel

    tipo = TipoCadastro(m.tipo)
    coluna = getattr(LinhaProgramacaoModel, tipo.campo_linha)
    cond = coluna == m.codigo if tipo is TipoCadastro.TECNICO else coluna.contains([m.codigo])  # lista (JSONB)
    return s.scalar(select(func.count()).select_from(LinhaProgramacaoModel)
                    .join(ProgramacaoModel, ProgramacaoModel.id == LinhaProgramacaoModel.programacao_id)
                    .where(ProgramacaoModel.obra_id == obra_id, cond)) or 0


def _out(s: Session, obra_id: int, m: CadastroSsmaModel) -> CadastroOut:
    o = CadastroOut.model_validate(m)
    o.em_uso = _uso(s, obra_id, m)
    o.aceita_anexo = TipoCadastro(m.tipo) in TIPOS_COM_ANEXO
    return o


def _obter(s: Session, c: ContextoObra, cid: int) -> CadastroSsmaModel:
    m = s.get(CadastroSsmaModel, cid)
    if m is None or m.obra_id != c.obra_id:
        raise NotFoundError("Cadastro", cid)
    return m


@router.get("/cadastros", response_model=list[CadastroOut])
def listar(tipo: TipoCadastro | None = None, q: str | None = None, s: Session = Depends(get_session),
           c: ContextoObra = Depends(ler)):
    stmt = select(CadastroSsmaModel).where(CadastroSsmaModel.obra_id == c.obra_id)
    if tipo:
        stmt = stmt.where(CadastroSsmaModel.tipo == tipo.value)
    if q:
        stmt = stmt.where(or_(CadastroSsmaModel.codigo.ilike(f"%{q}%"), CadastroSsmaModel.descricao.ilike(f"%{q}%")))
    out = []
    for m in s.scalars(stmt.order_by(CadastroSsmaModel.tipo, CadastroSsmaModel.codigo)):
        out.append(_out(s, c.obra_id, m))
    return out


def _duplicado(s: Session, obra_id: int, tipo: str, codigo: str, outro_id: int | None = None) -> None:
    q = select(CadastroSsmaModel).where(CadastroSsmaModel.obra_id == obra_id, CadastroSsmaModel.tipo == tipo,
                                        func.lower(CadastroSsmaModel.codigo) == codigo.lower())
    if outro_id:
        q = q.where(CadastroSsmaModel.id != outro_id)
    if s.scalar(q):
        raise DomainError(f"'{codigo}' já está cadastrado", "codigo")


@router.post("/cadastros", response_model=CadastroOut, status_code=201)
def criar(d: CadastroIn, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    _pode_editar(c, d.tipo)
    it = ItemCadastro(d.tipo, d.codigo, d.descricao, d.validade)
    _duplicado(s, c.obra_id, d.tipo.value, it.codigo)
    m = CadastroSsmaModel(obra_id=c.obra_id, tipo=d.tipo.value, codigo=it.codigo, descricao=it.descricao,
                          validade=it.validade, ativo=d.ativo)
    s.add(m)
    s.flush()
    return _out(s, c.obra_id, m)


@router.put("/cadastros/{cid}", response_model=CadastroOut)
def editar(cid: int, d: CadastroIn, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Renomear propaga para as linhas de programação que usam o item (o cadastro é a referência)."""
    from app.modules.planejamento.infra.models import LinhaProgramacaoModel, ProgramacaoModel

    m = _obter(s, c, cid)
    _pode_editar(c, TipoCadastro(m.tipo))
    if d.tipo.value != m.tipo:
        raise DomainError("não dá para mudar o tipo: cadastre de novo", "tipo")
    it = ItemCadastro(d.tipo, d.codigo, d.descricao, d.validade)
    _duplicado(s, c.obra_id, m.tipo, it.codigo, m.id)
    if it.codigo != m.codigo:
        tipo = TipoCadastro(m.tipo)
        attr = getattr(LinhaProgramacaoModel, tipo.campo_linha)
        ids = select(ProgramacaoModel.id).where(ProgramacaoModel.obra_id == c.obra_id, ProgramacaoModel.status == "rascunho")
        cond = attr == m.codigo if tipo is TipoCadastro.TECNICO else attr.contains([m.codigo])
        for ln in s.scalars(select(LinhaProgramacaoModel).where(LinhaProgramacaoModel.programacao_id.in_(ids), cond)):
            atual = getattr(ln, tipo.campo_linha)
            novo = it.codigo if tipo is TipoCadastro.TECNICO else [it.codigo if x == m.codigo else x for x in atual]
            setattr(ln, tipo.campo_linha, novo)
    m.codigo, m.descricao, m.validade, m.ativo = it.codigo, it.descricao, it.validade, d.ativo
    s.flush()
    return _out(s, c.obra_id, m)


@router.delete("/cadastros/{cid}", status_code=204)
def excluir(cid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    m = _obter(s, c, cid)
    _pode_editar(c, TipoCadastro(m.tipo))
    if _uso(s, c.obra_id, m):
        raise DomainError("item usado em programações: inative-o em vez de excluir")
    s.delete(m)


# ---- anexos (Excel, Word, PDF) --------------------------------------------------------------------------
@router.post("/cadastros/{cid}/anexos", response_model=AnexoOut, status_code=201)
async def anexar(cid: int, arquivo: UploadFile = File(...), s: Session = Depends(get_session),
                 c: ContextoObra = Depends(ler)):
    """Arquivo do documento (opcional, vários por item): RAC, PTS, ART, ATA e PTO."""
    m = _obter(s, c, cid)
    tipo = TipoCadastro(m.tipo)
    _pode_editar(c, tipo)
    from app.modules.ssma.domain.cadastro import LIMITE_ANEXO

    conteudo = await arquivo.read(LIMITE_ANEXO + 1)
    nome, ctype = validar_anexo(tipo, arquivo.filename or "", conteudo)
    a = AnexoSsmaModel(obra_id=c.obra_id, cadastro_id=m.id, nome=nome, content_type=ctype, tamanho=len(conteudo),
                       conteudo=conteudo, enviado_por=c.usuario.id)
    s.add(a)
    s.flush()
    s.refresh(a)
    return AnexoOut.model_validate(a)


def _anexo(s: Session, c: ContextoObra, aid: int) -> AnexoSsmaModel:
    a = s.get(AnexoSsmaModel, aid)
    if a is None or a.obra_id != c.obra_id:
        raise NotFoundError("Anexo", aid)
    return a


@router.get("/anexos/{aid}")
def baixar_anexo(aid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    from urllib.parse import quote

    a = _anexo(s, c, aid)
    ascii_ = a.nome.encode("ascii", "ignore").decode() or "arquivo"
    disp = f"attachment; filename=\"{ascii_}\"; filename*=UTF-8''{quote(a.nome)}"
    return Response(a.conteudo, media_type=a.content_type, headers={"Content-Disposition": disp})


@router.delete("/anexos/{aid}", status_code=204)
def excluir_anexo(aid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    a = _anexo(s, c, aid)
    m = s.get(CadastroSsmaModel, a.cadastro_id)
    _pode_editar(c, TipoCadastro(m.tipo))
    s.delete(a)


class TecnicosIn(BaseModel):
    colaboradores: list[int] = []  # pessoas do efetivo (time da segurança)
    equipe_id: int | None = None  # ou uma equipe cadastrada (equipe de segurança): entram o encarregado e os membros


@router.post("/tecnicos/importar")
def importar_tecnicos(d: TecnicosIn, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Alimenta a lista de Técnicos do SSMA com pessoas do efetivo ou com uma equipe inteira; quem já está fica."""
    from app.modules.efetivo.infra.models import ColaboradorModel
    from app.modules.equipes.infra.models import EquipeModel

    _pode_editar(c, TipoCadastro.TECNICO)
    pessoas: list[tuple[str, str | None]] = []  # (nome, descrição)
    if d.colaboradores:
        for p in s.scalars(select(ColaboradorModel).where(ColaboradorModel.obra_id == c.obra_id,
                                                          ColaboradorModel.id.in_(d.colaboradores))):
            pessoas.append((p.nome, " · ".join(x for x in (f"matrícula {p.matricula}" if p.matricula else None, p.funcao) if x) or None))
    if d.equipe_id is not None:
        e = s.get(EquipeModel, d.equipe_id)
        if e is None or e.obra_id != c.obra_id:
            raise NotFoundError("Equipe", d.equipe_id)
        if e.encarregado_nome:
            pessoas.append((e.encarregado_nome, f"encarregado da equipe {e.nome}"))
        for m in e.membros:
            if (m.nome or "").strip() and not m.nome.startswith("?"):
                pessoas.append((m.nome, " · ".join(x for x in (f"equipe {e.nome}", m.funcao) if x)))
    if not pessoas:
        raise DomainError("escolha pessoas do efetivo ou uma equipe", "colaboradores")
    existentes = {x.casefold() for x in s.scalars(select(CadastroSsmaModel.codigo).where(
        CadastroSsmaModel.obra_id == c.obra_id, CadastroSsmaModel.tipo == TipoCadastro.TECNICO.value))}
    novos = 0
    for nome, desc in pessoas:
        it = ItemCadastro(TipoCadastro.TECNICO, nome, desc, None)
        if it.codigo.casefold() in existentes:
            continue
        existentes.add(it.codigo.casefold())
        s.add(CadastroSsmaModel(obra_id=c.obra_id, tipo=TipoCadastro.TECNICO.value, codigo=it.codigo, descricao=it.descricao, ativo=True))
        novos += 1
    s.flush()
    return {"incluidos": novos, "ja_existiam": len(pessoas) - novos}
