"""Rota do apontador (spec 147): entra como o encarregado (matrícula + senha, endereço da empresa/obra), mas cuida da obra
inteira — cria equipes, aponta a presença do efetivo em todas as equipes, o dia de cada equipamento, registra as fotos das
atividades e confere a produção da programação vigente (previsto × realizado). Toda mudança de equipe passa pelo
`Alocador` e avisa o Planejamento; a presença vira leitura `manual` assinada pelo apontador."""
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.efetivo.infra.models import ColaboradorModel
from app.modules.equipes.application.alocacao import Alocador
from app.modules.equipes.infra.models import EquipeModel
from app.modules.lideres.application.portal import FORA, _avisar, _codigos, _pessoa, _sessao
from app.shared.errors import DomainError
from app.shared.memoria import Fonte, Memoria, Passo, num
from app.shared.tempo import hoje_local

DIAS_PARA_TRAS = 7  # o apontador corrige a presença da semana; mais para trás é com o Planejamento


def _ap(s: Session, token: str | None) -> tuple[int, ColaboradorModel, str]:
    p, _acesso, c = _sessao(s, token, perfil="apontador")
    return p.obra_id, c, f"apontador {c.matricula or c.cracha or c.id} · {c.nome}"[:80]


def contexto_presenca(s: Session, token: str | None):
    """Spec 150: a leitura de presença do celular (crachá NFC, código/QR, rosto, lista) roda com o token do apontador.
    Os casos de uso da presença recebem o mesmo contexto da conta do Malhet, com o apontador como autor (papel de quem
    lê crachás); a obra sai do token, nunca do aparelho."""
    from app.core.auth import ContextoObra, UsuarioAtual
    from app.modules.obras.domain.obra import PapelObra

    obra, c, por = _ap(s, token)
    return ContextoObra(obra_id=obra, usuario=UsuarioAtual(id=por, email=por), papel=PapelObra.ENCARREGADO,
                        cracha=c.cracha or c.matricula)


def _dia(data: date | None) -> date:
    hoje = hoje_local()
    d = data or hoje
    if d > hoje:
        raise DomainError("não dá para apontar dia que ainda não chegou", "data")
    if d < hoje - timedelta(days=DIAS_PARA_TRAS):
        raise DomainError(f"o apontador corrige até {DIAS_PARA_TRAS} dias para trás; antes disso, fale com o Planejamento", "data")
    return d


def _por_codigo(s: Session, obra_id: int) -> dict[str, ColaboradorModel]:
    out: dict[str, ColaboradorModel] = {}
    for x in s.scalars(select(ColaboradorModel).where(ColaboradorModel.obra_id == obra_id)):
        for k in _codigos(x):
            out.setdefault(k, x)
    return out


def _pessoa_out(x: ColaboradorModel | None, cod: str, nome: str, presentes: dict[int, dict], papel: str | None = None,
                faltas: dict[int, dict] | None = None, emprestimos: dict[int, dict] | None = None, equipe_id: int | None = None) -> dict:
    cid = x.id if x else None
    return {"cracha": cod, "nome": x.nome if x else nome, "matricula": x.matricula if x else None,
            "funcao": x.funcao if x else None, "colaborador_id": cid, "papel": papel, "equipe_id": equipe_id,
            "presenca": presentes.get(cid) if cid else None, "falta": (faltas or {}).get(cid) if cid else None,
            "emprestimo": (emprestimos or {}).get(cid) if cid else None}


