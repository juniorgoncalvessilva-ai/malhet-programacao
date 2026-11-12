"""Desvios (Pareto semanal): causas da obra, motivo de cada item não cumprido, importação e exportação."""
from datetime import date

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, ler, planejar, programar
from app.core.db import get_session
from app.modules.frentes.infra.models import AreaFrenteModel
from app.modules.indicadores.application import desvios as app_
from app.modules.indicadores.domain.causas import STATUS
from app.modules.indicadores.domain.pareto import nao_cumpridas
from app.modules.indicadores.infra.models import CausaDesvioModel, DesvioModel
from app.modules.planejamento.application import servico as prog
from app.modules.planejamento.domain.periodo import numero_semana
from app.shared.errors import DomainError, NotFoundError

router = APIRouter(prefix="/desvios", tags=["desvios (Pareto)"])
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


class CausaIn(BaseModel):
    descricao: str
    ativo: bool = True


class DesvioIn(BaseModel):
    data: date
    causa_id: int
    descricao: str
    programacao_id: int | None = None
    linha_id: int | None = None
    referencia: str | None = None
    frente: str | None = None
    area_id: int | None = None
    acao: str | None = None
    responsavel: str | None = None
    gerencia: str | None = None
    status: int = 1
    atividade_impactada: str | None = None
    qtd_nao_cumprida: float | None = None


def _causa_out(c: CausaDesvioModel) -> dict:
    return {"id": c.id, "numero": c.numero, "descricao": c.descricao, "ativo": c.ativo}


def _out(d: DesvioModel, nomes: dict[int, str]) -> dict:
    return {"id": d.id, "data": d.data.isoformat(), "semana": d.semana, "programacao_id": d.programacao_id,
            "linha_id": d.linha_id, "causa_id": d.causa_id, "causa": nomes.get(d.causa_id), "referencia": d.referencia,
            "descricao": d.descricao, "frente": d.frente, "area_id": d.area_id, "acao": d.acao,
            "responsavel": d.responsavel, "gerencia": d.gerencia, "status": d.status, "status_nome": STATUS.get(d.status),
            "atividade_impactada": d.atividade_impactada, "qtd_nao_cumprida": d.qtd_nao_cumprida, "origem": d.origem}


def _nomes(s: Session, obra_id: int) -> dict[int, str]:
    return {c.id: c.descricao for c in app_.causas(s, obra_id)}


