"""Apropriação de presença (spec 063): base para o celular trabalhar sem internet, sincronização da fila de leituras,
presença do dia por equipe (com a capacidade produtiva dos presentes) e o cadastro do crachá/NFC/rosto."""
from collections import Counter
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, ler, negar, planejar, programar
from app.modules.obras.domain.obra import PapelObra
from app.core.db import get_session
from app.modules.efetivo.infra.models import ColaboradorModel
from app.modules.equipes.infra.models import EquipeModel
from app.modules.presenca.domain.presenca import (DISTANCIA_MAX, Leitura, normalizar_codigo, primeiras_do_dia,
                                                  validar_descritor, validas)
from app.modules.presenca.infra.models import IdentificacaoModel, LeituraPresencaModel
from app.shared.errors import DomainError, NotFoundError

router = APIRouter(prefix="/presenca", tags=["presença (apropriação)"])
FORA = ("DESMOBILIZADO", "DESISTENCIA")


def _equipe_por_pessoa(s: Session, obra_id: int) -> tuple[dict[str, EquipeModel], list[EquipeModel]]:
    """crachá/matrícula → equipe (membro ou encarregado) e as equipes ativas."""
    equipes = list(s.scalars(select(EquipeModel).where(EquipeModel.obra_id == obra_id, EquipeModel.ativo.is_(True))
                             .order_by(EquipeModel.nome)))
    por: dict[str, EquipeModel] = {}
    for e in equipes:
        for m in e.membros:
            por.setdefault(m.cracha, e)
        if e.encarregado_cracha:
            por.setdefault(e.encarregado_cracha, e)
    return por, equipes


def _chaves(c: ColaboradorModel) -> list[str]:
    return [x for x in (c.cracha, c.matricula) if x]


async def campo(c: ContextoObra = Depends(ler)) -> ContextoObra:
    """Base de pessoas no aparelho: quem lê presença (encarregado+) e a segurança (etilômetro, spec 073)."""
    if not (c.papel.pode(PapelObra.ENCARREGADO) or c.papel == PapelObra.SEGURANCA):
        raise negar("seu papel não lê crachás")
    return c


@router.get("/base")
def base(s: Session = Depends(get_session), c: ContextoObra = Depends(campo)):
    """Tudo o que o celular precisa para ler sem internet: pessoas (com equipe, códigos e rosto) e equipes."""
    por, equipes = _equipe_por_pessoa(s, c.obra_id)
    ids = {i.colaborador_id: i for i in s.scalars(select(IdentificacaoModel).where(IdentificacaoModel.obra_id == c.obra_id))}
    from app.modules.lgpd.api.router import consentimentos, termo_vigente
    from app.modules.lgpd.domain.termo import consentimento as _cons

    cons, sem = consentimentos(s, c.obra_id), _cons([], None).como_dict()  # o celular decide sem internet (spec 074)
    t = termo_vigente(s, c.obra_id)
    pessoas = []
    for p in s.scalars(select(ColaboradorModel).where(ColaboradorModel.obra_id == c.obra_id, ColaboradorModel.situacao.not_in(FORA))
                       .order_by(ColaboradorModel.nome)):
        eq = next((por[k] for k in _chaves(p) if k in por), None)
        i = ids.get(p.id)
        pessoas.append({"id": p.id, "nome": p.nome, "matricula": p.matricula, "cracha": p.cracha, "funcao": p.funcao,
                        "situacao": p.situacao, "equipe_id": eq.id if eq else None,
                        "codigos": sorted({x for x in (normalizar_codigo(p.matricula), normalizar_codigo(p.cracha),
                                                       i.codigo if i else None) if x}),
                        "nfc": i.nfc_serial if i else None, "face": i.face_descritor if i else None,
                        "lgpd": cons.get(p.id, sem)})
    return {"gerado_em": datetime.now(timezone.utc).isoformat(), "distancia_max": DISTANCIA_MAX, "pessoas": pessoas,
            "termo_lgpd": {"versao": t.versao, "titulo": t.titulo, "texto": t.texto, "finalidades": t.finalidades, "hash": t.hash},
            "funcoes": _funcoes(s, c.obra_id),
            "equipes": [{"id": e.id, "nome": e.nome, "encarregado": e.encarregado_nome} for e in equipes]}


