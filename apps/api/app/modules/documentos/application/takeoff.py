"""Take-off pelo projeto (spec 124): extrair as quantidades do desenho de cada revisão, decidir (aceitar com item da PQ,
frente e fator, ou descartar), comparar com o take-off da planilha e com o IWP, e levar ao IWP com a memória.

A revisão nova reaproveita as decisões da anterior pela chave ("aço CA50 Ø8") e mostra a diferença (Δ); só a vigente
vai ao IWP. Nada é escrito na WBS sem o planejador pedir.
"""
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.arquivos.application import servico as arquivos
from app.modules.arquivos.infra.models import ArquivoModel
from app.modules.documentos.domain import documento as dom
from app.modules.documentos.domain import takeoff as to
from app.modules.documentos.infra import desenho
from app.modules.documentos.infra.models import DocumentoModel, DocumentoRevisaoModel, DocumentoVinculoModel, TakeoffProjetoModel
from app.modules.frentes.infra.models import AreaFrenteModel
from app.modules.referencias.infra.pq_gateway import itens_pq, quantidades_por_tag
from app.modules.wbs.infra import gateway as wbs
from app.shared.errors import DomainError, NotFoundError
from app.shared.memoria import Fonte, Memoria, Passo, num

SITUACOES = ("extraido", "aceito", "descartado")


def _rev(s: Session, obra_id: int, rev_id: int) -> DocumentoRevisaoModel:
    r = s.get(DocumentoRevisaoModel, rev_id)
    if r is None or r.obra_id != obra_id:
        raise NotFoundError("revisão", rev_id)
    return r


def _revs_do_doc(s: Session, doc_id: int) -> list[DocumentoRevisaoModel]:
    revs = list(s.scalars(select(DocumentoRevisaoModel).where(DocumentoRevisaoModel.documento_id == doc_id)))
    return sorted(revs, key=lambda r: dom.chave_revisao(r.revisao))


def _memoria(e: to.Extraida, d: DocumentoModel, r: DocumentoRevisaoModel) -> dict:
    origem = f"{d.codigo} rev. {r.revisao}"
    return Memoria(chave="projeto", titulo=e.descricao, valor=f"{num(e.quantidade)} {e.unidade}", formula=e.formula,
                   passos=tuple(Passo(*p) for p in e.passos),
                   fontes=tuple(Fonte(dado, valor, origem, local) for dado, valor, local in e.fontes),
                   notas=e.avisos).como_dict()


def _area_do_documento(s: Session, obra_id: int, doc_id: int) -> int | None:
    areas = {v.alvo_id for v in s.scalars(select(DocumentoVinculoModel).where(
        DocumentoVinculoModel.obra_id == obra_id, DocumentoVinculoModel.documento_id == doc_id,
        DocumentoVinculoModel.alvo_tipo == "area"))}
    return next(iter(areas)) if len(areas) == 1 else None


def extrair(s: Session, obra_id: int, rev_id: int, dxf: bytes | None = None) -> int:
    """Lê o desenho da revisão e grava as quantidades. Rodar de novo atualiza os números e mantém as decisões."""
    r = _rev(s, obra_id, rev_id)
    d = s.get(DocumentoModel, r.documento_id)
    if dxf is None:
        if not r.dxf_arquivo_id:
            raise DomainError("esta revisão não tem desenho em DXF/DWG para ler as quantidades", "revisao")
        a = s.get(ArquivoModel, r.dxf_arquivo_id)
        dxf = arquivos.abrir(s, a)
    textos, medidas, blocos, insunits = desenho.levantar(dxf)
    extraidas = to.extrair(textos, medidas, blocos, insunits)
    revs = _revs_do_doc(s, d.id)
    anteriores = [x.id for x in revs if dom.chave_revisao(x.revisao) < dom.chave_revisao(r.revisao)]
    herdar: dict[str, TakeoffProjetoModel] = {}
    if anteriores:  # decisões da revisão anterior mais nova que tenha levantamento
        for rid in reversed(anteriores):
            linhas = list(s.scalars(select(TakeoffProjetoModel).where(TakeoffProjetoModel.revisao_id == rid)))
            if linhas:
                herdar = {x.chave: x for x in linhas}
                break
    atuais = {x.chave: x for x in s.scalars(select(TakeoffProjetoModel).where(TakeoffProjetoModel.revisao_id == r.id))}
    pq = [(i.item, i.descricao, i.unid) for i in itens_pq(s, obra_id).values() if i.folha]
    area_padrao = _area_do_documento(s, obra_id, d.id)
    vistos = set()
    for e in extraidas:
        vistos.add(e.chave)
        x = atuais.get(e.chave)
        if x is None:
            h = herdar.get(e.chave)
            x = TakeoffProjetoModel(obra_id=obra_id, documento_id=d.id, revisao_id=r.id, chave=e.chave[:200],
                                    item_pq=h.item_pq if h else None, area_id=h.area_id if h else area_padrao,
                                    fator=h.fator if h else 1.0, situacao="extraido" if not h or h.situacao == "aceito" else h.situacao)
            s.add(x)
        x.origem, x.descricao, x.quantidade, x.unidade = e.origem, e.descricao[:300], float(e.quantidade), e.unidade[:20]
        x.memoria, x.avisos, x.confere = _memoria(e, d, r), list(e.avisos) or None, e.confere
        x.item_sugerido = to.sugerir_item(e.descricao, e.unidade, pq) if e.origem in ("quadro", "anotacao") else None
    for chave, x in atuais.items():
        if chave not in vistos:
            s.delete(x)
    s.flush()
    return len(extraidas)


