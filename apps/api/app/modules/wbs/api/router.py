"""WBS de execução: Área (CWA) → CWP (elemento + complemento) → Grupo (catálogo) → IWP (item da PQ)."""
import json
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Response, UploadFile
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, ler, planejar
from app.core.db import get_session
from app.modules.catalogo.infra.models import GrupoAtividadeModel, TipoAtividadeModel
from app.modules.frentes.infra.models import AreaFrenteModel
from app.modules.planejamento.infra.models import LinhaProgramacaoModel
from app.modules.referencias.infra.pq_gateway import itens_pq, quantidades_por_tag
from app.modules.wbs.domain import wbs as dom
from app.modules.wbs.infra.gateway import codigos, nos
from app.modules.wbs.infra.models import WbsNoModel
from app.shared.errors import DomainError, NotFoundError

router = APIRouter(prefix="/wbs", tags=["WBS de execução"])


class NoIn(BaseModel):
    pai_id: int | None = None
    tipo: str
    area_id: int | None = None  # área
    elemento: str | None = None  # CWP
    complemento: str | None = None  # CWP
    grupo_id: int | None = None  # grupo
    tipo_id: int | None = None  # IWP: tipo do catálogo (= item da PQ no grupo)
    quantidade: float | None = None  # IWP (e etapa, se for diferente do IWP)
    percentual: float | None = None  # etapa: peso no valor do item (0,4 = 40%)
    sem_avanco: bool = False  # etapa só de esforço (HH), sem avanço físico nem valor
    etapa_id: int | None = None  # etapa do critério de avanço (spec 079)
    observacao: str | None = None
    ativo: bool = True


def _no(s: Session, c: ContextoObra, nid: int) -> WbsNoModel:
    n = s.get(WbsNoModel, nid)
    if n is None or n.obra_id != c.obra_id:
        raise NotFoundError("Nó da WBS", nid)
    return n


def _atividades_p6(s: Session, obra_id: int, ids: set[str]) -> dict[str, str]:
    from app.modules.referencias.infra.resolvedor import ResolvedorReferencias
    from app.modules.referencias.infra.models import AtividadeCronogramaModel

    vig = ResolvedorReferencias(s, obra_id).versoes_vigentes().get("CRONOGRAMA")
    if not vig or not ids:
        return {}
    return {a.id_crono: a.atividade for a in s.scalars(select(AtividadeCronogramaModel).where(
        AtividadeCronogramaModel.versao_id == vig, AtividadeCronogramaModel.id_crono.in_(ids)))}


