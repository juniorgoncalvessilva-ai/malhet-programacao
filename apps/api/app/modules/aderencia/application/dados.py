"""Dados da aderência (spec 104): semanas do sistema (programações semanais emitidas) + histórico (o que veio de fora).
Semana com programação no sistema usa o sistema; sem ela, o histórico."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.aderencia.domain.aderencia import (SEM_RESPONSAVEL, Atividade, Registro, chave_nome, meta_da_semana,
                                                   montar_painel)
from app.modules.aderencia.infra.models import AderenciaHistoricoModel
from app.modules.planejamento.application import servico as sv
from app.modules.planejamento.domain.periodo import numero_semana
from app.modules.planejamento.infra.models import ProgramacaoModel
from app.shared.cache_leitura import dict_em_cache


def programacoes_por_semana(s: Session, obra_id: int) -> dict[int, ProgramacaoModel]:
    """Semana → programação semanal emitida/concluída (a mais nova, se houver duas)."""
    out: dict[int, ProgramacaoModel] = {}
    for p in s.scalars(select(ProgramacaoModel).where(ProgramacaoModel.obra_id == obra_id, ProgramacaoModel.tipo == "SEMANAL",
                                                      ProgramacaoModel.status.in_(("emitida", "concluida")))
                       .order_by(ProgramacaoModel.inicio)):
        out[numero_semana(p.fim)] = p
    return out


def _linhas(s: Session, obra_id: int, p: ProgramacaoModel) -> list[dict]:
    v = dict_em_cache("visao", obra_id, p.id, lambda: sv.visao(s, p))
    out = []
    for loc in v["locais"]:
        for a in loc["areas"]:
            for ln in a["linhas"]:
                pu = ln.get("pu") or 0.0
                prev, real = ln.get("total_previsto") or 0.0, ln.get("total_realizado") or 0.0
                out.append({"id": ln["id"], "codigo": ln["codigo_simova"], "descricao": ln.get("descricao_reduzida") or ln["descricao"],
                            "responsavel": (ln.get("responsavel") or "").strip() or SEM_RESPONSAVEL,
                            "local": loc["descricao"], "area": f"{a['codigo']} · {a['descricao']}", "unidade": ln.get("unidade"),
                            "pu": ln.get("pu"), "previsto": prev, "realizado": real,
                            "valor_previsto": round(prev * pu, 2), "valor_realizado": round(real * pu, 2),
                            "cumprida": prev > 0 and real >= prev * 0.999})
    return out


def registros_do_sistema(s: Session, obra_id: int, progs: dict[int, ProgramacaoModel]) -> tuple[list[Registro], dict[int, list[dict]]]:
    regs, linhas_por_semana = [], {}
    for semana, p in progs.items():
        ls = _linhas(s, obra_id, p)
        linhas_por_semana[semana] = ls
        por: dict[str, list[dict]] = {}
        for ln in ls:
            por.setdefault(chave_nome(ln["responsavel"]), []).append(ln)
        for lst in por.values():
            prog = [x for x in lst if x["previsto"] > 0]
            regs.append(Registro(semana, lst[0]["responsavel"], round(sum(x["valor_previsto"] for x in lst), 2),
                                 round(sum(x["valor_realizado"] for x in lst), 2), "sistema",
                                 atividades=len(prog), cumpridas=sum(1 for x in prog if x["cumprida"])))
    return regs, linhas_por_semana


def historico(s: Session, obra_id: int) -> list[AderenciaHistoricoModel]:
    return list(s.scalars(select(AderenciaHistoricoModel).where(AderenciaHistoricoModel.obra_id == obra_id)
                          .order_by(AderenciaHistoricoModel.semana, AderenciaHistoricoModel.responsavel)))


def valor_contrato(s: Session, obra_id: int) -> float | None:
    """Valor do contrato = Σ quantidade × PU dos itens (folhas) da PQ vigente — base do avanço previsto."""
    from app.modules.referencias.infra.pq_gateway import itens_pq

    total = sum((i.quantidade or 0) * (i.pu or 0) for i in itens_pq(s, obra_id).values() if i.folha)
    return round(total, 2) or None


def painel(s: Session, obra_id: int, semana: int | None) -> dict:
    progs = programacoes_por_semana(s, obra_id)
    sistema, linhas = registros_do_sistema(s, obra_id, progs)
    hist = historico(s, obra_id)
    no_sistema = set(progs)
    regs = sistema + [Registro(h.semana, h.responsavel, h.programado, h.realizado, "historico")
                      for h in hist if h.semana not in no_sistema]
    semanas = sorted({r.semana for r in regs})
    if semana is None:
        semana = max(no_sistema) if no_sistema else ((max(semanas) + 1) if semanas else numero_semana(__import__("datetime").date.today()))
    pn = montar_painel(regs, semana)
    # meta da semana N: as atividades da programação do sistema; sem ela, o programado do histórico (só o total)
    contrato = valor_contrato(s, obra_id)
    ls = linhas.get(semana, [])
    if ls:
        ativs = [Atividade(x["responsavel"], x["local"], f"{x['area'].split(' · ')[0]} · {x['descricao']}", x["valor_previsto"])
                 for x in ls if x["valor_previsto"] > 0]
        atual = {**meta_da_semana(ativs, contrato), "origem": "sistema", "programacao": {"id": progs[semana].id, "titulo": progs[semana].titulo}}
    else:
        h = [r for r in regs if r.semana == semana]
        atual = {**meta_da_semana([Atividade(r.responsavel, "—", "meta da semana (apresentação anterior)", r.programado) for r in h], contrato),
                 "origem": "historico" if h else None, "programacao": None}
    resumo = []
    for n in semanas if semana in semanas else sorted(set(semanas) | {semana}):
        rs = [r for r in regs if r.semana == n]
        p = sum(r.programado for r in rs)
        real = sum(r.realizado or 0 for r in rs) if any(r.realizado is not None for r in rs) else None
        resumo.append({"semana": n, "origem": "sistema" if n in no_sistema else ("historico" if rs else None),
                       "programado": round(p, 2), "realizado": round(real, 2) if real is not None else None,
                       "aderencia": (real / p) if real is not None and p else None,
                       "fisica": (sum(r.cumpridas for r in rs) / sum(r.atividades for r in rs)) if sum(r.atividades for r in rs) else None})
    return {"semana": semana, "semanas": resumo, "anteriores": pn.anteriores, "ranking": pn.ranking, "anterior": pn.anterior,
            "atual": atual, "linhas_anterior": linhas.get(semana - 1, []), "linhas_atual": ls,
            "historico": [{"id": h.id, "semana": h.semana, "responsavel": h.responsavel, "programado": h.programado,
                           "realizado": h.realizado, "origem": h.origem, "arquivo": h.arquivo, "no_sistema": h.semana in no_sistema}
                          for h in hist]}
