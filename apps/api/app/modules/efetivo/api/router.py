"""Efetivo e mobilização: importação semanal, equipes montadas pelo efetivo, de-para de funções e organograma."""
from datetime import date, datetime

from fastapi import APIRouter, Depends, File, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, ler, planejar
from app.core.db import get_session
from app.modules.efetivo.application.importar_efetivo import importar_efetivo
from app.modules.efetivo.domain.efetivo import Situacao, chave_texto, sugerir_recurso
from app.modules.efetivo.domain.organograma import (
    CORES_PADRAO,
    DisciplinaOrg,
    PessoaOrg,
    SetorOrg,
    filtrar,
    montar_organograma,
    validar_cor,
    validar_cores,
)
from app.modules.efetivo.infra.gateway import depara
from app.modules.efetivo.infra.models import (
    ColaboradorModel,
    DeParaFuncaoModel,
    ImportacaoEfetivoModel,
    MovimentoEfetivoModel,
    OrganogramaConfigModel,
    SetorObraModel,
    SubsetorObraModel,
)
from app.modules.equipes.infra.models import EquipeMembroModel, EquipeModel
from app.shared.errors import DomainError, NotFoundError

router = APIRouter(prefix="/efetivo", tags=["efetivo e mobilização"])


class ColaboradorOut(BaseModel):
    id: int
    chave: str
    empresa: str
    matricula: str | None
    cracha: str | None
    nome: str
    funcao: str | None
    funcao_composicao: str | None
    dp: str | None
    tipo_mo: str | None
    status_original: str | None
    situacao: str
    situacao_rotulo: str
    mobilizacao_prevista: date | None
    admissao: date | None
    demissao: date | None
    cracha_vale: str | None
    rac2: bool | None
    paebm: bool | None
    no_ultimo_arquivo: bool
    equipe_id: int | None = None
    equipe: str | None = None
    encarregado_de: str | None = None  # equipe que a pessoa encarrega


def _rotulo(sit: str) -> str:
    return Situacao(sit).rotulo if sit in Situacao._value2member_map_ else sit


def _vinculos(s: Session, obra_id: int) -> tuple[dict[str, EquipeModel], dict[str, EquipeModel]]:
    """crachá → equipe em que está (membro) e crachá → equipe que encarrega."""
    equipes = {e.id: e for e in s.scalars(select(EquipeModel).where(EquipeModel.obra_id == obra_id))}
    membro = {m.cracha: equipes[m.equipe_id] for e in equipes.values() for m in e.membros}
    enc = {e.encarregado_cracha: e for e in equipes.values() if e.encarregado_cracha}
    return membro, enc


def _out(m: ColaboradorModel, membro: dict, enc: dict, dp: dict) -> ColaboradorOut:
    eq = membro.get(m.cracha) if m.cracha else None
    e_enc = enc.get(m.cracha) if m.cracha else None
    d = dp.get(m.funcao_chave or "")
    return ColaboradorOut(
        id=m.id, chave=m.chave, empresa=m.empresa, matricula=m.matricula, cracha=m.cracha, nome=m.nome, funcao=m.funcao,
        funcao_composicao=(d.recurso if d and not d.ignorar else None), dp=m.dp, tipo_mo=m.tipo_mo,
        status_original=m.status_original, situacao=m.situacao, situacao_rotulo=_rotulo(m.situacao),
        mobilizacao_prevista=m.mobilizacao_prevista, admissao=m.admissao, demissao=m.demissao,
        cracha_vale=m.cracha_vale, rac2=m.rac2, paebm=m.paebm, no_ultimo_arquivo=m.no_ultimo_arquivo,
        equipe_id=(eq or e_enc).id if (eq or e_enc) else None, equipe=(eq or e_enc).nome if (eq or e_enc) else None,
        encarregado_de=e_enc.nome if e_enc else None)


def _colab(s: Session, c: ContextoObra, cid: int) -> ColaboradorModel:
    m = s.get(ColaboradorModel, cid)
    if m is None or m.obra_id != c.obra_id:
        raise NotFoundError("Colaborador", cid)
    return m


