"""Montagem, visão, emissão e exportações da programação semanal/mensal.

A visão é a mesma estrutura do formato da obra: Local → Área → linhas (P/R por dia). Ela é montada "ao vivo"
a partir dos ids (frentes, catálogo, equipes, PQ vigente); a emissão congela essa visão (foto) por revisão.
"""
from datetime import date
from io import BytesIO

from openpyxl import Workbook
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.catalogo.domain import catalogo as cat
from app.modules.catalogo.infra.models import GrupoAtividadeModel, ItemSimovaModel, TipoAtividadeModel
from app.modules.efetivo.infra.gateway import funcoes_por_cracha
from app.modules.equipes.infra.composicao import composicao_efetiva
from app.modules.equipes.infra.models import EquipeModel
from app.modules.frentes.infra.models import AreaFrenteModel, LocalFrenteModel
from app.modules.integracao_simova.domain import layout
from app.modules.planejamento.domain.periodo import DIAS, dias, janelas_ft
from app.modules.planejamento.infra.models import (
    ConclusaoModel,
    EmissaoModel,
    LinhaProgramacaoModel,
    ProgramacaoModel,
    ValorDiaModel,
)
from app.modules.referencias.infra.models import (
    AtividadeCronogramaModel,
    ItemPqModel,
    PqQuantidadeTagModel,
)
from app.modules.programacao.domain.gargalo import capacidade_da_equipe, capacidade_pelo_governa, capacidade_por_funcao
from app.modules.programacao.domain.previsto import capacidade_por_dia, fatores_do_periodo, previsto_pela_capacidade
from app.modules.referencias.domain.cpu_obra import nome_recurso
from app.modules.referencias.infra.cpu_gateway import CpuGateway, ParametrosCpu
from app.modules.referencias.application.importar_xer import status_pt
from app.modules.referencias.infra.resolvedor import JORNADA_REFERENCIA, ResolvedorReferencias
from app.shared import simova
from app.shared.errors import DomainError, NotFoundError

DIAS_FT = ("SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO", "DOMINGO")


def obter(s: Session, obra_id: int, pid: int) -> ProgramacaoModel:
    p = s.get(ProgramacaoModel, pid)
    if p is None or p.obra_id != obra_id:
        raise NotFoundError("Programação", pid)
    return p


def _num(v: float | None) -> float:
    return float(v or 0)


def _chave(nome: str) -> str:
    return nome_recurso(nome).casefold()


