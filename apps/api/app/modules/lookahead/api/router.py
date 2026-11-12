"""Look-ahead das equipes: blocos (equipe × atividade × área × dias) das programações numa janela de datas."""
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, ler
from app.core.db import get_session
from app.modules.catalogo.domain import catalogo as cat
from app.modules.catalogo.infra.models import GrupoAtividadeModel, ItemSimovaModel, TipoAtividadeModel
from app.modules.efetivo.infra.models import SetorObraModel, SubsetorObraModel
from app.modules.equipes.infra.models import EquipeModel
from app.modules.frentes.infra.models import AreaFrenteModel, LocalFrenteModel
from app.modules.lookahead.domain.blocos import DiaEquipe, blocos, faixas
from app.modules.planejamento.domain.periodo import DIAS, numero_semana
from app.modules.planejamento.infra.models import LinhaProgramacaoModel, ProgramacaoModel, ValorDiaModel
from app.shared.errors import DomainError

router = APIRouter(prefix="/lookahead", tags=["look-ahead das equipes"])
# cor de equipe sem setor/disciplina: ordem fixa (nunca ciclar por posição na tela; a cor segue a equipe pelo id)
PALETA = ("#2F6F73", "#B5651D", "#5B5EA6", "#8A6D1F", "#9B4D6B", "#3D7A3A", "#6B6B6B", "#A33E3E")