def _quantidade_final(x: TakeoffProjetoModel) -> float:
    return round(x.quantidade * (x.fator or 1.0), 4)


def listar(s: Session, obra_id: int, documento_id: int | None = None) -> dict:
    q = select(TakeoffProjetoModel).where(TakeoffProjetoModel.obra_id == obra_id)
    if documento_id:
        q = q.where(TakeoffProjetoModel.documento_id == documento_id)
    linhas = list(s.scalars(q))
    docs = {d.id: d for d in s.scalars(select(DocumentoModel).where(DocumentoModel.id.in_({x.documento_id for x in linhas} or {0})))}
    revs_por_doc = {did: _revs_do_doc(s, did) for did in docs}
    situacao: dict[int, str] = {}
    rev_obj: dict[int, DocumentoRevisaoModel] = {}
    anterior_de: dict[int, int | None] = {}
    com_linhas = {x.revisao_id for x in linhas}
    for did, revs in revs_por_doc.items():
        info = [dom.RevisaoInfo(r.id, r.revisao, r.finalidade) for r in revs]
        ultimo = None
        for r in revs:
            rev_obj[r.id] = r
            situacao[r.id] = dom.situacao(next(i for i in info if i.id == r.id), info)
            if r.id in com_linhas:
                anterior_de[r.id] = ultimo
                ultimo = r.id
    por_rev_chave = {(x.revisao_id, x.chave): x for x in linhas}
    areas = {a.id: a for a in s.scalars(select(AreaFrenteModel).where(AreaFrenteModel.obra_id == obra_id))}
    itens = {x.item_pq for x in linhas if x.item_pq} | {x.item_sugerido for x in linhas if x.item_sugerido}
    pq = itens_pq(s, obra_id, itens)
    saida = []
    origem_ordem = {"quadro": 0, "anotacao": 1, "camada": 2, "bloco": 3}
    for x in sorted(linhas, key=lambda x: (docs[x.documento_id].codigo, dom.chave_revisao(rev_obj[x.revisao_id].revisao),
                                           origem_ordem.get(x.origem, 9), to.ordem_natural(x.chave))):
        r, d = rev_obj[x.revisao_id], docs[x.documento_id]
        ant_id = anterior_de.get(r.id)
        ant = por_rev_chave.get((ant_id, x.chave)) if ant_id else None
        info = pq.get(x.item_pq) if x.item_pq else None
        sug = pq.get(x.item_sugerido) if x.item_sugerido else None
        saida.append({
            "id": x.id, "documento_id": d.id, "documento": d.codigo, "titulo": d.titulo, "revisao_id": r.id, "revisao": r.revisao,
            "situacao_revisao": situacao.get(r.id), "origem": x.origem, "chave": x.chave, "descricao": x.descricao,
            "quantidade": x.quantidade, "unidade": x.unidade, "fator": x.fator, "quantidade_final": _quantidade_final(x),
            "memoria": x.memoria, "avisos": x.avisos or [], "confere": x.confere, "situacao": x.situacao,
            "item_pq": x.item_pq, "item_descricao": info.descricao if info else None, "item_unid": info.unid if info else None,
            "item_sugerido": x.item_sugerido, "sugerido_descricao": sug.descricao if sug else None,
            "area_id": x.area_id, "area": (areas[x.area_id].descricao if x.area_id in areas else None),
            "anterior": ({"revisao": rev_obj[ant_id].revisao, "quantidade": ant.quantidade} if ant else None),
            "delta": to.delta(x.quantidade, ant.quantidade) if ant else None, "nova": bool(ant_id) and ant is None,
            "wbs_no_id": x.wbs_no_id, "decidido_por": x.decidido_por,
        })
    return {"linhas": saida, "comparacao": comparacao(s, obra_id, linhas, situacao, docs, rev_obj, areas)}


