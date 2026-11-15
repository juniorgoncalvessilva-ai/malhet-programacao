"""Mobilização do colaborador (spec 087): processos da solicitação ao crachá, metas da obra e métricas do esforço."""
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, ler, planejar
from app.core.db import get_session
from app.modules.efetivo.domain.efetivo import (
    EMPRESA_PROPRIA,
    Situacao,
    chave_cadastro,
    chave_provisoria,
    chave_texto,
    normalizar_matricula,
)
from app.modules.efetivo.infra.models import ColaboradorModel, MovimentoEfetivoModel
from app.modules.mobilizacao.domain.metricas import ProcessoNomeado, calcular, esforco, gargalo
from app.modules.mobilizacao.domain.vaga import Ocupacao, SituacaoVaga, Vaga, VagaResumo, proximo_codigo, resumo
from app.modules.mobilizacao.domain.pipeline import (
    ETAPAS,
    FAIXA,
    METAS_PADRAO,
    ROTULO_META,
    Etapa,
    Liberacoes,
    Meta,
    Passagem,
    Processo,
    Status,
)
from app.modules.mobilizacao.infra.models import (
    MetaMobilizacaoModel,
    TreinamentoPrevistoModel,
    VagaModel,
    PassagemMobilizacaoModel,
    ProcessoMobilizacaoModel,
)
from app.modules.efetivo.infra.gateway import funcao_padronizada
from app.modules.treinamentos.infra.gateway import AptidaoGateway, cargas_registradas, horas_exigidas
from app.shared.errors import DomainError, NotFoundError

router = APIRouter(prefix="/mobilizacao", tags=["mobilização do colaborador"])

SITUACAO_DO_STATUS = {Status.EM_ANDAMENTO: Situacao.EM_PROCESSO, Status.AGUARDANDO_CRACHA: Situacao.AGUARDANDO_CRACHA,
                      Status.MOBILIZADO: Situacao.MOBILIZADO, Status.DESISTENCIA: Situacao.DESISTENCIA}


def _agora() -> datetime:
    return datetime.now(timezone.utc)


def _metas(s: Session, obra_id: int) -> dict[Meta, float]:
    m = {k: float(v) for k, v in METAS_PADRAO.items()}
    for x in s.scalars(select(MetaMobilizacaoModel).where(MetaMobilizacaoModel.obra_id == obra_id)):
        if x.meta in Meta._value2member_map_:
            m[Meta(x.meta)] = x.dias
    return m


def _dominio(m: ProcessoMobilizacaoModel) -> Processo:
    return Processo(tuple(Passagem(Etapa(p.etapa), p.entrou_em, p.saiu_em) for p in m.passagens), Status(m.status),
                    m.treinamento_antes)


def _gravar(m: ProcessoMobilizacaoModel, p: Processo, por: str | None, obs: str | None = None) -> None:
    """Leva o processo do domínio para as linhas (mesma ordem; voltar remove a última)."""
    while len(m.passagens) > len(p.passagens):
        m.passagens.pop()
    for i, ps in enumerate(p.passagens):
        if i < len(m.passagens):
            linha = m.passagens[i]
            if linha.saiu_em != ps.saiu_em:
                linha.saiu_em = ps.saiu_em
                linha.concluido_por = por if ps.saiu_em else None
                if ps.saiu_em and obs:
                    linha.observacao = obs[:300]
        else:
            m.passagens.append(PassagemMobilizacaoModel(obra_id=m.obra_id, etapa=ps.etapa.value, entrou_em=ps.entrou_em))
    m.status, m.etapa_atual = p.status.value, p.etapa_atual.value


def _situacao(s: Session, c: ContextoObra, col: ColaboradorModel | None, nova: Situacao) -> None:
    if col is None or col.situacao == nova.value:
        return
    de = Situacao(col.situacao).rotulo if col.situacao in Situacao._value2member_map_ else col.situacao
    s.add(MovimentoEfetivoModel(obra_id=c.obra_id, colaborador_id=col.id, tipo="SITUACAO", de=de,
                                para=f"{nova.rotulo} (mobilização)", por=c.usuario.id))
    col.situacao = nova.value