def calculo_linha(par: ParametrosCpu | None, equipe: EquipeModel | None, previsto: list, realizado: list,
                  funcao_de: dict[str, str] | None = None, base: str = "equipe") -> dict:
    """Produção da linha a partir da CPU da obra: HH/un, recurso que governa, índice e capacidade da equipe.

    HH do dia            = quantidade × HH/un (soma da mão de obra da composição, auxiliares incluídas)
    índice (un/dia)      = jornada ÷ h/un do recurso que governa  → por oficial
    oficiais do dia      = quantidade ÷ índice
    capacidade da equipe = jornada ÷ max(h/un da função ÷ quantas a equipe tem)   (gargalo)
                         = menor(pessoas da função × jornada ÷ h/un)
    pelo recurso que governa = pessoas que governam × jornada ÷ h/un   (base "governa": apoio vira aviso)
    """
    jornada = float(equipe.jornada_horas) if equipe and equipe.jornada_horas else JORNADA_REFERENCIA
    alertas: list[str] = []
    if par is None:
        return {"composicao": None, "hh_un": None, "recurso_governa": None, "indice_un_dia": None,
                "jornada": jornada, "capacidade_un_dia": None, "gargalo": None, "apoio_externo": [],
                "capacidade_equipe": None, "capacidade_governa": None, "base_capacidade": base, "producao_por_funcao": {},
                "custo_unitario": None, "hh_previsto": [None] * len(previsto), "oficiais": [None] * len(previsto),
                "acima_capacidade": [False] * len(previsto), "total_hh_previsto": 0.0, "total_hh_realizado": 0.0,
                "alertas": ["sem item de PQ: sem HH nem índice"]}
    if not par.composicao:
        alertas.append(f"item {par.item_pq} sem composição na CPU vigente")
    elif not par.recursos:
        alertas.append(f"composição {par.composicao} sem mão de obra nem equipamento (subempreitado?)")
    hh_un = par.hh_por_unidade
    indice = par.indice_un_dia(jornada)
    cap = gargalo = cap_equipe = cap_gov = None
    apoio: list[str] = []
    por_funcao: dict[str, float] = {}
    if equipe is not None and (equipe.composicao or any(m.funcao or (funcao_de or {}).get(m.cracha) for m in equipe.membros)) and par.recursos:
        tem = {}
        for rec, _t, q in composicao_efetiva(equipe, funcao_de):
            tem[_chave(rec)] = tem.get(_chave(rec), 0.0) + q
        comp = {r.recurso: tem.get(_chave(r.recurso), 0.0) for r in par.recursos}
        ce = capacidade_da_equipe(par.coefs, comp, jornada, par.recurso_governa)
        cap_equipe, gargalo, apoio = round(ce.capacidade_un_dia, 4), ce.gargalo, list(ce.apoio_externo)
        cap_gov = round(capacidade_pelo_governa(par.coefs, comp, jornada, par.recurso_governa), 4)
        por_funcao = {f: round(v, 4) for f, v in capacidade_por_funcao(par.coefs, comp, jornada).items()}
        cap = cap_gov if base == "governa" else cap_equipe
        if ce.falta_governante:
            alertas.append(f"a equipe não tem {par.recurso_governa}: capacidade zero")
        elif base == "governa":  # apoio que não acompanha o ritmo de quem governa: aviso, não limita
            for f, v in sorted(por_funcao.items(), key=lambda kv: kv[1]):
                if f != par.recurso_governa and v < cap_gov - 1e-9:
                    alertas.append(f"com {comp[f]:g} {f} a equipe faz {v:.2f}/dia (abaixo dos {cap_gov:.2f} de quem governa)"
                                   .replace(".", ","))
    hh_prev = [round(q * hh_un, 2) if q and hh_un else None for q in previsto]
    oficiais = [round(q / indice, 1) if q and indice else None for q in previsto]
    acima = [bool(q and cap is not None and q > cap + 1e-9) for q in previsto]
    if any(acima):
        alertas.append(f"previsto acima da capacidade da equipe ({cap:.2f}/dia) em {sum(acima)} dia(s)".replace(".", ","))
    return {"composicao": par.composicao, "descricao_composicao": par.descricao_composicao,
            "hh_un": hh_un, "recurso_governa": par.recurso_governa, "coef_governa": par.coef_governa,
            "indice_un_dia": round(indice, 4) if indice else None, "jornada": jornada,
            "capacidade_un_dia": cap, "gargalo": gargalo, "apoio_externo": apoio,
            "capacidade_equipe": cap_equipe, "capacidade_governa": cap_gov, "base_capacidade": base,
            "producao_por_funcao": por_funcao,
            "custo_unitario": par.custo_unitario, "hh_previsto": hh_prev, "oficiais": oficiais,
            "acima_capacidade": acima,
            "total_hh_previsto": round(sum(x or 0 for x in hh_prev), 2),
            "total_hh_realizado": round(sum(_num(q) for q in realizado) * (hh_un or 0), 2),
            "alertas": alertas}


def limite_do_periodo(reg: dict) -> tuple[float | None, str]:
    """Até quanto o botão "Pela capacidade" preenche: a qtd do período; sem ela, o que resta do projeto antes do
    período (qtd de projeto − feito antes); sem nenhum dos dois, sem limite."""
    if reg.get("qtd_periodo") is not None:
        return float(reg["qtd_periodo"]), "quantidade do período"
    if reg.get("qtd_projeto") is not None:
        return max(0.0, round(reg["qtd_projeto"] - (reg.get("realizado_anterior") or 0), 4)), "resta do projeto antes do período"
    return None, "sem limite (sem qtd do período nem de projeto)"


def sugestao_capacidade(reg: dict, fatores) -> None:
    """Capacidade de cada dia (nas duas bases) e o previsto que o botão "Pela capacidade" daria — guardado mesmo
    quando o encarregado programa à mão, para comparar programado × capacidade nos indicadores."""
    c = reg["calc"]
    c["fator_dia"] = [f.fator for f in fatores]
    c["horas_dia"] = [f.horas for f in fatores]
    c["capacidade_dia"] = capacidade_por_dia(c["capacidade_un_dia"], fatores)
    c["capacidade_equipe_dia"] = capacidade_por_dia(c["capacidade_equipe"], fatores)
    c["capacidade_governa_dia"] = capacidade_por_dia(c["capacidade_governa"], fatores)
    lim, origem = limite_do_periodo(reg)
    c["limite_sugestao"], c["origem_limite"] = lim, origem
    c["previsto_sugerido"] = previsto_pela_capacidade(c["capacidade_un_dia"], fatores, lim)
    c["total_sugerido"] = round(sum(x or 0 for x in c["previsto_sugerido"]), 4)
    c["total_capacidade"] = round(sum(x or 0 for x in c["capacidade_dia"]), 4)


