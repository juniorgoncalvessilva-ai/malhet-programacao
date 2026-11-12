"""Painel de indicadores: lê o histórico (fato vigente) e os desvios, calcula os KPIs e a memória de cada um."""
from dataclasses import dataclass
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.indicadores.application.desvios import causas
from app.modules.indicadores.domain import kpi
from app.modules.indicadores.infra.models import DesvioModel, FatoProgramacaoModel
from app.shared.memoria import Fonte, Memoria, Passo, num, pacote

MODOS = {"capacidade": "Pela capacidade", "manual": "Manual (encarregado)", "ajustado": "Capacidade ajustada"}


@dataclass(frozen=True)
class Filtros:
    de: date | None = None
    ate: date | None = None
    encarregado: str | None = None
    equipe_id: int | None = None
    grupo: str | None = None
    item_pq: str | None = None
    area_id: int | None = None
    modo: str | None = None


def _fatos(s: Session, obra_id: int, f: Filtros) -> list[FatoProgramacaoModel]:
    q = select(FatoProgramacaoModel).where(FatoProgramacaoModel.obra_id == obra_id, FatoProgramacaoModel.vigente.is_(True))
    if f.de:
        q = q.where(FatoProgramacaoModel.data >= f.de)
    if f.ate:
        q = q.where(FatoProgramacaoModel.data <= f.ate)
    for campo in ("encarregado", "equipe_id", "grupo", "item_pq", "area_id"):
        v = getattr(f, campo)
        if v not in (None, ""):
            q = q.where(getattr(FatoProgramacaoModel, campo) == v)
    if f.modo:
        q = q.where(FatoProgramacaoModel.modo_previsto == f.modo)
    return list(s.scalars(q.order_by(FatoProgramacaoModel.data, FatoProgramacaoModel.n_linha)))


def _dia(x: FatoProgramacaoModel) -> kpi.FatoDia:
    return kpi.FatoDia(x.programacao_id, x.titulo, x.linha_id, x.n_linha, x.semana, x.concluida, x.modo_previsto,
                       x.previsto, x.capacidade, x.realizado, x.hh_un, x.hh_equipe, x.encarregado, x.equipe,
                       x.descricao or "", x.codigo_simova, x.unidade, x.area, x.grupo)


def _pct(v: float | None) -> str:
    return "—" if v is None else f"{num(v * 100, 1)} %"


def _mem_razao(chave: str, titulo: str, r: kpi.Razao, formula: str, rot_num: str, rot_den: str, fontes: tuple,
               notas: tuple = (), pct: bool = True, casas: int = 2, media: bool = False) -> Memoria:
    fmt = _pct if pct else (lambda v: num(v, casas))
    passos = []
    if media:
        passos += [Passo(rot, f"erro {_pct(a)}", "") for rot, a, _b in r.partes[:40]]
        if len(r.partes) > 40:
            passos.append(Passo(f"… e mais {len(r.partes) - 40} atividade(s)", "", ""))
    else:
        passos += [Passo(rot, f"{num(a, casas)} ÷ {num(b, casas)}", fmt(a / b if b > kpi.TOL else None)) for rot, a, b in r.partes]
    passos.append(Passo(f"Total ({r.n} atividade(s))", f"{rot_num} {num(r.numerador, casas)} ÷ {rot_den} {num(r.denominador, casas)}",
                        fmt(r.valor), True))
    return Memoria(chave, titulo, fmt(r.valor), formula, tuple(passos), fontes, notas)