def _processo(s: Session, c: ContextoObra, pid: int) -> ProcessoMobilizacaoModel:
    m = s.get(ProcessoMobilizacaoModel, pid)
    if m is None or m.obra_id != c.obra_id:
        raise NotFoundError("Processo de mobilização", pid)
    return m


def _previstos(s: Session, obra_id: int) -> dict[str, TreinamentoPrevistoModel]:
    return {x.funcao_chave: x for x in s.scalars(select(TreinamentoPrevistoModel).where(TreinamentoPrevistoModel.obra_id == obra_id))}


def _nomeados(s: Session, obra_id: int, ms: list[ProcessoMobilizacaoModel], agora: datetime) -> dict[int, ProcessoNomeado]:
    """Processo + o previsto em contrato para a função + as horas de treinamento registradas durante o processo."""
    prev = _previstos(s, obra_id)
    cargas = cargas_registradas(s, obra_id, [m.colaborador_id for m in ms if m.colaborador_id])
    out = {}
    for m in ms:
        if not m.passagens:
            continue
        p = _dominio(m)
        ini = p.passagens[0].entrou_em.date()
        fim_tr = next((x.saiu_em for x in reversed(p.passagens) if x.etapa == Etapa.TREINAMENTO and x.saiu_em), None)
        fim = (fim_tr or (p.passagens[-1].saiu_em if not p.status.aberto else agora) or agora).date()
        horas = sum(h for d, h in cargas.get(m.colaborador_id or 0, []) if ini <= d <= fim)
        pv = prev.get(m.funcao_chave or chave_texto(m.funcao) or "")
        out[m.id] = ProcessoNomeado(m.id, m.nome, m.funcao, p, pv.dias if pv else None, pv.horas if pv else None, horas)
    return out


def _saida(s: Session, c: ContextoObra, ms: list[ProcessoMobilizacaoModel]) -> list[dict]:
    metas, agora = _metas(s, c.obra_id), _agora()
    apt = _aptidoes(s, c.obra_id, ms)
    nom = _nomeados(s, c.obra_id, ms, agora)
    vagas = {v.id: v.codigo for v in s.scalars(select(VagaModel).where(VagaModel.id.in_([m.vaga_id for m in ms if m.vaga_id])))}
    return [_out(m, nom[m.id], metas, agora, apt.get(m.colaborador_id), vagas.get(m.vaga_id)) for m in ms]


def _out(m: ProcessoMobilizacaoModel, x: ProcessoNomeado, metas: dict[Meta, float], agora: datetime, apt=None,
         vaga: str | None = None) -> dict:
    p = x.processo
    esf = esforco(p, agora)
    g = gargalo(p, agora)
    return {
        "id": m.id, "colaborador_id": m.colaborador_id, "nome": m.nome, "funcao": m.funcao, "empresa": m.empresa,
        "vaga_id": m.vaga_id, "vaga_codigo": vaga,
        "treino": {"dias": round(d, 2) if (d := x.dias_treinamento(agora)) is not None else None,
                   "previsto_dias": x.previsto_dias, "horas": x.horas, "previsto_horas": x.previsto_horas},
        "requisicao": m.requisicao, "necessario_em": m.necessario_em, "treinamento_antes": m.treinamento_antes,
        "status": p.status.value, "status_rotulo": p.status.rotulo, "etapa_atual": p.etapa_atual.value,
        "etapa_rotulo": p.etapa_atual.rotulo, "motivo_desistencia": m.motivo_desistencia, "observacao": m.observacao,
        "criado_por": m.criado_por, "criado_em": m.criado_em,
        "passagens": [{"etapa": x.etapa, "rotulo": Etapa(x.etapa).rotulo, "entrou_em": x.entrou_em, "saiu_em": x.saiu_em,
                       "dias": round(Passagem(Etapa(x.etapa), x.entrou_em, x.saiu_em).dias(agora), 2),
                       "concluido_por": x.concluido_por, "observacao": x.observacao} for x in m.passagens],
        "esforco": {k: round(v, 2) for k, v in esf.items()}, "dias_total": round(p.dias_total(agora), 2),
        "gargalo": g.value if g else None, "atrasos": [a.value for a in p.atrasos(x.metas(metas), agora)],
        "dias_etapa_atual": round(p.aberta.dias(agora), 2) if p.aberta else None,
        "atrasado_para_obra": bool(m.necessario_em and p.status.aberto and m.necessario_em < agora.date()),
        "aptidao": apt,
    }


