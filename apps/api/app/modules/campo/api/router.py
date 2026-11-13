"""Campo (mobile): o dia do encarregado — o que foi programado para a data, quanto já foi lançado e o que ficou para
trás. O lançamento usa as rotas de sempre (valores da linha e desvios); aqui só a leitura montada para o celular."""
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, ler
from app.core.db import get_session
from app.modules.equipes.infra.models import EquipeModel
from app.modules.obras.domain.obra import PapelObra
from app.modules.planejamento.application import servico as sv
from app.modules.planejamento.infra.models import ProgramacaoModel

router = APIRouter(prefix="/campo", tags=["campo (mobile)"])


def programacao_do_dia(s: Session, obra_id: int, d: date) -> ProgramacaoModel | None:
    """A programação emitida (ou concluída) que cobre o dia: semanal mais nova primeiro (a semanal começa na sexta
    anterior, então duas podem cobrir o mesmo dia); sem semanal, a mensal."""
    progs = list(s.scalars(select(ProgramacaoModel).where(
        ProgramacaoModel.obra_id == obra_id, ProgramacaoModel.status.in_(("emitida", "concluida")),
        ProgramacaoModel.inicio <= d, ProgramacaoModel.fim >= d).order_by(ProgramacaoModel.inicio.desc())))
    return next((p for p in progs if p.tipo == "SEMANAL"), None) or (progs[0] if progs else None)


@router.get("/dia")
def dia(data: date | None = None, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    hoje = date.today()
    d = data or hoje
    p = programacao_do_dia(s, c.obra_id, d)
    base = {"data": d.isoformat(), "hoje": hoje.isoformat(), "programacao": None, "linhas": [], "pendentes": [],
            "so_minha_equipe": False}
    if p is None:
        return base
    v = sv.visao(s, p)
    datas = [x["data"] for x in v["dias"]]
    i = datas.index(d.isoformat())
    # encarregado vê só as linhas das equipes em que ele é o encarregado (pelo crachá do acesso)
    minhas = None
    if c.papel == PapelObra.ENCARREGADO and c.cracha:
        minhas = {e.id for e in s.scalars(select(EquipeModel).where(EquipeModel.obra_id == c.obra_id,
                                                                     EquipeModel.encarregado_cracha == c.cracha))}
    from app.modules.indicadores.infra.models import CausaDesvioModel, DesvioModel

    desvios = list(s.scalars(select(DesvioModel).where(DesvioModel.obra_id == c.obra_id, DesvioModel.programacao_id == p.id)))
    causas = {x.id: x.descricao for x in s.scalars(select(CausaDesvioModel).where(CausaDesvioModel.obra_id == c.obra_id))}
    from app.modules.campo.infra.models import FotoCampoModel

    fotos_dia: dict[int, list[int]] = {}
    for fid, lid in s.execute(select(FotoCampoModel.id, FotoCampoModel.alvo_id).where(
            FotoCampoModel.obra_id == c.obra_id, FotoCampoModel.alvo == "linha", FotoCampoModel.data == d)):
        fotos_dia.setdefault(lid, []).append(fid)
    linhas, pendentes = [], []
    for loc in v["locais"]:
        for a in loc["areas"]:
            for ln in a["linhas"]:
                if minhas is not None and ln["equipe_id"] not in minhas:
                    continue
                prev, real = ln["previsto"][i], ln["realizado"][i]
                comum = {"id": ln["id"], "n": ln["n"], "codigo_simova": ln["codigo_simova"], "descricao": ln["descricao"],
                         "grupo": ln["grupo"]["descricao"], "unidade": ln["unidade"], "area": f"{a['codigo']} · {a['descricao']}",
                         "local": f"{loc['codigo']} · {loc['descricao']}", "cwp": (ln.get("cwp") or {}).get("texto"),
                         "equipe": ln["equipe"], "encarregado": ln["encarregado"]}
                if prev or real is not None:
                    linhas.append({**comum, "previsto": prev, "realizado": real,
                                   "capacidade": (ln["calc"].get("capacidade_dia") or [None] * len(datas))[i],
                                   "fotos": fotos_dia.get(ln["id"], []), "previsto_periodo": ln["total_previsto"], "realizado_periodo": ln["total_realizado"],
                                   "desvios": [{"id": x.id, "causa": causas.get(x.causa_id), "descricao": x.descricao}
                                               for x in desvios if x.linha_id == ln["id"] and x.data == d]})
                # dias anteriores (até ontem) com previsto e sem realizado lançado
                for j, dj in enumerate(datas):
                    if dj < d.isoformat() and dj <= hoje.isoformat() and ln["previsto"][j] and ln["realizado"][j] is None:
                        pendentes.append({**comum, "data": dj, "dia": v["dias"][j]["dia"], "previsto": ln["previsto"][j]})
    return {**base, "programacao": {"id": p.id, "titulo": p.titulo, "status": p.status, "tipo": p.tipo,
                                   "editavel": p.status == "emitida", "inicio": p.inicio.isoformat(), "fim": p.fim.isoformat()},
            "dia_semana": v["dias"][i]["dia"], "linhas": linhas, "pendentes": pendentes, "so_minha_equipe": minhas is not None,
            "anterior": (d - timedelta(days=1)).isoformat(), "seguinte": (d + timedelta(days=1)).isoformat()}