def equipes(s: Session, token: str | None, data: date | None) -> dict:
    """Todas as equipes ativas com as pessoas, a presença, a falta e o empréstimo do dia; quem foi recebido emprestado em cada
    equipe; e quem do efetivo ativo está sem equipe (spec 147/152)."""
    from app.modules.presenca.application import apontamento as apt
    from app.modules.presenca.application.manual import presentes as presentes_do_dia

    obra, c, _por = _ap(s, token)
    dia = data or hoje_local()
    presentes = presentes_do_dia(s, obra, dia)
    faltas = apt.faltas_do_dia(s, obra, dia)
    emprestimos = apt.emprestimos_do_dia(s, obra, dia)
    pessoas = _por_codigo(s, obra)
    por_id = {x.id: x for x in pessoas.values()}
    po = lambda x, cod, nome, eid, papel=None: _pessoa_out(x, cod, nome, presentes, papel, faltas, emprestimos, eid)  # noqa: E731
    lista, alocados = [], set()
    for e in s.scalars(select(EquipeModel).where(EquipeModel.obra_id == obra, EquipeModel.ativo.is_(True)).order_by(EquipeModel.nome)):
        gente = []
        if e.encarregado_cracha:
            x = pessoas.get(e.encarregado_cracha)
            gente.append(po(x, e.encarregado_cracha, e.encarregado_nome or e.encarregado_cracha, e.id, "encarregado"))
            if x:
                alocados.add(x.id)
        for m in sorted(e.membros, key=lambda m: m.nome):
            x = pessoas.get(m.cracha)
            if x and x.id in alocados:  # já apareceu (encarregado desta ou de outra equipe): não conta duas vezes
                continue
            gente.append(po(x, m.cracha, m.nome, e.id))
            if x:
                alocados.add(x.id)
        recebidos = [po(por_id[cid], por_id[cid].cracha or por_id[cid].matricula, por_id[cid].nome, emp["de_equipe_id"])
                     for cid, emp in emprestimos.items() if emp["para_equipe_id"] == e.id and cid in por_id]
        aqui = [g for g in gente if not (g["emprestimo"] and g["emprestimo"]["para_equipe_id"] != e.id)] + recebidos
        lista.append({"id": e.id, "nome": e.nome, "encarregado": e.encarregado_nome, "pessoas": gente, "recebidos": recebidos,
                      "presentes": sum(1 for g in aqui if g["presenca"]), "faltas": sum(1 for g in gente if g["falta"]),
                      "cedidos": sum(1 for g in gente if g["emprestimo"]), "total": len(gente)})
    sem = [po(x, x.cracha or x.matricula, x.nome, None)
           for x in s.scalars(select(ColaboradorModel).where(ColaboradorModel.obra_id == obra, ColaboradorModel.situacao.not_in(FORA))
                              .order_by(ColaboradorModel.nome))
           if x.id not in alocados and (x.cracha or x.matricula)]
    return {"data": dia.isoformat(), "nome": c.nome, "matricula": c.matricula, "funcao": c.funcao, "obra_id": obra,
            "equipes": lista, "sem_equipe": sem, "presentes": len(presentes), "faltas": len(faltas), "emprestimos": len(emprestimos),
            "motivos_falta": [{"motivo": k, "rotulo": v[0], "justificada": v[1]} for k, v in _motivos().items()]}


def _motivos():
    from app.modules.presenca.domain.apontamento import MOTIVOS_FALTA

    return MOTIVOS_FALTA


def falta(s: Session, token: str | None, data: date | None, colaborador_id: int, motivo: str | None, observacao: str | None) -> dict:
    """Marca a falta do dia (com o motivo) ou tira (motivo vazio)."""
    from app.modules.presenca.application import apontamento as apt

    obra, _c, por = _ap(s, token)
    dia = _dia(data)
    if not motivo:
        apt.tirar_falta(s, obra, colaborador_id, dia)
        return {"falta": None}
    return {"falta": apt.marcar_falta(s, obra, colaborador_id, dia, motivo, observacao, por)}


def faltas_restantes(s: Session, token: str | None, data: date | None, equipe_id: int, motivo: str, observacao: str | None) -> dict:
    """Fecha a equipe no dia: quem não está presente, nem com falta, nem emprestado leva a falta com o motivo escolhido."""
    from app.modules.presenca.application import apontamento as apt

    dia = _dia(data)
    r = equipes(s, token, dia)
    eq = next((e for e in r["equipes"] if e["id"] == equipe_id), None)
    if eq is None:
        raise DomainError("equipe inválida", "equipe_id")
    obra, _c, por = _ap(s, token)
    feitas = 0
    for p in eq["pessoas"]:
        if p["colaborador_id"] and not p["presenca"] and not p["falta"] and not p["emprestimo"]:
            apt.marcar_falta(s, obra, p["colaborador_id"], dia, motivo, observacao, por)
            feitas += 1
    return {"faltas": feitas}