@router.get("/causas")
def listar_causas(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    return [_causa_out(x) for x in app_.causas(s, c.obra_id)]


@router.post("/causas", status_code=201)
def nova_causa(d: CausaIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    t = " ".join(d.descricao.split())
    if len(t) < 3:
        raise DomainError("descreva a causa", "descricao")
    if app_.causa_por_texto(s, c.obra_id, t, criar=False):
        raise DomainError(f"a causa \"{t}\" já existe", "descricao")
    return _causa_out(app_.causa_por_texto(s, c.obra_id, t, criar=True))


@router.put("/causas/{cid}")
def editar_causa(cid: int, d: CausaIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    x = s.get(CausaDesvioModel, cid)
    if x is None or x.obra_id != c.obra_id:
        raise NotFoundError("Causa", cid)
    t = " ".join(d.descricao.split())
    if len(t) < 3:
        raise DomainError("descreva a causa", "descricao")
    outra = app_.causa_por_texto(s, c.obra_id, t, criar=False)
    if outra is not None and outra.id != x.id:
        raise DomainError(f"a causa \"{t}\" já existe", "descricao")
    x.descricao, x.ativo = t[:150], d.ativo
    s.flush()
    return _causa_out(x)


@router.get("")
def listar(de: date | None = None, ate: date | None = None, programacao_id: int | None = None,
           causa_id: int | None = None, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    q = select(DesvioModel).where(DesvioModel.obra_id == c.obra_id)
    if de:
        q = q.where(DesvioModel.data >= de)
    if ate:
        q = q.where(DesvioModel.data <= ate)
    if programacao_id:
        q = q.where(DesvioModel.programacao_id == programacao_id)
    if causa_id:
        q = q.where(DesvioModel.causa_id == causa_id)
    nomes = _nomes(s, c.obra_id)
    return [_out(d, nomes) for d in s.scalars(q.order_by(DesvioModel.data.desc(), DesvioModel.id.desc()))]


@router.get("/programacao/{pid}")
def da_programacao(pid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Itens não cumpridos da programação (previsto > realizado) e os desvios já registrados para cada um."""
    p = prog.obter(s, c.obra_id, pid)
    foto = prog.visao(s, p)
    nomes = _nomes(s, c.obra_id)
    regs = list(s.scalars(select(DesvioModel).where(DesvioModel.obra_id == c.obra_id, DesvioModel.programacao_id == pid)
                          .order_by(DesvioModel.data, DesvioModel.id)))
    itens = [{"linha_id": x.linha_id, "n": x.n, "codigo_simova": x.codigo_simova, "descricao": x.descricao,
              "area": x.area, "previsto": x.previsto, "realizado": x.realizado, "falta": x.falta,
              "desvios": [_out(d, nomes) for d in regs if d.linha_id == x.linha_id]} for x in nao_cumpridas(foto)]
    return {"status": p.status, "itens": itens, "sem_causa": sum(1 for i in itens if not i["desvios"]),
            "outros": [_out(d, nomes) for d in regs if d.linha_id not in {i["linha_id"] for i in itens}]}


def _validar(s: Session, c: ContextoObra, d: DesvioIn, atual: DesvioModel | None) -> DesvioModel:
    causa = s.get(CausaDesvioModel, d.causa_id)
    if causa is None or causa.obra_id != c.obra_id:
        raise DomainError("escolha a classificação (causa)", "causa_id")
    desc = " ".join((d.descricao or "").split())
    if len(desc) < 3:
        raise DomainError("descreva o desvio", "descricao")
    if d.status not in STATUS:
        raise DomainError("status: 1 pendente, 2 em andamento ou 3 concluído", "status")
    for pid in {d.programacao_id, atual.programacao_id if atual else None} - {None}:
        p = prog.obter(s, c.obra_id, pid)
        prog.exigir_aberta(p)  # desvio de programação concluída só muda por revisão
    if d.linha_id is not None:
        if d.programacao_id is None:
            raise DomainError("item sem programação", "linha_id")
        p = prog.obter(s, c.obra_id, d.programacao_id)
        ln = next((x for x in p.linhas if x.id == d.linha_id), None)
        if ln is None:
            raise NotFoundError("Linha", d.linha_id)
        if not (p.inicio <= d.data <= p.fim):
            raise DomainError(f"o dia do desvio deve estar no período da programação ({p.inicio:%d/%m} a {p.fim:%d/%m})", "data")
    if d.area_id is not None:
        a = s.get(AreaFrenteModel, d.area_id)
        if a is None or a.obra_id != c.obra_id:
            raise DomainError("área inválida", "area_id")
    x = atual or DesvioModel(obra_id=c.obra_id, origem="app", criado_por=c.usuario.id)
    x.data, x.semana, x.causa_id, x.descricao = d.data, numero_semana(d.data), causa.id, desc[:500]
    x.programacao_id, x.linha_id, x.area_id = d.programacao_id, d.linha_id, d.area_id
    for campo, tam in (("referencia", 80), ("frente", 200), ("acao", 500), ("responsavel", 150), ("gerencia", 80),
                       ("atividade_impactada", 300)):
        v = " ".join((getattr(d, campo) or "").split())
        setattr(x, campo, v[:tam] or None)
    x.status = d.status
    if d.qtd_nao_cumprida is not None and d.qtd_nao_cumprida < 0:
        raise DomainError("quantidade não cumprida não pode ser negativa", "qtd_nao_cumprida")
    x.qtd_nao_cumprida = d.qtd_nao_cumprida
    return x


@router.post("", status_code=201)
def novo(d: DesvioIn, s: Session = Depends(get_session), c: ContextoObra = Depends(programar)):
    x = _validar(s, c, d, None)
    s.add(x)
    s.flush()
    return _out(x, _nomes(s, c.obra_id))


def _desvio(s: Session, c: ContextoObra, did: int) -> DesvioModel:
    x = s.get(DesvioModel, did)
    if x is None or x.obra_id != c.obra_id:
        raise NotFoundError("Desvio", did)
    return x


@router.put("/{did}")
def editar(did: int, d: DesvioIn, s: Session = Depends(get_session), c: ContextoObra = Depends(programar)):
    x = _validar(s, c, d, _desvio(s, c, did))
    s.flush()
    return _out(x, _nomes(s, c.obra_id))


@router.delete("/{did}", status_code=204)
def excluir(did: int, s: Session = Depends(get_session), c: ContextoObra = Depends(programar)):
    x = _desvio(s, c, did)
    if x.programacao_id:
        prog.exigir_aberta(prog.obter(s, c.obra_id, x.programacao_id))
    s.delete(x)


@router.post("/importar")
def importar(arquivo: UploadFile = File(...), s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Planilha "Pareto semanal de desvios" (.xlsx), aba Detalhamento."""
    return app_.importar_pareto(s, c.obra_id, arquivo.file.read(), c.usuario.id)


@router.get("/excel")
def excel(de: date | None = None, ate: date | None = None, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    q = select(DesvioModel).where(DesvioModel.obra_id == c.obra_id)
    if de:
        q = q.where(DesvioModel.data >= de)
    if ate:
        q = q.where(DesvioModel.data <= ate)
    from app.modules.obras.infra.models import ObraModel

    obra = s.get(ObraModel, c.obra_id)
    conteudo = app_.exportar_pareto(s, c.obra_id, list(s.scalars(q)), obra.nome if obra else "")
    return Response(conteudo, media_type=XLSX, headers={"Content-Disposition": 'attachment; filename="Pareto_desvios.xlsx"'})
