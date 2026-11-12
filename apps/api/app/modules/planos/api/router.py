"""Plano de 90 dias, 6 semanas (make-ready) e pull planning (Spec 043).

O plano alimenta o Restrições (6WLA): restrição levantada num item vira ação do Plano de Ação ligada a ele; limpar a
restrição (concluir/cancelar a ação) libera o item. Item liberado migra para a programação mensal ou semanal.
"""
from collections import Counter
from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, ler, planejar, programar
from app.core.db import get_session
from app.modules.catalogo.infra.models import TipoAtividadeModel
from app.modules.equipes.infra.models import EquipeModel
from app.modules.frentes.infra.models import AreaFrenteModel, LocalFrenteModel
from app.modules.planejamento.infra.models import LinhaProgramacaoModel, ProgramacaoModel
from app.modules.planos.domain import plano as dom
from app.modules.planos.infra.models import PlanoItemModel
from app.modules.restricoes.infra.models import AcaoRestricaoModel
from app.modules.wbs.infra.models import WbsNoModel
from app.shared.errors import DomainError, NotFoundError
from app.shared.memoria import pacote

router = APIRouter(prefix="/planos", tags=["Plano de 90 dias"])


class ItemIn(BaseModel):
    descricao: str | None = None  # vazio com IWP = texto do item da PQ
    area_id: int | None = None
    wbs_no_id: int | None = None
    tipo_id: int | None = None
    equipe_id: int | None = None
    inicio: date
    fim: date
    quantidade: float | None = None
    responsavel: str | None = None
    marco: bool = False
    marco_id: int | None = None
    observacao: str | None = None


class DaWbsIn(BaseModel):
    nos: list[int]
    inicio: date | None = None  # vazio: datas da atividade do cronograma (IWP do P6)
    fim: date | None = None
    equipe_id: int | None = None
    marco_id: int | None = None


class RestricaoIn(BaseModel):
    acao: str
    responsavel: str | None = None
    gerencia: str | None = None
    prazo_termino: date | None = None
    seis_m: str | None = None
    impeditivo: bool | None = True
    atividade: str | None = None


class AnaliseIn(BaseModel):
    analisado: bool


class LimparIn(BaseModel):
    status1: str = "Concluído"  # Concluído | Cancelado
    observacao: str | None = None


class MigrarIn(BaseModel):
    programacao_id: int
    itens: list[int]
    qtd: dict[int, float | None] = {}  # quantidade do período por item (vazio = sugerida)


def _item(s: Session, c: ContextoObra, iid: int) -> PlanoItemModel:
    it = s.get(PlanoItemModel, iid)
    if it is None or it.obra_id != c.obra_id:
        raise NotFoundError("Item do plano", iid)
    return it


def _proximo(s: Session, obra_id: int) -> int:
    return (s.scalar(select(func.max(PlanoItemModel.numero)).where(PlanoItemModel.obra_id == obra_id)) or 0) + 1


def _iwp(s: Session, c: ContextoObra, nid: int):
    from app.modules.wbs.infra.gateway import iwp_para_linha

    return iwp_para_linha(s, c.obra_id, nid)


def _texto_iwp(s: Session, obra_id: int, item_pq: str | None, complemento: str | None) -> str:
    from app.modules.referencias.infra.pq_gateway import itens_pq

    info = itens_pq(s, obra_id, {item_pq}).get(item_pq) if item_pq else None
    base = info.texto_simova if info else (item_pq or "IWP")
    return f"{base} - ({complemento})" if complemento else base