def comparacao(s: Session, obra_id: int, linhas: list[TakeoffProjetoModel], situacao: dict[int, str],
               docs: dict[int, DocumentoModel], rev_obj: dict[int, DocumentoRevisaoModel], areas: dict[int, AreaFrenteModel]) -> list[dict]:
    """Por item da PQ × frente: projeto (aceitas das vigentes) × take-off da planilha (TAG) × IWP — cada um com memória."""
    grupos: dict[tuple[str, int], list[TakeoffProjetoModel]] = {}
    for x in linhas:
        if x.situacao == "aceito" and x.item_pq and x.area_id and situacao.get(x.revisao_id) == "vigente":
            grupos.setdefault((x.item_pq, x.area_id), []).append(x)
    if not grupos:
        return []
    pq = itens_pq(s, obra_id, {i for i, _ in grupos})
    tk = quantidades_por_tag(s, obra_id, {i for i, _ in grupos})
    out = []
    for (item, area_id), xs in sorted(grupos.items()):
        a = areas.get(area_id)
        info = pq.get(item)
        projeto = round(sum(_quantidade_final(x) for x in xs), 4)
        planilha = tk.get((item, a.tag)) if a and a.tag else None
        iwps = wbs.iwps_do_item(s, obra_id, area_id, item)
        no_iwp = sum(i.quantidade or 0 for i in iwps) if iwps and any(i.quantidade is not None for i in iwps) else None
        un = info.unid if info else xs[0].unidade
        mem_proj = Memoria(
            chave="projeto", titulo=f"Projeto · PQ {item} · {a.descricao if a else area_id}", valor=f"{num(projeto)} {un}",
            formula="Σ quantidade do desenho × fator, só das revisões vigentes e aceitas",
            passos=tuple(Passo(f"{docs[x.documento_id].codigo} rev. {rev_obj[x.revisao_id].revisao} · {x.chave}",
                               f"{num(x.quantidade)} × {num(x.fator, 4)}", f"{num(_quantidade_final(x))} {un}") for x in xs),
            fontes=tuple(Fonte(x.chave, f"{num(x.quantidade)} {x.unidade}", f"{docs[x.documento_id].codigo} rev. {rev_obj[x.revisao_id].revisao}",
                               "levantamento do desenho") for x in xs)).como_dict()
        mem_plan = Memoria(chave="planilha", titulo=f"Take-off da planilha · PQ {item}", valor=f"{num(planilha)} {un}" if planilha is not None else "—",
                           formula="quantidade do item na TAG da frente (aba MC da PQ vigente)",
                           fontes=(Fonte("TAG da frente", a.tag if a and a.tag else "sem TAG", "Frentes", a.descricao if a else None),
                                   Fonte("quantidade", num(planilha), "PQ vigente · aba MC", f"item {item}"),)).como_dict()
        diferenca = round(projeto - planilha, 4) if planilha is not None else None
        out.append({"item_pq": item, "item_descricao": info.descricao if info else None, "unidade": un, "area_id": area_id,
                    "area": a.descricao if a else None, "tag": a.tag if a else None, "projeto": projeto, "planilha": planilha,
                    "iwp": no_iwp, "diferenca": diferenca,
                    "diferenca_pct": round(diferenca / planilha * 100, 1) if diferenca is not None and planilha else None,
                    "iwps": [{"id": i.id, "codigo": i.codigo, "quantidade": i.quantidade, "tem_etapas": i.tem_etapas} for i in iwps],
                    "linhas": [x.id for x in xs], "memorias": {"projeto": mem_proj, "planilha": mem_plan}})
    return out