def painel(s: Session, obra_id: int, f: Filtros) -> dict:
    linhas = _fatos(s, obra_id, f)
    ats = kpi.atividades([_dia(x) for x in linhas])
    progs = sorted({(x.programacao_id, x.titulo, x.concluida) for x in linhas}, key=lambda t: t[1])
    fontes = (Fonte("Histórico da programação", f"{len(ats)} atividade(s) · {len(linhas)} linha(s)-dia",
                    "gravado ao emitir e ao concluir cada programação",
                    "; ".join(f"{t}{' (concluída)' if c else ' (emitida)'}" for _i, t, c in progs[:12])
                    + (f" e mais {len(progs) - 12}" if len(progs) > 12 else "")),)
    so_concl = ("Só programações concluídas (com realizado lançado).",)
    r_ppc, r_ad, r_carga = kpi.ppc(ats), kpi.aderencia(ats), kpi.carga(ats)
    r_rc, r_hh = kpi.realizado_capacidade(ats), kpi.eficiencia_hh(ats)
    r_erro, r_prev = kpi.erro_programacao(ats), kpi.erro_previsao(ats)
    cls = kpi.classes_carga(ats)
    mems = [
        _mem_razao("ppc", "PPC — percentual de atividades cumpridas", r_ppc,
                   "PPC = atividades cumpridas (realizado ≥ previsto) ÷ atividades programadas", "cumpridas", "programadas",
                   fontes, so_concl, casas=0),
        _mem_razao("aderencia", "Aderência da quantidade", r_ad, "aderência = Σ realizado ÷ Σ previsto",
                   "realizado", "previsto", fontes, so_concl),
        _mem_razao("carga", "Programado × capacidade (carga)", r_carga,
                   "carga = Σ previsto ÷ Σ capacidade da equipe no período (base escolhida em cada programação)",
                   "previsto", "capacidade", fontes,
                   (f"Por atividade: {cls['sobre']} sobre-programada(s) (> 110 %), {cls['ok']} na capacidade, "
                    f"{cls['sub']} sub-programada(s) (< 70 %).", "Só atividades com equipe e CPU (com capacidade).")),
        _mem_razao("erro_programacao", "Erro de programação × capacidade", r_erro,
                   "erro = média de |previsto − capacidade| ÷ capacidade, por atividade", "Σ erros", "atividades",
                   fontes, ("Quanto o programado se afastou do que a equipe consegue fazer (pela CPU).",), media=True),
        _mem_razao("erro_previsao", "Erro de previsão (realizado × previsto)", r_prev,
                   "erro = média de |realizado − previsto| ÷ previsto, por atividade", "Σ erros", "atividades",
                   fontes, so_concl, media=True),
        _mem_razao("realizado_capacidade", "Realizado ÷ capacidade (produtividade × CPU)", r_rc,
                   "Σ realizado ÷ Σ capacidade da equipe programada", "realizado", "capacidade", fontes,
                   (*so_concl, "100 % = a equipe produziu o que a CPU diz que ela consegue.")),
        _mem_razao("eficiencia_hh", "Eficiência de HH (CPU ÷ equipe programada)", r_hh,
                   "Σ (realizado × HH/un da CPU) ÷ Σ HH da equipe programada (pessoas × jornada × fator do dia)",
                   "HH CPU", "HH equipe", fontes,
                   (*so_concl, "HH da equipe = equipe programada (o apontamento do Simova ainda está em implantação).")),
    ]
    # por modo do previsto: o manual do encarregado acerta mais ou menos que a capacidade?
    por_modo = []
    for m, rot in MODOS.items():
        sub = [a for a in ats if a.modo == m]
        if not sub:
            continue
        ad, ca, ep = kpi.aderencia(sub), kpi.carga(sub), kpi.erro_previsao(sub)
        por_modo.append({"modo": m, "rotulo": rot, "atividades": len(sub), "aderencia": ad.valor, "carga": ca.valor,
                         "erro_previsao": ep.valor, "ppc": kpi.ppc(sub).valor})
        mems += [_mem_razao(f"modo_aderencia:{m}", f"Aderência · {rot}", ad, "Σ realizado ÷ Σ previsto", "realizado",
                            "previsto", fontes, so_concl),
                 _mem_razao(f"modo_carga:{m}", f"Carga × capacidade · {rot}", ca, "Σ previsto ÷ Σ capacidade", "previsto",
                            "capacidade", fontes),
                 _mem_razao(f"modo_erro:{m}", f"Erro de previsão · {rot}", ep, "média |realizado − previsto| ÷ previsto",
                            "Σ erros", "atividades", fontes, so_concl, media=True)]
    # por encarregado
    por_enc = []
    for enc in sorted({a.encarregado or "(sem encarregado)" for a in ats}):
        sub = [a for a in ats if (a.encarregado or "(sem encarregado)") == enc]
        i = len(por_enc)
        rp, ra, rc = kpi.ppc(sub), kpi.aderencia(sub), kpi.carga(sub)
        por_enc.append({"encarregado": enc, "atividades": len(sub), "ppc": rp.valor, "aderencia": ra.valor,
                        "carga": rc.valor, "erro_programacao": kpi.erro_programacao(sub).valor, "chave": i})
        mems += [_mem_razao(f"enc_ppc:{i}", f"PPC · {enc}", rp, "cumpridas ÷ programadas", "cumpridas", "programadas",
                            fontes, so_concl, casas=0),
                 _mem_razao(f"enc_aderencia:{i}", f"Aderência · {enc}", ra, "Σ realizado ÷ Σ previsto", "realizado",
                            "previsto", fontes, so_concl),
                 _mem_razao(f"enc_carga:{i}", f"Carga × capacidade · {enc}", rc, "Σ previsto ÷ Σ capacidade", "previsto",
                            "capacidade", fontes)]
    # semanas (série)
    semanas = sorted({a.semana for a in ats})
    serie = []
    for w in semanas:
        sub = [a for a in ats if a.semana == w]
        serie.append({"semana": w, "ppc": kpi.ppc(sub).valor, "aderencia": kpi.aderencia(sub).valor,
                      "carga": kpi.carga(sub).valor, "atividades": len(sub)})
    # Pareto dos desvios no período
    qd = select(DesvioModel).where(DesvioModel.obra_id == obra_id)
    if f.de:
        qd = qd.where(DesvioModel.data >= f.de)
    if f.ate:
        qd = qd.where(DesvioModel.data <= f.ate)
    desvios = list(s.scalars(qd))
    nomes = {c.id: c.descricao for c in causas(s, obra_id)}
    cont: dict[str, int] = {}
    for d in desvios:
        cont[nomes.get(d.causa_id, "?")] = cont.get(nomes.get(d.causa_id, "?"), 0) + 1
    par = kpi.pareto(cont)
    if par:
        mems.append(Memoria("pareto", "Pareto de desvios", f"{len(desvios)} ocorrência(s)",
                            "recorrência por classificação; % = ocorrências ÷ total; acumulado em ordem decrescente",
                            tuple(Passo(p["causa"], f"{p['ocorrencias']} ÷ {len(desvios)}",
                                        f"{_pct(p['pct'])} · acumulado {_pct(p['pct_acumulado'])}") for p in par),
                            (Fonte("Desvios", f"{len(desvios)}", "registro de desvios (Pareto) da obra",
                                   f"{sum(d.origem == 'importado' for d in desvios)} importado(s) da planilha · "
                                   f"{sum(d.origem == 'app' for d in desvios)} lançado(s) no app"),)))
    # atividades mais fora da capacidade (para agir)
    fora = sorted([a for a in ats if a.classe_carga in ("sobre", "sub")], key=lambda a: -abs((a.carga or 1) - 1))[:30]
    sel = {"encarregados": sorted({x.encarregado for x in linhas if x.encarregado}),
           "equipes": sorted({(x.equipe_id, x.equipe) for x in linhas if x.equipe_id}, key=lambda t: t[1] or ""),
           "grupos": sorted({x.grupo for x in linhas if x.grupo}),
           "itens": sorted({x.item_pq for x in linhas if x.item_pq}),
           "areas": sorted({(x.area_id, x.area) for x in linhas if x.area_id}, key=lambda t: t[1] or "")}
    return {
        "kpis": {"ppc": r_ppc.valor, "aderencia": r_ad.valor, "carga": r_carga.valor, "erro_programacao": r_erro.valor,
                 "erro_previsao": r_prev.valor, "realizado_capacidade": r_rc.valor, "eficiencia_hh": r_hh.valor,
                 "atividades": len(ats), "concluidas": sum(a.concluida for a in ats), "classes_carga": cls,
                 "desvios": len(desvios)},
        "por_modo": por_modo, "por_encarregado": por_enc, "semanas": serie, "pareto": par,
        "fora_da_capacidade": [{"programacao_id": a.programacao_id, "titulo": a.titulo, "n_linha": a.n_linha,
                                "codigo_simova": a.codigo_simova, "descricao": a.descricao, "encarregado": a.encarregado,
                                "unidade": a.unidade, "previsto": round(a.previsto, 4), "capacidade": round(a.capacidade, 4),
                                "carga": a.carga, "classe": a.classe_carga, "modo": a.modo} for a in fora],
        "opcoes": {"encarregados": sel["encarregados"], "equipes": [{"id": i, "nome": n} for i, n in sel["equipes"]],
                   "grupos": sel["grupos"], "itens": sel["itens"], "areas": [{"id": i, "nome": n} for i, n in sel["areas"]]},
        **pacote(*mems),
    }