@router.get("")
def lookahead(de: date | None = None, ate: date | None = None, s: Session = Depends(get_session),
              c: ContextoObra = Depends(ler)):
    """Janela padrão: da segunda desta semana até 6 semanas à frente (6WLA)."""
    hoje = date.today()
    de = de or hoje - timedelta(days=hoje.weekday())
    ate = ate or de + timedelta(days=6 * 7 - 1)
    if ate < de or (ate - de).days > 120:
        raise DomainError("janela inválida: até 120 dias", "ate")
    progs = {p.id: p for p in s.scalars(select(ProgramacaoModel).where(
        ProgramacaoModel.obra_id == c.obra_id, ProgramacaoModel.inicio <= ate, ProgramacaoModel.fim >= de))}
    linhas = {ln.id: ln for ln in s.scalars(select(LinhaProgramacaoModel).where(
        LinhaProgramacaoModel.programacao_id.in_(list(progs) or [0])))}
    valores = s.scalars(select(ValorDiaModel).where(ValorDiaModel.linha_id.in_(list(linhas) or [0]),
                                                    ValorDiaModel.data >= de, ValorDiaModel.data <= ate))
    dias = []
    for v in valores:
        ln = linhas[v.linha_id]
        if not ((v.previsto or 0) > 0 or (v.realizado or 0) > 0):
            continue
        p = progs[ln.programacao_id]
        dias.append(DiaEquipe(ln.equipe_id or 0, ln.area_id, (ln.tipo_id, ln.item_simova_id, ln.item_pq), v.data,
                              float(v.previsto or 0), v.realizado, p.id, ln.id, p.inicio))
    bs = blocos(dias)
    # cadastros para rotular
    tipos = {t.id: t for t in s.scalars(select(TipoAtividadeModel).where(TipoAtividadeModel.obra_id == c.obra_id))}
    grupos = {g.id: g for g in s.scalars(select(GrupoAtividadeModel).where(GrupoAtividadeModel.obra_id == c.obra_id))}
    itens = {i.id: i for i in s.scalars(select(ItemSimovaModel).where(ItemSimovaModel.obra_id == c.obra_id))}
    areas = {a.id: a for a in s.scalars(select(AreaFrenteModel).where(AreaFrenteModel.obra_id == c.obra_id))}
    locais = {x.id: x for x in s.scalars(select(LocalFrenteModel).where(LocalFrenteModel.obra_id == c.obra_id))}
    setores = {x.id: x for x in s.scalars(select(SetorObraModel).where(SetorObraModel.obra_id == c.obra_id))}
    subs = {x.id: x for x in s.scalars(select(SubsetorObraModel).where(SubsetorObraModel.setor_id.in_(list(setores) or [0])))}
    usadas = {b.equipe_id for b in bs}
    equipes = {e.id: e for e in s.scalars(select(EquipeModel).where(EquipeModel.obra_id == c.obra_id,
                                                                  EquipeModel.id.in_(list(usadas) or [0])))}

    def cor(e: EquipeModel | None) -> tuple[str, str]:
        if e is None:
            return "#8C8C8C", "sem equipe"
        sb = subs.get(e.subsetor_id) if e.subsetor_id else None
        st = setores.get(e.setor_id) if e.setor_id else (setores.get(sb.setor_id) if sb else None)
        if sb and sb.cor:
            return sb.cor, f"disciplina {sb.nome}"
        if st and st.cor:
            return st.cor, f"setor {st.nome}"
        return PALETA[e.id % len(PALETA)], "cor da equipe (sem setor/disciplina com cor)"

    fx_eq: dict[int, int] = {}
    for eid in usadas:
        idx = [i for i, b in enumerate(bs) if b.equipe_id == eid]
        for k, f in faixas([bs[i] for i in idx]).items():
            fx_eq[idx[k]] = f
    fx_ar: dict[int, int] = {}
    for aid in {b.area_id for b in bs}:
        idx = [i for i, b in enumerate(bs) if b.area_id == aid]
        for k, f in faixas([bs[i] for i in idx]).items():
            fx_ar[idx[k]] = f
    from app.modules.restricoes.domain.acao import data_da_semana, situacao
    from app.modules.restricoes.infra.models import AcaoRestricaoModel

    pendentes = list(s.scalars(select(AcaoRestricaoModel).where(AcaoRestricaoModel.obra_id == c.obra_id,
                                                                AcaoRestricaoModel.status1 == "Pendente")))

    def restricoes_do_bloco(b) -> dict:
        """Pendente da própria linha, ou da área (sem linha) com prazo até o fim do cartão."""
        linhas_b = {d.linha_id for d in b.dias}
        rs = [r for r in pendentes if (r.linha_id in linhas_b) or (
            r.linha_id is None and r.area_id == b.area_id
            and (data_da_semana(r.prazo_termino, r.reprogramado) or b.fim) <= b.fim)]
        hoje = date.today()
        return {"pendentes": len(rs), "vencidas": sum(situacao(r.status1, r.prazo_termino, r.reprogramado, hoje).farol == 1 for r in rs),
                "ids": [r.id for r in rs][:20]}

    saida_blocos = []
    for i, b in enumerate(bs):
        tipo_id, item_id, item_pq = b.atividade
        t = tipos.get(tipo_id)
        g = grupos.get(t.grupo_id) if t else None
        it = itens.get(item_id) if item_id else None
        p = progs[b.programacao_id]
        saida_blocos.append({
            "id": i, "equipe_id": b.equipe_id or None, "area_id": b.area_id, "linha_id": b.linha_id,
            "programacao_id": b.programacao_id, "programacao": p.titulo.split(" · ")[0], "status": p.status,
            "codigo_simova": cat.codigo_item(g.numero, t.numero, it.numero if it else None) if t and g else None,
            "descricao": cat.descricao_item(t.descricao, it.complemento if it else None) if t else "?",
            "grupo": g.descricao if g else None, "item_pq": item_pq, "unidade": t.unidade if t else None,
            "inicio": b.inicio.isoformat(), "fim": b.fim.isoformat(),
            "total_previsto": b.total_previsto, "total_realizado": b.total_realizado,
            "dias": [{"data": d.data.isoformat(), "previsto": d.previsto, "realizado": d.realizado} for d in b.dias],
            "faixa_equipe": fx_eq.get(i, 0), "faixa_area": fx_ar.get(i, 0), "restricoes": restricoes_do_bloco(b)})
    eq_out = []
    for eid in sorted(usadas, key=lambda x: (equipes[x].nome if x in equipes else "~")):
        e = equipes.get(eid)
        cr, origem = cor(e)
        eq_out.append({"id": eid or None, "nome": e.nome if e else "Sem equipe", "encarregado": e.encarregado_nome if e else None,
                       "cor": cr, "origem_cor": origem, "turno": e.turno if e else None,
                       "faixas": max([fx_eq[i] for i, b in enumerate(bs) if b.equipe_id == eid], default=0) + 1})
    ar_out = []
    for aid in sorted({b.area_id for b in bs}, key=lambda x: (locais[areas[x].local_id].ordem if areas[x].local_id in locais else 0,
                                                              areas[x].ordem, x)):
        a = areas[aid]
        loc = locais.get(a.local_id)
        ar_out.append({"id": aid, "codigo": a.codigo, "descricao": a.descricao,
                       "local": f"{loc.codigo} · {loc.descricao}" if loc else None,
                       "faixas": max([fx_ar[i] for i, b in enumerate(bs) if b.area_id == aid], default=0) + 1})
    dias_out = []
    d = de
    while d <= ate:
        dias_out.append({"data": d.isoformat(), "dia": DIAS[d.weekday()], "semana": numero_semana(d)})
        d += timedelta(days=1)
    return {"de": de.isoformat(), "ate": ate.isoformat(), "dias": dias_out, "equipes": eq_out, "areas": ar_out,
            "blocos": saida_blocos,
            "programacoes": [{"id": p.id, "titulo": p.titulo, "status": p.status} for p in sorted(progs.values(), key=lambda x: x.inicio)]}