def emprestimo(s: Session, token: str | None, data: date | None, colaborador_id: int, para_equipe_id: int, justificativa: str,
               presente: bool) -> dict:
    """A pessoa de outra equipe trabalhou hoje nesta: fica na equipe dela, com a justificativa. `presente` já aponta a presença."""
    from app.modules.presenca.application import apontamento as apt

    obra, c, por = _ap(s, token)
    dia = _dia(data)
    r = apt.emprestar(s, obra, colaborador_id, dia, para_equipe_id, justificativa, por)
    if presente:
        presenca(s, token, dia, colaborador_id, True)
    x = s.get(ColaboradorModel, colaborador_id)
    _avisar(s, obra, f"{c.nome} (apontador) emprestou {x.nome} para a {r['para_equipe']}",
            f"{'Da ' + r['de_equipe'] if r['de_equipe'] else 'Sem equipe'} · {dia:%d/%m}: {r['justificativa']}")
    return {"emprestimo": r}


def devolver(s: Session, token: str | None, data: date | None, colaborador_id: int) -> dict:
    from app.modules.presenca.application import apontamento as apt

    obra, _c, _por = _ap(s, token)
    apt.devolver(s, obra, colaborador_id, _dia(data))
    return {"emprestimo": None}


def criar_equipe(s: Session, token: str | None, disciplina: str, encarregado: str, membros: list[str], nome: str | None) -> dict:
    """O apontador forma a equipe na hora (sem aprovação): o encarregado e as pessoas saem do efetivo; quem estava em outra
    equipe sai de lá (histórico) e o Planejamento é avisado."""
    from app.modules.lideres.application.gestao import criar_equipe as criar
    from app.modules.lideres.domain.portal import validar_pedido

    obra, c, por = _ap(s, token)
    disc, cods = validar_pedido(disciplina, membros or [encarregado])
    lider = _pessoa(s, obra, encarregado)
    if lider is None or lider.situacao in FORA:
        raise DomainError("escolha o encarregado no efetivo ativo da obra", "encarregado")
    gente, nao_achou = [], []
    for cod in cods:
        x = _pessoa(s, obra, cod)
        if x is None or not (x.cracha or x.matricula):
            nao_achou.append(cod)
        elif x.id != lider.id:
            gente.append((x.cracha or x.matricula, x.nome))
    if nao_achou:
        raise DomainError(f"não achei no efetivo: {', '.join(nao_achou[:5])}", "membros")
    nova, entraram = criar(s, obra, disc, lider, gente, por, f"Formada pelo apontador {c.nome}", nome)
    _avisar(s, obra, f"{c.nome} (apontador) formou a {nova.nome}", f"Encarregado {lider.nome}, {entraram} pessoa(s).")
    return {"equipe_id": nova.id, "nome": nova.nome, "membros": entraram}


def _equipe(s: Session, obra: int, equipe_id: int) -> EquipeModel:
    e = s.get(EquipeModel, equipe_id)
    if e is None or e.obra_id != obra or not e.ativo:
        raise DomainError("equipe inválida", "equipe_id")
    return e


def incluir(s: Session, token: str | None, equipe_id: int, cracha: str) -> dict:
    obra, c, por = _ap(s, token)
    e = _equipe(s, obra, equipe_id)
    x = _pessoa(s, obra, cracha)
    if x is None or not (x.cracha or x.matricula):
        raise DomainError("matrícula não encontrada no efetivo da obra", "cracha")
    if any(m.cracha in _codigos(x) for m in e.membros) or e.encarregado_cracha in _codigos(x):
        raise DomainError(f"{x.nome} já está na {e.nome}", "cracha")
    saiu = Alocador(s, obra, por).incluir(e, x.cracha or x.matricula, x.nome)
    _avisar(s, obra, f"{c.nome} (apontador) pôs {x.nome} na {e.nome}", f"{'Saiu de ' + ', '.join(saiu) + '.' if saiu else 'Estava sem equipe.'}")
    s.flush()
    return {"ok": True, "saiu_de": saiu}


def tirar(s: Session, token: str | None, equipe_id: int, cracha: str) -> dict:
    """Tira a pessoa da equipe (fica sem equipe); para pôr em outra, use incluir na outra (sai sozinha desta)."""
    obra, c, por = _ap(s, token)
    e = _equipe(s, obra, equipe_id)
    m = next((x for x in e.membros if x.cracha == cracha), None)
    if m is None:
        raise DomainError("essa pessoa não está na equipe (o encarregado só sai trocando o encarregado)", "cracha")
    e.membros.remove(m)
    Alocador(s, obra, por).saiu(e, cracha)
    _avisar(s, obra, f"{c.nome} (apontador) tirou {m.nome} da {e.nome}", "Ficou sem equipe.")
    s.flush()
    return {"ok": True}


