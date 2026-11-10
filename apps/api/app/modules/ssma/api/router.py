from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, ler, negar
from app.core.db import get_session
from app.modules.obras.domain.obra import PapelObra
from app.modules.ssma.domain.cadastro import ItemCadastro, TipoCadastro
from app.modules.ssma.infra.models import CadastroSsmaModel
from app.shared.errors import DomainError, NotFoundError

router = APIRouter(prefix="/ssma", tags=["SSMA: cadastros das listas suspensas"])


class CadastroIn(BaseModel):
    tipo: TipoCadastro
    codigo: str
    descricao: str | None = None
    validade: date | None = None
    ativo: bool = True


class CadastroOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    tipo: str
    codigo: str
    descricao: str | None
    validade: date | None
    ativo: bool
    em_uso: int = 0


def _pode_editar(c: ContextoObra, tipo: TipoCadastro) -> None:
    if tipo.do_planejamento:
        if not c.papel.pode(PapelObra.PLANEJADOR):
            raise negar("o PTO é cadastrado pelo Planejamento")
    elif not c.papel.edita_ssma:
        raise negar("só a segurança (ou o planejamento) cadastra os itens de SSMA")


def _uso(s: Session, obra_id: int, m: CadastroSsmaModel) -> int:
    from app.modules.planejamento.infra.models import LinhaProgramacaoModel, ProgramacaoModel

    coluna = getattr(LinhaProgramacaoModel, TipoCadastro(m.tipo).campo_linha)
    return s.scalar(select(func.count()).select_from(LinhaProgramacaoModel)
                    .join(ProgramacaoModel, ProgramacaoModel.id == LinhaProgramacaoModel.programacao_id)
                    .where(ProgramacaoModel.obra_id == obra_id, coluna == m.codigo)) or 0


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
        o = CadastroOut.model_validate(m)
        o.em_uso = _uso(s, c.obra_id, m)
        out.append(o)
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
    return CadastroOut.model_validate(m)


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
        coluna = TipoCadastro(m.tipo).campo_linha
        ids = select(ProgramacaoModel.id).where(ProgramacaoModel.obra_id == c.obra_id, ProgramacaoModel.status == "rascunho")
        for ln in s.scalars(select(LinhaProgramacaoModel).where(LinhaProgramacaoModel.programacao_id.in_(ids),
                                                                getattr(LinhaProgramacaoModel, coluna) == m.codigo)):
            setattr(ln, coluna, it.codigo)
    m.codigo, m.descricao, m.validade, m.ativo = it.codigo, it.descricao, it.validade, d.ativo
    s.flush()
    o = CadastroOut.model_validate(m)
    o.em_uso = _uso(s, c.obra_id, m)
    return o


@router.delete("/cadastros/{cid}", status_code=204)
def excluir(cid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    m = _obter(s, c, cid)
    _pode_editar(c, TipoCadastro(m.tipo))
    if _uso(s, c.obra_id, m):
        raise DomainError("item usado em programações: inative-o em vez de excluir")
    s.delete(m)