def _preencher(s: Session, c: ContextoObra, it: PlanoItemModel, d: ItemIn) -> None:
    it.inicio, it.fim = dom.validar_janela(d.inicio, d.fim)
    it.quantidade = dom.validar_quantidade(d.quantidade)
    if d.wbs_no_id:
        i = _iwp(s, c, d.wbs_no_id)
        it.wbs_no_id, it.area_id, it.tipo_id, it.id_crono = i.id, i.area_id, i.tipo_id, i.id_crono
        it.descricao = dom.validar_descricao(d.descricao or _texto_iwp(s, c.obra_id, i.item_pq, i.complemento))
    else:
        it.wbs_no_id, it.id_crono = None, None
        if d.area_id is not None:
            a = s.get(AreaFrenteModel, d.area_id)
            if a is None or a.obra_id != c.obra_id:
                raise DomainError("área inválida", "area_id")
        if d.tipo_id is not None:
            t = s.get(TipoAtividadeModel, d.tipo_id)
            if t is None or t.obra_id != c.obra_id:
                raise DomainError("tipo do catálogo inválido", "tipo_id")
        it.area_id, it.tipo_id = d.area_id, d.tipo_id
        it.descricao = dom.validar_descricao(d.descricao)
    if d.equipe_id is not None:
        e = s.get(EquipeModel, d.equipe_id)
        if e is None or e.obra_id != c.obra_id:
            raise DomainError("equipe inválida", "equipe_id")
    it.equipe_id = d.equipe_id
    it.marco = d.marco
    if d.marco_id is not None:
        m = _item(s, c, d.marco_id)
        if not m.marco or m.id == it.id:
            raise DomainError("escolha um marco do plano", "marco_id")
    it.marco_id = None if d.marco else d.marco_id
    it.responsavel = " ".join((d.responsavel or "").split())[:150] or None
    it.observacao = (d.observacao or "").strip()[:600] or None


def _saida(s: Session, obra_id: int, itens: list[PlanoItemModel]) -> list[dict]:
    ids = [i.id for i in itens] or [0]
    areas = {a.id: a for a in s.scalars(select(AreaFrenteModel).where(AreaFrenteModel.obra_id == obra_id))}
    locais = {x.id: x for x in s.scalars(select(LocalFrenteModel).where(LocalFrenteModel.obra_id == obra_id))}
    equipes = {e.id: e for e in s.scalars(select(EquipeModel).where(EquipeModel.obra_id == obra_id))}
    acoes: dict[int, list[AcaoRestricaoModel]] = {}
    for a in s.scalars(select(AcaoRestricaoModel).where(AcaoRestricaoModel.plano_item_id.in_(ids))
                       .order_by(AcaoRestricaoModel.numero)):
        acoes.setdefault(a.plano_item_id, []).append(a)
    migr: dict[int, list[dict]] = {}
    for iid, pid, tit, tipo in s.execute(
            select(LinhaProgramacaoModel.plano_item_id, ProgramacaoModel.id, ProgramacaoModel.titulo, ProgramacaoModel.tipo)
            .join(ProgramacaoModel, ProgramacaoModel.id == LinhaProgramacaoModel.programacao_id)
            .where(LinhaProgramacaoModel.plano_item_id.in_(ids)).distinct()):
        migr.setdefault(iid, []).append({"id": pid, "titulo": tit, "tipo": tipo})
    hoje = date.today()
    from app.modules.restricoes.domain.acao import situacao as farol

    out = []
    for i in itens:
        a = areas.get(i.area_id)
        lst = acoes.get(i.id, [])
        pend = [x for x in lst if x.status1 == "Pendente"]
        out.append({
            "id": i.id, "numero": i.numero, "codigo": dom.codigo_item(i.numero), "descricao": i.descricao,
            "area_id": i.area_id, "area": f"{a.codigo} · {a.descricao}" if a else None,
            "local": (f"{locais[a.local_id].codigo} · {locais[a.local_id].descricao}" if a and a.local_id in locais else None),
            "wbs_no_id": i.wbs_no_id, "tipo_id": i.tipo_id, "id_crono": i.id_crono,
            "equipe_id": i.equipe_id, "equipe": equipes[i.equipe_id].nome if i.equipe_id in equipes else None,
            "inicio": i.inicio.isoformat(), "fim": i.fim.isoformat(), "quantidade": i.quantidade,
            "responsavel": i.responsavel, "marco": i.marco, "marco_id": i.marco_id, "analisado": i.analisado,
            "analisado_em": i.analisado_em.isoformat() if i.analisado_em else None, "observacao": i.observacao,
            "restricoes": [{"id": x.id, "numero": x.numero, "acao": x.acao, "responsavel": x.responsavel,
                            "prazo": (x.reprogramado or x.prazo_termino).isoformat() if (x.reprogramado or x.prazo_termino) else None,
                            "status1": x.status1, "impeditivo": x.impeditivo, "seis_m": x.seis_m,
                            "farol": farol(x.status1, x.prazo_termino, x.reprogramado, hoje).status2} for x in lst],
            "pendentes": len(pend), "impeditivas": sum(1 for x in pend if x.impeditivo is not False),
            "programacoes": migr.get(i.id, []),
            "situacao": dom.situacao(i.analisado, len(pend), bool(migr.get(i.id))),
        })
    return out


