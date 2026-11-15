"""ASOs e treinamentos (spec 088): catálogo, exigência por função, ASOs, registros (turmas), matriz e métricas."""
from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, ler, ssma
from app.core.db import get_session
from app.modules.efetivo.domain.efetivo import Situacao
from app.modules.efetivo.infra.models import ColaboradorModel
from app.modules.treinamentos.domain.aptidao import (
    JANELA_PADRAO,
    Aso,
    PessoaApta,
    ResultadoAso,
    TipoAso,
    Treinamento,
    Validade,
    indicadores,
    situacao_validade,
    valido_ate_padrao,
)
from app.modules.treinamentos.infra.gateway import AptidaoGateway
from app.modules.treinamentos.infra.models import (
    AsoModel,
    ColaboradorTreinamentoModel,
    TreinamentoFuncaoModel,
    TreinamentoModel,
)
from app.shared.errors import DomainError, NotFoundError

router = APIRouter(prefix="/treinamentos", tags=["ASOs e treinamentos"])

CONSIDERADOS = (Situacao.MOBILIZADO, Situacao.AFASTADO, Situacao.AGUARDANDO_CRACHA, Situacao.EM_PROCESSO, Situacao.PREVISTO)


def _do(s: Session, c: ContextoObra, modelo, oid: int, nome: str):
    m = s.get(modelo, oid)
    if m is None or m.obra_id != c.obra_id:
        raise NotFoundError(nome, oid)
    return m


def _pessoa(s: Session, c: ContextoObra, cid: int) -> ColaboradorModel:
    return _do(s, c, ColaboradorModel, cid, "Colaborador")


# ---- catálogo -----------------------------------------------------------------------------------------
class TreinamentoIn(BaseModel):
    nome: str = Field(min_length=2, max_length=120)
    norma: str | None = Field(None, max_length=40)
    validade_meses: int = 12
    carga_horaria: float | None = None
    impeditivo: bool = False
    todos: bool = False
    ativo: bool = True


def _t_out(t: TreinamentoModel, funcoes: int = 0, registros: int = 0) -> dict:
    return {"id": t.id, "nome": t.nome, "norma": t.norma, "validade_meses": t.validade_meses,
            "carga_horaria": t.carga_horaria, "impeditivo": t.impeditivo, "todos": t.todos, "ativo": t.ativo,
            "funcoes": funcoes, "registros": registros}


