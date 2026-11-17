"""Monta o resumo do dia (spec 101) a partir do que já está registrado: a programação do dia (realizado e fotos de cada
linha), as ocorrências (desvios), as restrições do 6WLA, as auditorias, a presença das equipes e o book de fotos.
Cada parte vem agrupada na hierarquia da programação (Local → Área; nas atividades também o CWP da WBS)."""
from collections import OrderedDict
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra
from app.modules.campo.application.book import montar_book
from app.modules.campo.infra.models import FotoCampoModel
from app.modules.frentes.infra.models import AreaFrenteModel, LocalFrenteModel
from app.modules.indicadores.infra.models import CausaDesvioModel, DesvioModel
from app.modules.planejamento.application import servico as sv
from app.modules.planejamento.infra.models import LinhaProgramacaoModel
from app.modules.restricoes.infra.models import AcaoRestricaoModel
from app.shared.cache_leitura import dict_em_cache

FUSO = ZoneInfo("America/Sao_Paulo")
STATUS_DESVIO = {1: "Pendente", 2: "Em andamento", 3: "Concluído"}
FIM = (10**9, 10**9, "", 10**9, 10**9)  # "Sem frente" vai por último


class _Frentes:
    """Rótulos e ordem de cada área (Local → Área), na ordem da lista de frentes da obra."""

    def __init__(self, s: Session, obra_id: int):
        locais = {lc.id: lc for lc in s.scalars(select(LocalFrenteModel).where(LocalFrenteModel.obra_id == obra_id))}
        self.areas: dict[int, tuple] = {}
        for a in s.scalars(select(AreaFrenteModel).where(AreaFrenteModel.obra_id == obra_id)):
            lc = locais.get(a.local_id)
            self.areas[a.id] = ((lc.ordem if lc else 10**8), (lc.id if lc else 0), f"{lc.codigo} · {lc.descricao}" if lc else "",
                                a.ordem, a.id, f"{a.codigo} · {a.descricao}")

    def agrupar(self, itens: list[tuple[int | None, str | None, dict]], com_cwp: bool = False) -> list[dict]:
        """itens = (area_id, texto da frente quando não há área, item[, cwp no item]). Mantém a ordem dos itens."""
        grupos: "OrderedDict[tuple, dict]" = OrderedDict()
        for area_id, texto, it in itens:
            a = self.areas.get(area_id) if area_id else None
            chave = a[:5] if a else (*FIM[:2], texto or "", *FIM[3:])
            g = grupos.get(chave)
            if g is None:
                g = grupos[chave] = {"local": a[2] if a else None, "area": a[5] if a else (texto or None),
                                     "area_id": area_id if a else None, ("cwps" if com_cwp else "itens"): []}
            if com_cwp:
                txt = it.pop("_cwp", None)
                cw = next((x for x in g["cwps"] if x["texto"] == txt), None)
                if cw is None:
                    cw = {"texto": txt, "itens": []}
                    g["cwps"].append(cw)
                cw["itens"].append(it)
            else:
                g["itens"].append(it)
        return [grupos[k] for k in sorted(grupos, key=lambda k: k)]


def _dia_local(dt: datetime | None) -> date | None:
    return dt.astimezone(FUSO).date() if dt else None


