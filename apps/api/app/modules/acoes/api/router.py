"""Ações 5W2H (spec 064): quadro, reunião das frentes, programação das ações e geração a partir das ocorrências e
restrições pendentes."""
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, ler, negar
from app.core.db import get_session
from app.modules.acoes.application import servico as sv
from app.modules.acoes.infra.models import AcaoModel
from app.modules.campo.api.fotos import fotos_de
from app.modules.obras.domain.obra import PapelObra
from app.shared.errors import DomainError, NotFoundError

router = APIRouter(prefix="/acoes", tags=["ações 5W2H"])


async def agir(c: ContextoObra = Depends(ler)) -> ContextoObra:
    """Criar e mexer nas ações: encarregado para cima e a segurança."""
    if not (c.papel.pode(PapelObra.ENCARREGADO) or c.papel == PapelObra.SEGURANCA):
        raise negar("seu papel só consulta as ações")
    return c


class AcaoIn(BaseModel):
    o_que: str
    por_que: str | None = None
    onde: str | None = None
    area_id: int | None = None
    quando: date | None = None
    data_execucao: date | None = None
    quem: str | None = None
    como: str | None = None
    quanto: str | None = None
    acompanhamento: str | None = None


def _lista(s: Session, obra_id: int, acoes: list[AcaoModel]) -> list[dict]:
    fotos = fotos_de(s, obra_id, "acao", [a.id for a in acoes])
    return [sv.saida(a, fotos.get(a.id, [])) for a in acoes]


