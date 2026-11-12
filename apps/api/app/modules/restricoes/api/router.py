"""Restrições do look-ahead (Plano de Ação 6WLA): cadastro, farol, Ishikawa (6M), importação e Excel."""
from collections import Counter
from datetime import date

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, ler, planejar, programar
from app.core.db import get_session
from app.modules.equipes.infra.models import EquipeModel
from app.modules.frentes.infra.models import AreaFrenteModel
from app.modules.planejamento.infra.models import LinhaProgramacaoModel, ProgramacaoModel
from app.modules.restricoes.application import planilha
from app.modules.restricoes.domain import acao as dom
from app.modules.restricoes.infra.models import AcaoRestricaoModel
from app.shared.errors import DomainError, NotFoundError
from app.shared.memoria import Fonte, Memoria, Passo, num, pacote

router = APIRouter(prefix="/restricoes", tags=["restrições (6WLA)"])
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


class AcaoIn(BaseModel):
    acao: str
    atividade: str | None = None
    impeditivo: bool | None = None
    area_id: int | None = None
    area_texto: str | None = None
    referencia: str | None = None
    reuniao: str | None = "6WLA"
    responsavel: str | None = None
    gerencia: str | None = None
    prazo_inicio: date | None = None
    prazo_termino: date | None = None
    status1: str = "Pendente"
    conclusao: date | None = None
    seis_m: str | None = None
    observacoes: str | None = None  # None = mantém o histórico; texto = corrige o histórico inteiro
    nova_observacao: str | None = None  # entra no topo com a data de hoje ("dd/mm: texto")
    linha_id: int | None = None
    equipe_id: int | None = None


class ReprogramarIn(BaseModel):
    data: date
    observacao: str | None = None


def _acao(s: Session, c: ContextoObra, aid: int) -> AcaoRestricaoModel:
    a = s.get(AcaoRestricaoModel, aid)
    if a is None or a.obra_id != c.obra_id:
        raise NotFoundError("Restrição", aid)
    return a


def _t(v: str | None, n: int) -> str | None:
    return " ".join((v or "").split())[:n] or None


def _preencher(s: Session, c: ContextoObra, a: AcaoRestricaoModel, d: AcaoIn) -> None:
    texto = _t(d.acao, 600)
    if not texto or len(texto) < 3:
        raise DomainError("descreva a ação", "acao")
    dom.validar_prazo(d.prazo_inicio, d.prazo_termino)
    a.acao, a.atividade, a.impeditivo = texto, _t(d.atividade, 80), d.impeditivo
    if d.area_id is not None:
        ar = s.get(AreaFrenteModel, d.area_id)
        if ar is None or ar.obra_id != c.obra_id:
            raise DomainError("área inválida", "area_id")
        a.area_id, a.area_texto = ar.id, _t(d.area_texto, 200) or ar.descricao[:200]
    else:
        a.area_id, a.area_texto = None, _t(d.area_texto, 200)
    if d.linha_id is not None:
        ln = s.get(LinhaProgramacaoModel, d.linha_id)
        p = s.get(ProgramacaoModel, ln.programacao_id) if ln else None
        if p is None or p.obra_id != c.obra_id:
            raise DomainError("linha da programação inválida", "linha_id")
    if d.equipe_id is not None:
        e = s.get(EquipeModel, d.equipe_id)
        if e is None or e.obra_id != c.obra_id:
            raise DomainError("equipe inválida", "equipe_id")
    a.linha_id, a.equipe_id = d.linha_id, d.equipe_id
    a.referencia, a.reuniao = _t(d.referencia, 80), _t(d.reuniao, 20) or "6WLA"
    a.responsavel, a.gerencia = _t(d.responsavel, 150), _t(d.gerencia, 80)
    a.prazo_inicio, a.prazo_termino = d.prazo_inicio, d.prazo_termino
    a.status1, a.seis_m = dom.validar_status1(d.status1), dom.validar_6m(d.seis_m)
    if d.observacoes is not None:
        a.observacoes = (d.observacoes or "").strip()[:4000] or None
    a.observacoes = dom.anotar(a.observacoes, d.nova_observacao, date.today())
    a.conclusao = (d.conclusao or a.conclusao or date.today()) if a.status1 == "Concluído" else None