@router.get("")
def arvore(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    todos = nos(s, c.obra_id)
    cods = codigos(s, c.obra_id, todos)
    areas = {a.id: a for a in s.scalars(select(AreaFrenteModel).where(AreaFrenteModel.obra_id == c.obra_id))}
    grupos = {g.id: g for g in s.scalars(select(GrupoAtividadeModel).where(GrupoAtividadeModel.obra_id == c.obra_id))}
    itens = {n.item_pq for n in todos.values() if n.item_pq}
    pq = itens_pq(s, c.obra_id, itens)
    tk = quantidades_por_tag(s, c.obra_id, itens)
    uso = dict(s.execute(select(LinhaProgramacaoModel.wbs_no_id, func.count()).where(
        LinhaProgramacaoModel.wbs_no_id.in_(list(todos) or [0])).group_by(LinhaProgramacaoModel.wbs_no_id)).all())
    atividades_p6 = _atividades_p6(s, c.obra_id, {n.id_crono for n in todos.values() if n.id_crono})
    filhos: dict[int | None, list[WbsNoModel]] = {}
    for n in todos.values():
        filhos.setdefault(n.pai_id, []).append(n)

    def area_de(n: WbsNoModel) -> AreaFrenteModel | None:
        while n.tipo != "area":
            n = todos[n.pai_id]
        return areas.get(n.area_id)

    def saida(n: WbsNoModel) -> dict:
        d = {"id": n.id, "pai_id": n.pai_id, "tipo": n.tipo, "seq": n.seq, "codigo": cods[n.id].codigo,
             "caminho": cods[n.id].caminho, "ativo": n.ativo, "observacao": n.observacao,
             "linhas": uso.get(n.id, 0), "area_id": n.area_id, "elemento": n.elemento, "complemento": n.complemento,
             "grupo_id": n.grupo_id, "tipo_id": n.tipo_atividade_id, "item_pq": n.item_pq,
             "origem": n.origem, "fora_cronograma": n.fora_cronograma, "id_crono": n.id_crono, "codigo_p6": n.codigo_p6,
             "atividade_p6": atividades_p6.get(n.id_crono) if n.id_crono else None}
        if n.tipo == "area":
            a = areas.get(n.area_id)
            d["titulo"], d["detalhe"] = (a.descricao if a else "?"), (f"CWA {a.cwa}" + (f" · Ativo {a.ativo_codigo}" if a and a.ativo_codigo else "") if a else "")
        elif n.tipo == "cwp":
            d["titulo"], d["detalhe"] = dom.texto_cwp(n.elemento, n.complemento), "CWP"
        elif n.tipo == "grupo":
            g = grupos.get(n.grupo_id)
            d["titulo"], d["detalhe"] = (g.descricao if g else "?"), (f"grupo {g.numero}" if g else "")
        elif n.tipo == "etapa":
            d.update({"titulo": n.elemento or "Etapa", "detalhe": "só esforço (HH), não fatura" if n.sem_avanco
                      else f"{round((n.percentual or 0) * 100, 2):g}% do valor do item", "percentual": n.percentual,
                      "sem_avanco": n.sem_avanco, "etapa_id": n.etapa_id, "quantidade": n.quantidade})
        else:
            info = pq.get(n.item_pq)
            a = area_de(n)
            qtd_tk = tk.get((n.item_pq, a.tag)) if a and a.tag else None
            d.update({"titulo": info.texto_simova if info else (n.item_pq or "?"),
                      "detalhe": f"PQ {n.item_pq}" + (f" · {info.descricao}" if info and info.nome_simplificado else ""),
                      "unid": info.unid if info else None, "quantidade": n.quantidade, "qtd_takeoff": qtd_tk,
                      "quantidade_efetiva": n.quantidade if n.quantidade is not None else qtd_tk,
                      "origem_qtd": "digitada" if n.quantidade is not None else ("take-off" if qtd_tk is not None else None),
                      "na_pq_vigente": info is not None})
        d["filhos"] = [saida(f) for f in sorted(filhos.get(n.id, []), key=lambda x: (x.seq, x.id))]
        return d

    import re

    natural = lambda t: [int(x) if x.isdigit() else x for x in re.split(r"(\d+)", t)]  # noqa: E731
    raizes = sorted(filhos.get(None, []), key=lambda n: natural(cods[n.id].codigo))
    return {"arvore": [saida(n) for n in raizes]}


@router.post("/sincronizar-cronograma")
def sincronizar_cronograma(s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Traz a WBS do cronograma vigente (P6): áreas, CWPs e IWPs (atividades com item da PQ no Catálogo)."""
    from app.modules.wbs.application.sincronizar_cronograma import sincronizar

    return sincronizar(s, c.obra_id)


@router.post("/areas-das-frentes")
def areas_das_frentes(s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Traz para a WBS as áreas ativas das Frentes que ainda não estão nela."""
    from app.modules.wbs.application.p6 import garantir_areas

    return {"areas_novas": garantir_areas(s, c.obra_id)}


@router.post("/exportar-p6")
def exportar_p6(arquivo: UploadFile = File(...), s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Recebe o .xer atual do cronograma e devolve o mesmo .xer com a WBS de execução acrescentada (para importar
    no Primavera). Áreas e CWPs ganham o código WBS; IWPs viram atividades com Activity ID EXE-00000."""
    from app.modules.wbs.application.p6 import exportar_xer

    conteudo = arquivo.file.read()
    if len(conteudo) > 80 * 1024 * 1024:
        raise DomainError("o .xer passa de 80 MB", "arquivo")
    saida, resumo = exportar_xer(s, c.obra_id, conteudo)
    base = (arquivo.filename or "cronograma.xer").rsplit(".", 1)[0]
    nome = f"{base} + WBS de execucao.xer"
    return Response(saida, media_type="application/octet-stream", headers={
        "Content-Disposition": f"attachment; filename=\"{nome}\"; filename*=UTF-8''{quote(nome)}",
        "X-Resumo": quote(json.dumps(resumo, ensure_ascii=False)), "Access-Control-Expose-Headers": "X-Resumo"})


@router.post("/nos", status_code=201)
def criar(d: NoIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    pai = _no(s, c, d.pai_id) if d.pai_id else None
    dom.validar_tipo(d.tipo, pai.tipo if pai else None)
    irmaos = list(s.scalars(select(WbsNoModel).where(WbsNoModel.obra_id == c.obra_id,
                                                     WbsNoModel.pai_id.is_(None) if pai is None else WbsNoModel.pai_id == pai.id)))
    n = WbsNoModel(obra_id=c.obra_id, pai_id=pai.id if pai else None, tipo=d.tipo,
                   seq=max([x.seq for x in irmaos], default=0) + 1, observacao=(d.observacao or None), ativo=d.ativo)
    if d.tipo == "area":
        a = s.get(AreaFrenteModel, d.area_id or 0)
        if a is None or a.obra_id != c.obra_id:
            raise DomainError("escolha a área (CWA) em Frentes", "area_id")
        if any(x.area_id == a.id for x in irmaos):
            raise DomainError(f"a área {a.codigo} já está na WBS", "area_id")
        n.area_id = a.id
    elif d.tipo == "cwp":
        n.elemento, n.complemento = dom.validar_cwp(d.elemento, d.complemento)
        if any((x.elemento or "").lower() == n.elemento.lower() and (x.complemento or "").lower() == (n.complemento or "").lower()
               for x in irmaos):
            raise DomainError(f"o CWP {dom.texto_cwp(n.elemento, n.complemento)} já existe nesta área", "elemento")
    elif d.tipo == "grupo":
        g = s.get(GrupoAtividadeModel, d.grupo_id or 0)
        if g is None or g.obra_id != c.obra_id:
            raise DomainError("escolha o grupo do catálogo", "grupo_id")
        if any(x.grupo_id == g.id for x in irmaos):
            raise DomainError(f"o grupo {g.numero} · {g.descricao} já está neste CWP", "grupo_id")
        n.grupo_id, n.seq = g.id, g.numero
    elif d.tipo == "etapa":  # spec 079: etapa do IWP (do critério de avanço ou criada aqui)
        from app.modules.criterios.infra.models import EtapaCriterioModel

        ec = s.get(EtapaCriterioModel, d.etapa_id) if d.etapa_id else None
        if d.etapa_id and (ec is None or ec.obra_id != c.obra_id):
            raise NotFoundError("Etapa do critério", d.etapa_id)
        nome = d.elemento or (ec.nome if ec else None)
        sem = d.sem_avanco if not ec or d.elemento else ec.sem_avanco
        pct = d.percentual if d.percentual is not None or not ec else ec.percentual
        n.elemento, n.percentual = dom.validar_etapa(nome, pct, sem)
        n.sem_avanco, n.etapa_id, n.quantidade = sem, ec.id if ec else None, dom.validar_quantidade(d.quantidade)
        if any((x.elemento or "").lower() == n.elemento.lower() for x in irmaos):
            raise DomainError(f"a etapa “{n.elemento}” já existe neste IWP", "elemento")
    else:  # iwp
        t = s.get(TipoAtividadeModel, d.tipo_id or 0)
        if t is None or t.obra_id != c.obra_id or not t.item_pq:
            raise DomainError("escolha o item da PQ (vinculado ao grupo no Catálogo)", "tipo_id")
        if t.grupo_id != pai.grupo_id:
            raise DomainError(f"o item {t.item_pq} não é do grupo deste nó: vincule-o ao grupo no Catálogo", "tipo_id")
        if any(x.tipo_atividade_id == t.id for x in irmaos):
            raise DomainError(f"o item {t.item_pq} já está neste grupo", "tipo_id")
        n.tipo_atividade_id, n.item_pq, n.quantidade = t.id, t.item_pq, dom.validar_quantidade(d.quantidade)
    s.add(n)
    s.flush()
    return {"id": n.id, "codigo": codigos(s, c.obra_id)[n.id].codigo}


class DuplicarIn(BaseModel):
    cwp_id: int | None = None  # CWP de destino, no mesmo CWA
    novo_cwp_elemento: str | None = None  # ou um CWP novo nesse CWA
    novo_cwp_complemento: str | None = None
    quantidades: bool = False  # copiar as quantidades digitadas (vazio = take-off da TAG)


@router.post("/nos/{nid}/duplicar", status_code=201)
def duplicar(nid: int, d: DuplicarIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Duplica um grupo (com os IWPs e as etapas) ou um IWP para outro CWP do MESMO CWA (spec 136) — existente ou criado
    aqui. O que o CWP de destino já tem não repete; a atividade do cronograma não vai junto (é outra execução)."""
    o = _no(s, c, nid)
    if o.tipo not in ("grupo", "iwp"):
        raise DomainError("duplique um grupo ou um IWP", "tipo")
    todos = nos(s, c.obra_id)
    grupo_o = o if o.tipo == "grupo" else todos[o.pai_id]
    cwp_o = todos[grupo_o.pai_id]
    area = todos[cwp_o.pai_id]
    if d.cwp_id:
        destino = _no(s, c, d.cwp_id)
        if destino.tipo != "cwp" or destino.pai_id != area.id:
            raise DomainError("o destino precisa ser um CWP do mesmo CWA", "cwp_id")
    elif d.novo_cwp_elemento:
        el, comp = dom.validar_cwp(d.novo_cwp_elemento, d.novo_cwp_complemento)
        irmaos = [x for x in todos.values() if x.pai_id == area.id]
        destino = next((x for x in irmaos if (x.elemento or "").lower() == el.lower() and (x.complemento or "").lower() == (comp or "").lower()), None)
        if destino is None:
            destino = WbsNoModel(obra_id=c.obra_id, pai_id=area.id, tipo="cwp", elemento=el, complemento=comp,
                                 seq=max([x.seq for x in irmaos], default=0) + 1)
            s.add(destino)
            s.flush()
            todos[destino.id] = destino
    else:
        raise DomainError("escolha o CWP de destino (no mesmo CWA) ou escreva um novo", "cwp_id")
    if destino.id == cwp_o.id:
        raise DomainError("escolha outro CWP: neste já está", "cwp_id")
    filhos: dict[int, list[WbsNoModel]] = {}
    for x in todos.values():
        if x.pai_id:
            filhos.setdefault(x.pai_id, []).append(x)
    grupo_d = next((x for x in filhos.get(destino.id, []) if x.tipo == "grupo" and x.grupo_id == grupo_o.grupo_id), None)
    if grupo_d is None:
        grupo_d = WbsNoModel(obra_id=c.obra_id, pai_id=destino.id, tipo="grupo", grupo_id=grupo_o.grupo_id, seq=grupo_o.seq)
        s.add(grupo_d)
        s.flush()
    ja = {x.tipo_atividade_id for x in filhos.get(grupo_d.id, []) if x.tipo == "iwp"}
    seq = max([x.seq for x in filhos.get(grupo_d.id, [])], default=0)
    origem = [o] if o.tipo == "iwp" else sorted([x for x in filhos.get(grupo_o.id, []) if x.tipo == "iwp" and x.ativo], key=lambda x: x.seq)
    criados = repetidos = 0
    for i in origem:
        if i.tipo_atividade_id in ja:
            repetidos += 1
            continue
        seq += 1
        novo = WbsNoModel(obra_id=c.obra_id, pai_id=grupo_d.id, tipo="iwp", seq=seq, tipo_atividade_id=i.tipo_atividade_id,
                          item_pq=i.item_pq, quantidade=i.quantidade if d.quantidades else None)
        s.add(novo)
        s.flush()
        for e in sorted([x for x in filhos.get(i.id, []) if x.tipo == "etapa"], key=lambda x: x.seq):
            s.add(WbsNoModel(obra_id=c.obra_id, pai_id=novo.id, tipo="etapa", seq=e.seq, elemento=e.elemento, percentual=e.percentual,
                             sem_avanco=e.sem_avanco, etapa_id=e.etapa_id, quantidade=e.quantidade if d.quantidades else None,
                             ativo=e.ativo))
        ja.add(i.tipo_atividade_id)
        criados += 1
    s.flush()
    cods = codigos(s, c.obra_id)
    return {"cwp_id": destino.id, "cwp": cods[destino.id].caminho, "criados": criados, "ja_estavam": repetidos}


@router.put("/nos/{nid}")
def editar(nid: int, d: NoIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Edita o texto do CWP, a quantidade do IWP, a observação e a situação (área, grupo e item não mudam)."""
    n = _no(s, c, nid)
    if n.tipo == "cwp":
        n.elemento, n.complemento = dom.validar_cwp(d.elemento, d.complemento)
    if n.tipo == "iwp":
        n.quantidade = dom.validar_quantidade(d.quantidade)
    if n.tipo == "etapa":
        n.elemento, n.percentual = dom.validar_etapa(d.elemento or n.elemento, d.percentual, d.sem_avanco)
        n.sem_avanco, n.quantidade = d.sem_avanco, dom.validar_quantidade(d.quantidade)
    n.observacao, n.ativo = (d.observacao or None), d.ativo
    s.flush()
    return {"id": n.id}


@router.delete("/nos/{nid}", status_code=204)
def excluir(nid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    n = _no(s, c, nid)
    if s.scalar(select(func.count()).select_from(WbsNoModel).where(WbsNoModel.pai_id == n.id)):
        raise DomainError("o nó tem itens abaixo: exclua-os antes")
    if s.scalar(select(func.count()).select_from(LinhaProgramacaoModel).where(LinhaProgramacaoModel.wbs_no_id == n.id)):
        raise DomainError("o IWP está em programação: inative em vez de excluir")
    s.delete(n)


@router.post("/nos/{nid}/aplicar-criterio")
def aplicar_criterio(nid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Cria abaixo do IWP as etapas do critério de avanço do item da PQ (as que já existem ficam). Etapas sem avanço
    criadas à mão no critério (ex.: pré-armação) também vêm."""
    from app.modules.criterios.api.router import criterio_para_item

    n = _no(s, c, nid)
    if n.tipo != "iwp":
        raise DomainError("aplique o critério num IWP (item da PQ)", "tipo")
    cr = criterio_para_item(s, c.obra_id, n.item_pq)
    if cr is None:
        raise DomainError(f"nenhum critério de avanço cobre o item {n.item_pq} — cadastre em Critério de avanço", "item_pq")
    filhos = list(s.scalars(select(WbsNoModel).where(WbsNoModel.pai_id == n.id)))
    ja = {f.etapa_id for f in filhos if f.etapa_id} | {(f.elemento or "").lower() for f in filhos}
    seq = max([f.seq for f in filhos], default=0)
    criadas = 0
    for e in sorted(cr.etapas, key=lambda e: e.numero):
        if e.id in ja or e.nome.lower() in ja:
            continue
        seq += 1
        s.add(WbsNoModel(obra_id=c.obra_id, pai_id=n.id, tipo="etapa", seq=seq, elemento=e.nome, percentual=0 if e.sem_avanco else e.percentual,
                         sem_avanco=e.sem_avanco, etapa_id=e.id, ativo=True))
        criadas += 1
    s.flush()
    return {"criterio": f"{cr.codigo} · {cr.item_pq}", "criadas": criadas, "ja_existiam": len(cr.etapas) - criadas}


# ---- associação com o cronograma (spec 080) ----
def _palavras(t: str | None) -> set[str]:
    from app.modules.wbs.domain.cronograma import normalizar_descricao

    return {w for w in normalizar_descricao(t).split() if len(w) > 2}


@router.get("/associacao")
def associacao(area_id: int | None = None, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """IWPs e etapas da WBS com a atividade do cronograma vigente ligada a cada um e, para os que não têm, até 3
    sugestões (mesmo item da PQ, mesma área e palavras da descrição). Também as atividades do cronograma sem WBS."""
    from app.modules.referencias.infra.models import AtividadeCronogramaModel
    from app.modules.referencias.infra.resolvedor import ResolvedorReferencias

    todos = nos(s, c.obra_id)
    cods = codigos(s, c.obra_id, todos)
    areas = {a.id: a for a in s.scalars(select(AreaFrenteModel).where(AreaFrenteModel.obra_id == c.obra_id))}
    vig = ResolvedorReferencias(s, c.obra_id).versoes_vigentes().get("CRONOGRAMA")
    ativs = list(s.scalars(select(AtividadeCronogramaModel).where(AtividadeCronogramaModel.versao_id == vig)
                           .order_by(AtividadeCronogramaModel.ordem_p6.nulls_last()))) if vig else []
    por_id = {a.id_crono: a for a in ativs}
    pq = itens_pq(s, c.obra_id, {n.item_pq for n in todos.values() if n.item_pq})

    def area_de(n: WbsNoModel) -> AreaFrenteModel | None:
        while n.tipo != "area":
            n = todos[n.pai_id]
        return areas.get(n.area_id)

    def na_area(at, a: AreaFrenteModel | None) -> bool:
        if a is None or not at.area:
            return False
        if f"CWA {a.cwa}".lower() in at.area.lower():
            return True
        return bool(a.tag and a.tag.count("-") >= 2 and "{1}-{0}-{2}".format(*a.tag.split("-", 2)).lower() in at.area.lower())

    usados = {n.id_crono for n in todos.values() if n.id_crono}
    out = []
    for n in todos.values():
        if n.tipo not in ("iwp", "etapa") or not n.ativo:
            continue
        iwp = todos[n.pai_id] if n.tipo == "etapa" else n
        a = area_de(n)
        if area_id and (a is None or a.id != area_id):
            continue
        info = pq.get(iwp.item_pq)
        titulo = (info.texto_simova if info else iwp.item_pq or "?") + (f" — {n.elemento}" if n.tipo == "etapa" else "")
        d = {"id": n.id, "tipo": n.tipo, "codigo": cods[n.id].codigo, "caminho": cods[n.id].caminho, "titulo": titulo,
             "item_pq": iwp.item_pq, "area": f"{a.codigo} · {a.descricao}" if a else None, "area_id": a.id if a else None,
             "id_crono": n.id_crono, "atividade": por_id[n.id_crono].atividade if n.id_crono in por_id else None,
             "no_cronograma": n.id_crono in por_id if n.id_crono else None, "sem_avanco": n.sem_avanco, "sugestoes": []}
        if not n.id_crono and ativs:
            alvo = _palavras((info.descricao if info else "") + " " + titulo)
            notas = []
            for at in ativs:
                pts = (3 if at.item_pq and at.item_pq == iwp.item_pq else 0) + (2 if na_area(at, a) else 0)
                comuns = len(alvo & _palavras(at.atividade))
                pts += min(comuns, 4) * 0.5
                if pts >= 2:
                    notas.append((pts - (1 if at.id_crono in usados else 0), at))
            notas.sort(key=lambda x: -x[0])
            d["sugestoes"] = [{"id_crono": at.id_crono, "atividade": at.atividade, "ja_usada": at.id_crono in usados} for _, at in notas[:3]]
        out.append(d)
    out.sort(key=lambda x: [int(p) if p.isdigit() else p for p in x["codigo"].replace(".", "-").split("-")])
    sem_wbs = [{"id_crono": a.id_crono, "atividade": a.atividade, "area": a.area, "inicio": a.inicio, "fim": a.fim}
               for a in ativs if a.id_crono not in usados]
    return {"nos": out, "total": len(out), "ligados": sum(1 for x in out if x["id_crono"]),
            "atividades": len(ativs), "atividades_sem_wbs": len(sem_wbs), "sem_wbs": sem_wbs[:300]}


class AtividadeIn(BaseModel):
    id_crono: str | None = None
    levar_para_programacoes: bool = True


def _conferir_atividade(s: Session, obra_id: int, id_crono: str | None) -> str | None:
    if not id_crono:
        return None
    from app.modules.referencias.infra.models import AtividadeCronogramaModel
    from app.modules.referencias.infra.resolvedor import ResolvedorReferencias

    vig = ResolvedorReferencias(s, obra_id).versoes_vigentes().get("CRONOGRAMA")
    cod = id_crono.strip()
    if not vig or not s.scalar(select(AtividadeCronogramaModel.id).where(AtividadeCronogramaModel.versao_id == vig,
                                                                           AtividadeCronogramaModel.id_crono == cod)):
        raise DomainError(f"a atividade {cod} não está no cronograma vigente", "id_crono")
    return cod


def ligar_atividade(s: Session, obra_id: int, n: WbsNoModel, id_crono: str | None, levar: bool = True) -> int:
    """Liga o nó (IWP ou etapa) à atividade do cronograma e, se pedido, as linhas dele nas programações em rascunho."""
    from app.modules.planejamento.infra.models import ProgramacaoModel

    n.id_crono = _conferir_atividade(s, obra_id, id_crono)
    if not levar:
        return 0
    linhas = list(s.scalars(select(LinhaProgramacaoModel).join(ProgramacaoModel, ProgramacaoModel.id == LinhaProgramacaoModel.programacao_id)
                            .where(ProgramacaoModel.obra_id == obra_id, ProgramacaoModel.status == "rascunho",
                                   LinhaProgramacaoModel.wbs_no_id == n.id)))
    for ln in linhas:
        ln.id_crono = n.id_crono
    return len(linhas)


@router.put("/nos/{nid}/atividade")
def associar(nid: int, d: AtividadeIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    n = _no(s, c, nid)
    if n.tipo not in ("iwp", "etapa"):
        raise DomainError("a atividade do cronograma vai no IWP ou na etapa", "tipo")
    linhas = ligar_atividade(s, c.obra_id, n, d.id_crono, d.levar_para_programacoes)
    s.flush()
    return {"id": n.id, "id_crono": n.id_crono, "linhas_atualizadas": linhas}