@router.get("")
def listar(inicio: date | None = None, semanas: int = dom.SEMANAS_90, s: Session = Depends(get_session),
           c: ContextoObra = Depends(ler)):
    """Itens do horizonte (sobrepõem as `semanas` a partir da semana de `inicio`, padrão hoje) + os marcos."""
    semanas = max(1, min(semanas, 26))
    sem = dom.semanas(inicio or date.today(), semanas)
    h_ini, h_fim = sem[0][0], sem[-1][1]
    itens = list(s.scalars(select(PlanoItemModel).where(PlanoItemModel.obra_id == c.obra_id,
                                                        PlanoItemModel.inicio <= h_fim, PlanoItemModel.fim >= h_ini)
                           .order_by(PlanoItemModel.inicio, PlanoItemModel.numero)))
    ids = {i.id for i in itens}
    marcos = list(s.scalars(select(PlanoItemModel).where(PlanoItemModel.obra_id == c.obra_id, PlanoItemModel.marco.is_(True))
                            .order_by(PlanoItemModel.fim)))
    # pull planning: o que um marco do horizonte puxa entra mesmo antes do horizonte
    puxados = list(s.scalars(select(PlanoItemModel).where(PlanoItemModel.obra_id == c.obra_id,
                                                          PlanoItemModel.marco_id.in_([m.id for m in marcos] or [0]))))
    todos = itens + [x for x in [*marcos, *puxados] if x.id not in ids and not ids.add(x.id)]
    saida = _saida(s, c.obra_id, todos)
    cont = Counter(x["situacao"] for x in saida if not x["marco"])
    return {"semanas": [{"inicio": a.isoformat(), "fim": b.isoformat()} for a, b in sem],
            "itens": saida, "resumo": {k: cont.get(k, 0) for k in dom.ROTULO}}