def presenca(s: Session, token: str | None, data: date | None, colaborador_id: int, presente: bool) -> dict:
    from app.modules.presenca.application import manual

    obra, _c, por = _ap(s, token)
    dia = _dia(data)
    x = s.get(ColaboradorModel, colaborador_id)
    if x is None or x.obra_id != obra:
        raise DomainError("pessoa não está no efetivo desta obra", "colaborador_id")
    if presente:
        if x.situacao in FORA:
            raise DomainError(f"{x.nome} está {x.situacao.lower()} no efetivo", "colaborador_id")
        from app.modules.presenca.application import apontamento as apt

        eq = apt.equipe_do_dia(s, obra, x.id, dia)
        if eq is None:
            e = apt.equipe_da_pessoa(apt.equipes_ativas(s, obra), x)
            eq = e.id if e else None
        manual.marcar(s, obra, x.id, dia, eq, por)
        apt.tirar_falta(s, obra, x.id, dia)  # presente não é falta
    else:
        manual.desmarcar(s, obra, x.id, dia)
    return {"ok": True, "presenca": manual.presentes(s, obra, dia).get(x.id)}


def equipamentos(s: Session, token: str | None, data: date | None) -> dict:
    from app.modules.equipamentos.application import equipamentos as eqs

    obra, _c, _por = _ap(s, token)
    r = eqs.listar(s, obra, data or hoje_local(), "mobilizado")
    r["equipes"] = [{"id": e.id, "nome": e.nome, "encarregado": e.encarregado_nome}
                    for e in s.scalars(select(EquipeModel).where(EquipeModel.obra_id == obra, EquipeModel.ativo.is_(True)).order_by(EquipeModel.nome))]
    return r


def apontar_equipamento(s: Session, token: str | None, eid: int, data: date | None, situacao: str, horas: float | None,
                        equipe_id: int | None, observacao: str | None) -> dict:
    from app.modules.equipamentos.application import equipamentos as eqs

    obra, _c, por = _ap(s, token)
    return eqs.apontar(s, obra, eid, _dia(data), situacao, horas, equipe_id, observacao, por)


def producao(s: Session, token: str | None) -> dict:
    """A programação vigente, dia a dia: previsto × realizado de cada atividade e o acumulado da semana (com a memória)."""
    from app.modules.planejamento.application import servico as sv

    obra, _c, _por = _ap(s, token)
    p = sv.programacao_vigente(s, obra, hoje_local())
    if p is None:
        return {"programacao": None}
    v = sv.visao(s, p)
    dias = v["dias"]
    areas = []
    for loc in v["locais"]:
        for a in loc["areas"]:
            linhas = []
            for ln in a["linhas"]:
                prev, real = [x or 0 for x in ln["previsto"]], ln["realizado"]
                tp, tr = sum(prev), sum(x or 0 for x in real)
                un = ln.get("unidade") or ""
                mem = Memoria("semana", "Realizado na semana", f"{num(tr)} de {num(tp)} {un}".strip(),
                              "realizado da semana = soma do realizado de cada dia",
                              passos=tuple(Passo(f"{d['dia']} {d['data'][8:]}/{d['data'][5:7]}", f"P {num(pv)} · R {num(rv)}", num(rv or 0))
                                           for d, pv, rv in zip(dias, prev, real) if pv or rv),
                              fontes=(Fonte("Programação", f"{v['titulo']}", "programação vigente", f"linha {ln['codigo_simova']}"),)).como_dict()
                linhas.append({"id": ln["id"], "codigo": ln["codigo_simova"], "descricao": ln.get("descricao_reduzida") or ln["descricao"],
                               "cwp": (ln.get("cwp") or {}).get("texto"), "unidade": un or None, "encarregado": ln.get("encarregado"),
                               "equipe": ln.get("equipe"), "previsto": ln["previsto"], "realizado": real,
                               "total_previsto": tp, "total_realizado": tr,
                               "percentual": round(tr / tp * 100) if tp else None, "memoria": mem})
            if linhas:
                areas.append({"local": f"{loc['codigo']} · {loc['descricao']}", "area": f"{a['codigo']} · {a['descricao']}", "linhas": linhas})
    return {"programacao": {"id": p.id, "titulo": v["titulo"]}, "dias": dias, "areas": areas}
