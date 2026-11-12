"""Cronograma do Primavera P6 direto do .xer (sem exportar para Excel) → versão CRONOGRAMA.

Formato XER: linhas separadas por TAB; `%T tabela`, `%F campos`, `%R valores`. Usamos PROJWBS (caminho da EAP),
TASK (atividades) e TASKPRED (contagem de ligações, para o sequenciamento futuro).
"""
from datetime import datetime
from typing import BinaryIO

from sqlalchemy.orm import Session

from app.modules.referencias.application.versoes import ResultadoCarga, ativar_versao, nova_versao
from app.modules.referencias.infra.models import AtividadeCronogramaModel

STATUS = {"TK_NotStart": "Não iniciada", "TK_Active": "Em andamento", "TK_Complete": "Concluída"}
_EN = {"Not Started": "Não iniciada", "In Progress": "Em andamento", "Completed": "Concluída"}


def status_pt(s: str | None) -> str | None:
    """Status do P6 em português (versões importadas antes guardaram em inglês)."""
    return _EN.get(s, s) if s else s


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
    """wbs_id → nomes da WBS do topo até o nó (sem o nó do projeto)."""
    return {wid: [n for n, _c, _k in niveis] for wid, niveis in estrutura_wbs(wbs).items()}


def _seq(v: str | None) -> int:
    try:
        return int(float(v or 0))
    except ValueError:
        return 0


def estrutura_wbs(wbs: list[dict[str, str]]) -> dict[str, list[tuple[str, str, str]]]:
    """wbs_id → [(nome, código, chave de ordem)] por nível, como o P6 mostra a EAP.

    A ordem do P6 é o seq_num do nó entre os irmãos (empate: código); a chave de cada nível acumula a do pai,
    então ordenar por ela devolve a árvore na ordem do Primavera (O.S. 1 antes da O.S. 2…).
    """
    por_id = {w["wbs_id"]: w for w in wbs}
    cache: dict[str, list[tuple[str, str, str]]] = {}

    def niveis(wid: str, pilha: tuple[str, ...] = ()) -> list[tuple[str, str, str]]:
        if wid in cache:
            return cache[wid]
        w = por_id.get(wid)
        if not w or w.get("proj_node_flag") == "Y" or wid in pilha:
            cache[wid] = []
            return []
        pai = niveis(w.get("parent_wbs_id", ""), pilha + (wid,))
        codigo = (w.get("wbs_short_name") or "").strip()
        chave = f"{(pai[-1][2] + '/') if pai else ''}{_seq(w.get('seq_num')):08d}~{codigo}"
        cache[wid] = pai + [((w.get("wbs_name") or "").strip(), codigo, chave)]
        return cache[wid]

    return {wid: niveis(wid) for wid in por_id}


TIPO_RECURSO = {"RT_Labor": "mao_de_obra", "RT_Equip": "equipamento", "RT_Mat": "material"}


def recursos_por_tarefa(t: dict[str, list[dict[str, str]]]) -> dict[str, list[dict]]:
    """task_id → recursos alocados (TASKRSRC + RSRC): código, nome, tipo, quantidade orçada e restante, unidade.
    Mão de obra e equipamento em horas; material na unidade do recurso (UMEASURE)."""
    unid = {u.get("unit_id"): (u.get("unit_abbrev") or "").strip() for u in t.get("UMEASURE", [])}
    rsrc = {r.get("rsrc_id"): r for r in t.get("RSRC", [])}
    out: dict[str, list[dict]] = {}
    for a in t.get("TASKRSRC", []):
        r = rsrc.get(a.get("rsrc_id"), {})
        tipo = TIPO_RECURSO.get(a.get("rsrc_type") or r.get("rsrc_type", ""), "outro")
        out.setdefault(a.get("task_id", ""), []).append({
            "codigo": (r.get("rsrc_short_name") or "").strip() or None, "nome": (r.get("rsrc_name") or "").strip() or "?",
            "tipo": tipo, "qtd": _num(a.get("target_qty")), "restante": _num(a.get("remain_qty")),
            "unid": unid.get(r.get("unit_id")) or None if tipo == "material" else "h"})
    return out


def _chave_codigo(code: str) -> tuple:
    """Ordem natural do Activity ID (C-9 antes de C-10)."""
    import re

    return tuple(int(p) if p.isdigit() else p.lower() for p in re.split(r"(\d+)", code))


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
    estrutura = estrutura_wbs(t.get("PROJWBS", []))
    recursos = recursos_por_tarefa(t)
    validas, vistos = [], set()
    for r in tasks:
        code = (r.get("task_code") or "").strip()
        if not code or code in vistos or r.get("task_type") in ("TT_WBS", "TT_LOE"):
            continue
        vistos.add(code)
        validas.append(r)
    # ordem do P6: a WBS pelo seq_num (nível a nível); dentro de cada WBS, o Activity ID em ordem natural
    validas.sort(key=lambda r: ((estrutura.get(r.get("wbs_id", "")) or [("", "", "~")])[-1][2],
                                _chave_codigo(r["task_code"].strip())))
    for ordem, r in enumerate(validas, start=1):
        code = r["task_code"].strip()
        niv = estrutura.get(r.get("wbs_id", ""), [])
        cam = [n for n, _c, _k in niv]
        inicio = _dt(r.get("act_start_date")) or _dt(r.get("early_start_date")) or _dt(r.get("target_start_date"))
        fim = _dt(r.get("act_end_date")) or _dt(r.get("early_end_date")) or _dt(r.get("target_end_date"))
        session.add(AtividadeCronogramaModel(
            versao_id=v.id, id_crono=code, atividade=(r.get("task_name") or "").strip()[:400],
            area=" / ".join(cam[:-1])[:200] or None, wbs=(cam[-1][:200] if cam else None),
            detalhe_wbs=None, status=STATUS.get(r.get("status_code", ""), r.get("status_code")),
            inicio=inicio, fim=fim, realizado=_num(r.get("phys_complete_pct")),
            horas_crono=_num(r.get("target_drtn_hr_cnt")),
            wbs_niveis=[{"nome": n, "codigo": c, "ordem": k} for n, c, k in niv] or None, ordem_p6=ordem,
            recursos=recursos.get(r.get("task_id", "")) or None))
    v.qtd_itens = len(vistos)
    res.contagem["CRONOGRAMA"] = len(vistos)
    res.contagem["LIGACOES"] = len(t.get("TASKPRED", []))
    res.versoes["CRONOGRAMA"] = v.id
    if ativar:
        ativar_versao(session, v.id, obra_id)
    session.flush()
    return res
