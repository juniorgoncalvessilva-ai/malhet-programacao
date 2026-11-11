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
from app.modules.efetivo.domain.organograma import PessoaOrg, filtrar, montar_organograma
from app.modules.efetivo.infra.gateway import depara
from app.modules.efetivo.infra.models import (
    ColaboradorModel,
    DeParaFuncaoModel,
    ImportacaoEfetivoModel,
    MovimentoEfetivoModel,
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
@router.get("/organograma")
def organograma(q: str | None = None, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    from app.modules.obras.infra.models import ObraModel

    obra = s.get(ObraModel, c.obra_id)
    cs = {m.cracha: m for m in s.scalars(select(ColaboradorModel).where(ColaboradorModel.obra_id == c.obra_id))
          if m.cracha}
    todos = list(s.scalars(select(ColaboradorModel).where(ColaboradorModel.obra_id == c.obra_id)))
    pessoas: list[PessoaOrg] = []
    na_equipe: set[str] = set()
    for e in s.scalars(select(EquipeModel).where(EquipeModel.obra_id == c.obra_id, EquipeModel.ativo.is_(True))):
        enc = cs.get(e.encarregado_cracha or "")
        setor = e.frente_codigo or (enc.dp if enc else None)
        base = {"equipe": e.nome, "encarregado": e.encarregado_nome, "supervisor": e.responsavel, "setor": setor,
                "turno": e.turno or ""}
        for mb in e.membros:
            m = cs.get(mb.cracha)
            if m is not None and not Situacao(m.situacao).ativo:
                continue  # desmobilizado ainda na equipe: some do organograma (aparece como alerta no efetivo)
            pessoas.append(PessoaOrg(mb.cracha, m.nome if m else mb.nome, (m.funcao if m else None) or mb.funcao or "",
                                     "equipe", **base))
            na_equipe.add(mb.cracha)
        if enc is not None:
            pessoas.append(PessoaOrg(enc.cracha, enc.nome, enc.funcao or "Encarregado", "equipe", **base))
            na_equipe.add(enc.cracha)
    for m in todos:
        sit = Situacao(m.situacao)
        if m.cracha in na_equipe:
            continue
        if sit.ativo:
            pessoas.append(PessoaOrg(m.matricula or "", m.nome, m.funcao or "", "sem-equipe"))
        elif sit.em_mobilizacao:
            pessoas.append(PessoaOrg(m.matricula or "", m.nome, m.funcao or "", "mobilizacao"))
    raiz = montar_organograma(obra.nome if obra else "Obra", pessoas)
    vis = filtrar(raiz, q or "")
    return {"raiz": vis.como_dict() if vis else None, "total": raiz.qtd}