@router.get("/catalogo")
def catalogo(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    nf = dict(s.execute(select(TreinamentoFuncaoModel.treinamento_id, func.count()).where(
        TreinamentoFuncaoModel.obra_id == c.obra_id).group_by(TreinamentoFuncaoModel.treinamento_id)).all())
    nr = dict(s.execute(select(ColaboradorTreinamentoModel.treinamento_id, func.count()).where(
        ColaboradorTreinamentoModel.obra_id == c.obra_id).group_by(ColaboradorTreinamentoModel.treinamento_id)).all())
    return [_t_out(t, nf.get(t.id, 0), nr.get(t.id, 0)) for t in s.scalars(
        select(TreinamentoModel).where(TreinamentoModel.obra_id == c.obra_id).order_by(TreinamentoModel.nome))]


def _salvar_t(s: Session, c: ContextoObra, t: TreinamentoModel, d: TreinamentoIn) -> dict:
    nome = " ".join(d.nome.split())
    Treinamento(id=t.id or 0, nome=nome, validade_meses=d.validade_meses, impeditivo=d.impeditivo, todos=d.todos,
                carga_horaria=d.carga_horaria)  # valida
    outro = s.scalar(select(TreinamentoModel).where(TreinamentoModel.obra_id == c.obra_id,
                                                    func.upper(TreinamentoModel.nome) == nome.upper()))
    if outro is not None and outro.id != t.id:
        raise DomainError(f"já existe o treinamento {outro.nome}", "nome")
    t.nome, t.norma, t.validade_meses, t.carga_horaria = nome, (d.norma or "").strip() or None, d.validade_meses, d.carga_horaria
    t.impeditivo, t.todos, t.ativo = d.impeditivo, d.todos, d.ativo
    s.flush()
    return _t_out(t)


@router.post("/catalogo", status_code=201)
def criar_treinamento(d: TreinamentoIn, s: Session = Depends(get_session), c: ContextoObra = Depends(ssma)):
    t = TreinamentoModel(obra_id=c.obra_id)
    s.add(t)
    return _salvar_t(s, c, t, d)


@router.put("/catalogo/{tid}")
def atualizar_treinamento(tid: int, d: TreinamentoIn, s: Session = Depends(get_session), c: ContextoObra = Depends(ssma)):
    return _salvar_t(s, c, _do(s, c, TreinamentoModel, tid, "Treinamento"), d)


@router.delete("/catalogo/{tid}", status_code=204)
def excluir_treinamento(tid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(ssma)):
    t = _do(s, c, TreinamentoModel, tid, "Treinamento")
    n = s.scalar(select(func.count()).select_from(ColaboradorTreinamentoModel).where(ColaboradorTreinamentoModel.treinamento_id == tid))
    if n:
        raise DomainError(f"{t.nome} tem {n} registro(s) de pessoas: desative em vez de excluir")
    s.delete(t)


# ---- exigência por função -----------------------------------------------------------------------------
@router.get("/exigencias")
def exigencias(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Funções do efetivo (ativos e em mobilização) com os treinamentos exigidos de cada uma."""
    funcoes: dict[str, dict] = {}
    for fch, fn, n in s.execute(
            select(ColaboradorModel.funcao_chave, func.min(ColaboradorModel.funcao), func.count())
            .where(ColaboradorModel.obra_id == c.obra_id, ColaboradorModel.funcao_chave.is_not(None),
                   ColaboradorModel.situacao.in_([x.value for x in CONSIDERADOS]))
            .group_by(ColaboradorModel.funcao_chave)):
        funcoes[fch] = {"funcao_chave": fch, "funcao": fn, "pessoas": n, "treinamentos": []}
    for x in s.scalars(select(TreinamentoFuncaoModel).where(TreinamentoFuncaoModel.obra_id == c.obra_id)):
        funcoes.setdefault(x.funcao_chave, {"funcao_chave": x.funcao_chave, "funcao": x.funcao_chave, "pessoas": 0,
                                            "treinamentos": []})["treinamentos"].append(x.treinamento_id)
    return sorted(funcoes.values(), key=lambda f: (-f["pessoas"], f["funcao"] or ""))


class ExigenciaIn(BaseModel):
    funcao_chave: str = Field(min_length=1, max_length=120)
    treinamentos: list[int]


@router.put("/exigencias")
def salvar_exigencia(d: ExigenciaIn, s: Session = Depends(get_session), c: ContextoObra = Depends(ssma)):
    validos = set(s.scalars(select(TreinamentoModel.id).where(TreinamentoModel.obra_id == c.obra_id)))
    if set(d.treinamentos) - validos:
        raise DomainError("treinamento de outra obra ou inexistente", "treinamentos")
    atuais = {x.treinamento_id: x for x in s.scalars(select(TreinamentoFuncaoModel).where(
        TreinamentoFuncaoModel.obra_id == c.obra_id, TreinamentoFuncaoModel.funcao_chave == d.funcao_chave))}
    for tid, x in atuais.items():
        if tid not in d.treinamentos:
            s.delete(x)
    for tid in set(d.treinamentos) - set(atuais):
        s.add(TreinamentoFuncaoModel(obra_id=c.obra_id, funcao_chave=d.funcao_chave, treinamento_id=tid))
    s.flush()
    return {"funcao_chave": d.funcao_chave, "treinamentos": sorted(set(d.treinamentos))}


# ---- ASOs ---------------------------------------------------------------------------------------------
class AsoIn(BaseModel):
    colaborador_id: int
    tipo: TipoAso
    data_exame: date
    valido_ate: date | None = None  # vazio = 12 meses
    resultado: ResultadoAso
    clinica: str | None = Field(None, max_length=120)
    observacao: str | None = Field(None, max_length=300)


def _aso_out(a: AsoModel, nome: str | None, hoje: date) -> dict:
    sit = Validade.VENCIDO if a.resultado == ResultadoAso.INAPTO else situacao_validade(a.valido_ate, hoje)
    return {"id": a.id, "colaborador_id": a.colaborador_id, "nome": nome, "tipo": a.tipo, "tipo_rotulo": TipoAso(a.tipo).rotulo,
            "data_exame": a.data_exame, "valido_ate": a.valido_ate, "resultado": a.resultado,
            "resultado_rotulo": ResultadoAso(a.resultado).rotulo, "clinica": a.clinica, "observacao": a.observacao,
            "situacao": sit.value, "dias_para_vencer": (a.valido_ate - hoje).days}


@router.get("/asos")
def listar_asos(colaborador_id: int | None = None, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    q = (select(AsoModel, ColaboradorModel.nome).join(ColaboradorModel, ColaboradorModel.id == AsoModel.colaborador_id)
         .where(AsoModel.obra_id == c.obra_id))
    if colaborador_id:
        q = q.where(AsoModel.colaborador_id == colaborador_id)
    hoje = date.today()
    return [_aso_out(a, nm, hoje) for a, nm in s.execute(q.order_by(AsoModel.data_exame.desc(), AsoModel.id.desc()))]


def _salvar_aso(s: Session, c: ContextoObra, a: AsoModel, d: AsoIn) -> dict:
    p = _pessoa(s, c, d.colaborador_id)
    ate = d.valido_ate or valido_ate_padrao(d.data_exame, 12)
    Aso(d.tipo, d.data_exame, ate, d.resultado)  # valida
    if d.data_exame > date.today():
        raise DomainError("a data do exame não pode estar no futuro", "data_exame")
    a.colaborador_id, a.tipo, a.data_exame, a.valido_ate, a.resultado = p.id, d.tipo.value, d.data_exame, ate, d.resultado.value
    a.clinica, a.observacao = (d.clinica or "").strip() or None, (d.observacao or "").strip() or None
    s.flush()
    return _aso_out(a, p.nome, date.today())


@router.post("/asos", status_code=201)
def criar_aso(d: AsoIn, s: Session = Depends(get_session), c: ContextoObra = Depends(ssma)):
    a = AsoModel(obra_id=c.obra_id, registrado_por=c.usuario.email or c.usuario.id)
    s.add(a)
    return _salvar_aso(s, c, a, d)


@router.put("/asos/{aid}")
def atualizar_aso(aid: int, d: AsoIn, s: Session = Depends(get_session), c: ContextoObra = Depends(ssma)):
    return _salvar_aso(s, c, _do(s, c, AsoModel, aid, "ASO"), d)


@router.delete("/asos/{aid}", status_code=204)
def excluir_aso(aid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(ssma)):
    s.delete(_do(s, c, AsoModel, aid, "ASO"))


# ---- registros de treinamento (turmas) ----------------------------------------------------------------
class RegistroIn(BaseModel):
    treinamento_id: int
    colaboradores: list[int] = Field(min_length=1, max_length=500)
    realizado_em: date
    valido_ate: date | None = None  # vazio = pela validade do catálogo
    entidade: str | None = Field(None, max_length=120)
    observacao: str | None = Field(None, max_length=300)


def _r_out(r: ColaboradorTreinamentoModel, nome: str | None, trein: str | None, hoje: date) -> dict:
    return {"id": r.id, "colaborador_id": r.colaborador_id, "nome": nome, "treinamento_id": r.treinamento_id,
            "treinamento": trein, "realizado_em": r.realizado_em, "valido_ate": r.valido_ate, "entidade": r.entidade,
            "observacao": r.observacao, "situacao": situacao_validade(r.valido_ate, hoje).value}


@router.get("/registros")
def listar_registros(colaborador_id: int | None = None, treinamento_id: int | None = None,
                     s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    q = (select(ColaboradorTreinamentoModel, ColaboradorModel.nome, TreinamentoModel.nome)
         .join(ColaboradorModel, ColaboradorModel.id == ColaboradorTreinamentoModel.colaborador_id)
         .join(TreinamentoModel, TreinamentoModel.id == ColaboradorTreinamentoModel.treinamento_id)
         .where(ColaboradorTreinamentoModel.obra_id == c.obra_id))
    if colaborador_id:
        q = q.where(ColaboradorTreinamentoModel.colaborador_id == colaborador_id)
    if treinamento_id:
        q = q.where(ColaboradorTreinamentoModel.treinamento_id == treinamento_id)
    hoje = date.today()
    return [_r_out(r, nm, tn, hoje) for r, nm, tn in
            s.execute(q.order_by(ColaboradorTreinamentoModel.realizado_em.desc(), ColaboradorTreinamentoModel.id.desc()).limit(3000))]


@router.post("/registros", status_code=201)
def registrar_turma(d: RegistroIn, s: Session = Depends(get_session), c: ContextoObra = Depends(ssma)):
    """Uma turma: o mesmo treinamento, na mesma data, para várias pessoas."""
    t = _do(s, c, TreinamentoModel, d.treinamento_id, "Treinamento")
    if d.realizado_em > date.today():
        raise DomainError("a data do treinamento não pode estar no futuro", "realizado_em")
    ate = d.valido_ate if d.valido_ate is not None else valido_ate_padrao(d.realizado_em, t.validade_meses)
    if ate is not None and ate < d.realizado_em:
        raise DomainError("a validade não pode ser antes da realização", "valido_ate")
    pessoas = {p.id: p for p in s.scalars(select(ColaboradorModel).where(ColaboradorModel.obra_id == c.obra_id,
                                                                         ColaboradorModel.id.in_(d.colaboradores)))}
    if len(pessoas) != len(set(d.colaboradores)):
        raise DomainError("pessoa de outra obra ou inexistente", "colaboradores")
    out = []
    for cid in dict.fromkeys(d.colaboradores):
        r = ColaboradorTreinamentoModel(obra_id=c.obra_id, colaborador_id=cid, treinamento_id=t.id, realizado_em=d.realizado_em,
                                        valido_ate=ate, entidade=(d.entidade or "").strip() or None,
                                        observacao=(d.observacao or "").strip() or None,
                                        registrado_por=c.usuario.email or c.usuario.id)
        s.add(r)
        s.flush()
        out.append(_r_out(r, pessoas[cid].nome, t.nome, date.today()))
    return out


@router.delete("/registros/{rid}", status_code=204)
def excluir_registro(rid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(ssma)):
    s.delete(_do(s, c, ColaboradorTreinamentoModel, rid, "Registro de treinamento"))


# ---- pessoa, matriz e métricas ------------------------------------------------------------------------
def _considerados(s: Session, obra_id: int, situacoes: list[str] | None = None) -> list[ColaboradorModel]:
    sits = situacoes or [x.value for x in CONSIDERADOS]
    return list(s.scalars(select(ColaboradorModel).where(ColaboradorModel.obra_id == obra_id,
                                                         ColaboradorModel.situacao.in_(sits)).order_by(ColaboradorModel.nome)))


def _celulas(info) -> dict:
    return {str(x.treinamento_id): {"situacao": x.situacao.value, "valido_ate": x.valido_ate, "realizado_em": x.realizado_em,
                                    "impeditivo": x.impeditivo} for x in info.aptidao.celulas}


@router.get("/pessoa/{cid}")
def pessoa(cid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Ficha de segurança da pessoa: ASOs, treinamentos, exigidos e o que impede."""
    p = _pessoa(s, c, cid)
    g = AptidaoGateway(s, c.obra_id)
    info = g.de([(p.id, p.funcao_chave)], date.today())[p.id]
    return {"colaborador_id": p.id, "nome": p.nome, "funcao": p.funcao, "aso": info.aptidao.aso.value,
            "aso_libera": info.aso_libera, "impedida": info.aptidao.impedida, "impedimentos": info.impedimentos,
            "pendentes": info.pendentes, "funcao_tem_exigencia": info.funcao_tem_exigencia,
            "exigidos": [{"id": t.id, "nome": t.nome, "impeditivo": t.impeditivo, "todos": t.todos} for t in info.exigidos],
            "celulas": _celulas(info),
            "asos": listar_asos(colaborador_id=cid, s=s, c=c), "registros": listar_registros(colaborador_id=cid, s=s, c=c)}


@router.get("/matriz")
def matriz(situacao: str | None = None, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Pessoa × treinamento exigido (colunas = treinamentos exigidos de alguém), com o ASO."""
    pessoas = _considerados(s, c.obra_id, situacao.split(",") if situacao else None)
    g = AptidaoGateway(s, c.obra_id)
    infos = g.de([(p.id, p.funcao_chave) for p in pessoas], date.today())
    usados = {t.id for i in infos.values() for t in i.exigidos}
    return {
        "treinamentos": [{"id": t.id, "nome": t.nome, "impeditivo": t.impeditivo, "todos": t.todos}
                         for t in g.treinamentos if t.id in usados],
        "pessoas": [{"id": p.id, "nome": p.nome, "funcao": p.funcao, "empresa": p.empresa, "situacao": p.situacao,
                     "aso": infos[p.id].aptidao.aso.value,
                     "aso_valido_ate": infos[p.id].aptidao.aso_vigente.valido_ate if infos[p.id].aptidao.aso_vigente else None,
                     "impedida": infos[p.id].aptidao.impedida, "impedimentos": infos[p.id].impedimentos,
                     "celulas": _celulas(infos[p.id])} for p in pessoas],
    }


@router.get("/indicadores")
def metricas(janela: int = JANELA_PADRAO, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    hoje = date.today()
    janela = max(1, min(janela, 180))
    pessoas = _considerados(s, c.obra_id)
    g = AptidaoGateway(s, c.obra_id)
    infos = g.de([(p.id, p.funcao_chave) for p in pessoas], hoje)
    mem = indicadores([PessoaApta(p.nome, infos[p.id].aptidao) for p in pessoas], g.nomes, hoje, janela)
    # vencimentos dos próximos 60 dias (ASO vigente e treinamentos exigidos)
    venc = []
    for p in pessoas:
        a = infos[p.id].aptidao
        if a.aso_vigente and 0 <= (a.aso_vigente.valido_ate - hoje).days <= 60:
            venc.append({"colaborador_id": p.id, "nome": p.nome, "item": "ASO", "valido_ate": a.aso_vigente.valido_ate,
                         "dias": (a.aso_vigente.valido_ate - hoje).days})
        for x in a.celulas:
            if x.valido_ate and 0 <= (x.valido_ate - hoje).days <= 60:
                venc.append({"colaborador_id": p.id, "nome": p.nome, "item": g.nomes.get(x.treinamento_id),
                             "valido_ate": x.valido_ate, "dias": (x.valido_ate - hoje).days})
    por_trein = []
    for t in g.treinamentos:
        cel = [i.aptidao for i in infos.values() for x in i.aptidao.celulas if x.treinamento_id == t.id]
        if not cel:
            continue
        cont = {v.value: 0 for v in Validade}
        for i in infos.values():
            for x in i.aptidao.celulas:
                if x.treinamento_id == t.id:
                    cont[x.situacao.value] += 1
        por_trein.append({"id": t.id, "nome": t.nome, "impeditivo": t.impeditivo, "exigidos": len(cel), **cont})
    return {"memorias": {k: m.como_dict() for k, m in mem.items()}, "pessoas": len(pessoas), "janela": janela,
            "vencimentos": sorted(venc, key=lambda v: v["dias"])[:200], "por_treinamento": por_trein}