class LeituraIn(BaseModel):
    id_local: str
    colaborador_id: int
    data: date
    hora: datetime
    meio: str
    dispositivo: str | None = None


class LeiturasIn(BaseModel):
    leituras: list[LeituraIn]


@router.post("/leituras")
def sincronizar(d: LeiturasIn, s: Session = Depends(get_session), c: ContextoObra = Depends(programar)):
    """Recebe a fila do celular. Idempotente pelo id_local: mandar de novo não duplica."""
    if len(d.leituras) > 2000:
        raise DomainError("no máximo 2000 leituras por envio")
    pessoas = {p.id: p for p in s.scalars(select(ColaboradorModel).where(
        ColaboradorModel.obra_id == c.obra_id, ColaboradorModel.id.in_({x.colaborador_id for x in d.leituras})))}
    por, _ = _equipe_por_pessoa(s, c.obra_id)
    aceitas, repetidas, erros = 0, 0, []
    tocadas: set[tuple[int, date]] = set()
    for x in d.leituras:
        try:
            lt = Leitura(x.id_local, x.colaborador_id, x.data, x.hora, x.meio)
        except DomainError as e:
            erros.append({"id_local": x.id_local, "erro": e.mensagem})
            continue
        p = pessoas.get(lt.colaborador_id)
        if p is None:
            erros.append({"id_local": x.id_local, "erro": "pessoa não está no efetivo desta obra"})
            continue
        eq = next((por[k] for k in _chaves(p) if k in por), None)
        r = s.execute(insert(LeituraPresencaModel).values(
            obra_id=c.obra_id, id_local=lt.id_local, colaborador_id=p.id, data=lt.data, hora=lt.hora, meio=lt.meio,
            equipe_id=eq.id if eq else None, dispositivo=(x.dispositivo or "")[:120] or None, registrado_por=c.usuario.id,
        ).on_conflict_do_nothing(constraint="uq_presenca_id_local").returning(LeituraPresencaModel.id))
        if r.scalar() is not None:
            aceitas += 1
        else:
            repetidas += 1
        tocadas.add((p.id, lt.data))
    s.flush()
    # duplicidade entre celulares (spec 069): por pessoa e dia, só a leitura mais cedo vale
    resultados = []
    for cid, dia_ in tocadas:
        todas = list(s.scalars(select(LeituraPresencaModel).where(LeituraPresencaModel.obra_id == c.obra_id,
                                                                  LeituraPresencaModel.colaborador_id == cid, LeituraPresencaModel.data == dia_)))
        vid = validas([(x.id, x.hora) for x in todas])
        valida = next(x for x in todas if x.id == vid)
        for x in todas:
            x.valida = x.id == vid
        enviados = {y.id_local for y in d.leituras if y.colaborador_id == cid and y.data == dia_}
        for x in todas:
            if x.id_local in enviados:
                resultados.append({"id_local": x.id_local, "valida": x.valida, "hora_valida": valida.hora.isoformat(),
                                   "outro_celular": valida.id_local not in enviados})
    s.flush()
    return {"aceitas": aceitas, "repetidas": repetidas, "erros": erros, "resultados": resultados}


@router.get("/hoje")
def hoje(data: date | None = None, s: Session = Depends(get_session), c: ContextoObra = Depends(programar)):
    """Presenças válidas do dia já no servidor (de todos os celulares): o celular baixa para avisar "já registrado por
    outro celular" na hora da leitura."""
    d = data or date.today()
    return [{"colaborador_id": x.colaborador_id, "hora": x.hora.isoformat(), "meio": x.meio, "id_local": x.id_local}
            for x in s.scalars(select(LeituraPresencaModel).where(LeituraPresencaModel.obra_id == c.obra_id,
                                                                  LeituraPresencaModel.data == d, LeituraPresencaModel.valida.is_(True)))]