def montar(s: Session, c: ContextoObra, d: date) -> dict:
    from app.modules.campo.api.router import programacao_do_dia
    from app.modules.obras.infra.models import MarcaObraModel, ObraModel

    obra_id = c.obra_id
    fr = _Frentes(s, obra_id)
    obra = s.get(ObraModel, obra_id)
    marca = s.get(MarcaObraModel, obra_id)
    rotulo_obra = " · ".join(x for x in (obra.nome if obra else None, (marca.nome_contratada or "").strip() if marca else None) if x)

    # 1. atividades executadas: realizado lançado no dia ou foto da linha no dia
    prog = programacao_do_dia(s, obra_id, d)
    executadas: list[tuple] = []
    linhas_do_dia: dict[int, dict] = {}
    if prog is not None:
        v = dict_em_cache("visao", obra_id, prog.id, lambda: sv.visao(s, prog))
        datas = [x["data"] for x in v["dias"]]
        i = datas.index(d.isoformat()) if d.isoformat() in datas else None
        ids = [ln["id"] for loc in v["locais"] for a in loc["areas"] for ln in a["linhas"]]
        fotos_linha = dict(s.execute(select(FotoCampoModel.alvo_id, func.count()).where(
            FotoCampoModel.obra_id == obra_id, FotoCampoModel.alvo == "linha", FotoCampoModel.data == d,
            FotoCampoModel.alvo_id.in_(ids or [0])).group_by(FotoCampoModel.alvo_id)).all())
        for loc in v["locais"]:
            for a in loc["areas"]:
                for ln in a["linhas"]:
                    real = ln["realizado"][i] if i is not None else None
                    nf = fotos_linha.get(ln["id"], 0)
                    if not (real and real > 0) and not nf:
                        continue
                    it = {"linha_id": ln["id"], "codigo": ln["codigo_simova"],
                          "atividade": ln.get("descricao_reduzida") or ln["descricao"], "unidade": ln.get("unidade"),
                          "realizado": real if real and real > 0 else None, "previsto": ln["previsto"][i] if i is not None else None,
                          "equipe_id": ln.get("equipe_id"), "equipe": ln.get("equipe"), "encarregado": ln.get("encarregado"),
                          "fotos": nf, "_cwp": (ln.get("cwp") or {}).get("texto") if (ln.get("cwp") or {}).get("id") else None}
                    linhas_do_dia[ln["id"]] = {**it, "area_id": a["id"], "area_codigo": a["codigo"]}
                    executadas.append((a["id"], None, it))
    atividades = {"total": len(executadas), "grupos": fr.agrupar(executadas, com_cwp=True)}
    areas_do_dia = {x["area_id"] for x in linhas_do_dia.values()}

    # 2. ocorrências do dia (desvios), na frente da atividade impactada
    causas = {k.id: k.descricao for k in s.scalars(select(CausaDesvioModel).where(CausaDesvioModel.obra_id == obra_id))}
    desvios = list(s.scalars(select(DesvioModel).where(DesvioModel.obra_id == obra_id, DesvioModel.data == d).order_by(DesvioModel.id)))
    da_linha = {lid: (aid, eid) for lid, aid, eid in s.execute(
        select(LinhaProgramacaoModel.id, LinhaProgramacaoModel.area_id, LinhaProgramacaoModel.equipe_id).where(
            LinhaProgramacaoModel.id.in_({x.linha_id for x in desvios if x.linha_id} or {0})))}
    ocorr, impacto = [], []  # impacto: (equipe da atividade impactada, área, ocorrência) — spec 102
    for x in desvios:
        aid_ln, eq_ln = da_linha.get(x.linha_id, (None, None))
        aid = x.area_id or aid_ln
        areas_do_dia.add(aid) if aid else None
        it = {"id": x.id, "causa": causas.get(x.causa_id), "descricao": x.descricao,
              "atividade": x.atividade_impactada or x.referencia, "acao": x.acao,
              "responsavel": x.responsavel, "status": STATUS_DESVIO.get(x.status, "Pendente"),
              "qtd_nao_cumprida": x.qtd_nao_cumprida}
        ocorr.append((aid, x.frente, it))
        impacto.append((eq_ln, aid, it))
    ocorrencias = {"total": len(ocorr), "grupos": fr.agrupar(ocorr)}

    # 3. restrições: as abertas no dia, as concluídas no dia e as pendentes das frentes/atividades do dia
    restr = []
    for r in s.scalars(select(AcaoRestricaoModel).where(AcaoRestricaoModel.obra_id == obra_id).order_by(AcaoRestricaoModel.numero)):
        criada = _dia_local(r.criado_em)
        concluida = r.status1 == "Concluído" or r.conclusao is not None
        if criada and criada > d:
            continue
        prazo = r.reprogramado or r.prazo_termino
        if r.conclusao == d:
            marcador = "concluida"
        elif criada == d:
            marcador = "nova"
        elif not concluida and (r.area_id in areas_do_dia or r.linha_id in linhas_do_dia):
            marcador = "atrasada" if prazo and prazo < d else "pendente"
        else:
            continue
        restr.append((r.area_id, r.area_texto, {
            "id": r.id, "numero": r.numero, "acao": r.acao, "atividade": r.atividade, "responsavel": r.responsavel,
            "prazo": prazo.isoformat() if prazo else None, "prazo_br": f"{prazo:%d/%m}" if prazo else None,
            "status": r.status1, "impeditivo": r.impeditivo, "marcador": marcador}))
    restricoes = {"total": len(restr), "grupos": fr.agrupar(restr)}

    # 4. auditorias enviadas no dia
    from app.modules.acoes.infra.models import AcaoModel
    from app.modules.auditorias.infra.models import RegistroAuditoriaModel

    regs = list(s.scalars(select(RegistroAuditoriaModel).where(RegistroAuditoriaModel.obra_id == obra_id, RegistroAuditoriaModel.data == d,
                                                               RegistroAuditoriaModel.status != "rascunho").order_by(RegistroAuditoriaModel.numero)))
    num_acao = dict(s.execute(select(AcaoModel.id, AcaoModel.numero).where(AcaoModel.id.in_({x.acao_id for x in regs if x.acao_id} or {0}))).all())
    aud = [(x.area_id, x.area_texto or x.local, {
        "id": x.id, "numero": x.numero, "tipo": x.tipo, "tipo_registro": x.tipo_registro, "nao_conformidade": x.nao_conformidade,
        "medida_corretiva": x.medida_corretiva, "ver_agir": x.ver_agir, "acao_numero": num_acao.get(x.acao_id),
        "encarregado": x.encarregado, "auditor": x.auditor}) for x in regs]
    auditorias = {"total": len(aud), "grupos": fr.agrupar(aud)}

    # 5. equipes: presença do dia e as atividades executadas de cada uma
    from app.modules.presenca.api.router import dia as presenca_dia

    pres = presenca_dia(data=d, atividades=False, s=s, c=c)
    por_equipe: dict[int, list[str]] = {}
    for x in linhas_do_dia.values():
        if x["equipe_id"]:
            por_equipe.setdefault(x["equipe_id"], []).append(f"{x['codigo']} {x['atividade']} ({x['area_codigo']})")
    eq_itens = []
    for e in pres["equipes"]:
        ativs = por_equipe.get(e["equipe_id"], [])
        if not e["presentes"] and not ativs:
            continue
        eq_itens.append({"equipe_id": e["equipe_id"], "nome": e["nome"], "encarregado": e["encarregado"],
                         "setor": (e.get("setor") or {}).get("nome") if isinstance(e.get("setor"), dict) else e.get("setor"),
                         "presentes": e["presentes"], "total": e["total"],
                         "funcoes": [f"{f['presentes']} {f['funcao']}" for f in e["por_funcao"] if f["presentes"]],
                         "atividades": ativs})
    eq_itens.sort(key=lambda x: (not x["atividades"], x["nome"]))
    equipes = {"itens": eq_itens, "presentes": pres["presentes"], "sem_equipe": len(pres["sem_equipe"])}

    # 2b. equipes impactadas (spec 102): a equipe da atividade impactada por cada ocorrência, com a presença do dia
    from app.modules.equipes.infra.models import EquipeModel

    pres_eq = {e["equipe_id"]: e for e in pres["equipes"]}
    imp: "OrderedDict[int, dict]" = OrderedDict()
    sem_equipe_oc = 0
    for eq_id, aid, it in impacto:
        if not eq_id:
            sem_equipe_oc += 1
            continue
        g = imp.get(eq_id)
        if g is None:
            e = pres_eq.get(eq_id)
            m = None if e else s.get(EquipeModel, eq_id)
            g = imp[eq_id] = {"equipe_id": eq_id, "nome": e["nome"] if e else (m.nome if m else "?"),
                              "encarregado": e["encarregado"] if e else (m.encarregado_nome if m else None),
                              "presentes": e["presentes"] if e else 0, "total": e["total"] if e else 0, "ocorrencias": []}
        g["ocorrencias"].append({**{k: it[k] for k in ("causa", "descricao", "atividade", "status", "qtd_nao_cumprida")},
                                 "area": fr.areas[aid][5].split(" · ")[0] if aid in fr.areas else None})
    impactadas = {"itens": sorted(imp.values(), key=lambda x: x["nome"]), "total": len(imp),
                  "ocorrencias": sum(len(x["ocorrencias"]) for x in imp.values()), "sem_equipe": sem_equipe_oc}

    # 6. fotos do dia (book), por frente; no texto, uma linha por atividade/ocorrência com a quantidade
    book = montar_book(s, obra_id, d, d, None, None)
    por_alvo: "OrderedDict[tuple, dict]" = OrderedDict()
    ordem_tipo = {"atividade": 0, "ocorrencia": 1, "restricao": 2, "auditoria": 3, "acao": 4}
    for f in sorted(book, key=lambda x: (ordem_tipo.get(x["tipo"], 9), x["id"])):
        desc = {"atividade": f.get("atividade"), "ocorrencia": f"Ocorrência: {f.get('titulo') or f.get('causa') or ''}"}.get(f["tipo"]) or f.get("titulo") or f["tipo"]
        k = (f["tipo"], f["alvo_id"], f["area_id"])
        g = por_alvo.setdefault(k, {"area_id": f["area_id"], "area": f["area"], "descricao": desc, "tipo": f["tipo"], "n": 0, "ids": []})
        g["n"] += 1
        g["ids"].append(f["id"])
    fotos = {"total": len(book), "grupos": fr.agrupar([(g["area_id"], g["area"], g) for g in por_alvo.values()]),
             "lista": [{"id": f["id"], "tipo": f["tipo"], "legenda": f.get("legenda"), "area": f["area"], "local": f.get("local"),
                        "descricao": f.get("atividade") or f.get("titulo")} for f in book]}

    return {"data": d.isoformat(), "obra": rotulo_obra,
            "programacao": {"id": prog.id, "titulo": prog.titulo} if prog else None,
            "atividades": atividades, "ocorrencias": ocorrencias, "restricoes": restricoes, "auditorias": auditorias,
            "impactadas": impactadas, "equipes": equipes, "fotos": fotos, "gerado_em": datetime.now(timezone.utc).isoformat()}
