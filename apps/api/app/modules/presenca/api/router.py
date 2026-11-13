"""Apropriação de presença (spec 063): base para o celular trabalhar sem internet, sincronização da fila de leituras,
presença do dia por equipe (com a capacidade produtiva dos presentes) e o cadastro do crachá/NFC/rosto."""
from collections import Counter
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, ler, planejar, programar
from app.core.db import get_session
from app.modules.efetivo.infra.models import ColaboradorModel
from app.modules.equipes.infra.models import EquipeModel
from app.modules.presenca.domain.presenca import (DISTANCIA_MAX, Leitura, normalizar_codigo, primeiras_do_dia,
                                                  validar_descritor)
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


@router.get("/base")
def base(s: Session = Depends(get_session), c: ContextoObra = Depends(programar)):
    """Tudo o que o celular precisa para ler sem internet: pessoas (com equipe, códigos e rosto) e equipes."""
    por, equipes = _equipe_por_pessoa(s, c.obra_id)
    ids = {i.colaborador_id: i for i in s.scalars(select(IdentificacaoModel).where(IdentificacaoModel.obra_id == c.obra_id))}
    pessoas = []
    for p in s.scalars(select(ColaboradorModel).where(ColaboradorModel.obra_id == c.obra_id, ColaboradorModel.situacao.not_in(FORA))
                       .order_by(ColaboradorModel.nome)):
        eq = next((por[k] for k in _chaves(p) if k in por), None)
        i = ids.get(p.id)
        pessoas.append({"id": p.id, "nome": p.nome, "matricula": p.matricula, "cracha": p.cracha, "funcao": p.funcao,
                        "situacao": p.situacao, "equipe_id": eq.id if eq else None,
                        "codigos": sorted({x for x in (normalizar_codigo(p.matricula), normalizar_codigo(p.cracha),
                                                       i.codigo if i else None) if x}),
                        "nfc": i.nfc_serial if i else None, "face": i.face_descritor if i else None})
    return {"gerado_em": datetime.now(timezone.utc).isoformat(), "distancia_max": DISTANCIA_MAX, "pessoas": pessoas,
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
    s.flush()
    return {"aceitas": aceitas, "repetidas": repetidas, "erros": erros}


@router.get("/dia")
def dia(data: date | None = None, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Presença do dia por equipe e a capacidade produtiva com os presentes, linha a linha da programação do dia."""
    d = data or date.today()
    lt = primeiras_do_dia([(x.colaborador_id, x.hora, x.meio) for x in s.scalars(select(LeituraPresencaModel).where(
        LeituraPresencaModel.obra_id == c.obra_id, LeituraPresencaModel.data == d))])
    por, equipes = _equipe_por_pessoa(s, c.obra_id)
    pessoas = {p.id: p for p in s.scalars(select(ColaboradorModel).where(ColaboradorModel.obra_id == c.obra_id))}
    por_chave = {k: p for p in pessoas.values() for k in _chaves(p)}
    presentes_chaves = {k for cid in lt for k in _chaves(pessoas[cid])} if lt else set()

    def pessoa(p: ColaboradorModel, papel: str) -> dict:
        h = lt.get(p.id)
        return {"id": p.id, "nome": p.nome, "matricula": p.matricula, "funcao": p.funcao, "papel": papel,
                "presente": h is not None, "hora": h[0].isoformat() if h else None, "meio": h[1] if h else None}

    saida_eq, nas_equipes = [], set()
    for e in equipes:
        lista = []
        if e.encarregado_cracha and e.encarregado_cracha in por_chave:
            lista.append(pessoa(por_chave[e.encarregado_cracha], "encarregado"))
        for m in e.membros:
            p = por_chave.get(m.cracha)
            if p is not None and p.situacao not in FORA and all(x["id"] != p.id for x in lista):
                lista.append(pessoa(p, "membro"))
        nas_equipes |= {x["id"] for x in lista}
        pres = [x for x in lista if x["presente"]]
        jornada = float(e.jornada_horas or 0)
        saida_eq.append({"equipe_id": e.id, "nome": e.nome, "encarregado": e.encarregado_nome, "jornada": jornada,
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
    if prog is not None:
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
        if face is not None and not d.consentimento:
            raise DomainError("registre o consentimento da pessoa para usar o rosto (LGPD)", "consentimento")
        i.face_descritor = face
        i.face_em = agora if face else None
        if face:
            i.consentimento_em, i.consentimento_por = agora, c.usuario.id
    i.atualizado_por = c.usuario.id
    s.flush()
    return {"id": cid, "codigo": i.codigo, "nfc": i.nfc_serial, "face": bool(i.face_descritor)}
