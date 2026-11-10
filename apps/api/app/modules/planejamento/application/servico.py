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
from app.modules.equipes.infra.models import EquipeModel
from app.modules.frentes.infra.models import AreaFrenteModel, LocalFrenteModel
from app.modules.integracao_simova.domain import layout
from app.modules.planejamento.domain.periodo import DIAS, dias, janelas_ft
from app.modules.planejamento.infra.models import EmissaoModel, LinhaProgramacaoModel, ProgramacaoModel, ValorDiaModel
from app.modules.referencias.infra.models import (
    AtividadeCronogramaModel,
    ItemPqModel,
    PqQuantidadeTagModel,
)
from app.modules.referencias.infra.resolvedor import ResolvedorReferencias
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
    cron = {}
    ids_crono = {ln.id_crono for ln in p.linhas if ln.id_crono}
    if "CRONOGRAMA" in vig and ids_crono:
        cron = {x.id_crono: x for x in s.scalars(select(AtividadeCronogramaModel).where(
            AtividadeCronogramaModel.versao_id == vig["CRONOGRAMA"], AtividadeCronogramaModel.id_crono.in_(ids_crono)))}

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
            "equipe_id": ln.equipe_id, "equipe": eq.nome if eq else None,
            "encarregado": (eq.encarregado_nome if eq else None), "cracha": (eq.encarregado_cracha if eq else None),
            "observacao": ln.observacao, "previsto": prev, "realizado": real,
            "total_previsto": round(sum(_num(x) for x in prev), 4), "total_realizado": round(sum(_num(x) for x in real), 4),
        })
    saida_locais = []
    for loc in sorted(locais.values(), key=lambda x: (x.ordem, x.id)):
        areas_loc = sorted([a for a in areas.values() if a.local_id == loc.id and a.id in por_area],
                           key=lambda x: (x.ordem, x.id))
        if not areas_loc:
            continue
        saida_locais.append({"id": loc.id, "codigo": loc.codigo, "descricao": loc.descricao,
                             "areas": [{"id": a.id, "codigo": a.codigo, "cwa": a.cwa, "descricao": a.descricao,
                                        "tag": a.tag, "linhas": por_area[a.id]} for a in areas_loc]})
    return {"id": p.id, "tipo": p.tipo, "titulo": p.titulo, "inicio": p.inicio.isoformat(), "fim": p.fim.isoformat(),
            "status": p.status, "revisao": p.revisao,
            "dias": [{"data": d.isoformat(), "dia": DIAS[d.weekday()]} for d in datas],
            "locais": saida_locais, "linhas": sum(len(v) for v in por_area.values())}


def exigir_rascunho(p: ProgramacaoModel) -> None:
    if p.status != "rascunho":
        raise DomainError("programação emitida: reabra para alterar o previsto")


def salvar_valores(s: Session, p: ProgramacaoModel, linha_id: int, valores: list[dict], campo: str) -> None:
    """campo = previsto (só em rascunho) | realizado (a qualquer momento)."""
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
        setattr(v, campo, q)
    s.flush()


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
    if p.status != "emitida":
        raise DomainError("só programação emitida pode ser reaberta")
    p.status = "rascunho"


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
                        linha[f"PE_{DIAS_FT[d.weekday()]}"] = str(int(q)) if float(q).is_integer() else str(q)
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