# ---- importação e consulta ------------------------------------------------------------------------------
@router.post("/importar")
def importar(arquivo: UploadFile = File(...), s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Planilha de efetivo do DP (.xls/.xlsx). Atualiza pela matrícula; a composição das equipes não muda, só o vínculo
    das pessoas (número antes do nome → matrícula)."""
    r = importar_efetivo(s, c.obra_id, arquivo.file, nome_arquivo=arquivo.filename or "efetivo.xls",
                         usuario=c.usuario.id)
    from app.modules.equipes.application.vincular_efetivo import vincular_equipes

    return {**r, "vinculo_equipes": vincular_equipes(s, c.obra_id)}


@router.get("/colaboradores", response_model=list[ColaboradorOut])
def listar(situacao: str | None = None, empresa: str | None = None, q: str | None = None, sem_equipe: bool = False,
           s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    stmt = select(ColaboradorModel).where(ColaboradorModel.obra_id == c.obra_id)
    if situacao:
        stmt = stmt.where(ColaboradorModel.situacao.in_(situacao.split(",")))
    if empresa:
        stmt = stmt.where(ColaboradorModel.empresa.in_(empresa.split("|")))
    if q:
        stmt = stmt.where(or_(ColaboradorModel.nome.ilike(f"%{q}%"), ColaboradorModel.matricula.ilike(f"{q}%"),
                              ColaboradorModel.funcao.ilike(f"%{q}%")))
    membro, enc = _vinculos(s, c.obra_id)
    dp = depara(s, c.obra_id)
    out = [_out(m, membro, enc, dp) for m in s.scalars(stmt.order_by(ColaboradorModel.nome))]
    return [o for o in out if not (sem_equipe and o.equipe_id)]


@router.get("/resumo")
def resumo(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    cs = list(s.scalars(select(ColaboradorModel).where(ColaboradorModel.obra_id == c.obra_id)))
    membro, enc = _vinculos(s, c.obra_id)
    dp = depara(s, c.obra_id)
    por_sit: dict[str, int] = {}
    for m in cs:
        por_sit[m.situacao] = por_sit.get(m.situacao, 0) + 1
    ativos = [m for m in cs if Situacao(m.situacao).ativo]
    ult = s.scalar(select(ImportacaoEfetivoModel).where(ImportacaoEfetivoModel.obra_id == c.obra_id)
                   .order_by(ImportacaoEfetivoModel.id.desc()).limit(1))
    desm_em_equipe = [m.nome for m in cs if m.cracha in membro and not Situacao(m.situacao).ativo]
    funcoes_sem = {m.funcao_chave for m in ativos if m.funcao_chave and m.funcao_chave not in dp}
    return {
        "total": len(cs), "por_situacao": por_sit,
        "por_empresa": {e: sum(1 for m in ativos if m.empresa == e) for e in sorted({m.empresa for m in ativos})},
        "ativos": len(ativos), "em_mobilizacao": sum(1 for m in cs if Situacao(m.situacao).em_mobilizacao),
        "sem_equipe": sum(1 for m in ativos if not (m.cracha and (m.cracha in membro or m.cracha in enc))),
        "fora_do_ultimo_arquivo": sum(1 for m in cs if not m.no_ultimo_arquivo),
        "desmobilizados_em_equipe": desm_em_equipe[:50],
        "funcoes_sem_depara": len(funcoes_sem),
        "ultima_importacao": ({"arquivo": ult.arquivo, "em": ult.importado_em.isoformat(), "resumo": ult.resumo}
                              if ult else None),
    }


@router.get("/movimentos")
def movimentos(colaborador_id: int | None = None, limite: int = 200, s: Session = Depends(get_session),
               c: ContextoObra = Depends(ler)):
    stmt = (select(MovimentoEfetivoModel, ColaboradorModel.nome)
            .join(ColaboradorModel, ColaboradorModel.id == MovimentoEfetivoModel.colaborador_id)
            .where(MovimentoEfetivoModel.obra_id == c.obra_id))
    if colaborador_id:
        stmt = stmt.where(MovimentoEfetivoModel.colaborador_id == colaborador_id)
    return [{"id": mv.id, "colaborador_id": mv.colaborador_id, "nome": nome, "tipo": mv.tipo, "de": mv.de,
             "para": mv.para, "em": mv.em.isoformat()}
            for mv, nome in s.execute(stmt.order_by(MovimentoEfetivoModel.id.desc()).limit(min(limite, 1000)))]


class CrachaIn(BaseModel):
    cracha: str | None = Field(None, max_length=20)


@router.put("/colaboradores/{cid}/cracha", response_model=ColaboradorOut)
def definir_cracha(cid: int, d: CrachaIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Crachá do Simova para quem não tem matrícula própria (terceiros)."""
    m = _colab(s, c, cid)
    novo = (d.cracha or "").strip() or None
    if novo and s.scalar(select(ColaboradorModel).where(ColaboradorModel.obra_id == c.obra_id,
                                                        ColaboradorModel.cracha == novo, ColaboradorModel.id != m.id)):
        raise DomainError(f"o crachá {novo} já é de outra pessoa", "cracha")
    if m.cracha and m.cracha != novo:
        for mb in s.scalars(select(EquipeMembroModel).where(EquipeMembroModel.cracha == m.cracha)):
            mb.cracha = novo
    m.cracha = novo
    s.flush()
    membro, enc = _vinculos(s, c.obra_id)
    return _out(m, membro, enc, depara(s, c.obra_id))


# ---- equipes montadas pelo efetivo ----------------------------------------------------------------------
def _tirar_de_equipes(s: Session, obra_id: int, cracha: str) -> str | None:
    saiu = None
    for e in s.scalars(select(EquipeModel).where(EquipeModel.obra_id == obra_id)):
        for mb in list(e.membros):
            if mb.cracha == cracha:
                e.membros.remove(mb)
                saiu = e.nome
    return saiu


def _mover(s: Session, c: ContextoObra, m: ColaboradorModel, equipe: EquipeModel | None) -> None:
    if not m.cracha and equipe is None:
        return  # sem crachá não está em equipe nenhuma
    if not m.cracha:
        raise DomainError(f"{m.nome} não tem crachá/matrícula: defina o crachá antes de colocar em equipe")
    if equipe is not None and equipe.encarregado_cracha == m.cracha:
        raise DomainError(f"{m.nome} é o encarregado de {equipe.nome}")
    de = _tirar_de_equipes(s, c.obra_id, m.cracha)
    if equipe is not None:
        equipe.membros.append(EquipeMembroModel(cracha=m.cracha, nome=m.nome[:150], funcao=None))
    if (de or None) != (equipe.nome if equipe else None):
        s.add(MovimentoEfetivoModel(obra_id=c.obra_id, colaborador_id=m.id, tipo="EQUIPE", de=de,
                                    para=equipe.nome if equipe else None, por=c.usuario.id))


def _equipe(s: Session, c: ContextoObra, eid: int) -> EquipeModel:
    e = s.get(EquipeModel, eid)
    if e is None or e.obra_id != c.obra_id:
        raise NotFoundError("Equipe", eid)
    return e


class MoverIn(BaseModel):
    colaboradores: list[int]
    equipe_id: int | None = None  # None = tirar da equipe


@router.put("/equipe")
def mover(d: MoverIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Coloca (ou tira) colaboradores numa equipe. Cada pessoa fica em uma equipe só."""
    e = _equipe(s, c, d.equipe_id) if d.equipe_id else None
    sem = [m.nome for m in (_colab(s, c, x) for x in d.colaboradores) if not m.cracha]
    if sem and e is not None:
        raise DomainError(f"sem crachá/matrícula (defina o crachá ou tire da seleção): {', '.join(sem)}", "colaboradores")
    for cid in d.colaboradores:
        _mover(s, c, _colab(s, c, cid), e)
    s.flush()
    return {"movidos": len(d.colaboradores), "equipe": e.nome if e else None}


class NovaEquipeIn(BaseModel):
    nome: str = Field(min_length=2, max_length=120)
    encarregado_id: int
    colaboradores: list[int] = []
    turno: str | None = "Diurno"
    jornada_horas: float = Field(9.0, gt=0, le=24)
    responsavel: str | None = None
    codigo_simova: str | None = None


@router.post("/equipes", status_code=201)
def criar_equipe(d: NovaEquipeIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Cria a equipe com o encarregado e os colaboradores escolhidos no efetivo."""
    if s.scalar(select(EquipeModel).where(EquipeModel.obra_id == c.obra_id, EquipeModel.nome == d.nome.strip())):
        raise DomainError(f"já existe a equipe {d.nome}", "nome")
    enc = _colab(s, c, d.encarregado_id)
    sem = [m.nome for m in (_colab(s, c, x) for x in d.colaboradores) if not m.cracha]
    if sem:
        raise DomainError(f"sem crachá/matrícula (defina o crachá ou tire da seleção): {', '.join(sem)}", "colaboradores")
    if not enc.cracha:
        raise DomainError(f"o encarregado {enc.nome} não tem crachá/matrícula", "encarregado_id")
    outra = s.scalar(select(EquipeModel).where(EquipeModel.obra_id == c.obra_id,
                                               EquipeModel.encarregado_cracha == enc.cracha))
    if outra:
        raise DomainError(f"{enc.nome} já encarrega a equipe {outra.nome}", "encarregado_id")
    codigo = (d.codigo_simova or "").strip() or None
    if codigo is None:
        usados = [int(x) for x in s.scalars(select(EquipeModel.codigo_simova).where(EquipeModel.obra_id == c.obra_id))
                  if x and str(x).isdigit()]
        codigo = str(max(usados, default=0) + 1)
    e = EquipeModel(obra_id=c.obra_id, nome=d.nome.strip(), encarregado_cracha=enc.cracha,
                    encarregado_nome=enc.nome, jornada_horas=d.jornada_horas, turno=d.turno,
                    responsavel=d.responsavel, codigo_simova=codigo, ativo=True)
    s.add(e)
    s.flush()
    _tirar_de_equipes(s, c.obra_id, enc.cracha)
    for cid in d.colaboradores:
        if cid != enc.id:
            _mover(s, c, _colab(s, c, cid), e)
    s.flush()
    return {"id": e.id, "nome": e.nome, "codigo_simova": e.codigo_simova, "membros": len(e.membros)}


# ---- de-para de funções ---------------------------------------------------------------------------------
def _recursos_cpu(s: Session, obra_id: int) -> list[str]:
    from app.modules.referencias.infra.models import CpuRecursoModel, VersaoReferenciaModel

    vid = s.scalar(select(VersaoReferenciaModel.id).where(
        VersaoReferenciaModel.obra_id == obra_id, VersaoReferenciaModel.tipo == "CPU", VersaoReferenciaModel.vigente.is_(True)))
    if vid is None:
        return []
    return sorted(set(s.scalars(select(CpuRecursoModel.recurso).where(CpuRecursoModel.versao_id == vid,
                                                                      CpuRecursoModel.tipo == "MOD"))))


@router.get("/funcoes")
def funcoes(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Funções do efetivo (como o DP escreve) com quantas pessoas, o de-para atual e a sugestão pela CPU."""
    cs = list(s.scalars(select(ColaboradorModel).where(ColaboradorModel.obra_id == c.obra_id)))
    dp = depara(s, c.obra_id)
    recursos = _recursos_cpu(s, c.obra_id)
    grupos: dict[str, dict] = {}
    for m in cs:
        if not m.funcao_chave:
            continue
        g = grupos.setdefault(m.funcao_chave, {"funcao": m.funcao, "total": 0, "ativos": 0})
        g["total"] += 1
        g["ativos"] += 1 if Situacao(m.situacao).ativo else 0
    for k, d in dp.items():
        grupos.setdefault(k, {"funcao": d.funcao, "total": 0, "ativos": 0})
    out = []
    for k, g in grupos.items():
        d = dp.get(k)
        out.append({"funcao_chave": k, **g, "recurso": d.recurso if d else None, "ignorar": d.ignorar if d else False,
                    "definido": d is not None, "sugestao": sugerir_recurso(g["funcao"], recursos)})
    out.sort(key=lambda x: (x["definido"], -x["ativos"], x["funcao"]))
    return {"recursos_cpu": recursos, "funcoes": out}


class DeParaItem(BaseModel):
    funcao: str
    recurso: str | None = None
    ignorar: bool = False


class DeParaIn(BaseModel):
    itens: list[DeParaItem]


@router.put("/funcoes")
def salvar_funcoes(d: DeParaIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    dp = depara(s, c.obra_id)
    n = 0
    for it in d.itens:
        k = chave_texto(it.funcao)
        if not k:
            continue
        rec = " ".join((it.recurso or "").split()) or None
        m = dp.get(k)
        if rec is None and not it.ignorar:  # limpar o de-para
            if m is not None:
                s.delete(m)
                n += 1
            continue
        if m is None:
            m = DeParaFuncaoModel(obra_id=c.obra_id, funcao_chave=k, funcao=" ".join(it.funcao.split())[:120])
            s.add(m)
            dp[k] = m
        m.recurso, m.ignorar, m.atualizado_por = (None if it.ignorar else rec[:120] if rec else None), it.ignorar, c.usuario.id
        n += 1
    s.flush()
    return {"salvos": n}


@router.post("/funcoes/sugeridas")
def aplicar_sugestoes(s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Grava a sugestão para as funções ainda sem de-para (não mexe nas já definidas)."""
    lista = funcoes(s, c)["funcoes"]
    itens = [DeParaItem(funcao=f["funcao"], recurso=f["sugestao"]) for f in lista if not f["definido"] and f["sugestao"]]
    salvar_funcoes(DeParaIn(itens=itens), s, c)
    return {"aplicadas": len(itens)}


# ---- organograma ---------------------------------------------------------------------------------------
def frentes_das_equipes(s: Session, obra_id: int) -> dict[int, tuple[str | None, str | None]]:
    """equipe → (frente, área) para o organograma por frente. Vale a frente escolhida na equipe (código da área ou
    do local, em `frente_codigo`); sem ela, a área onde a equipe mais aparece na programação mais recente dela."""
    from collections import Counter

    from app.modules.frentes.infra.models import AreaFrenteModel, LocalFrenteModel
    from app.modules.planejamento.infra.models import LinhaProgramacaoModel, ProgramacaoModel

    locais = {x.id: x for x in s.scalars(select(LocalFrenteModel).where(LocalFrenteModel.obra_id == obra_id))}
    areas = {x.id: x for x in s.scalars(select(AreaFrenteModel).where(AreaFrenteModel.obra_id == obra_id))}
    area_cod = {a.codigo: a for a in areas.values()}
    local_cod = {x.codigo: x for x in locais.values()}
    rot_local = lambda x: f"{x.codigo} · {x.descricao}"  # noqa: E731
    rot_area = lambda a: f"{a.codigo} · {a.descricao}"  # noqa: E731
    # programação mais recente de cada equipe → área mais frequente nela
    ultima: dict[int, int] = {}
    contagem: dict[int, Counter] = {}
    for eq, area_id, pid in s.execute(select(LinhaProgramacaoModel.equipe_id, LinhaProgramacaoModel.area_id, ProgramacaoModel.id)
                                      .join(ProgramacaoModel, ProgramacaoModel.id == LinhaProgramacaoModel.programacao_id)
                                      .where(ProgramacaoModel.obra_id == obra_id, LinhaProgramacaoModel.equipe_id.is_not(None))
                                      .order_by(ProgramacaoModel.inicio.desc(), ProgramacaoModel.id.desc())):
        if ultima.setdefault(eq, pid) != pid or area_id not in areas:
            continue
        contagem.setdefault(eq, Counter())[area_id] += 1
    out: dict[int, tuple[str | None, str | None]] = {}
    for e in s.scalars(select(EquipeModel).where(EquipeModel.obra_id == obra_id)):
        cod = (e.frente_codigo or "").strip()
        if cod in area_cod:
            a = area_cod[cod]
            out[e.id] = (rot_local(locais[a.local_id]) if a.local_id in locais else None, rot_area(a))
        elif cod in local_cod:
            out[e.id] = (rot_local(local_cod[cod]), None)
        elif e.id in contagem:
            a = areas[contagem[e.id].most_common(1)[0][0]]
            out[e.id] = (rot_local(locais[a.local_id]) if a.local_id in locais else None, rot_area(a))
    return out


def _config(s: Session, obra_id: int) -> OrganogramaConfigModel:
    cfg = s.scalar(select(OrganogramaConfigModel).where(OrganogramaConfigModel.obra_id == obra_id))
    if cfg is None:
        cfg = OrganogramaConfigModel(obra_id=obra_id, cores={})
        s.add(cfg)
        s.flush()
    return cfg


def _cores(cfg: OrganogramaConfigModel | None) -> dict:
    return {**CORES_PADRAO, **((cfg.cores if cfg else None) or {})}


@router.get("/organograma")
def organograma(q: str | None = None, vista: str = "setor", s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """vista=setor: Obra → Setor → Disciplina → Equipe → Função; vista=frente: Obra → Setor → Frente → Área → Equipe."""
    from app.modules.obras.infra.models import ObraModel

    obra = s.get(ObraModel, c.obra_id)
    todos = list(s.scalars(select(ColaboradorModel).where(ColaboradorModel.obra_id == c.obra_id)))
    por_id = {m.id: m for m in todos}
    cs = {m.cracha: m for m in todos if m.cracha}
    cfg = s.scalar(select(OrganogramaConfigModel).where(OrganogramaConfigModel.obra_id == c.obra_id))
    geral = por_id.get(cfg.responsavel_id) if cfg and cfg.responsavel_id else None
    setores_m = list(s.scalars(select(SetorObraModel).where(SetorObraModel.obra_id == c.obra_id)))
    disc_m = list(s.scalars(select(SubsetorObraModel).where(SubsetorObraModel.obra_id == c.obra_id)))
    setor_nome = {st.id: st.nome for st in setores_m}
    disc_nome = {d.id: (d.setor_id, d.nome) for d in disc_m}
    # responsáveis (obra, setores, disciplinas) aparecem só na própria caixa: fora das listas de funções e da contagem
    responsaveis = {m.id for m in [geral, *(por_id.get(x.responsavel_id) for x in [*setores_m, *disc_m])] if m is not None}
    pessoas: list[PessoaOrg] = []
    na_equipe: set[str] = set()
    por_frente = vista == "frente"
    frente_de = frentes_das_equipes(s, c.obra_id) if por_frente else {}
    for e in s.scalars(select(EquipeModel).where(EquipeModel.obra_id == c.obra_id, EquipeModel.ativo.is_(True))):
        enc = cs.get(e.encarregado_cracha or "")
        disciplina = None
        if setores_m:  # com setores cadastrados, vale o setor (e a disciplina) da equipe
            setor = setor_nome.get(e.setor_id) if e.setor_id else None
            d = disc_nome.get(e.subsetor_id) if e.subsetor_id else None
            if d and d[0] == e.setor_id:
                disciplina = d[1]
        else:
            setor = e.frente_codigo or (enc.dp if enc else None)
        base = {"equipe": e.nome, "encarregado": enc.nome if enc else e.encarregado_nome, "setor": setor,
                "disciplina": disciplina, "turno": e.turno or ""}
        if por_frente:
            base["frente"], base["area"] = frente_de.get(e.id, (None, None))
        for mb in e.membros:
            m = cs.get(mb.cracha)
            if m is not None and (not Situacao(m.situacao).ativo or m.id in responsaveis):
                na_equipe.add(mb.cracha)
                continue  # desmobilizado (alerta no efetivo) ou responsável (já está na caixa dele)
            pessoas.append(PessoaOrg(mb.cracha, m.nome if m else mb.nome, (m.funcao if m else None) or mb.funcao or "",
                                     "equipe", **base))
            na_equipe.add(mb.cracha)
        if enc is not None and enc.id not in responsaveis:
            pessoas.append(PessoaOrg(enc.cracha, enc.nome, enc.funcao or "Encarregado", "equipe", **base))
            na_equipe.add(enc.cracha)
    for m in todos:
        sit = Situacao(m.situacao)
        if m.cracha in na_equipe or m.id in responsaveis:
            continue
        if sit.ativo:
            pessoas.append(PessoaOrg(m.matricula or "", m.nome, m.funcao or "", "sem-equipe"))
        elif sit.em_mobilizacao:
            pessoas.append(PessoaOrg(m.matricula or "", m.nome, m.funcao or "", "mobilizacao"))
    nome_de = lambda cid: por_id[cid].nome if cid in por_id else None  # noqa: E731
    setores = [SetorOrg(st.nome, nome_de(st.responsavel_id), st.cor, st.ordem,
                        tuple(DisciplinaOrg(d.nome, nome_de(d.responsavel_id), d.cor, d.ordem)
                              for d in disc_m if d.setor_id == st.id))
               for st in setores_m]
    raiz = montar_organograma(obra.nome if obra else "Obra", pessoas, setores, geral.nome if geral else None, por_frente)
    vis = filtrar(raiz, q or "")
    return {"raiz": vis.como_dict() if vis else None, "total": raiz.qtd, "cores": _cores(cfg)}


# ---- setores da obra e configuração do organograma -----------------------------------------------------
class PessoaRef(BaseModel):
    id: int
    nome: str
    matricula: str | None
    funcao: str | None
    situacao: str


class SetorIn(BaseModel):
    nome: str = Field(min_length=1, max_length=80)
    cor: str | None = None
    ordem: int = 0
    responsavel_id: int | None = None
    equipes: list[int] = []


class ConfigIn(BaseModel):
    responsavel_id: int | None = None
    cores: dict[str, str] = {}


def _ref(m: ColaboradorModel | None) -> PessoaRef | None:
    return PessoaRef(id=m.id, nome=m.nome, matricula=m.matricula, funcao=m.funcao, situacao=m.situacao) if m else None


def _colaborador(s: Session, obra_id: int, cid: int | None) -> ColaboradorModel | None:
    if cid is None:
        return None
    m = s.get(ColaboradorModel, cid)
    if m is None or m.obra_id != obra_id:
        raise NotFoundError("Colaborador", cid)
    return m


@router.get("/setores")
def listar_setores(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    cfg = s.scalar(select(OrganogramaConfigModel).where(OrganogramaConfigModel.obra_id == c.obra_id))
    equipes = list(s.scalars(select(EquipeModel).where(EquipeModel.obra_id == c.obra_id).order_by(EquipeModel.nome)))
    setores = list(s.scalars(select(SetorObraModel).where(SetorObraModel.obra_id == c.obra_id)
                             .order_by(SetorObraModel.ordem, SetorObraModel.nome)))
    discs = list(s.scalars(select(SubsetorObraModel).where(SubsetorObraModel.obra_id == c.obra_id)
                           .order_by(SubsetorObraModel.ordem, SubsetorObraModel.nome)))
    resp = lambda cid: _ref(s.get(ColaboradorModel, cid) if cid else None)  # noqa: E731
    eq_ref = lambda e: {"id": e.id, "nome": e.nome}  # noqa: E731
    return {
        "setores": [{"id": st.id, "nome": st.nome, "cor": st.cor, "ordem": st.ordem, "responsavel": resp(st.responsavel_id),
                     "equipes": [eq_ref(e) for e in equipes if e.setor_id == st.id],
                     "disciplinas": [{"id": d.id, "nome": d.nome, "cor": d.cor, "ordem": d.ordem, "setor_id": st.id,
                                      "responsavel": resp(d.responsavel_id),
                                      "equipes": [eq_ref(e) for e in equipes if e.subsetor_id == d.id]}
                                     for d in discs if d.setor_id == st.id]}
                    for st in setores],
        "equipes": [{"id": e.id, "nome": e.nome, "setor_id": e.setor_id, "subsetor_id": e.subsetor_id, "ativo": e.ativo}
                    for e in equipes],
        "responsavel_geral": _ref(s.get(ColaboradorModel, cfg.responsavel_id) if cfg and cfg.responsavel_id else None),
        "cores": _cores(cfg),
        "cores_padrao": CORES_PADRAO,
    }


def _salvar_setor(s: Session, c: ContextoObra, st: SetorObraModel, d: SetorIn) -> dict:
    nome = " ".join(d.nome.split())
    outro = s.scalar(select(SetorObraModel).where(SetorObraModel.obra_id == c.obra_id, SetorObraModel.nome == nome,
                                                  SetorObraModel.id != (st.id or 0)))
    if outro is not None:
        raise DomainError(f"já existe o setor {nome}")
    st.nome, st.cor, st.ordem = nome, validar_cor(d.cor), d.ordem
    st.responsavel_id = _colaborador(s, c.obra_id, d.responsavel_id).id if d.responsavel_id else None
    s.add(st)
    s.flush()
    for e in s.scalars(select(EquipeModel).where(EquipeModel.obra_id == c.obra_id)):
        if e.id in d.equipes:
            if e.setor_id != st.id:
                e.subsetor_id = None  # disciplina é de outro setor
            e.setor_id = st.id
        elif e.setor_id == st.id:
            e.setor_id = e.subsetor_id = None
    s.flush()
    return {"id": st.id, "nome": st.nome}


@router.post("/setores", status_code=201)
def criar_setor(d: SetorIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    return _salvar_setor(s, c, SetorObraModel(obra_id=c.obra_id), d)


@router.put("/setores/{setor_id}")
def atualizar_setor(setor_id: int, d: SetorIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    st = s.get(SetorObraModel, setor_id)
    if st is None or st.obra_id != c.obra_id:
        raise NotFoundError("Setor", setor_id)
    return _salvar_setor(s, c, st, d)


@router.delete("/setores/{setor_id}", status_code=204)
def excluir_setor(setor_id: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    st = s.get(SetorObraModel, setor_id)
    if st is None or st.obra_id != c.obra_id:
        raise NotFoundError("Setor", setor_id)
    for e in s.scalars(select(EquipeModel).where(EquipeModel.setor_id == st.id)):
        e.setor_id = e.subsetor_id = None
    for dsc in s.scalars(select(SubsetorObraModel).where(SubsetorObraModel.setor_id == st.id)):
        s.delete(dsc)
    s.flush()
    s.delete(st)


# ---- disciplinas (subsetores) ---------------------------------------------------------------------------
def _salvar_disciplina(s: Session, c: ContextoObra, dsc: SubsetorObraModel, d: SetorIn) -> dict:
    nome = " ".join(d.nome.split())
    outro = s.scalar(select(SubsetorObraModel).where(SubsetorObraModel.setor_id == dsc.setor_id,
                                                     SubsetorObraModel.nome == nome, SubsetorObraModel.id != (dsc.id or 0)))
    if outro is not None:
        raise DomainError(f"já existe a disciplina {nome} neste setor")
    dsc.nome, dsc.cor, dsc.ordem = nome, validar_cor(d.cor), d.ordem
    dsc.responsavel_id = _colaborador(s, c.obra_id, d.responsavel_id).id if d.responsavel_id else None
    s.add(dsc)
    s.flush()
    for e in s.scalars(select(EquipeModel).where(EquipeModel.obra_id == c.obra_id)):
        if e.id in d.equipes:  # entra na disciplina e, com ela, no setor
            e.setor_id, e.subsetor_id = dsc.setor_id, dsc.id
        elif e.subsetor_id == dsc.id:
            e.subsetor_id = None  # sai da disciplina e continua no setor
    s.flush()
    return {"id": dsc.id, "nome": dsc.nome, "setor_id": dsc.setor_id}


def _disciplina(s: Session, c: ContextoObra, did: int) -> SubsetorObraModel:
    dsc = s.get(SubsetorObraModel, did)
    if dsc is None or dsc.obra_id != c.obra_id:
        raise NotFoundError("Disciplina", did)
    return dsc


@router.post("/setores/{setor_id}/disciplinas", status_code=201)
def criar_disciplina(setor_id: int, d: SetorIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    st = s.get(SetorObraModel, setor_id)
    if st is None or st.obra_id != c.obra_id:
        raise NotFoundError("Setor", setor_id)
    return _salvar_disciplina(s, c, SubsetorObraModel(obra_id=c.obra_id, setor_id=st.id), d)


@router.put("/disciplinas/{disciplina_id}")
def atualizar_disciplina(disciplina_id: int, d: SetorIn, s: Session = Depends(get_session),
                         c: ContextoObra = Depends(planejar)):
    return _salvar_disciplina(s, c, _disciplina(s, c, disciplina_id), d)


@router.delete("/disciplinas/{disciplina_id}", status_code=204)
def excluir_disciplina(disciplina_id: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    dsc = _disciplina(s, c, disciplina_id)
    for e in s.scalars(select(EquipeModel).where(EquipeModel.subsetor_id == dsc.id)):
        e.subsetor_id = None  # equipes continuam no setor
    s.delete(dsc)


@router.put("/organograma/config")
def salvar_config(d: ConfigIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Responsável geral da obra (pessoa do efetivo) e cores dos níveis (obra, setor, equipe, função)."""
    cfg = _config(s, c.obra_id)
    cfg.responsavel_id = _colaborador(s, c.obra_id, d.responsavel_id).id if d.responsavel_id else None
    cfg.cores = validar_cores(d.cores)
    s.flush()
    return {"responsavel_geral": _ref(s.get(ColaboradorModel, cfg.responsavel_id) if cfg.responsavel_id else None),
            "cores": _cores(cfg)}