def _chave_linha(ln: LinhaProgramacaoModel) -> tuple:
    return (ln.area_id, ln.tipo_id, ln.item_simova_id, ln.item_pq)


def realizado_anterior(s: Session, p: ProgramacaoModel) -> dict[tuple, float]:
    """Realizado acumulado ANTES do início desta programação, pela mesma atividade (área, tipo, item, PQ).

    Considera programações do mesmo tipo; semanas se sobrepõem (sexta/sábado), então cada dia conta uma vez,
    valendo a programação mais recente.
    """
    q = (select(ProgramacaoModel).where(ProgramacaoModel.obra_id == p.obra_id, ProgramacaoModel.tipo == p.tipo,
                                        ProgramacaoModel.id != p.id, ProgramacaoModel.inicio < p.inicio)
         .order_by(ProgramacaoModel.inicio))
    por_dia: dict[tuple, float] = {}
    for outra in s.scalars(q):
        for ln in outra.linhas:
            for v in ln.valores:
                if v.data < p.inicio and v.realizado is not None:
                    por_dia[(_chave_linha(ln), v.data)] = float(v.realizado)
    tot: dict[tuple, float] = {}
    for (k, _d), q_ in por_dia.items():
        tot[k] = round(tot.get(k, 0.0) + q_, 4)
    return tot


