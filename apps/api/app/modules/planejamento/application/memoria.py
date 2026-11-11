"""Memória de cálculo da programação: a conta de cada número da linha, dos totais e da equipe, com as fontes.

Usa os mesmos cálculos da visão (`servico.calculo_linha`, `capacidade_da_equipe`) e a origem da CPU
(`referencias.application.memoria_cpu`), para que o número aberto seja exatamente o número mostrado.
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.efetivo.infra.gateway import funcoes_por_cracha, pessoas_por_cracha
from app.modules.equipes.infra.composicao import composicao_efetiva
from app.modules.equipes.infra.models import EquipeModel
from app.modules.frentes.infra.models import AreaFrenteModel
from app.modules.planejamento.application import servico
from app.modules.planejamento.infra.models import ProgramacaoModel
from app.modules.programacao.domain.gargalo import capacidade_da_equipe
from app.modules.referencias.application.memoria_cpu import OrigemCpu, fontes_base, memorias_cpu, origem_cpu
from app.modules.referencias.infra.models import PqQuantidadeTagModel, VersaoReferenciaModel
from app.modules.referencias.infra.resolvedor import JORNADA_REFERENCIA, ResolvedorReferencias
from app.shared.errors import NotFoundError
from app.shared.memoria import Fonte, Memoria, Passo, num, pacote


# ---- equipe ----------------------------------------------------------------------------------------------
def fonte_jornada(eq: EquipeModel | None) -> Fonte:
    if eq is not None and eq.jornada_horas:
        return Fonte("Jornada", f"{num(eq.jornada_horas)} h/dia", f"Equipe {eq.nome}",
                     "cadastro de Equipes · campo Jornada (h/dia)")
    return Fonte("Jornada", f"{num(JORNADA_REFERENCIA)} h/dia", "jornada de referência do app",
                 "linha sem equipe: usa a jornada padrão")


def pessoas_da_equipe(s: Session, obra_id: int, eq: EquipeModel) -> list[tuple[str, str, str, str]]:
    """(crachá, nome, função na composição, de onde veio a função) de cada membro da equipe."""
    funcao_de = funcoes_por_cracha(s, obra_id)
    pessoas = pessoas_por_cracha(s, obra_id)
    out = []
    for m in sorted(eq.membros, key=lambda x: x.nome):
        p = pessoas.get(m.cracha)
        if (m.funcao or "").strip():
            out.append((m.cracha, m.nome, m.funcao.strip(), "função escolhida nesta equipe (formulário da equipe)"))
        elif funcao_de.get(m.cracha):
            out.append((m.cracha, m.nome, funcao_de[m.cracha],
                        f"De-para de funções: {p.funcao if p else '?'} (Efetivo) → {funcao_de[m.cracha]}"))
        else:
            out.append((m.cracha, m.nome, "—", f"sem função: {p.funcao + ' sem de-para' if p and p.funcao else 'fora do efetivo'}"))
    return out


def memoria_composicao_equipe(s: Session, obra_id: int, eq: EquipeModel) -> Memoria:
    funcao_de = funcoes_por_cracha(s, obra_id)
    efetiva = composicao_efetiva(eq, funcao_de)
    por_membro = any((m.funcao or "").strip() or funcao_de.get(m.cracha) for m in eq.membros)
    fontes = [Fonte(nome, funcao, f"Equipe {eq.nome}", f"crachá {cracha} · {origem}")
              for cracha, nome, funcao, origem in pessoas_da_equipe(s, obra_id, eq)]
    if not por_membro:
        fontes += [Fonte(c.recurso, num(c.quantidade, 0), f"Equipe {eq.nome}", "composição digitada no cadastro")
                   for c in eq.composicao]
    passos = [Passo(r, "pessoas com esta função" if t == "MOD" else "equipamento (composição digitada)",
                    num(q, 0)) for r, t, q in efetiva]
    return Memoria("composicao_equipe", f"Composição da equipe {eq.nome}",
                   " · ".join(f"{num(q, 0)} {r}" for r, _t, q in efetiva) or "sem composição",
                   "conta as pessoas pela função da composição: a escolhida na equipe ou, sem ela, a do De-para de "
                   "funções pela função do efetivo (crachá = matrícula)",
                   tuple(passos), tuple(fontes),
                   () if por_membro else ("Nenhum membro com função: vale a composição digitada no cadastro.",))


def memoria_hh_disponivel(s: Session, obra_id: int, eq: EquipeModel) -> Memoria:
    funcao_de = funcoes_por_cracha(s, obra_id)
    ef = composicao_efetiva(eq, funcao_de)
    mod = sum(q for _, t, q in ef if t == "MOD")
    base = mod or len(eq.membros)
    passo = Passo("Mão de obra × jornada", f"{num(base, 0)} pessoa(s) × {num(eq.jornada_horas)} h",
                  f"{num(base * eq.jornada_horas)} HH/dia", True)
    return Memoria("hh_disponivel", "HH disponível por dia", f"{num(base * eq.jornada_horas)} HH/dia",
                   "HH/dia = pessoas de mão de obra da equipe × jornada",
                   (*(Passo(r, "pessoas", num(q, 0)) for r, t, q in ef if t == "MOD"), passo),
                   (fonte_jornada(eq), Fonte("Pessoas", num(base, 0), f"Equipe {eq.nome}",
                                             "composição efetiva (veja a composição da equipe)" if mod
                                             else "nº de membros (sem função informada)")))


# ---- linha da programação --------------------------------------------------------------------------------
def _linha_visao(s: Session, p: ProgramacaoModel, linha_id: int) -> dict:
    v = servico.visao(s, p)
    for loc in v["locais"]:
        for a in loc["areas"]:
            for ln in a["linhas"]:
                if ln["id"] == linha_id:
                    return {**ln, "_dias": v["dias"], "_area": a, "_local": loc}
    raise NotFoundError("Linha", linha_id)


def _capacidade(o: OrigemCpu, eq: EquipeModel, jornada: float, funcao_de: dict, un: str,
                cap_mostrada: float | None) -> Memoria:
    tem: dict[str, float] = {}
    for rec, _t, q in composicao_efetiva(eq, funcao_de):
        tem[servico._chave(rec)] = tem.get(servico._chave(rec), 0.0) + q
    coefs: dict[str, float] = {}
    for r, _t, cf in o.recursos:
        coefs[r] = coefs.get(r, 0.0) + cf
    comp = {r: tem.get(servico._chave(r), 0.0) for r in coefs}
    ce = capacidade_da_equipe(coefs, comp, jornada, o.recurso_governa)
    passos = []
    for r, cf in sorted(coefs.items(), key=lambda kv: -kv[1]):
        n = comp.get(r, 0.0)
        if n:
            passos.append(Passo(f"{r}: h/un ÷ pessoas na equipe", f"{num(cf, 4)} ÷ {num(n, 0)}", f"{num(cf / n, 4)} h/{un}",
                                r == ce.gargalo))
        elif r == o.recurso_governa:
            passos.append(Passo(f"{r} (governa): a equipe não tem", f"{num(cf, 4)} ÷ 0", "sem quem governe → 0", True))
        else:
            passos.append(Passo(f"{r}: a equipe não tem", "apoio externo", "não limita a equipe"))
    if not ce.falta_governante and ce.gargalo:
        rmax = coefs[ce.gargalo] / comp[ce.gargalo]
        passos.append(Passo(f"Capacidade (gargalo {ce.gargalo})", f"{num(jornada)} h ÷ {num(rmax, 4)} h/{un}",
                            f"{num(ce.capacidade_un_dia)} {un}/dia", True))
    fontes = [fonte_jornada(eq), Fonte("Composição da equipe",
                                       " · ".join(f"{num(q, 0)} {r}" for r, q in comp.items() if q) or "nenhuma função da CPU",
                                       f"Equipe {eq.nome}", "pessoas por função (abra a composição da equipe)"),
              *fontes_base(o)]
    return Memoria("capacidade", "Capacidade da equipe", f"{num(cap_mostrada)} {un}/dia",
                   "capacidade = jornada ÷ maior(h/un da função ÷ pessoas da equipe com a função)  — a maior razão é o gargalo",
                   tuple(passos), tuple(fontes),
                   ("Função da composição que a equipe não tem é apoio externo e não limita, exceto o recurso que governa.",))


def realizado_anterior_detalhe(s: Session, p: ProgramacaoModel, chave: tuple) -> list[tuple[str, str, float]]:
    """(programação, data, realizado) de cada dia antes do início desta, pela mesma atividade (o mais recente vale)."""
    q = (select(ProgramacaoModel).where(ProgramacaoModel.obra_id == p.obra_id, ProgramacaoModel.tipo == p.tipo,
                                        ProgramacaoModel.id != p.id, ProgramacaoModel.inicio < p.inicio)
         .order_by(ProgramacaoModel.inicio))
    por_dia: dict = {}
    for outra in s.scalars(q):
        for ln in outra.linhas:
            if servico._chave_linha(ln) != chave:
                continue
            for v in ln.valores:
                if v.data < p.inicio and v.realizado is not None:
                    por_dia[v.data] = (outra.titulo, float(v.realizado))
    return [(t, d.strftime("%d/%m/%Y"), q_) for d, (t, q_) in sorted(por_dia.items())]


def memorias_linha(s: Session, p: ProgramacaoModel, linha_id: int) -> dict:
    ln = _linha_visao(s, p, linha_id)
    modelo = next(x for x in p.linhas if x.id == linha_id)
    vig = ResolvedorReferencias(s, p.obra_id).versoes_vigentes()
    eq = s.get(EquipeModel, modelo.equipe_id) if modelo.equipe_id else None
    c = ln["calc"]
    un = ln["unidade"] or "un"
    jornada = c["jornada"]
    fj = fonte_jornada(eq)
    mems: list[Memoria] = []
    prog = f"Programação {p.titulo}"
    o = origem_cpu(s, p.obra_id, modelo.item_pq, vig) if modelo.item_pq else None
    if o is not None and (o.recursos or o.composicao):
        mems += memorias_cpu(o, jornada, fj, un)
    if o is not None and eq is not None and c["capacidade_un_dia"] is not None:
        mems.append(_capacidade(o, eq, jornada, funcoes_por_cracha(s, p.obra_id), un, c["capacidade_un_dia"]))
    if eq is not None:
        mems.append(memoria_composicao_equipe(s, p.obra_id, eq))
    # por dia: HH e oficiais
    for i, d in enumerate(ln["_dias"]):
        q = ln["previsto"][i]
        if not q:
            continue
        data = d["data"][8:10] + "/" + d["data"][5:7]
        fq = Fonte("Previsto do dia", f"{num(q)} {un}", prog, f"linha {ln['n']} · {d['dia']} {data}")
        if c["hh_un"]:
            mems.append(Memoria(f"hh_dia:{i}", f"HH previsto em {d['dia']} {data}", f"{num(c['hh_previsto'][i], 1)} HH",
                                "HH do dia = quantidade prevista × HH/un",
                                (Passo("Quantidade × HH/un", f"{num(q)} {un} × {num(c['hh_un'], 4)} HH/{un}",
                                       f"{num(c['hh_previsto'][i], 2)} HH", True),),
                                (fq, Fonte("HH/un", f"{num(c['hh_un'], 4)} HH/{un}", o.origem if o else "CPU",
                                           "abra o HH por unidade para ver as linhas")),
                                ("Acima da capacidade da equipe neste dia." ,) if c["acima_capacidade"][i] else ()))
        if c["indice_un_dia"]:
            mems.append(Memoria(f"oficiais:{i}", f"{c['recurso_governa'] or 'Oficiais'} necessários em {d['dia']} {data}",
                                f"{num(c['oficiais'][i], 1)} {c['recurso_governa'] or 'oficial'}(s)",
                                "oficiais = quantidade prevista ÷ índice (un/dia por oficial)",
                                (Passo("Quantidade ÷ índice", f"{num(q)} {un} ÷ {num(c['indice_un_dia'])} {un}/dia",
                                       f"{num(q / c['indice_un_dia'], 2)} pessoa(s)", True),),
                                (fq, Fonte("Índice", f"{num(c['indice_un_dia'])} {un}/dia", "calculado",
                                           "abra o índice para ver a conta"))))
    # totais de HH da linha
    for modo, chave, titulo in (("previsto", "total_hh_previsto", "HH previsto no período"),
                                ("realizado", "total_hh_realizado", "HH realizado no período")):
        vals = [(ln["_dias"][i], v) for i, v in enumerate(ln[modo]) if v]
        if c["hh_un"] and vals:
            total = sum(v for _, v in vals)
            mems.append(Memoria(chave, titulo, f"{num(c[chave], 1)} HH", f"HH = Σ quantidade {modo} × HH/un",
                                (*(Passo(f"{d['dia']} {d['data'][8:10]}/{d['data'][5:7]}", f"{num(v)} × {num(c['hh_un'], 4)}",
                                         f"{num(v * c['hh_un'], 2)} HH") for d, v in vals),
                                 Passo("Total", f"{num(total)} {un} × {num(c['hh_un'], 4)} HH/{un}", f"{num(c[chave], 2)} HH", True)),
                                (Fonte(f"Quantidades ({modo})", f"{num(total)} {un}", prog, f"linha {ln['n']}"),
                                 Fonte("HH/un", f"{num(c['hh_un'], 4)} HH/{un}", o.origem if o else "CPU", None))))
    # quantidade do projeto, feito antes e resta
    a = s.get(AreaFrenteModel, modelo.area_id)
    if modelo.qtd_projeto is not None:
        mems.append(Memoria("qtd_projeto", "Quantidade de projeto", f"{num(ln['qtd_projeto'])} {un}",
                            "digitada na linha (substitui o take-off)",
                            (Passo("Quantidade digitada", "—", f"{num(modelo.qtd_projeto)} {un}", True),),
                            (Fonte("Qtd projeto", f"{num(modelo.qtd_projeto)} {un}", prog,
                                   f"linha {ln['n']} · campo Qtd projeto"),)))
    elif ln["qtd_takeoff"] is not None:
        vpq = s.get(VersaoReferenciaModel, vig["PQ"]) if "PQ" in vig else None
        tags = list(s.scalars(select(PqQuantidadeTagModel).where(
            PqQuantidadeTagModel.versao_id == vig["PQ"], PqQuantidadeTagModel.item == modelo.item_pq,
            PqQuantidadeTagModel.tag == a.tag))) if vpq else []
        mems.append(Memoria("qtd_projeto", "Quantidade de projeto (take-off)", f"{num(ln['qtd_takeoff'])} {un}",
                            "quantidade do item da PQ na TAG da área (aba MC do take-off)",
                            (Passo(f"Item {modelo.item_pq} × TAG {a.tag}", "soma das quantidades da TAG",
                                   f"{num(ln['qtd_takeoff'])} {un}", True),),
                            (Fonte("TAG da área", a.tag or "—", f"Frentes · área {a.codigo}",
                                   f"Ativo {a.ativo_codigo}" if a.ativo_codigo else "TAG lida da descrição da área"),
                             Fonte("Quantidade", f"{num(sum(t.quantidade or 0 for t in tags))} {un}",
                                   f"PQ / take-off · {vpq.rotulo if vpq else '—'} · {vpq.arquivo_origem if vpq else ''}".strip(" ·"),
                                   f"aba MC · item {modelo.item_pq} · TAG {a.tag}"))))
    if ln["realizado_anterior"]:
        det = realizado_anterior_detalhe(s, p, servico._chave_linha(modelo))
        mems.append(Memoria("realizado_anterior", "Feito antes deste período", f"{num(ln['realizado_anterior'])} {un}",
                            "soma do realizado da mesma atividade (área, tipo, item, PQ) em programações anteriores; "
                            "dia repetido em duas semanas vale uma vez, a mais recente",
                            (*(Passo(f"{t} · {d}", "realizado", f"{num(v)} {un}") for t, d, v in det),
                             Passo("Total", " + ".join(num(v) for *_x, v in det), f"{num(ln['realizado_anterior'])} {un}", True)),
                            tuple(Fonte("Realizado", f"{num(v)} {un}", f"Programação {t}", d) for t, d, v in det)))
    if ln["restante"] is not None:
        mems.append(Memoria("restante", "Resta fazer", f"{num(ln['restante'])} {un}",
                            "resta = quantidade de projeto − feito antes − realizado neste período",
                            (Passo("Conta", f"{num(ln['qtd_projeto'])} − {num(ln['realizado_anterior'] or 0)} − {num(ln['total_realizado'])}",
                                   f"{num(ln['restante'])} {un}", True),),
                            (Fonte("Quantidade de projeto", f"{num(ln['qtd_projeto'])} {un}", "abra a quantidade de projeto"),
                             Fonte("Feito antes", f"{num(ln['realizado_anterior'] or 0)} {un}", "programações anteriores"),
                             Fonte("Realizado no período", f"{num(ln['total_realizado'])} {un}", prog, f"linha {ln['n']}"))))
    return pacote(*mems)


def memorias_programacao(s: Session, p: ProgramacaoModel) -> dict:
    """Totais do rodapé: HH previsto por dia e no período (soma das linhas)."""
    v = servico.visao(s, p)
    linhas = [ln for loc in v["locais"] for a in loc["areas"] for ln in a["linhas"]]
    mems = []
    for i, d in enumerate(v["dias"]):
        parc = [(ln, ln["calc"]["hh_previsto"][i]) for ln in linhas if ln["calc"]["hh_previsto"][i]]
        if not parc:
            continue
        data = d["data"][8:10] + "/" + d["data"][5:7]
        mems.append(Memoria(f"hh_dia:{i}", f"HH previsto da programação em {d['dia']} {data}",
                            f"{num(v['hh_previsto_dia'][i], 1)} HH", "Σ HH previsto das linhas no dia",
                            (*(Passo(f"{ln['codigo_simova']} {ln['descricao'][:60]}",
                                     f"{num(ln['previsto'][i])} × {num(ln['calc']['hh_un'], 4)}", f"{num(h, 2)} HH")
                               for ln, h in parc),
                             Passo("Total do dia", " + ".join(num(h, 1) for _l, h in parc), f"{num(v['hh_previsto_dia'][i], 2)} HH", True)),
                            (Fonte("Linhas", f"{len(parc)} com previsto", f"Programação {p.titulo}", f"{d['dia']} {data}"),)))
    if v["total_hh_previsto"]:
        mems.append(Memoria("total_hh_previsto", "HH previsto no período", f"{num(v['total_hh_previsto'], 1)} HH",
                            "Σ HH previsto dos dias",
                            (*(Passo(f"{d['dia']} {d['data'][8:10]}/{d['data'][5:7]}", "Σ das linhas", f"{num(h, 2)} HH")
                               for d, h in zip(v["dias"], v["hh_previsto_dia"]) if h),
                             Passo("Total", "soma dos dias", f"{num(v['total_hh_previsto'], 2)} HH", True)),
                            (Fonte("Programação", p.titulo, f"{v['inicio']} a {v['fim']}", f"{v['linhas']} linha(s)"),)))
    return pacote(*mems)
