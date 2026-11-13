"""Book de fotos (spec 062): as fotos de campo com a frente, a atividade e a data de execução, e as das ocorrências e
restrições, prontas para agrupar por frente, atividade ou data. Lê a visão publicada da programação (planejamento)."""
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.campo.infra.models import FotoCampoModel
from app.modules.frentes.infra.models import AreaFrenteModel, LocalFrenteModel
from app.modules.indicadores.infra.models import CausaDesvioModel, DesvioModel
from app.modules.planejamento.application import servico as sv
from app.modules.planejamento.infra.models import LinhaProgramacaoModel, ProgramacaoModel
from app.modules.restricoes.infra.models import AcaoRestricaoModel

TIPOS = {"atividade": "linha", "ocorrencia": "desvio", "restricao": "restricao"}


def _frentes(s: Session, obra_id: int) -> dict[int, dict]:
    locais = {lc.id: lc for lc in s.scalars(select(LocalFrenteModel).where(LocalFrenteModel.obra_id == obra_id))}
    out = {}
    for a in s.scalars(select(AreaFrenteModel).where(AreaFrenteModel.obra_id == obra_id)):
        lc = locais.get(a.local_id)
        out[a.id] = {"area_id": a.id, "area": f"{a.codigo} · {a.descricao}",
                     "local": f"{lc.codigo} · {lc.descricao}" if lc else None}
    return out


def montar_book(s: Session, obra_id: int, de: date | None, ate: date | None, tipo: str | None, area_id: int | None) -> list[dict]:
    alvos = [TIPOS[tipo]] if tipo in TIPOS else list(TIPOS.values())
    fotos = list(s.execute(select(FotoCampoModel.id, FotoCampoModel.alvo, FotoCampoModel.alvo_id, FotoCampoModel.data,
                                  FotoCampoModel.legenda, FotoCampoModel.enviado_em, FotoCampoModel.enviado_por)
                           .where(FotoCampoModel.obra_id == obra_id, FotoCampoModel.alvo.in_(alvos))
                           .order_by(FotoCampoModel.id.desc())))
    frentes = _frentes(s, obra_id)
    sem_frente = {"area_id": None, "area": "Sem frente", "local": None}

    # atividades: a linha da programação pela visão (código, nome, CWP, área), uma visão por programação
    ids_linha = {f.alvo_id for f in fotos if f.alvo == "linha"}
    linhas: dict[int, dict] = {}
    if ids_linha:
        progs = {pid for (pid,) in s.execute(select(LinhaProgramacaoModel.programacao_id).where(LinhaProgramacaoModel.id.in_(ids_linha)))}
        for p in s.scalars(select(ProgramacaoModel).where(ProgramacaoModel.id.in_(progs), ProgramacaoModel.obra_id == obra_id)):
            for loc in sv.visao(s, p)["locais"]:
                for a in loc["areas"]:
                    for ln in a["linhas"]:
                        if ln["id"] in ids_linha:
                            linhas[ln["id"]] = {"area_id": a["id"], "programacao": p.titulo, "codigo": ln["codigo_simova"],
                                                "atividade": ln.get("descricao_reduzida") or ln["descricao"],
                                                "cwp": (ln.get("cwp") or {}).get("texto"), "equipe": ln.get("equipe")}
    ids_desvio = {f.alvo_id for f in fotos if f.alvo == "desvio"}
    desvios = {d.id: d for d in s.scalars(select(DesvioModel).where(DesvioModel.id.in_(ids_desvio), DesvioModel.obra_id == obra_id))} if ids_desvio else {}
    causas = {c.id: c.descricao for c in s.scalars(select(CausaDesvioModel).where(CausaDesvioModel.obra_id == obra_id))} if desvios else {}
    if desvios:  # frente da ocorrência: a área da atividade impactada
        faltam = {d.linha_id for d in desvios.values() if d.linha_id and d.linha_id not in linhas}
        for lid, aid in s.execute(select(LinhaProgramacaoModel.id, LinhaProgramacaoModel.area_id).where(LinhaProgramacaoModel.id.in_(faltam))):
            linhas.setdefault(lid, {"area_id": aid})
    ids_restr = {f.alvo_id for f in fotos if f.alvo == "restricao"}
    restricoes = {r.id: r for r in s.scalars(select(AcaoRestricaoModel).where(AcaoRestricaoModel.id.in_(ids_restr), AcaoRestricaoModel.obra_id == obra_id))} if ids_restr else {}

    out = []
    for f in fotos:
        base = {"id": f.id, "legenda": f.legenda, "enviado_em": f.enviado_em.isoformat() if f.enviado_em else None,
                "enviado_por": f.enviado_por, "alvo_id": f.alvo_id}
        if f.alvo == "linha":
            ln = linhas.get(f.alvo_id)
            if ln is None:
                continue
            fr = frentes.get(ln["area_id"], sem_frente)
            item = {**base, **fr, "tipo": "atividade", "data": (f.data or f.enviado_em.date()).isoformat(),
                    "atividade": f"{ln['codigo']} · {ln['atividade']}", "cwp": ln["cwp"], "equipe": ln["equipe"],
                    "programacao": ln["programacao"], "titulo": None, "causa": None}
        elif f.alvo == "desvio":
            d = desvios.get(f.alvo_id)
            if d is None:
                continue
            aid = d.area_id or (linhas.get(d.linha_id) or {}).get("area_id")
            fr = frentes.get(aid) if aid else None
            fr = fr or {**sem_frente, "area": d.frente or "Sem frente"}
            item = {**base, **fr, "tipo": "ocorrencia", "data": d.data.isoformat(),
                    "atividade": " · ".join(x for x in (d.referencia, d.atividade_impactada) if x) or None, "cwp": None, "equipe": None,
                    "programacao": None, "titulo": d.descricao, "causa": causas.get(d.causa_id), "acao": d.acao}
        else:
            r = restricoes.get(f.alvo_id)
            if r is None:
                continue
            fr = frentes.get(r.area_id) if r.area_id else None
            fr = fr or {**sem_frente, "area": r.area_texto or "Sem frente"}
            item = {**base, **fr, "tipo": "restricao", "data": (f.data or f.enviado_em.date()).isoformat(),
                    "atividade": r.atividade, "cwp": None, "equipe": None, "programacao": None,
                    "titulo": f"Restrição Nº {r.numero} · {r.acao}", "causa": None, "status": r.status1}
        d0 = date.fromisoformat(item["data"])
        if (de and d0 < de) or (ate and d0 > ate) or (area_id and item["area_id"] != area_id):
            continue
        out.append(item)
    out.sort(key=lambda x: (x["data"], x["id"]), reverse=True)
    return out