def visao(s: Session, p: ProgramacaoModel) -> dict:
    """Programação resolvida para tela/impressão: locais → áreas → linhas, com totais."""
    vig = ResolvedorReferencias(s, p.obra_id).versoes_vigentes()
    datas = dias(p.inicio, p.fim)
    areas = {a.id: a for a in s.scalars(select(AreaFrenteModel).where(AreaFrenteModel.obra_id == p.obra_id))}
    locais = {x.id: x for x in s.scalars(select(LocalFrenteModel).where(LocalFrenteModel.obra_id == p.obra_id))}
    tipos = {t.id: t for t in s.scalars(select(TipoAtividadeModel).where(TipoAtividadeModel.obra_id == p.obra_id))}
    grupos = {g.id: g for g in s.scalars(select(GrupoAtividadeModel).where(GrupoAtividadeModel.obra_id == p.obra_id))}
    itens = {i.id: i for i in s.scalars(select(ItemSimovaModel).where(ItemSimovaModel.obra_id == p.obra_id))}
    equipes = {e.id: e for e in s.scalars(select(EquipeModel).where(EquipeModel.obra_id == p.obra_id))}
    cods_pq = {ln.item_pq for ln in p.linhas if ln.item_pq}
    pq = {}
    qtd_tag = {}
    if "PQ" in vig and cods_pq:
        pq = {x.item: x for x in s.scalars(select(ItemPqModel).where(ItemPqModel.versao_id == vig["PQ"],
                                                                      ItemPqModel.item.in_(cods_pq)))}
        qtd_tag = {(x.item, x.tag): x.quantidade for x in s.scalars(
            select(PqQuantidadeTagModel).where(PqQuantidadeTagModel.versao_id == vig["PQ"],
                                               PqQuantidadeTagModel.item.in_(cods_pq)))}
    cpu = CpuGateway(s, p.obra_id, vig).por_itens(cods_pq)
    funcao_de = funcoes_por_cracha(s, p.obra_id)
    cron = {}
    ids_crono = {ln.id_crono for ln in p.linhas if ln.id_crono}
    if "CRONOGRAMA" in vig and ids_crono:
        cron = {x.id_crono: x for x in s.scalars(select(AtividadeCronogramaModel).where(
            AtividadeCronogramaModel.versao_id == vig["CRONOGRAMA"], AtividadeCronogramaModel.id_crono.in_(ids_crono)))}

    anterior = realizado_anterior(s, p)
    fatores = fatores_do_periodo(datas, semanal=p.tipo == "SEMANAL")
    wbs_cod = {}
    if any(ln.wbs_no_id for ln in p.linhas):
        from app.modules.wbs.infra.gateway import codigos

        wbs_cod = codigos(s, p.obra_id)
    por_area: dict[int, list[dict]] = {}
    for n, ln in enumerate(p.linhas, start=1):
        a, t = areas[ln.area_id], tipos[ln.tipo_id]
        g = grupos[t.grupo_id]
        it = itens.get(ln.item_simova_id) if ln.item_simova_id else None
        eq = equipes.get(ln.equipe_id) if ln.equipe_id else None
        ipq = pq.get(ln.item_pq) if ln.item_pq else None
        val = {v.data: v for v in ln.valores}
        prev = [val[d].previsto if d in val else None for d in datas]
        real = [val[d].realizado if d in val else None for d in datas]
        qtd_tk = qtd_tag.get((ln.item_pq, a.tag)) if ln.item_pq and a.tag else None
        at = cron.get(ln.id_crono) if ln.id_crono else None
        por_area.setdefault(a.id, []).append({
            "id": ln.id, "n": n, "area_id": a.id, "tipo_id": t.id, "item_simova_id": ln.item_simova_id,
            "grupo": {"codigo": str(g.numero), "descricao": g.descricao},
            "codigo_simova": cat.codigo_item(g.numero, t.numero, it.numero if it else None),
            "descricao": cat.descricao_item(t.descricao, it.complemento if it else None),
            "complemento": it.complemento if it else None,
            "unidade": t.unidade or (ipq.unid if ipq else None),
            "item_pq": ln.item_pq, "descricao_pq": ipq.descricao if ipq else None,
            "pu": ipq.pu if ipq else None,
            "qtd_takeoff": qtd_tk, "qtd_projeto": ln.qtd_projeto if ln.qtd_projeto is not None else qtd_tk,
            "id_crono": ln.id_crono, "atividade_crono": at.atividade if at else None,
            "wbs_no_id": ln.wbs_no_id, "wbs_codigo": wbs_cod[ln.wbs_no_id].codigo if ln.wbs_no_id in wbs_cod else None,
            "wbs_caminho": wbs_cod[ln.wbs_no_id].caminho if ln.wbs_no_id in wbs_cod else None,
            "equipe_id": ln.equipe_id, "equipe": eq.nome if eq else None,
            "encarregado": (eq.encarregado_nome if eq else None), "cracha": (eq.encarregado_cracha if eq else None),
            "observacao": ln.observacao, "previsto": prev, "realizado": real,
            "qtd_periodo": ln.qtd_periodo, "natureza": ln.natureza or "P", "modo_previsto": ln.modo_previsto or "manual",
            "responsavel": ln.responsavel or (eq.responsavel if eq else None),
            "turno": eq.turno if eq else None, "jornada": eq.jornada_horas if eq else None,
            "equipe_codigo": eq.codigo_simova if eq else None,
            "status_crono": status_pt(at.status) if at else None,
            "realizado_anterior": anterior.get(_chave_linha(ln)),
            "ssma": {k: getattr(ln, f"ssma_{k}") for k in ("tecnico", "rac", "pts", "art", "pto", "ata")},
            "total_previsto": round(sum(_num(x) for x in prev), 4), "total_realizado": round(sum(_num(x) for x in real), 4),
            "calc": calculo_linha(cpu.get(ln.item_pq) if ln.item_pq else None, eq, prev, real, funcao_de,
                                  p.base_capacidade or "equipe"),
        })
        reg = por_area[a.id][-1]
        feito = (reg["realizado_anterior"] or 0) + reg["total_realizado"]
        reg["restante"] = round(reg["qtd_projeto"] - feito, 4) if reg["qtd_projeto"] is not None else None
        sugestao_capacidade(reg, fatores)
    # dentro de cada área, as linhas seguem a estrutura do Primavera (ordem da atividade do cronograma no P6);
    # linhas sem atividade do cronograma vêm depois, na ordem em que foram incluídas
    ordem_crono = {k: x.ordem_p6 for k, x in cron.items() if x.ordem_p6 is not None}
    for lista in por_area.values():
        lista.sort(key=lambda ln: (ordem_crono.get(ln["id_crono"], 10**9), ln["n"]))
    saida_locais = []
    for loc in sorted(locais.values(), key=lambda x: (x.ordem, x.id)):
        areas_loc = sorted([a for a in areas.values() if a.local_id == loc.id and a.id in por_area],
                           key=lambda x: (x.ordem, x.id))
        if not areas_loc:
            continue
        saida_locais.append({"id": loc.id, "codigo": loc.codigo, "descricao": loc.descricao,
                             "areas": [{"id": a.id, "codigo": a.codigo, "cwa": a.cwa, "descricao": a.descricao,
                                        "tag": a.tag, "linhas": por_area[a.id]} for a in areas_loc]})
    todas = [ln for loc in saida_locais for a in loc["areas"] for ln in a["linhas"]]
    hh_dia = [round(sum(ln["calc"]["hh_previsto"][i] or 0 for ln in todas), 2) for i in range(len(datas))]
    return {"id": p.id, "tipo": p.tipo, "titulo": p.titulo, "inicio": p.inicio.isoformat(), "fim": p.fim.isoformat(),
            "status": p.status, "revisao": p.revisao, "hh_previsto_dia": hh_dia,
            "base_capacidade": p.base_capacidade or "equipe",
            "conclusoes": [{"numero": c.numero, "concluida_por": c.concluida_por,
                            "concluida_em": c.concluida_em.isoformat() if c.concluida_em else None,
                            "revisada_por": c.revisada_por, "motivo_revisao": c.motivo_revisao,
                            "revisada_em": c.revisada_em.isoformat() if c.revisada_em else None}
                           for c in sorted(p.conclusoes, key=lambda x: x.numero)],
            "total_hh_previsto": round(sum(hh_dia), 2),
            "total_hh_realizado": round(sum(ln["calc"]["total_hh_realizado"] for ln in todas), 2),
            "dias": [{"data": d.isoformat(), "dia": DIAS[d.weekday()]} for d in datas],
            "locais": saida_locais, "linhas": sum(len(v) for v in por_area.values())}