def decidir(s: Session, obra_id: int, tid: int, por: str, *, situacao: str | None = None, item_pq: str | None = None,
            area_id: int | None = None, fator: float | None = None, campos: set[str] | None = None) -> None:
    x = s.get(TakeoffProjetoModel, tid)
    if x is None or x.obra_id != obra_id:
        raise NotFoundError("quantidade do projeto", tid)
    campos = campos or set()
    if "item_pq" in campos:
        info = itens_pq(s, obra_id, {item_pq}).get(item_pq) if item_pq else None
        if item_pq and info is None:
            raise DomainError(f"item {item_pq} não está na PQ vigente", "item_pq")
        if info and x.origem in ("quadro", "anotacao"):  # camada e bloco: o planejador informa o fator
            f = to.fator_de_conversao(x.unidade, info.unid)
            if f is None:
                raise DomainError(f"o desenho está em {x.unidade} e o item {item_pq} em {info.unid}: escolha um item na mesma unidade", "item_pq")
            x.fator = f
        elif not item_pq and x.origem in ("quadro", "anotacao"):
            x.fator = 1.0
        x.item_pq = item_pq or None
    if "area_id" in campos:
        if area_id:
            a = s.get(AreaFrenteModel, area_id)
            if a is None or a.obra_id != obra_id:
                raise NotFoundError("frente", area_id)
        x.area_id = area_id or None
    if "fator" in campos:
        if fator is None or fator <= 0:
            raise DomainError("fator precisa ser maior que zero (ex.: 0,01 para cm → m)", "fator")
        x.fator = float(fator)
    if situacao is not None:
        if situacao not in SITUACOES:
            raise DomainError("situação: extraido, aceito ou descartado", "situacao")
        if situacao == "aceito" and not x.item_pq:
            raise DomainError("escolha o item da PQ antes de aceitar", "item_pq")
        x.situacao = situacao
    x.decidido_por, x.decidido_em = por, datetime.now(timezone.utc)


def usar_no_iwp(s: Session, obra_id: int, item_pq: str, area_id: int, por: str, iwp_id: int | None = None) -> dict:
    """Leva o total do projeto (aceitas das vigentes) para a quantidade do IWP da frente com o item, com a origem anotada."""
    linhas = list(s.scalars(select(TakeoffProjetoModel).where(
        TakeoffProjetoModel.obra_id == obra_id, TakeoffProjetoModel.item_pq == item_pq,
        TakeoffProjetoModel.area_id == area_id, TakeoffProjetoModel.situacao == "aceito")))
    docs = {d.id: d for d in s.scalars(select(DocumentoModel).where(DocumentoModel.id.in_({x.documento_id for x in linhas} or {0})))}
    vigentes = set()
    rev_txt: dict[int, str] = {}
    for did in docs:
        revs = _revs_do_doc(s, did)
        v = dom.vigente([dom.RevisaoInfo(r.id, r.revisao, r.finalidade) for r in revs])
        if v:
            vigentes.add(v)
        rev_txt.update({r.id: r.revisao for r in revs})
    validas = [x for x in linhas if x.revisao_id in vigentes]
    if not validas:
        raise DomainError("nenhuma quantidade aceita de revisão vigente para este item e frente", "item_pq")
    iwps = wbs.iwps_do_item(s, obra_id, area_id, item_pq)
    if iwp_id:
        iwps = [i for i in iwps if i.id == iwp_id]
    if not iwps:
        raise DomainError(f"não há IWP na WBS para o item {item_pq} nesta frente: crie o IWP e tente de novo", "iwp")
    if len(iwps) > 1:
        raise DomainError("há mais de um IWP com este item na frente: escolha qual recebe a quantidade", "iwp")
    total = round(sum(_quantidade_final(x) for x in validas), 4)
    origem = ", ".join(sorted({f"{docs[x.documento_id].codigo} rev. {rev_txt.get(x.revisao_id)}" for x in validas}))
    wbs.definir_quantidade_iwp(s, obra_id, iwps[0].id, total, f"take-off do projeto: {origem}")
    for x in validas:
        x.wbs_no_id = iwps[0].id
        x.decidido_por, x.decidido_em = por, datetime.now(timezone.utc)
    return {"iwp_id": iwps[0].id, "codigo": iwps[0].codigo, "quantidade": total, "origem": origem}
