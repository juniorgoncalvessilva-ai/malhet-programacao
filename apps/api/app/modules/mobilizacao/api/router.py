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
    PassagemMobilizacaoModel,
    ProcessoMobilizacaoModel,
)
from app.modules.treinamentos.infra.gateway import AptidaoGateway
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


def _out(m: ProcessoMobilizacaoModel, metas: dict[Meta, float], agora: datetime, apt=None) -> dict:
    p = _dominio(m)
    esf = esforco(p, agora)
    g = gargalo(p, agora)
    return {
        "id": m.id, "colaborador_id": m.colaborador_id, "nome": m.nome, "funcao": m.funcao, "empresa": m.empresa,
        "requisicao": m.requisicao, "necessario_em": m.necessario_em, "treinamento_antes": m.treinamento_antes,
        "status": p.status.value, "status_rotulo": p.status.rotulo, "etapa_atual": p.etapa_atual.value,
        "etapa_rotulo": p.etapa_atual.rotulo, "motivo_desistencia": m.motivo_desistencia, "observacao": m.observacao,
        "criado_por": m.criado_por, "criado_em": m.criado_em,
        "passagens": [{"etapa": x.etapa, "rotulo": Etapa(x.etapa).rotulo, "entrou_em": x.entrou_em, "saiu_em": x.saiu_em,
                       "dias": round(Passagem(Etapa(x.etapa), x.entrou_em, x.saiu_em).dias(agora), 2),
                       "concluido_por": x.concluido_por, "observacao": x.observacao} for x in m.passagens],
        "esforco": {k: round(v, 2) for k, v in esf.items()}, "dias_total": round(p.dias_total(agora), 2),
        "gargalo": g.value if g else None, "atrasos": [x.value for x in p.atrasos(metas, agora)],
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
    metas, agora = _metas(s, c.obra_id), _agora()
    apt = _aptidoes(s, c.obra_id, ms)
    return [_out(m, metas, agora, apt.get(m.colaborador_id)) for m in ms]


class ProcessoIn(BaseModel):
    colaborador_id: int | None = None  # pessoa já no efetivo (ex.: prevista na planilha do DP)
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
    m = ProcessoMobilizacaoModel(obra_id=c.obra_id, colaborador_id=col.id, nome=col.nome, funcao=d.funcao or col.funcao,
                                 empresa=col.empresa, requisicao=(d.requisicao or "").strip() or None,
                                 necessario_em=d.necessario_em, treinamento_antes=d.treinamento_antes,
                                 observacao=(d.observacao or "").strip() or None, criado_por=c.usuario.email or c.usuario.id,
                                 status=p.status.value, etapa_atual=p.etapa_atual.value)
    s.add(m)
    _gravar(m, p, None)
    s.flush()
    return _out(m, _metas(s, c.obra_id), agora, _aptidoes(s, c.obra_id, [m]).get(col.id))


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
    return _out(m, _metas(s, c.obra_id), _agora(), _aptidoes(s, c.obra_id, [m]).get(m.colaborador_id))


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
    return _out(m, _metas(s, c.obra_id), agora, _aptidoes(s, c.obra_id, [m]).get(m.colaborador_id))


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
    return _out(m, _metas(s, c.obra_id), agora)


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
    return _out(m, _metas(s, c.obra_id), _agora(), _aptidoes(s, c.obra_id, [m]).get(m.colaborador_id))


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
    r = calcular([ProcessoNomeado(m.id, m.nome, m.funcao, _dominio(m)) for m in ms], metas, agora)
    return {**r, "processos": len(ms), "funcoes_disponiveis": sorted({m.funcao for m in ms if m.funcao})}