def _aptidoes(s: Session, obra_id: int, ms: list[ProcessoMobilizacaoModel]) -> dict[int, dict]:
    cols = {x.id: x for x in s.scalars(select(ColaboradorModel).where(
        ColaboradorModel.id.in_([m.colaborador_id for m in ms if m.colaborador_id])))}
    infos = AptidaoGateway(s, obra_id).de([(cid, col.funcao_chave) for cid, col in cols.items()], date.today())
    return {cid: {"aso_libera": i.aso_libera, "aso": i.aptidao.aso.value, "pendentes": i.pendentes,
                  "funcao_tem_exigencia": i.funcao_tem_exigencia, "impedimentos": i.impedimentos}
            for cid, i in infos.items()}


@router.get("/etapas")
def etapas(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    metas = _metas(s, c.obra_id)
    return {"etapas": [{"etapa": e.value, "rotulo": e.rotulo} for e in ETAPAS],
            "metas": [{"meta": m.value, "rotulo": ROTULO_META[m], "dias": metas[m],
                       "etapas": [e.value for e in FAIXA[m]]}
                      for m in Meta]}


@router.get("/processos")
def listar(status: str | None = None, colaborador_id: int | None = None, s: Session = Depends(get_session),
           c: ContextoObra = Depends(ler)):
    q = select(ProcessoMobilizacaoModel).where(ProcessoMobilizacaoModel.obra_id == c.obra_id)
    if status:
        q = q.where(ProcessoMobilizacaoModel.status.in_(status.split(",")))
    if colaborador_id:
        q = q.where(ProcessoMobilizacaoModel.colaborador_id == colaborador_id)
    ms = list(s.scalars(q.order_by(ProcessoMobilizacaoModel.criado_em.desc())))
    return _saida(s, c, ms)


class ProcessoIn(BaseModel):
    colaborador_id: int | None = None  # pessoa já no efetivo (ex.: prevista na planilha do DP)
    vaga_id: int | None = None  # vaga aberta pelo Planejamento (spec 089)
    nome: str | None = Field(None, max_length=150)
    funcao: str | None = Field(None, max_length=120)
    empresa: str = Field(EMPRESA_PROPRIA, max_length=80)
    requisicao: str | None = Field(None, max_length=40)
    necessario_em: date | None = None
    treinamento_antes: bool = False
    observacao: str | None = Field(None, max_length=500)
    iniciado_em: datetime | None = None  # solicitação feita antes de lançar aqui


def _quando(v: datetime | None, agora: datetime) -> datetime:
    if v is None:
        return agora
    if v.tzinfo is None:
        v = v.replace(tzinfo=timezone.utc)
    if v > agora + timedelta(minutes=5):
        raise DomainError("a data não pode estar no futuro", "em")
    return v


@router.post("/processos", status_code=201)
def abrir(d: ProcessoIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Abre a aquisição na Solicitação. Pessoa nova entra no efetivo como Em processo (chave provisória pelo nome)."""
    agora = _agora()
    vaga = None
    if d.vaga_id:
        vaga = _vaga(s, c, d.vaga_id)
        _ocupacao(s, vaga).aceita_processo()
        d = d.model_copy(update={"funcao": vaga.funcao, "requisicao": vaga.codigo,
                                 "necessario_em": d.necessario_em or vaga.necessario_em,
                                 "empresa": vaga.empresa if d.empresa == EMPRESA_PROPRIA else d.empresa,
                                 "iniciado_em": d.iniciado_em or vaga.aberta_em})
    fp = funcao_padronizada(s, c.obra_id, d.funcao)
    if fp is not None:
        d = d.model_copy(update={"funcao": fp.funcao})
    if d.colaborador_id:
        col = s.get(ColaboradorModel, d.colaborador_id)
        if col is None or col.obra_id != c.obra_id:
            raise NotFoundError("Colaborador", d.colaborador_id)
        aberto = s.scalar(select(ProcessoMobilizacaoModel).where(
            ProcessoMobilizacaoModel.colaborador_id == col.id,
            ProcessoMobilizacaoModel.status.in_([Status.EM_ANDAMENTO.value, Status.AGUARDANDO_CRACHA.value])))
        if aberto is not None:
            raise DomainError(f"{col.nome} já tem um processo aberto (#{aberto.id})", "colaborador_id")
        if col.situacao in (Situacao.PREVISTO.value, Situacao.DESMOBILIZADO.value, Situacao.DESISTENCIA.value):
            _situacao(s, c, col, Situacao.EM_PROCESSO)
        if fp is not None and not col.funcao:
            col.funcao, col.funcao_chave = fp.funcao, fp.funcao_chave
    else:
        nome = " ".join((d.nome or "").split()).upper()
        if len(nome) < 5 or len(nome.split()) < 2:
            raise DomainError("informe nome e sobrenome (ou escolha a pessoa do efetivo)", "nome")
        empresa = " ".join(d.empresa.split()) or EMPRESA_PROPRIA
        chave = chave_provisoria(empresa, nome)
        if s.scalar(select(ColaboradorModel).where(ColaboradorModel.obra_id == c.obra_id, ColaboradorModel.chave == chave)):
            raise DomainError(f"{nome} já está no efetivo: escolha a pessoa na lista", "nome")
        funcao = " ".join((d.funcao or "").split()) or None
        col = ColaboradorModel(obra_id=c.obra_id, chave=chave, empresa=empresa, nome=nome[:150], funcao=funcao,
                               funcao_chave=chave_texto(funcao) or None, situacao=Situacao.EM_PROCESSO.value,
                               origem="manual", no_ultimo_arquivo=False)
        s.add(col)
        s.flush()
        s.add(MovimentoEfetivoModel(obra_id=c.obra_id, colaborador_id=col.id, tipo="ENTRADA", de=None,
                                    para="Em processo (mobilização)", por=c.usuario.id))
    p = Processo.iniciar(_quando(d.iniciado_em, agora), d.treinamento_antes)
    funcao = d.funcao or col.funcao
    m = ProcessoMobilizacaoModel(obra_id=c.obra_id, colaborador_id=col.id, nome=col.nome, funcao=funcao,
                                 funcao_chave=chave_texto(funcao) or None, vaga_id=vaga.id if vaga else None,
                                 empresa=col.empresa, requisicao=(d.requisicao or "").strip() or None,
                                 necessario_em=d.necessario_em, treinamento_antes=d.treinamento_antes,
                                 observacao=(d.observacao or "").strip() or None, criado_por=c.usuario.email or c.usuario.id,
                                 status=p.status.value, etapa_atual=p.etapa_atual.value)
    s.add(m)
    _gravar(m, p, None)
    s.flush()
    return _saida(s, c, [m])[0]


class DadosIn(BaseModel):
    requisicao: str | None = Field(None, max_length=40)
    necessario_em: date | None = None
    treinamento_antes: bool = False
    observacao: str | None = Field(None, max_length=500)


@router.put("/processos/{pid}")
def editar(pid: int, d: DadosIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    m = _processo(s, c, pid)
    if d.treinamento_antes != m.treinamento_antes and _dominio(m).concluida(Etapa.ASO):
        raise DomainError("a ordem treinamento/contratação só muda antes de liberar o ASO", "treinamento_antes")
    m.requisicao, m.necessario_em = (d.requisicao or "").strip() or None, d.necessario_em
    m.treinamento_antes, m.observacao = d.treinamento_antes, (d.observacao or "").strip() or None
    s.flush()
    return _saida(s, c, [m])[0]


class ConcluirIn(BaseModel):
    etapa: Etapa
    em: datetime | None = None
    observacao: str | None = Field(None, max_length=300)
    confirmar_treinamentos: bool = False
    matricula: str | None = Field(None, max_length=20)  # na Contratação
    admissao: date | None = None  # na Contratação
    cracha: str | None = Field(None, max_length=20)  # no Crachá


@router.post("/processos/{pid}/concluir")
def concluir(pid: int, d: ConcluirIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    m = _processo(s, c, pid)
    agora = _agora()
    col = s.get(ColaboradorModel, m.colaborador_id) if m.colaborador_id else None
    lib = Liberacoes(confirmar_treinamentos=d.confirmar_treinamentos)
    if col is not None:
        info = AptidaoGateway(s, c.obra_id).de([(col.id, col.funcao_chave)], date.today())[col.id]
        lib = Liberacoes(aso_apto=info.aso_libera, treinamentos_pendentes=tuple(info.pendentes),
                         funcao_tem_exigencia=info.funcao_tem_exigencia, confirmar_treinamentos=d.confirmar_treinamentos)
    p = _dominio(m).concluir(d.etapa, _quando(d.em, agora), lib)
    if col is not None and d.etapa == Etapa.CONTRATACAO:
        mat = normalizar_matricula(d.matricula) if d.matricula else None
        if mat:
            chave = chave_cadastro(col.empresa, mat, col.nome)
            outro = s.scalar(select(ColaboradorModel).where(ColaboradorModel.obra_id == c.obra_id, ColaboradorModel.chave == chave,
                                                            ColaboradorModel.id != col.id))
            if outro is not None:
                raise DomainError(f"a matrícula {mat} já é de {outro.nome}", "matricula")
            col.matricula, col.chave = mat, chave
            if col.empresa == EMPRESA_PROPRIA and not col.cracha:
                col.cracha = mat
            col.cadastro_pendente = False
        col.admissao = d.admissao or col.admissao or _quando(d.em, agora).date()
    if col is not None and d.etapa == Etapa.CRACHA:
        cr = (d.cracha or "").strip() or col.cracha
        if not cr:
            raise DomainError("informe o número do crachá emitido", "cracha")
        if s.scalar(select(ColaboradorModel).where(ColaboradorModel.obra_id == c.obra_id, ColaboradorModel.cracha == cr,
                                                   ColaboradorModel.id != col.id)):
            raise DomainError(f"o crachá {cr} já é de outra pessoa", "cracha")
        col.cracha = cr
    _gravar(m, p, c.usuario.email or c.usuario.id, d.observacao)
    _situacao(s, c, col, SITUACAO_DO_STATUS[p.status])
    s.flush()
    return _saida(s, c, [m])[0]


class DesistirIn(BaseModel):
    motivo: str = Field(min_length=3, max_length=300)
    em: datetime | None = None


@router.post("/processos/{pid}/desistir")
def desistir(pid: int, d: DesistirIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    m = _processo(s, c, pid)
    agora = _agora()
    p = _dominio(m).desistir(_quando(d.em, agora))
    m.motivo_desistencia = d.motivo.strip()
    _gravar(m, p, c.usuario.email or c.usuario.id)
    col = s.get(ColaboradorModel, m.colaborador_id) if m.colaborador_id else None
    _situacao(s, c, col, Situacao.DESISTENCIA)
    s.flush()
    return _saida(s, c, [m])[0]


@router.post("/processos/{pid}/voltar")
def voltar(pid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Desfaz a última conclusão (ou a desistência) lançada por engano."""
    m = _processo(s, c, pid)
    p = _dominio(m).voltar()
    m.motivo_desistencia = None
    _gravar(m, p, None)
    col = s.get(ColaboradorModel, m.colaborador_id) if m.colaborador_id else None
    _situacao(s, c, col, SITUACAO_DO_STATUS[p.status])
    s.flush()
    return _saida(s, c, [m])[0]


@router.delete("/processos/{pid}", status_code=204)
def excluir(pid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Apaga o processo (lançado por engano). A pessoa continua no efetivo."""
    s.delete(_processo(s, c, pid))


class MetasIn(BaseModel):
    metas: dict[Meta, float]


@router.put("/metas")
def salvar_metas(d: MetasIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    atuais = {x.meta: x for x in s.scalars(select(MetaMobilizacaoModel).where(MetaMobilizacaoModel.obra_id == c.obra_id))}
    for meta, dias in d.metas.items():
        if not 0 < dias <= 120:
            raise DomainError(f"meta de {ROTULO_META[meta]} entre 0 e 120 dias", meta.value)
        x = atuais.get(meta.value)
        if x is None:
            s.add(MetaMobilizacaoModel(obra_id=c.obra_id, meta=meta.value, dias=dias))
        else:
            x.dias = dias
    s.flush()
    return {k.value: v for k, v in _metas(s, c.obra_id).items()}


@router.get("/metricas")
def metricas(desde: date | None = None, ate: date | None = None, funcao: str | None = None,
             s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Esforço de cada aquisição: dias por etapa, gargalo, funil, metas e desistências (pela data de abertura)."""
    q = select(ProcessoMobilizacaoModel).where(ProcessoMobilizacaoModel.obra_id == c.obra_id)
    ms = list(s.scalars(q))
    ms = [m for m in ms if m.passagens and (not desde or m.passagens[0].entrou_em.date() >= desde)
          and (not ate or m.passagens[0].entrou_em.date() <= ate) and (not funcao or (m.funcao or "") == funcao)]
    agora = _agora()
    metas = _metas(s, c.obra_id)
    r = calcular(list(_nomeados(s, c.obra_id, ms, agora).values()), metas, agora)
    return {**r, "processos": len(ms), "funcoes_disponiveis": sorted({m.funcao for m in ms if m.funcao})}


# ---- vagas: a janela de contratação aberta pelo Planejamento (spec 089) --------------------------------
def _vaga(s: Session, c: ContextoObra, vid: int) -> VagaModel:
    v = s.get(VagaModel, vid)
    if v is None or v.obra_id != c.obra_id:
        raise NotFoundError("Vaga", vid)
    return v


def _processos_da_vaga(s: Session, vaga_ids: list[int]) -> dict[int, list[ProcessoMobilizacaoModel]]:
    out: dict[int, list[ProcessoMobilizacaoModel]] = {}
    if vaga_ids:
        for p in s.scalars(select(ProcessoMobilizacaoModel).where(ProcessoMobilizacaoModel.vaga_id.in_(vaga_ids))):
            out.setdefault(p.vaga_id, []).append(p)
    return out


def _ocupacao(s: Session, v: VagaModel, ps: list[ProcessoMobilizacaoModel] | None = None) -> Ocupacao:
    ps = ps if ps is not None else _processos_da_vaga(s, [v.id]).get(v.id, [])
    return Ocupacao(v.quantidade, sum(p.status == Status.MOBILIZADO.value for p in ps),
                    sum(p.status in (Status.EM_ANDAMENTO.value, Status.AGUARDANDO_CRACHA.value) for p in ps),
                    sum(p.status == Status.DESISTENCIA.value for p in ps), v.cancelada_em is not None)


def _preenchida_em(v: VagaModel, ps: list[ProcessoMobilizacaoModel]) -> datetime | None:
    saidas = sorted(x.saiu_em for p in ps if p.status == Status.MOBILIZADO.value for x in p.passagens
                    if x.etapa == Etapa.CRACHA.value and x.saiu_em)
    return saidas[v.quantidade - 1] if len(saidas) >= v.quantidade else None


def _vaga_out(v: VagaModel, ps: list[ProcessoMobilizacaoModel], oc: Ocupacao, agora: datetime) -> dict:
    fim = _preenchida_em(v, ps) if oc.situacao == SituacaoVaga.PREENCHIDA else (v.cancelada_em or agora)
    return {"id": v.id, "codigo": v.codigo, "funcao": v.funcao, "funcao_chave": v.funcao_chave, "empresa": v.empresa,
            "quantidade": v.quantidade, "necessario_em": v.necessario_em, "destino": v.destino, "solicitante": v.solicitante,
            "justificativa": v.justificativa, "aberta_por": v.aberta_por, "aberta_em": v.aberta_em,
            "cancelada_em": v.cancelada_em, "motivo_cancelamento": v.motivo_cancelamento,
            "situacao": oc.situacao.value, "situacao_rotulo": oc.situacao.rotulo, "mobilizados": oc.mobilizados,
            "em_processo": oc.em_processo, "desistencias": oc.desistencias, "saldo": oc.saldo,
            "dias_aberta": round(max(0.0, ((fim or agora) - v.aberta_em).total_seconds() / 86400), 2),
            "atrasada": bool(v.necessario_em and oc.situacao in (SituacaoVaga.ABERTA, SituacaoVaga.EM_ATENDIMENTO)
                             and v.necessario_em < agora.date()),
            "processos": [{"id": p.id, "nome": p.nome, "status": p.status, "etapa_atual": p.etapa_atual} for p in ps]}


@router.get("/vagas")
def listar_vagas(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    vs = list(s.scalars(select(VagaModel).where(VagaModel.obra_id == c.obra_id).order_by(VagaModel.aberta_em.desc())))
    ps = _processos_da_vaga(s, [v.id for v in vs])
    agora = _agora()
    ocs = {v.id: _ocupacao(s, v, ps.get(v.id, [])) for v in vs}
    res = resumo([VagaResumo(v.codigo, v.funcao, ocs[v.id], v.aberta_em, v.necessario_em, _preenchida_em(v, ps.get(v.id, [])))
                  for v in vs], agora.date())
    return {"vagas": [_vaga_out(v, ps.get(v.id, []), ocs[v.id], agora) for v in vs],
            "memorias": {k: m.como_dict() for k, m in res.items()}}


class VagaIn(BaseModel):
    funcao: str = Field(min_length=2, max_length=120)
    quantidade: int = 1
    empresa: str = Field(EMPRESA_PROPRIA, max_length=80)
    necessario_em: date | None = None
    destino: str | None = Field(None, max_length=150)
    solicitante: str | None = Field(None, max_length=120)
    justificativa: str | None = Field(None, max_length=500)


def _gravar_vaga(s: Session, c: ContextoObra, v: VagaModel, d: VagaIn) -> None:
    fp = funcao_padronizada(s, c.obra_id, d.funcao)
    Vaga(fp.funcao if fp else "", d.quantidade, d.necessario_em)
    if v.id is not None:
        oc = _ocupacao(s, v)
        if d.quantidade < oc.mobilizados + oc.em_processo:
            raise DomainError(f"a vaga já tem {oc.mobilizados + oc.em_processo} pessoa(s) mobilizada(s) ou em processo", "quantidade")
        if fp.funcao_chave != v.funcao_chave and (oc.mobilizados or oc.em_processo):
            raise DomainError("a função só muda antes de iniciar processos na vaga", "funcao")
    v.funcao, v.funcao_chave, v.quantidade, v.necessario_em = fp.funcao, fp.funcao_chave, d.quantidade, d.necessario_em
    v.empresa = " ".join(d.empresa.split()) or EMPRESA_PROPRIA
    v.destino, v.solicitante = (d.destino or "").strip() or None, (d.solicitante or "").strip() or None
    v.justificativa = (d.justificativa or "").strip() or None


@router.post("/vagas", status_code=201)
def abrir_vaga(d: VagaIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """O Planejamento abre a vaga; o RH (gestão) é avisado e inicia o ciclo de contratação a partir dela."""
    from app.modules.notificacoes.application import GESTAO, notificar

    codigos = list(s.scalars(select(VagaModel.codigo).where(VagaModel.obra_id == c.obra_id)))
    v = VagaModel(obra_id=c.obra_id, codigo=proximo_codigo(codigos), aberta_por=c.usuario.email or c.usuario.id, aberta_em=_agora())
    _gravar_vaga(s, c, v, d)
    s.add(v)
    s.flush()
    notificar(s, c.obra_id, tipo="vaga", gravidade="info", titulo=f"Vaga {v.codigo} aberta: {v.quantidade} × {v.funcao}",
              texto=f"Obra precisa em {v.necessario_em:%d/%m/%Y}." if v.necessario_em else "Inicie a contratação na Mobilização.",
              papeis=GESTAO, url="/app/efetivo/mobilizacao", autor_id=c.usuario.id, chave=f"vaga-{v.id}")
    return _vaga_out(v, [], _ocupacao(s, v, []), _agora())


@router.put("/vagas/{vid}")
def editar_vaga(vid: int, d: VagaIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    v = _vaga(s, c, vid)
    _gravar_vaga(s, c, v, d)
    s.flush()
    ps = _processos_da_vaga(s, [v.id]).get(v.id, [])
    return _vaga_out(v, ps, _ocupacao(s, v, ps), _agora())


class CancelarVagaIn(BaseModel):
    motivo: str = Field(min_length=3, max_length=300)


@router.post("/vagas/{vid}/cancelar")
def cancelar_vaga(vid: int, d: CancelarVagaIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Cancela a vaga. Processos abertos continuam (desistência ou conclusão é decisão do RH)."""
    v = _vaga(s, c, vid)
    v.cancelada_em, v.motivo_cancelamento = _agora(), d.motivo.strip()
    s.flush()
    ps = _processos_da_vaga(s, [v.id]).get(v.id, [])
    return _vaga_out(v, ps, _ocupacao(s, v, ps), _agora())


@router.post("/vagas/{vid}/reabrir")
def reabrir_vaga(vid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    v = _vaga(s, c, vid)
    v.cancelada_em, v.motivo_cancelamento = None, None
    s.flush()
    ps = _processos_da_vaga(s, [v.id]).get(v.id, [])
    return _vaga_out(v, ps, _ocupacao(s, v, ps), _agora())


@router.delete("/vagas/{vid}", status_code=204)
def excluir_vaga(vid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    v = _vaga(s, c, vid)
    if _processos_da_vaga(s, [v.id]).get(v.id):
        raise DomainError(f"a vaga {v.codigo} já tem processos: cancele em vez de excluir")
    s.delete(v)


# ---- configurações: treinamento previsto em contrato por função (spec 089) -----------------------------
@router.get("/config/treinamentos")
def config_treinamentos(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Funções de contratação com o que o contrato prevê de treinamento (dias e horas) e a sugestão de horas pela
    exigência de treinamentos da função (carga horária do catálogo)."""
    from app.modules.efetivo.infra.gateway import funcoes_de_contratacao

    prev = _previstos(s, c.obra_id)
    sug = horas_exigidas(s, c.obra_id)
    usadas = set(s.scalars(select(VagaModel.funcao_chave).where(VagaModel.obra_id == c.obra_id))) | set(
        s.scalars(select(ProcessoMobilizacaoModel.funcao_chave).where(ProcessoMobilizacaoModel.obra_id == c.obra_id)))
    out = []
    for f in funcoes_de_contratacao(s, c.obra_id).values():
        p = prev.get(f.funcao_chave)
        out.append({"funcao_chave": f.funcao_chave, "funcao": f.funcao, "pessoas": f.pessoas, "em_mobilizacao": f.funcao_chave in usadas,
                    "dias": p.dias if p else None, "horas": p.horas if p else None, "clausula": p.clausula if p else None,
                    "horas_sugeridas": sug.get(f.funcao_chave, sug.get("", 0)) or None})
    out.sort(key=lambda x: (not (x["dias"] or x["horas"]), not x["em_mobilizacao"], -x["pessoas"], x["funcao"]))
    return out


class PrevistoItem(BaseModel):
    funcao_chave: str = Field(min_length=1, max_length=120)
    dias: float | None = None
    horas: float | None = None
    clausula: str | None = Field(None, max_length=200)


class PrevistosIn(BaseModel):
    itens: list[PrevistoItem]


@router.put("/config/treinamentos")
def salvar_config_treinamentos(d: PrevistosIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    from app.modules.efetivo.infra.gateway import funcoes_de_contratacao

    funcoes = funcoes_de_contratacao(s, c.obra_id)
    prev = _previstos(s, c.obra_id)
    for it in d.itens:
        f = funcoes.get(it.funcao_chave)
        if f is None:
            raise DomainError("função não cadastrada", "funcao_chave")
        if it.dias is not None and not 0 < it.dias <= 120:
            raise DomainError(f"{f.funcao}: dias de treinamento entre 0 e 120", "dias")
        if it.horas is not None and not 0 < it.horas <= 2000:
            raise DomainError(f"{f.funcao}: horas de treinamento entre 0 e 2000", "horas")
        x = prev.get(it.funcao_chave)
        if it.dias is None and it.horas is None:
            if x is not None:
                s.delete(x)
            continue
        if x is None:
            x = TreinamentoPrevistoModel(obra_id=c.obra_id, funcao_chave=f.funcao_chave, funcao=f.funcao)
            s.add(x)
        x.dias, x.horas, x.clausula = it.dias, it.horas, (it.clausula or "").strip() or None
    s.flush()
    return {"salvos": len(d.itens)}