def exigir_aberta(p: ProgramacaoModel) -> None:
    """Programação concluída não muda: só por revisão (com motivo), que guarda a foto do que estava concluído."""
    if p.status == "concluida":
        raise DomainError("programação concluída: não pode ser alterada — abra uma revisão (com o motivo) para corrigir")


def exigir_rascunho(p: ProgramacaoModel) -> None:
    exigir_aberta(p)
    if p.status != "rascunho":
        raise DomainError("programação emitida: reabra para alterar o previsto")


def salvar_valores(s: Session, p: ProgramacaoModel, linha_id: int, valores: list[dict], campo: str) -> None:
    """campo = previsto (só em rascunho) | realizado (até concluir)."""
    exigir_aberta(p)
    if campo == "previsto":
        exigir_rascunho(p)
    ln = next((x for x in p.linhas if x.id == linha_id), None)
    if ln is None:
        raise NotFoundError("Linha", linha_id)
    atuais = {v.data: v for v in ln.valores}
    for item in valores:
        d = date.fromisoformat(str(item["data"]))
        if not (p.inicio <= d <= p.fim):
            raise DomainError(f"{d:%d/%m} fora do período da programação")
        q = item.get("valor")
        q = None if q in (None, "") else float(q)
        if q is not None and q < 0:
            raise DomainError("quantidade não pode ser negativa")
        v = atuais.get(d)
        if v is None:
            v = ValorDiaModel(data=d)
            ln.valores.append(v)
            atuais[d] = v
        if campo == "previsto" and ln.modo_previsto == "capacidade" and (v.previsto or None) != q:
            ln.modo_previsto = "ajustado"
        setattr(v, campo, q)
    s.flush()