def _setores(s: Session, obra_id: int) -> dict[int, dict]:
    from app.modules.efetivo.infra.models import SetorObraModel
    return {x.id: {"id": x.id, "nome": x.nome, "cor": x.cor}
            for x in s.scalars(select(SetorObraModel).where(SetorObraModel.obra_id == obra_id))}


def _composicao(e: EquipeModel, por_chave: dict[str, ColaboradorModel]) -> list[tuple[ColaboradorModel, str]]:
    """Encarregado + membros ativos da equipe (pessoa do efetivo, sem repetir)."""
    lista: list[tuple[ColaboradorModel, str]] = []
    if e.encarregado_cracha and e.encarregado_cracha in por_chave:
        lista.append((por_chave[e.encarregado_cracha], "encarregado"))
    for m in e.membros:
        p = por_chave.get(m.cracha)
        if p is not None and p.situacao not in FORA and all(x.id != p.id for x, _ in lista):
            lista.append((p, "membro"))
    return lista


@router.get("/dia")
def dia(data: date | None = None, atividades: bool = False, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Presença do dia por equipe (com o setor para agrupar). Com `atividades=true`, também a capacidade produtiva com
    os presentes linha a linha da programação do dia (spec 063; a tela deixou de mostrar na spec 071)."""
    d = data or date.today()
    lt = primeiras_do_dia([(x.colaborador_id, x.hora, x.meio) for x in s.scalars(select(LeituraPresencaModel).where(
        LeituraPresencaModel.obra_id == c.obra_id, LeituraPresencaModel.data == d))])  # 3º item: nº de leituras (duplicadas)
    por, equipes = _equipe_por_pessoa(s, c.obra_id)
    setores = _setores(s, c.obra_id)
    pessoas = {p.id: p for p in s.scalars(select(ColaboradorModel).where(ColaboradorModel.obra_id == c.obra_id))}
    por_chave = {k: p for p in pessoas.values() for k in _chaves(p)}
    presentes_chaves = {k for cid in lt for k in _chaves(pessoas[cid])} if lt else set()

    def pessoa(p: ColaboradorModel, papel: str) -> dict:
        h = lt.get(p.id)
        return {"id": p.id, "nome": p.nome, "matricula": p.matricula, "funcao": p.funcao, "papel": papel,
                "presente": h is not None, "hora": h[0].isoformat() if h else None, "meio": h[1] if h else None,
                "leituras": h[2] if h else 0}

    saida_eq, nas_equipes = [], set()
    for e in equipes:
        lista = [pessoa(p, papel) for p, papel in _composicao(e, por_chave)]
        nas_equipes |= {x["id"] for x in lista}
        pres = [x for x in lista if x["presente"]]
        jornada = float(e.jornada_horas or 0)
        saida_eq.append({"equipe_id": e.id, "nome": e.nome, "encarregado": e.encarregado_nome, "jornada": jornada,
                         "setor": setores.get(e.setor_id) if e.setor_id else None,
                         "total": len(lista), "presentes": len(pres), "hh_disponivel": round(len(pres) * jornada, 2),
                         "por_funcao": [{"funcao": f, "presentes": sum(1 for x in pres if (x["funcao"] or "—") == f), "total": n}
                                        for f, n in sorted(Counter(x["funcao"] or "—" for x in lista).items())],
                         "pessoas": sorted(lista, key=lambda x: (not x["presente"], x["papel"] != "encarregado", x["nome"])),
                         "linhas": []})
    avulsos = [pessoa(pessoas[cid], "sem equipe") for cid in lt if cid not in nas_equipes]

    # capacidade do dia: a da programação (equipe completa) × a dos presentes, nas linhas com previsto no dia
    from app.modules.campo.api.router import programacao_do_dia
    from app.modules.planejamento.application import servico as sv

    prog = programacao_do_dia(s, c.obra_id, d)
    if prog is not None and atividades:
        v = sv.visao(s, prog)
        i = [x["data"] for x in v["dias"]].index(d.isoformat())
        cap_pres = sv.capacidade_com_presentes(s, prog, presentes_chaves)
        idx = {e["equipe_id"]: e for e in saida_eq}
        for loc in v["locais"]:
            for a in loc["areas"]:
                for ln in a["linhas"]:
                    if not ln["previsto"][i] or ln["equipe_id"] not in idx:
                        continue
                    calc = ln["calc"]
                    fator = (calc.get("fator_dia") or [1] * len(v["dias"]))[i] or 0
                    cp = cap_pres.get(ln["id"])
                    idx[ln["equipe_id"]]["linhas"].append({
                        "id": ln["id"], "codigo": ln["codigo_simova"], "atividade": ln.get("descricao_reduzida") or ln["descricao"],
                        "area": f"{a['codigo']} · {a['descricao']}", "unidade": ln["unidade"], "previsto": ln["previsto"][i],
                        "capacidade_programada": (calc.get("capacidade_dia") or [None] * len(v["dias"]))[i],
                        "capacidade_presentes": round(cp * fator, 4) if cp is not None else None,
                        "fator_dia": fator, "capacidade_un_dia_presentes": cp, "gargalo": calc.get("gargalo")})
    tot = len(nas_equipes)  # pessoa em duas equipes conta uma vez
    pres = len({cid for cid in nas_equipes if cid in lt})
    return {"data": d.isoformat(), "programacao": {"id": prog.id, "titulo": prog.titulo} if prog else None,
            "presentes": len(lt), "nas_equipes": tot, "presentes_nas_equipes": pres,
            "hh_disponivel": round(sum(e["hh_disponivel"] for e in saida_eq), 2),
            "equipes": saida_eq, "sem_equipe": sorted(avulsos, key=lambda x: x["nome"])}


@router.get("/indicadores")
def indicadores(de: date | None = None, ate: date | None = None, s: Session = Depends(get_session),
                c: ContextoObra = Depends(ler)):
    """Indicadores da presença no período (padrão: últimos 30 dias): taxa de presença e absenteísmo por dia e por
    equipe, meio de leitura, horário de chegada, HH disponível e quem mais faltou — com a memória de cálculo."""
    from app.modules.presenca.domain.indicadores import EquipeInd, calcular

    ate = ate or date.today()
    de = de or ate - timedelta(days=29)
    if de > ate:
        raise DomainError("início do período depois do fim", "de")
    if (ate - de).days > 366:
        raise DomainError("período de no máximo um ano", "de")
    leit = s.execute(select(LeituraPresencaModel.data, LeituraPresencaModel.colaborador_id, LeituraPresencaModel.hora,
                            LeituraPresencaModel.meio).where(
        LeituraPresencaModel.obra_id == c.obra_id, LeituraPresencaModel.data >= de, LeituraPresencaModel.data <= ate,
        LeituraPresencaModel.valida.is_(True)))
    presencas: dict[date, dict[int, tuple[datetime, str]]] = {}
    for d, cid, hora, meio in leit:
        dd = presencas.setdefault(d, {})
        if cid not in dd or hora < dd[cid][0]:
            dd[cid] = (hora, meio)
    _, equipes = _equipe_por_pessoa(s, c.obra_id)
    setores = _setores(s, c.obra_id)
    pessoas = {p.id: p for p in s.scalars(select(ColaboradorModel).where(ColaboradorModel.obra_id == c.obra_id))}
    por_chave = {k: p for p in pessoas.values() for k in _chaves(p)}
    eqs = [EquipeInd(e.id, e.nome, setores[e.setor_id]["nome"] if e.setor_id in setores else None,
                     float(e.jornada_horas or 0), frozenset(p.id for p, _ in _composicao(e, por_chave))) for e in equipes]
    r = calcular(eqs, presencas, {p.id: p.nome for p in pessoas.values()})
    return {"de": de.isoformat(), "ate": ate.isoformat(), **r}


def _funcoes(s: Session, obra_id: int) -> list[dict]:
    """Funções de contratação do de-para (como o DP escreve → função da CPU): a pessoa nova já nasce ligada à composição."""
    from app.modules.efetivo.infra.models import DeParaFuncaoModel

    return [{"funcao_chave": d.funcao_chave, "funcao": d.funcao, "recurso": d.recurso}
            for d in s.scalars(select(DeParaFuncaoModel).where(DeParaFuncaoModel.obra_id == obra_id, DeParaFuncaoModel.ignorar.is_(False))
                               .order_by(DeParaFuncaoModel.funcao))]


def _ligar(s: Session, obra_id: int, cid: int, codigo: str | None, nfc: str | None, por: str) -> IdentificacaoModel:
    """Grava o crachá lido (código/QR ou NFC) na pessoa; o mesmo crachá não serve para duas pessoas."""
    i = s.scalar(select(IdentificacaoModel).where(IdentificacaoModel.obra_id == obra_id, IdentificacaoModel.colaborador_id == cid))
    if i is None:
        i = IdentificacaoModel(obra_id=obra_id, colaborador_id=cid)
        s.add(i)
    for campo, valor, rot in (("codigo", normalizar_codigo(codigo), "este código de crachá"), ("nfc_serial", normalizar_codigo(nfc), "este crachá NFC")):
        if valor is None:
            continue
        outro = s.scalar(select(IdentificacaoModel).where(IdentificacaoModel.obra_id == obra_id, getattr(IdentificacaoModel, campo) == valor,
                                                          IdentificacaoModel.colaborador_id != cid))
        if outro is not None:
            dono = s.get(ColaboradorModel, outro.colaborador_id)
            raise DomainError(f"{rot} já é de {dono.nome if dono else 'outra pessoa'}", campo)
        setattr(i, campo, valor)
    i.atualizado_por = por
    s.flush()
    return i


def _pessoa_base(s: Session, p: ColaboradorModel) -> dict:
    por, _ = _equipe_por_pessoa(s, p.obra_id)
    eq = next((por[k] for k in _chaves(p) if k in por), None)
    i = s.scalar(select(IdentificacaoModel).where(IdentificacaoModel.obra_id == p.obra_id, IdentificacaoModel.colaborador_id == p.id))
    return {"id": p.id, "nome": p.nome, "matricula": p.matricula, "cracha": p.cracha, "funcao": p.funcao, "situacao": p.situacao,
            "equipe_id": eq.id if eq else None,
            "codigos": sorted({x for x in (normalizar_codigo(p.matricula), normalizar_codigo(p.cracha), i.codigo if i else None) if x}),
            "nfc": i.nfc_serial if i else None, "face": i.face_descritor if i else None, "cadastro_pendente": p.cadastro_pendente}


class VincularIn(BaseModel):
    colaborador_id: int
    codigo: str | None = None
    nfc: str | None = None


@router.post("/vincular")
def vincular(d: VincularIn, s: Session = Depends(get_session), c: ContextoObra = Depends(programar)):
    """Crachá lido e não cadastrado → liga à pessoa do efetivo, direto do celular (spec 065)."""
    p = s.get(ColaboradorModel, d.colaborador_id)
    if p is None or p.obra_id != c.obra_id:
        raise NotFoundError("Pessoa", d.colaborador_id)
    if not (d.codigo or d.nfc):
        raise DomainError("leia o crachá (código ou NFC)")
    _ligar(s, c.obra_id, p.id, d.codigo, d.nfc, c.usuario.id)
    return _pessoa_base(s, p)


class PessoaSimplesIn(BaseModel):
    nome: str
    funcao_chave: str
    codigo: str | None = None
    nfc: str | None = None


@router.post("/pessoa-simplificada", status_code=201)
def pessoa_simplificada(d: PessoaSimplesIn, s: Session = Depends(get_session), c: ContextoObra = Depends(programar)):
    """Pessoa que não está no efetivo: nome + função de contratação do de-para (já ligada à composição/CPU). Fica pendente
    para o DP/RH completar; quando a planilha do DP trouxer a matrícula com o mesmo nome, o cadastro se completa sozinho."""
    from app.modules.efetivo.domain.efetivo import EMPRESA_PROPRIA, Situacao, chave_provisoria
    from app.modules.efetivo.infra.models import DeParaFuncaoModel

    nome = " ".join(d.nome.split()).upper()
    if len(nome) < 5 or len(nome.split()) < 2:
        raise DomainError("informe nome e sobrenome", "nome")
    dp = s.scalar(select(DeParaFuncaoModel).where(DeParaFuncaoModel.obra_id == c.obra_id, DeParaFuncaoModel.funcao_chave == d.funcao_chave))
    if dp is None:
        raise DomainError("escolha a função da lista do de-para de funções", "funcao_chave")
    chave = chave_provisoria(EMPRESA_PROPRIA, nome)
    igual = s.scalar(select(ColaboradorModel).where(ColaboradorModel.obra_id == c.obra_id, (ColaboradorModel.chave == chave)
                                                    | (func.upper(ColaboradorModel.nome) == nome)))
    if igual is not None:
        raise DomainError(f"{igual.nome} já está no efetivo: vincule o crachá a ele", "nome")
    p = ColaboradorModel(obra_id=c.obra_id, chave=chave, empresa=EMPRESA_PROPRIA, nome=nome[:150], funcao=dp.funcao,
                         funcao_chave=dp.funcao_chave, situacao=Situacao.MOBILIZADO.value, origem="campo",
                         no_ultimo_arquivo=False, cadastro_pendente=True, cadastrado_por=c.usuario.email or c.usuario.id,
                         cadastrado_em=datetime.now(timezone.utc))
    s.add(p)
    s.flush()
    if d.codigo or d.nfc:
        _ligar(s, c.obra_id, p.id, d.codigo, d.nfc, c.usuario.id)
    return _pessoa_base(s, p)


@router.get("/cadastros-pendentes")
def cadastros_pendentes(meus: bool = False, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Alerta para completar o cadastro: quem cadastrou (meus=true) e o DP/RH (planejamento/admin) veem a lista."""
    q = select(ColaboradorModel).where(ColaboradorModel.obra_id == c.obra_id, ColaboradorModel.cadastro_pendente.is_(True))
    if meus:
        q = q.where(ColaboradorModel.cadastrado_por == (c.usuario.email or c.usuario.id))
    return [{"id": p.id, "nome": p.nome, "funcao": p.funcao, "empresa": p.empresa, "cadastrado_por": p.cadastrado_por,
             "cadastrado_em": p.cadastrado_em.isoformat() if p.cadastrado_em else None}
            for p in s.scalars(q.order_by(ColaboradorModel.cadastrado_em.desc()))]


class CompletarIn(BaseModel):
    matricula: str | None = None
    nome: str | None = None
    concluido: bool = True


@router.put("/cadastros-pendentes/{cid}")
def completar(cid: int, d: CompletarIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """DP/RH completa: matrícula (vira a chave e o crachá do Simova) e o nome certo; tira o alerta."""
    from app.modules.efetivo.domain.efetivo import normalizar_matricula

    p = s.get(ColaboradorModel, cid)
    if p is None or p.obra_id != c.obra_id:
        raise NotFoundError("Pessoa", cid)
    if d.nome and len(" ".join(d.nome.split())) >= 5:
        p.nome = " ".join(d.nome.split()).upper()[:150]
    if d.matricula:
        mat = normalizar_matricula(d.matricula)
        if not mat:
            raise DomainError("matrícula inválida", "matricula")
        outro = s.scalar(select(ColaboradorModel).where(ColaboradorModel.obra_id == c.obra_id, ColaboradorModel.chave == mat, ColaboradorModel.id != cid))
        if outro is not None:
            raise DomainError(f"a matrícula {mat} já é de {outro.nome}", "matricula")
        p.matricula, p.cracha, p.chave = mat, mat, mat
    p.cadastro_pendente = not d.concluido
    s.flush()
    return {"id": p.id, "nome": p.nome, "matricula": p.matricula, "cadastro_pendente": p.cadastro_pendente}


@router.get("/identificacoes")
def identificacoes(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Quem tem crachá (código), NFC e rosto cadastrados — sem devolver o descritor."""
    ids = {i.colaborador_id: i for i in s.scalars(select(IdentificacaoModel).where(IdentificacaoModel.obra_id == c.obra_id))}
    por, _ = _equipe_por_pessoa(s, c.obra_id)
    out = []
    for p in s.scalars(select(ColaboradorModel).where(ColaboradorModel.obra_id == c.obra_id, ColaboradorModel.situacao.not_in(FORA))
                       .order_by(ColaboradorModel.nome)):
        i = ids.get(p.id)
        eq = next((por[k] for k in _chaves(p) if k in por), None)
        out.append({"id": p.id, "nome": p.nome, "matricula": p.matricula, "cracha": p.cracha, "funcao": p.funcao,
                    "situacao": p.situacao, "equipe": eq.nome if eq else None, "codigo": i.codigo if i else None,
                    "nfc": i.nfc_serial if i else None, "face": bool(i and i.face_descritor),
                    "face_em": i.face_em.isoformat() if i and i.face_em else None,
                    "consentimento_em": i.consentimento_em.isoformat() if i and i.consentimento_em else None})
    return out


class IdentificacaoIn(BaseModel):
    codigo: str | None = None
    nfc: str | None = None
    face: list[float] | None = None
    consentimento: bool = False
    campos: list[str] = []  # quais campos mudar (os outros ficam como estão)


@router.put("/identificacoes/{cid}")
def identificar(cid: int, d: IdentificacaoIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    p = s.get(ColaboradorModel, cid)
    if p is None or p.obra_id != c.obra_id:
        raise NotFoundError("Pessoa", cid)
    i = s.scalar(select(IdentificacaoModel).where(IdentificacaoModel.obra_id == c.obra_id, IdentificacaoModel.colaborador_id == cid))
    if i is None:
        i = IdentificacaoModel(obra_id=c.obra_id, colaborador_id=cid)
        s.add(i)
    agora = datetime.now(timezone.utc)

    def unico(campo: str, valor: str | None, rotulo: str) -> None:
        if valor is None:
            return
        outro = s.scalar(select(IdentificacaoModel).where(IdentificacaoModel.obra_id == c.obra_id,
                                                          getattr(IdentificacaoModel, campo) == valor,
                                                          IdentificacaoModel.colaborador_id != cid))
        if outro is not None:
            dono = s.get(ColaboradorModel, outro.colaborador_id)
            raise DomainError(f"{rotulo} já é de {dono.nome if dono else 'outra pessoa'}", campo)

    if "codigo" in d.campos:
        cod = normalizar_codigo(d.codigo)
        unico("codigo", cod, "este código de crachá")
        i.codigo = cod
    if "nfc" in d.campos:
        nfc = normalizar_codigo(d.nfc)
        unico("nfc_serial", nfc, "este crachá NFC")
        i.nfc_serial = nfc
    if "face" in d.campos:
        face = validar_descritor(d.face)
        if face is not None:
            from app.modules.lgpd.api.router import consentimento_de

            sit = consentimento_de(s, c.obra_id, cid)
            if sit["situacao"] in ("recusado", "revogado") or (sit["situacao"] != "pendente" and not sit["biometria"]):
                raise DomainError("o colaborador não autorizou o reconhecimento facial no termo LGPD", "consentimento")
        if face is not None and not d.consentimento:
            raise DomainError("registre o consentimento da pessoa para usar o rosto (LGPD)", "consentimento")
        i.face_descritor = face
        i.face_em = agora if face else None
        if face:
            i.consentimento_em, i.consentimento_por = agora, c.usuario.id
    i.atualizado_por = c.usuario.id
    s.flush()
    return {"id": cid, "codigo": i.codigo, "nfc": i.nfc_serial, "face": bool(i.face_descritor)}
