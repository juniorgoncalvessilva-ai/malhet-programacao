from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from fastapi import HTTPException

from app.core.auth import ContextoObra, UsuarioAtual, ler, planejar, programar, usuario_atual
from app.modules.obras.domain.obra import PapelObra
from app.core.db import get_session
from app.modules.programacao.application.use_cases import (
    AprovarItem,
    CriarItemIn,
    CriarItemProgramacao,
    DiaIn,
    ExcluirItem,
)
from app.modules.programacao.domain import capacidade
from app.modules.programacao.domain.calendario import Calendario, TipoProgramacao
from app.modules.programacao.domain.item_programacao import ItemProgramacao
from app.modules.programacao.domain.sequenciador import AtividadeSeq, Predecessora, TipoLigacao, sequenciar
from app.modules.programacao.infra.catalogo_gateway import SqlCatalogoGateway
from app.modules.programacao.infra.repository import SqlProgramacaoRepository

router = APIRouter(prefix="/programacao", tags=["programação"])


class DiaSchema(BaseModel):
    data: date
    pe: float | None = Field(None, ge=0)
    hh: float | None = Field(None, ge=0)


class ItemIn(BaseModel):
    encarregado_cracha: str
    encarregado_nome: str
    grupo_codigo: str
    oper_codigo: str
    frente_codigo: str
    data_inicio: date
    data_fim: date
    dias: list[DiaSchema]
    tarefa_codigo: str | None = None
    observacao: str | None = None
    vinculo_id: int | None = None
    permitir_excesso: bool = False


class ItemOut(BaseModel):
    id: int | None
    encarregado_cracha: str
    encarregado_nome: str
    grupo_codigo: str
    grupo_descricao: str
    oper_codigo: str
    oper_descricao: str
    frente_codigo: str
    tarefa_codigo: str | None
    observacao: str | None
    data_inicio: date
    data_fim: date
    origem: str
    status: str
    indice_hh_por_unidade: float | None
    vinculo_id: int | None
    id_crono: str | None
    item_pq: str | None
    composicao: str | None
    versoes: dict[str, int]
    dias: list[DiaSchema]

    @classmethod
    def de(cls, i: ItemProgramacao) -> "ItemOut":
        return cls(**{k: getattr(i, k) for k in cls.model_fields if k != "dias"},
                   dias=[DiaSchema(data=d.data, pe=d.pe, hh=d.hh) for d in i.dias])


class OcupacaoOut(BaseModel):
    data: date
    hh_disponivel: float
    hh_programado: float
    saldo: float
    excedido: bool


class CriarOut(BaseModel):
    item: ItemOut
    hh_disponivel_dia: float
    ocupacao: list[OcupacaoOut]
    avisos: list[str]


def _ocup(o: capacidade.OcupacaoDia) -> OcupacaoOut:
    return OcupacaoOut(data=o.data, hh_disponivel=o.hh_disponivel, hh_programado=o.hh_programado,
                       saldo=o.saldo, excedido=o.excedido)


@router.get("/itens", response_model=list[ItemOut])
def listar(inicio: date, fim: date, status: str | None = None, s: Session = Depends(get_session),
           c: ContextoObra = Depends(ler)):
    return [ItemOut.de(i) for i in SqlProgramacaoRepository(s, c.obra_id).do_periodo(inicio, fim, status)]


def _so_a_propria_equipe(c: ContextoObra, cracha: str) -> None:
    """Encarregado programa só a própria equipe (crachá do acesso)."""
    if c.papel == PapelObra.ENCARREGADO and cracha != (c.cracha or ""):
        raise HTTPException(403, detail={"ok": False, "message": "Encarregado só programa a própria equipe",
                                         "detail": "Encarregado só programa a própria equipe"})


@router.post("/itens", response_model=CriarOut, status_code=201)
def criar(d: ItemIn, s: Session = Depends(get_session), c: ContextoObra = Depends(programar)):
    _so_a_propria_equipe(c, d.encarregado_cracha)
    dados = CriarItemIn(**d.model_dump(exclude={"dias"}), dias=[DiaIn(x.data, x.pe, x.hh) for x in d.dias])
    out = CriarItemProgramacao(SqlProgramacaoRepository(s, c.obra_id), SqlCatalogoGateway(s, c.obra_id)).executar(
        dados, c.usuario.id)
    return CriarOut(item=ItemOut.de(out.item), hh_disponivel_dia=out.hh_disponivel_dia,
                    ocupacao=[_ocup(o) for o in out.ocupacao], avisos=out.avisos)


@router.post("/itens/{item_id}/aprovar", response_model=ItemOut)
def aprovar(item_id: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    return ItemOut.de(AprovarItem(SqlProgramacaoRepository(s, c.obra_id)).executar(item_id))


@router.delete("/itens/{item_id}", status_code=204)
def excluir(item_id: int, s: Session = Depends(get_session), c: ContextoObra = Depends(programar)):
    repo = SqlProgramacaoRepository(s, c.obra_id)
    if c.papel == PapelObra.ENCARREGADO:
        item = repo.obter(item_id)
        if item is not None:
            _so_a_propria_equipe(c, item.encarregado_cracha)
    ExcluirItem(repo).executar(item_id)


@router.get("/capacidade", response_model=list[OcupacaoOut])
def ocupacao_encarregado(encarregado: str, inicio: date, fim: date, s: Session = Depends(get_session),
                         c: ContextoObra = Depends(ler)):
    hh = capacidade.hh_disponivel(SqlCatalogoGateway(s, c.obra_id).equipe(encarregado))
    itens = SqlProgramacaoRepository(s, c.obra_id).do_encarregado(encarregado, inicio, fim)
    return [_ocup(o) for o in capacidade.ocupacao(itens, hh)]


@router.get("/calendario")
def calendario(tipo: TipoProgramacao, referencia: date, jornada: float = 9.0,
               _: UsuarioAtual = Depends(usuario_atual)):
    cal = Calendario(tipo=tipo, referencia=referencia, jornada=jornada)
    return {"inicio": cal.inicio, "fim": cal.fim, "dias_de_referencia": round(cal.dias_de_referencia(), 4),
            "dias": [{"data": d.data, "dia": d.dia, "semana": d.semana, "horas": d.horas,
                      "fator": round(d.fator, 4), "fator_acumulado": round(d.fator_acumulado, 4)} for d in cal.dias()]}


class PredIn(BaseModel):
    numero: int
    tipo: TipoLigacao = TipoLigacao.TI
    lag: float = 0


class AtivSeqIn(BaseModel):
    numero: int
    duracao: float = Field(ge=0)
    equipe: str | None = None
    predecessoras: list[PredIn] = []


@router.post("/sequenciar")
def sequenciar_equipes(atividades: list[AtivSeqIn], _: UsuarioAtual = Depends(usuario_atual)):
    """Ordem de cada equipe respeitando predecessoras TI/II e lag (equivale à macro SequenciarEquipes)."""
    r = sequenciar([AtividadeSeq(a.numero, a.duracao, a.equipe,
                                 tuple(Predecessora(p.numero, p.tipo, p.lag) for p in a.predecessoras))
                    for a in atividades])
    return {"inicio": r.inicio, "fim": r.fim, "sequencia_na_equipe": r.sequencia_na_equipe, "em_ciclo": r.em_ciclo}