def aplicar_modo_previsto(s: Session, p: ProgramacaoModel, modo: str, linhas: list[int] | None) -> dict:
    """Botões da programação. "capacidade": previsto do dia = capacidade × fator do dia até o limite (sobrescreve o
    previsto da linha). "manual": o encarregado preenche; nada é apagado, só muda o modo."""
    exigir_rascunho(p)
    if modo not in ("capacidade", "manual"):
        raise DomainError("modo: capacidade ou manual", "modo")
    alvo = [ln for ln in p.linhas if linhas is None or ln.id in set(linhas)]
    if linhas is not None and len(alvo) != len(set(linhas)):
        raise NotFoundError("Linha", ",".join(str(x) for x in set(linhas) - {ln.id for ln in alvo}))
    if modo == "manual":
        for ln in alvo:
            ln.modo_previsto = "manual"
        s.flush()
        return {"aplicadas": len(alvo), "puladas": []}
    v = visao(s, p)
    regs = {r["id"]: r for loc in v["locais"] for a in loc["areas"] for r in a["linhas"]}
    datas = [date.fromisoformat(d["data"]) for d in v["dias"]]
    feitas, puladas = 0, []
    for ln in alvo:
        r = regs[ln.id]
        c = r["calc"]
        if not c["capacidade_un_dia"]:
            motivo = ("sem equipe" if not ln.equipe_id else "sem item da PQ/CPU" if not c["hh_un"]
                      else "capacidade zero (" + "; ".join(c["alertas"][:1]) + ")" if c["alertas"] else "sem capacidade")
            puladas.append({"linha": r["n"], "id": ln.id, "descricao": r["descricao"], "motivo": motivo})
            continue
        sug = dict(zip(datas, c["previsto_sugerido"]))
        atuais = {x.data: x for x in ln.valores}
        for d in datas:
            x = atuais.get(d)
            if x is None:
                if sug[d] is None:
                    continue
                x = ValorDiaModel(data=d)
                ln.valores.append(x)
            x.previsto = sug[d]
        ln.modo_previsto = "capacidade"
        feitas += 1
    s.flush()
    return {"aplicadas": feitas, "puladas": puladas}


def emitir(s: Session, p: ProgramacaoModel, usuario: str) -> EmissaoModel:
    exigir_rascunho(p)
    if not p.linhas:
        raise DomainError("programação sem linhas")
    foto = visao(s, p)
    p.status = "emitida"
    foto["status"], foto["revisao"] = "emitida", p.revisao
    e = EmissaoModel(programacao_id=p.id, revisao=p.revisao, emitida_por=usuario, foto=foto)
    s.add(e)
    p.revisao += 1
    s.flush()
    return e


def reabrir(p: ProgramacaoModel) -> None:
    exigir_aberta(p)
    if p.status != "emitida":
        raise DomainError("só programação emitida pode ser reaberta")
    p.status = "rascunho"


def concluir(s: Session, p: ProgramacaoModel, usuario: str) -> ConclusaoModel:
    """Fecha a programação (depois de emitida e do realizado lançado): congela a foto; dali em diante só revisão."""
    if p.status != "emitida":
        raise DomainError("só programação emitida pode ser concluída" if p.status == "rascunho"
                          else "programação já concluída")
    n = len(p.conclusoes) + 1
    foto = visao(s, p)
    foto["status"] = "concluida"
    c = ConclusaoModel(programacao_id=p.id, numero=n, concluida_por=usuario, foto=foto)
    p.conclusoes.append(c)
    p.status = "concluida"
    s.flush()
    return c


def revisar(s: Session, p: ProgramacaoModel, usuario: str, motivo: str) -> ConclusaoModel:
    """Única forma de mudar uma programação concluída: registra o motivo e volta para emitida (o que estava concluído
    fica guardado na conclusão anterior). Para fechar de novo, conclua outra vez."""
    from datetime import datetime, timezone

    if p.status != "concluida":
        raise DomainError("só programação concluída é revisada; esta ainda está aberta")
    motivo = " ".join((motivo or "").split())
    if len(motivo) < 5:
        raise DomainError("informe o motivo da revisão", "motivo")
    ult = max(p.conclusoes, key=lambda x: x.numero)
    ult.revisada_por, ult.revisada_em, ult.motivo_revisao = usuario, datetime.now(timezone.utc), motivo[:500]
    p.status = "emitida"
    s.flush()
    return ult


def _fmt_ft(q: float) -> str:
    return str(int(q)) if float(q).is_integer() else str(q)


