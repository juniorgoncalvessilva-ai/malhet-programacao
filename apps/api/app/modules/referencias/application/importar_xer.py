"""Cronograma do Primavera P6 direto do .xer (sem exportar para Excel) → versão CRONOGRAMA.

Formato XER: linhas separadas por TAB; `%T tabela`, `%F campos`, `%R valores`. Usamos PROJWBS (caminho da EAP),
TASK (atividades) e TASKPRED (contagem de ligações, para o sequenciamento futuro).
"""
from datetime import datetime
from typing import BinaryIO

from sqlalchemy.orm import Session

from app.modules.referencias.application.versoes import ResultadoCarga, ativar_versao, nova_versao
from app.modules.referencias.infra.models import AtividadeCronogramaModel

STATUS = {"TK_NotStart": "Not Started", "TK_Active": "In Progress", "TK_Complete": "Completed"}


def ler_xer(conteudo: bytes) -> dict[str, list[dict[str, str]]]:
    texto = conteudo.decode("cp1252", errors="replace")
    tabelas: dict[str, list[dict[str, str]]] = {}
    campos: list[str] = []
    atual = None
    for linha in texto.splitlines():
        p = linha.split("\t")
        if p[0] == "%T":
            atual = p[1].strip()
            tabelas.setdefault(atual, [])
        elif p[0] == "%F":
            campos = p[1:]
        elif p[0] == "%R" and atual:
            tabelas[atual].append(dict(zip(campos, p[1:])))
    return tabelas


def _dt(v: str | None) -> datetime | None:
    if not v:
        return None
    try:
        return datetime.strptime(v.strip()[:16], "%Y-%m-%d %H:%M")
    except ValueError:
        return None


def _num(v: str | None) -> float | None:
    try:
        return float(v) if v not in (None, "") else None
    except ValueError:
        return None


def caminhos_wbs(wbs: list[dict[str, str]]) -> dict[str, list[str]]:
    por_id = {w["wbs_id"]: w for w in wbs}
    cache: dict[str, list[str]] = {}

    def caminho(wid: str) -> list[str]:
        if wid in cache:
            return cache[wid]
        w = por_id.get(wid)
        if not w or w.get("proj_node_flag") == "Y":
            cache[wid] = []
            return []
        cache[wid] = caminho(w.get("parent_wbs_id", "")) + [w.get("wbs_name", "").strip()]
        return cache[wid]

    return {wid: caminho(wid) for wid in por_id}


def carregar_xer(session: Session, obra_id: int, arquivo: BinaryIO, *, nome_arquivo: str, rotulo: str,
                 usuario: str, ativar: bool = True) -> ResultadoCarga:
    t = ler_xer(arquivo.read())
    res = ResultadoCarga()
    tasks = t.get("TASK", [])
    if not tasks:
        res.avisos.append("arquivo sem a tabela TASK: não parece um .xer do P6")
        return res
    proj = (t.get("PROJECT") or [{}])[0]
    data_base = _dt(proj.get("last_recalc_date"))
    v = nova_versao(session, obra_id, "CRONOGRAMA", rotulo, usuario, data_base.date() if data_base else None,
                    nome_arquivo, f"P6 {proj.get('proj_short_name', '')}".strip())
    caminhos = caminhos_wbs(t.get("PROJWBS", []))
    vistos = set()
    for r in tasks:
        code = (r.get("task_code") or "").strip()
        if not code or code in vistos or r.get("task_type") in ("TT_WBS", "TT_LOE"):
            continue
        vistos.add(code)
        cam = caminhos.get(r.get("wbs_id", ""), [])
        inicio = _dt(r.get("act_start_date")) or _dt(r.get("early_start_date")) or _dt(r.get("target_start_date"))
        fim = _dt(r.get("act_end_date")) or _dt(r.get("early_end_date")) or _dt(r.get("target_end_date"))
        session.add(AtividadeCronogramaModel(
            versao_id=v.id, id_crono=code, atividade=(r.get("task_name") or "").strip()[:400],
            area=" / ".join(cam[:-1])[:200] or None, wbs=(cam[-1][:200] if cam else None),
            detalhe_wbs=None, status=STATUS.get(r.get("status_code", ""), r.get("status_code")),
            inicio=inicio, fim=fim, realizado=_num(r.get("phys_complete_pct")),
            horas_crono=_num(r.get("target_drtn_hr_cnt"))))
    v.qtd_itens = len(vistos)
    res.contagem["CRONOGRAMA"] = len(vistos)
    res.contagem["LIGACOES"] = len(t.get("TASKPRED", []))
    res.versoes["CRONOGRAMA"] = v.id
    if ativar:
        ativar_versao(session, v.id, obra_id)
    session.flush()
    return res