@router.get("")
def listar(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    from app.modules.campo.api.fotos import fotos_de

    hoje = date.today()
    lista = list(s.scalars(select(AcaoRestricaoModel).where(AcaoRestricaoModel.obra_id == c.obra_id)
                           .order_by(AcaoRestricaoModel.numero.desc())))
    fotos = fotos_de(s, c.obra_id, "restricao", [a.id for a in lista])
    return [{**planilha.saida(a, hoje), "fotos": fotos.get(a.id, [])} for a in lista]


@router.post("", status_code=201)
def nova(d: AcaoIn, s: Session = Depends(get_session), c: ContextoObra = Depends(programar)):
    a = AcaoRestricaoModel(obra_id=c.obra_id, numero=planilha.proximo_numero(s, c.obra_id), origem="app",
                           criado_por=c.usuario.id, reprogramacoes=0)
    _preencher(s, c, a, d)
    s.add(a)
    s.flush()
    return planilha.saida(a, date.today())


@router.put("/{aid}")
def editar(aid: int, d: AcaoIn, s: Session = Depends(get_session), c: ContextoObra = Depends(programar)):
    a = _acao(s, c, aid)
    _preencher(s, c, a, d)
    s.flush()
    return planilha.saida(a, date.today())


@router.post("/{aid}/reprogramar")
def reprogramar(aid: int, d: ReprogramarIn, s: Session = Depends(get_session), c: ContextoObra = Depends(programar)):
    """Nova data (REPROGRAMADO · DATA) e +1 no nº de reprogramações; o prazo original fica."""
    a = _acao(s, c, aid)
    if a.status1 != "Pendente":
        raise DomainError("só restrição pendente é reprogramada")
    if a.prazo_termino and d.data < a.prazo_termino:
        raise DomainError("a reprogramação é depois do término do prazo", "data")
    a.reprogramado, a.reprogramacoes = d.data, (a.reprogramacoes or 0) + 1
    a.observacoes = dom.anotar(a.observacoes, f"reprogramada para {d.data:%d/%m/%Y}" + (f" — {d.observacao}" if d.observacao else ""),
                               date.today())
    s.flush()
    return planilha.saida(a, date.today())


@router.delete("/{aid}", status_code=204)
def excluir(aid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    s.delete(_acao(s, c, aid))


@router.post("/importar")
def importar(arquivo: UploadFile = File(...), s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Plano de Ação 6WLA (.xlsm/.xlsx), aba Ações. Reimportar atualiza pelo Nº."""
    return planilha.importar(s, c.obra_id, arquivo.file.read(), c.usuario.id)


@router.get("/excel")
def excel(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    from app.modules.obras.infra.models import ObraModel

    obra = s.get(ObraModel, c.obra_id)
    acoes = list(s.scalars(select(AcaoRestricaoModel).where(AcaoRestricaoModel.obra_id == c.obra_id)))
    conteudo = planilha.exportar(acoes, date.today(), f"Plano de Ação 6WLA · {obra.nome if obra else ''}".strip(" ·"))
    return Response(conteudo, media_type=XLSX, headers={"Content-Disposition": 'attachment; filename="Plano_de_Acao_6WLA.xlsx"'})


@router.get("/ishikawa")
def ishikawa(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Restrições pendentes por 6M (espinha de peixe), farol, gerência e área — cada número com a lista que o compõe."""
    hoje = date.today()
    todas = [planilha.saida(a, hoje) for a in s.scalars(select(AcaoRestricaoModel).where(AcaoRestricaoModel.obra_id == c.obra_id))]
    pend = [a for a in todas if a["status1"] == "Pendente"]
    fonte = (Fonte("Restrições", f"{len(todas)} ação(ões)", "Plano de ação 6WLA da obra",
                   f"{sum(a['origem'] == 'importado' for a in todas)} importada(s) da planilha · "
                   f"{sum(a['origem'] == 'app' for a in todas)} lançada(s) no app"),)

    def mem(chave: str, titulo: str, itens: list[dict], base: str) -> Memoria:
        return Memoria(chave, titulo, f"{len(itens)}", f"contagem das ações {base}",
                       tuple(Passo(f"Nº {a['numero']} · {a['acao'][:80]}", a["responsavel"] or "—", a["status2"]) for a in itens[:60])
                       + ((Passo(f"… e mais {len(itens) - 60}", "", ""),) if len(itens) > 60 else ())
                       + (Passo("Total", f"{len(itens)} ação(ões)", f"{len(itens)}", True),), fonte)

    espinhas = []
    mems = []
    for k in (*dom.SEIS_M, None):
        itens = [a for a in pend if a["seis_m"] == k]
        nome = dom.SEIS_M.get(k, "Não classificado") if k else "Não classificado"
        espinhas.append({"codigo": k, "nome": nome, "pendentes": len(itens),
                         "atrasadas": sum(a["farol"] == 1 for a in itens),
                         "itens": [{"id": a["id"], "numero": a["numero"], "acao": a["acao"], "status2": a["status2"]}
                                   for a in sorted(itens, key=lambda x: (x["farol"] or 9, x["prazo_termino"] or ""))[:6]]})
        mems.append(mem(f"6m:{k or 'NC'}", f"Pendentes · {nome}", itens, f"pendentes com 6M = {nome}"))
    por = lambda campo, base: Counter((a[campo] or "—") for a in base).most_common()  # noqa: E731
    farol = Counter(a["status2"] for a in todas)
    for st in ("Atrasado", "Reprogramado", "No Prazo", "Concluído", "Cancelado"):
        mems.append(mem(f"status:{st}", f"Ações · {st}", [a for a in todas if a["status2"] == st], f"com status {st}"))
    abertas = [a for a in pend]
    no_prazo = sum(a["status2"] == "No Prazo" for a in abertas)
    mems.append(Memoria("no_prazo", "Pendentes no prazo", f"{num(100 * no_prazo / len(abertas), 1)} %" if abertas else "—",
                        "pendentes no prazo ÷ pendentes",
                        (Passo("Conta", f"{no_prazo} ÷ {len(abertas)}", f"{num(100 * no_prazo / len(abertas), 1)} %" if abertas else "—", True),),
                        fonte, ("Reprogramadas e atrasadas contam como fora do prazo.",)))
    # gráficos do PAINEL AÇÃO (mesma conta do Excel): cada valor com a lista das ações que o compõem
    from app.modules.restricoes.domain.painel import LinhaPainel, painel

    por_id = {a["id"]: a for a in todas}
    pn = painel([LinhaPainel(a["id"], a["status1"], a["status2"], a["responsavel"], a["area_texto"], a["gerencia"], a["seis_m"],
                             a["semana"]) for a in todas])
    graficos = {}
    for nome, grupos in pn.items():
        saida_g = []
        for i, g in enumerate(grupos):
            valores = {}
            for serie, ids in g.ids.items():
                chave = f"{nome}:{i}:{serie}"
                valores[serie] = {"n": len(ids), "chave": chave}
                rot = (dom.SEIS_M.get(g.rotulo, "Não classificado") if nome == "seis_m" else g.rotulo) or "Não classificado"
                mems.append(mem(chave, f"{rot}{'' if serie == 'total' else ' · ' + serie}", [por_id[x] for x in ids],
                                f"{rot}{'' if serie == 'total' else ' com status ' + serie}"))
            rot = (f"{g.rotulo} · {dom.SEIS_M[g.rotulo]}" if g.rotulo in dom.SEIS_M else "Não classificado") if nome == "seis_m" else g.rotulo
            saida_g.append({"rotulo": rot, "valores": valores})
        graficos[nome] = saida_g
    return {"graficos": graficos, "total": len(todas), "pendentes": len(pend), "impeditivas": sum(bool(a["impeditivo"]) for a in pend),
            "no_prazo": (no_prazo / len(abertas)) if abertas else None, "status": dict(farol), "espinhas": espinhas,
            "gerencia": por("gerencia", pend), "area": por("area_texto", pend)[:15], "responsavel": por("responsavel", pend)[:15],
            "semana": sorted(Counter(a["semana"] for a in pend if a["semana"]).items()), **pacote(*mems)}