@router.post("/itens", status_code=201)
def criar(d: ItemIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    it = PlanoItemModel(obra_id=c.obra_id, numero=_proximo(s, c.obra_id), criado_por=c.usuario.id)
    _preencher(s, c, it, d)
    s.add(it)
    s.flush()
    return _saida(s, c.obra_id, [it])[0]


@router.put("/itens/{iid}")
def editar(iid: int, d: ItemIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    it = _item(s, c, iid)
    _preencher(s, c, it, d)
    s.flush()
    return _saida(s, c.obra_id, [it])[0]


@router.delete("/itens/{iid}", status_code=204)
def excluir(iid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    it = _item(s, c, iid)
    if s.scalar(select(LinhaProgramacaoModel.id).where(LinhaProgramacaoModel.plano_item_id == iid).limit(1)):
        raise DomainError("o item já foi para a programação: tire a linha de lá antes")
    if s.scalar(select(AcaoRestricaoModel.id).where(AcaoRestricaoModel.plano_item_id == iid,
                                                    AcaoRestricaoModel.status1 == "Pendente").limit(1)):
        raise DomainError("o item tem restrição pendente no 6WLA: conclua ou cancele antes")
    for x in s.scalars(select(PlanoItemModel).where(PlanoItemModel.marco_id == iid)):
        x.marco_id = None
    s.delete(it)


@router.post("/itens/da-wbs", status_code=201)
def da_wbs(d: DaWbsIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Cada IWP abaixo dos nós escolhidos vira um item do plano (datas da atividade do P6 quando houver)."""
    from app.modules.referencias.infra.models import AtividadeCronogramaModel
    from app.modules.referencias.infra.resolvedor import ResolvedorReferencias
    from app.modules.wbs.infra.gateway import iwps_abaixo

    iwps, vazios = iwps_abaixo(s, c.obra_id, d.nos)
    ja = set(s.scalars(select(PlanoItemModel.wbs_no_id).where(PlanoItemModel.obra_id == c.obra_id,
                                                              PlanoItemModel.wbs_no_id.in_(iwps or [0]))))
    vig = ResolvedorReferencias(s, c.obra_id).versoes_vigentes().get("CRONOGRAMA")
    criados, sem_data = [], 0
    for nid in iwps:
        if nid in ja:
            continue
        i = _iwp(s, c, nid)
        ini, fim = d.inicio, d.fim
        if (ini is None or fim is None) and i.id_crono and vig:
            at = s.scalar(select(AtividadeCronogramaModel).where(AtividadeCronogramaModel.versao_id == vig,
                                                                 AtividadeCronogramaModel.id_crono == i.id_crono))
            if at and at.inicio and at.fim:
                ini, fim = ini or at.inicio.date(), fim or at.fim.date()
        if ini is None or fim is None:
            sem_data += 1
            continue
        it = PlanoItemModel(obra_id=c.obra_id, numero=_proximo(s, c.obra_id), criado_por=c.usuario.id)
        _preencher(s, c, it, ItemIn(wbs_no_id=nid, inicio=ini, fim=fim, equipe_id=d.equipe_id, marco_id=d.marco_id,
                                    quantidade=i.quantidade))
        s.add(it)
        s.flush()
        criados.append(it.id)
    return {"criados": len(criados), "ja_estavam": len([i for i in iwps if i in ja]), "sem_data": sem_data,
            "nos_sem_iwp": vazios}


@router.post("/itens/{iid}/restricoes", status_code=201)
def levantar(iid: int, d: RestricaoIn, s: Session = Depends(get_session), c: ContextoObra = Depends(programar)):
    """Restrição do item → ação no Plano de Ação (6WLA), ligada ao item, à área e à equipe dele."""
    from app.modules.restricoes.api.router import AcaoIn, nova

    it = _item(s, c, iid)
    r = nova(AcaoIn(acao=d.acao, atividade=d.atividade or "Planejamento", impeditivo=d.impeditivo, area_id=it.area_id,
                    referencia=dom.codigo_item(it.numero), reuniao="6WLA", responsavel=d.responsavel, gerencia=d.gerencia,
                    prazo_inicio=date.today() if d.prazo_termino and d.prazo_termino >= date.today() else None,
                    prazo_termino=d.prazo_termino, seis_m=d.seis_m, equipe_id=it.equipe_id,
                    nova_observacao=f"levantada no plano de 90 dias ({dom.codigo_item(it.numero)} · {it.descricao})"[:300]),
             s, c)
    s.get(AcaoRestricaoModel, r["id"]).plano_item_id = it.id
    it.analisado, it.analisado_em = True, date.today()
    s.flush()
    return _saida(s, c.obra_id, [it])[0]


@router.post("/restricoes/{aid}/limpar")
def limpar(aid: int, d: LimparIn, s: Session = Depends(get_session), c: ContextoObra = Depends(programar)):
    """Limpa a restrição (Concluído/Cancelado no 6WLA) e devolve o item do plano atualizado."""
    from app.modules.restricoes.domain import acao as racao

    a = s.get(AcaoRestricaoModel, aid)
    if a is None or a.obra_id != c.obra_id or a.plano_item_id is None:
        raise NotFoundError("Restrição do plano", aid)
    a.status1 = racao.validar_status1(d.status1)
    if a.status1 == "Pendente":
        raise DomainError("limpar = Concluído ou Cancelado", "status1")
    a.conclusao = date.today() if a.status1 == "Concluído" else None
    a.observacoes = racao.anotar(a.observacoes, d.observacao or f"{a.status1.lower()} no plano de 90 dias", date.today())
    s.flush()
    return _saida(s, c.obra_id, [s.get(PlanoItemModel, a.plano_item_id)])[0]


@router.put("/itens/{iid}/analise")
def analise(iid: int, d: AnaliseIn, s: Session = Depends(get_session), c: ContextoObra = Depends(programar)):
    """Análise de restrições feita (sem restrição = liberado) ou desfeita."""
    it = _item(s, c, iid)
    it.analisado, it.analisado_em = d.analisado, (date.today() if d.analisado else None)
    s.flush()
    return _saida(s, c.obra_id, [it])[0]


def _programacao(s: Session, c: ContextoObra, pid: int) -> ProgramacaoModel:
    p = s.get(ProgramacaoModel, pid)
    if p is None or p.obra_id != c.obra_id:
        raise NotFoundError("Programação", pid)
    return p


@router.get("/migrar/{pid}")
def previa(pid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Itens do plano que caem no período da programação, com a quantidade sugerida (e a memória dela)."""
    from app.modules.referencias.infra.pq_gateway import itens_pq

    p = _programacao(s, c, pid)
    itens = list(s.scalars(select(PlanoItemModel).where(PlanoItemModel.obra_id == c.obra_id, PlanoItemModel.marco.is_(False),
                                                        PlanoItemModel.inicio <= p.fim, PlanoItemModel.fim >= p.inicio)
                           .order_by(PlanoItemModel.inicio, PlanoItemModel.numero)))
    ja = set(s.scalars(select(LinhaProgramacaoModel.plano_item_id).where(LinhaProgramacaoModel.programacao_id == pid,
                                                                         LinhaProgramacaoModel.plano_item_id.is_not(None))))
    iwps = {n.id: n for n in s.scalars(select(WbsNoModel).where(WbsNoModel.id.in_([i.wbs_no_id for i in itens if i.wbs_no_id] or [0])))}
    unid = {k: v.unid for k, v in itens_pq(s, c.obra_id, {n.item_pq for n in iwps.values() if n.item_pq}).items()}
    saida, memorias = [], []
    for x, i in zip(_saida(s, c.obra_id, itens), itens):
        pr = dom.qtd_no_periodo(i.inicio, i.fim, i.quantidade, p.inicio, p.fim)
        u = unid.get(iwps[i.wbs_no_id].item_pq) if i.wbs_no_id in iwps else None
        if pr.sugerida is not None:
            memorias.append(dom.memoria_qtd(x["codigo"], u, i.inicio, i.fim, pr, p.titulo, p.inicio, p.fim))
        saida.append({**x, "unid": u, "qtd_sugerida": pr.sugerida, "dias_no_periodo": pr.dias_no_periodo,
                      "ja_na_programacao": i.id in ja, "migravel": bool(i.wbs_no_id or (i.area_id and i.tipo_id))})
    return {"programacao": {"id": p.id, "titulo": p.titulo, "tipo": p.tipo, "status": p.status,
                            "inicio": p.inicio.isoformat(), "fim": p.fim.isoformat()},
            "itens": saida, **pacote(*memorias)}


@router.post("/migrar")
def migrar(d: MigrarIn, s: Session = Depends(get_session), c: ContextoObra = Depends(programar)):
    """Leva itens do plano para a programação (rascunho). Na semanal só entra item liberado (sem restrição pendente);
    na mensal entra com aviso. Item que já está na programação não duplica."""
    from app.modules.planejamento.api.router import LinhaIn, nova_linha

    p = _programacao(s, c, d.programacao_id)
    ja = set(s.scalars(select(LinhaProgramacaoModel.plano_item_id).where(LinhaProgramacaoModel.programacao_id == p.id,
                                                                         LinhaProgramacaoModel.plano_item_id.is_not(None))))
    pend = Counter(s.scalars(select(AcaoRestricaoModel.plano_item_id).where(AcaoRestricaoModel.plano_item_id.in_(d.itens or [0]),
                                                                            AcaoRestricaoModel.status1 == "Pendente")))
    criadas, avisos, bloqueados = 0, [], []
    for iid in d.itens:
        it = _item(s, c, iid)
        cod = dom.codigo_item(it.numero)
        if it.marco or iid in ja:
            continue
        if not dom.sobrepoe(it.inicio, it.fim, p.inicio, p.fim):
            avisos.append(f"{cod}: fora do período de {p.titulo}")
            continue
        if not (it.wbs_no_id or (it.area_id and it.tipo_id)):
            bloqueados.append(f"{cod}: ligue ao IWP da WBS (ou área + tipo do catálogo) para virar linha")
            continue
        if pend.get(iid):
            if p.tipo == "SEMANAL":
                bloqueados.append(f"{cod}: {pend[iid]} restrição(ões) pendente(s) no 6WLA: limpe antes da semanal")
                continue
            avisos.append(f"{cod}: entrou na mensal com {pend[iid]} restrição(ões) pendente(s)")
        elif not it.analisado and p.tipo == "SEMANAL":
            avisos.append(f"{cod}: entrou sem a análise de restrições registrada")
        q = d.qtd.get(iid) if iid in d.qtd else dom.qtd_no_periodo(it.inicio, it.fim, it.quantidade, p.inicio, p.fim).sugerida
        r = nova_linha(p.id, LinhaIn(wbs_no_id=it.wbs_no_id, area_id=it.area_id, tipo_id=it.tipo_id, equipe_id=it.equipe_id,
                                     id_crono=it.id_crono, qtd_periodo=q, responsavel=it.responsavel,
                                     observacao=f"{cod} · plano de 90 dias"), s, c)
        s.get(LinhaProgramacaoModel, r["id"]).plano_item_id = it.id
        if r.get("aviso"):
            avisos.append(f"{cod}: {r['aviso']}")
        criadas += 1
    s.flush()
    return {"criadas": criadas, "bloqueados": bloqueados, "avisos": avisos[:30]}