# ---- Simova ---------------------------------------------------------------------------------------------
def ft_xlsx(s: Session, p: ProgramacaoModel) -> tuple[bytes, int, list[str]]:
    """FT_IMPORT_INTERMEDIARIA: cada linha vira 1+ linhas (janelas de até 7 dias sem repetir o dia da semana)."""
    v = visao(s, p)
    datas = [date.fromisoformat(d["data"]) for d in v["dias"]]
    wb = Workbook()
    ws = wb.active
    ws.title = "FT_IMPORT_INTERMEDIARIA"
    ws.append(layout.FT_IMPORT_INTERMEDIARIA)
    n, pend = 0, []
    for loc in v["locais"]:
        for a in loc["areas"]:
            for ln in a["linhas"]:
                if not any(ln["previsto"]):
                    continue
                if not ln["cracha"]:
                    pend.append(f"linha {ln['n']} ({a['codigo']} · {ln['codigo_simova']}): equipe sem crachá do encarregado")
                    continue
                prev = dict(zip(datas, ln["previsto"]))
                hh_un = ln["calc"]["hh_un"]
                for jan in janelas_ft(datas):  # janela cobre o período; só os dias com quantidade vão preenchidos
                    if not any(prev.get(d) for d in jan):
                        continue
                    linha = dict.fromkeys(layout.FT_IMPORT_INTERMEDIARIA)
                    tipo_cod = ln["codigo_simova"]
                    linha.update({
                        "CRACHA_ENCARREGADO": ln["cracha"], "NOME_ENCARREGADO": ln["encarregado"],
                        "CODIGO_GRUPO": ln["grupo"]["codigo"], "CODIGO_OPER": tipo_cod,
                        "DESCRICAO_GRUPO": ln["grupo"]["descricao"], "DESCRICAO_OPER": ln["descricao"],
                        "CODIGO_TAREFA": ln["id_crono"], "CODIGO_FRENTE": a["codigo"],
                        "OBSERVACAO": " · ".join(x for x in (f"PQ {ln['item_pq']}" if ln["item_pq"] else None,
                                                             ln["observacao"]) if x) or None,
                        "DATA_INICIO": simova.fmt_data_br(jan[0]), "DATA_FIM": simova.fmt_data_br(jan[-1]),
                    })
                    for d in jan:
                        q = prev[d]
                        if not q:
                            continue
                        linha[f"PE_{DIAS_FT[d.weekday()]}"] = _fmt_ft(q)
                        hh = hh_un * q if hh_un else None
                        if hh:
                            linha[f"HH_{DIAS_FT[d.weekday()]}"] = _fmt_ft(round(hh, 2))
                    ws.append([linha[c] for c in layout.FT_IMPORT_INTERMEDIARIA])
                    n += 1
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue(), n, pend


def cadastros_simova_xlsx(s: Session, obra_id: int) -> bytes:
    """FRENTE (locais + áreas), OPER_GRUPO (grupos) e OPER (tipos g.t e itens g.t.n) para importar no Simova."""
    wb = Workbook()
    ws = wb.active
    ws.title = "FRENTE"
    ws.append(["CODIGO", "DESCRICAO", "GIS_OBJECT", "ATIVO"])
    locais = s.scalars(select(LocalFrenteModel).where(LocalFrenteModel.obra_id == obra_id)
                       .order_by(LocalFrenteModel.ordem, LocalFrenteModel.id)).all()
    for loc in locais:
        ws.append([loc.codigo, loc.descricao, None, "1" if loc.ativo else "0"])
        for a in s.scalars(select(AreaFrenteModel).where(AreaFrenteModel.local_id == loc.id)
                           .order_by(AreaFrenteModel.ordem, AreaFrenteModel.id)):
            ws.append([a.codigo, a.descricao, None, "1" if a.ativo else "0"])
    wg = wb.create_sheet("OPER_GRUPO")
    wg.append(["CODIGO", "DESCRICAO", "UNIDADE_MEDIDA", "MATERIAL", "OPER_GRUPO", "REVISAO_DH", "ATIVO"])
    wo = wb.create_sheet("OPER")
    wo.append(layout.OPER)
    grupos = s.scalars(select(GrupoAtividadeModel).where(GrupoAtividadeModel.obra_id == obra_id)
                       .order_by(GrupoAtividadeModel.numero)).all()
    for g in grupos:
        wg.append([str(g.numero), g.descricao.upper(), None, None, None, None, "1" if g.ativo else "0"])
        for t in s.scalars(select(TipoAtividadeModel).where(TipoAtividadeModel.grupo_id == g.id)
                           .order_by(TipoAtividadeModel.numero)):
            ativo = "1" if (g.ativo and t.ativo) else "0"
            wo.append([cat.codigo_tipo(g.numero, t.numero), t.descricao, None, str(g.numero), None, None, None,
                       "1", None, None, ativo])
            for it in s.scalars(select(ItemSimovaModel).where(ItemSimovaModel.tipo_id == t.id)
                                .order_by(ItemSimovaModel.numero)):
                wo.append([cat.codigo_item(g.numero, t.numero, it.numero), cat.descricao_item(t.descricao, it.complemento),
                           None, str(g.numero), None, None, None, "1", None, None,
                           "1" if (ativo == "1" and it.ativo) else "0"])
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()