@router.get("")
def listar(status: str | None = None, area_id: int | None = None, origem: str | None = None, de: date | None = None,
           ate: date | None = None, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    q = select(AcaoModel).where(AcaoModel.obra_id == c.obra_id)
    if status:
        q = q.where(AcaoModel.status.in_(status.split(",")))
    if area_id:
        q = q.where(AcaoModel.area_id == area_id)
    if origem:
        q = q.where(AcaoModel.origem == origem)
    if de:
        q = q.where((AcaoModel.data_execucao >= de) | (AcaoModel.data_execucao.is_(None) & (AcaoModel.quando >= de)))
    if ate:
        q = q.where((AcaoModel.data_execucao <= ate) | (AcaoModel.data_execucao.is_(None) & (AcaoModel.quando <= ate)))
    return _lista(s, c.obra_id, list(s.scalars(q.order_by(AcaoModel.quando.nulls_last(), AcaoModel.numero))))


@router.post("", status_code=201)
def criar(d: AcaoIn, s: Session = Depends(get_session), c: ContextoObra = Depends(agir)):
    a = sv.criar(s, c.obra_id, c.usuario.id, d.model_dump(), origem="reuniao" if d.acompanhamento == "reuniao" else "manual")
    return sv.saida(a, [])


@router.put("/{aid}")
def editar(aid: int, d: AcaoIn, s: Session = Depends(get_session), c: ContextoObra = Depends(agir)):
    a = sv.editar(s, sv.obter(s, c.obra_id, aid), c.usuario.id, d.model_dump())
    return _lista(s, c.obra_id, [a])[0]


class EventoIn(BaseModel):
    evento: str  # andamento | concluir | verificar | cancelar
    texto: str | None = None
    eficaz: bool | None = None


@router.post("/{aid}/evento")
def evento(aid: int, d: EventoIn, s: Session = Depends(get_session), c: ContextoObra = Depends(agir)):
    a = sv.obter(s, c.obra_id, aid)
    tem = bool(fotos_de(s, c.obra_id, "acao", [a.id]).get(a.id))
    if d.evento == "verificar" and d.eficaz is None:
        raise DomainError("diga se a ação foi eficaz", "eficaz")
    sv.mudar(s, a, c.usuario.id, d.evento, d.texto, d.eficaz, tem_evidencia=tem)
    return _lista(s, c.obra_id, [a])[0]


@router.get("/candidatas")
def candidatas(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Ocorrências e restrições ainda abertas que não viraram ação — para a reunião gerar as ações."""
    from app.modules.indicadores.infra.models import CausaDesvioModel, DesvioModel
    from app.modules.restricoes.infra.models import AcaoRestricaoModel

    ja = {(o, i) for o, i in s.execute(select(AcaoModel.origem, AcaoModel.origem_id).where(AcaoModel.obra_id == c.obra_id))}
    causas = {x.id: x.descricao for x in s.scalars(select(CausaDesvioModel).where(CausaDesvioModel.obra_id == c.obra_id))}
    oc = [{"origem": "ocorrencia", "id": d.id, "data": d.data.isoformat(), "titulo": d.descricao, "causa": causas.get(d.causa_id),
           "frente": d.frente, "atividade": d.atividade_impactada, "acao": d.acao, "responsavel": d.responsavel}
          for d in s.scalars(select(DesvioModel).where(DesvioModel.obra_id == c.obra_id, DesvioModel.status != 3)
                             .order_by(DesvioModel.data.desc())) if ("ocorrencia", d.id) not in ja]
    rs = [{"origem": "restricao", "id": r.id, "data": (r.prazo_termino or r.prazo_inicio or date.today()).isoformat(),
           "titulo": f"Restrição Nº {r.numero} · {r.acao}", "causa": r.seis_m, "frente": r.area_texto, "atividade": r.atividade,
           "acao": r.acao, "responsavel": r.responsavel}
          for r in s.scalars(select(AcaoRestricaoModel).where(AcaoRestricaoModel.obra_id == c.obra_id, AcaoRestricaoModel.status1 == "Pendente")
                             .order_by(AcaoRestricaoModel.numero)) if ("restricao", r.id) not in ja]
    return oc + rs


class OrigemIn(BaseModel):
    origem: str  # ocorrencia | restricao
    origem_id: int
    quem: str | None = None
    quando: date | None = None


@router.post("/de-origem", status_code=201)
def de_origem(d: OrigemIn, s: Session = Depends(get_session), c: ContextoObra = Depends(agir)):
    """Ação 5W2H já preenchida a partir de uma ocorrência (desvio do Pareto) ou de uma restrição do 6WLA."""
    if s.scalar(select(AcaoModel.id).where(AcaoModel.obra_id == c.obra_id, AcaoModel.origem == d.origem, AcaoModel.origem_id == d.origem_id)):
        raise DomainError("esta origem já tem ação")
    if d.origem == "ocorrencia":
        from app.modules.indicadores.infra.models import CausaDesvioModel, DesvioModel

        x = s.get(DesvioModel, d.origem_id)
        if x is None or x.obra_id != c.obra_id:
            raise NotFoundError("Ocorrência", d.origem_id)
        causa = s.get(CausaDesvioModel, x.causa_id)
        dados = {"o_que": x.acao or f"Tratar: {x.descricao}", "por_que": f"{causa.descricao if causa else 'Ocorrência'}: {x.descricao}",
                 "onde": x.frente, "area_id": x.area_id, "quem": d.quem or x.responsavel, "quando": d.quando or (x.data + timedelta(days=7))}
        texto = f"Ocorrência de {x.data:%d/%m}"
    elif d.origem == "restricao":
        from app.modules.restricoes.infra.models import AcaoRestricaoModel

        x = s.get(AcaoRestricaoModel, d.origem_id)
        if x is None or x.obra_id != c.obra_id:
            raise NotFoundError("Restrição", d.origem_id)
        dados = {"o_que": x.acao, "por_que": f"Restrição Nº {x.numero}{' (impeditiva)' if x.impeditivo else ''}", "onde": x.area_texto,
                 "area_id": x.area_id, "quem": d.quem or x.responsavel, "quando": d.quando or x.prazo_termino or (date.today() + timedelta(days=7))}
        texto = f"Restrição Nº {x.numero}"
    else:
        raise DomainError("origem: ocorrencia ou restricao")
    a = sv.criar(s, c.obra_id, c.usuario.id, dados, d.origem, d.origem_id, texto)
    return sv.saida(a, [])
