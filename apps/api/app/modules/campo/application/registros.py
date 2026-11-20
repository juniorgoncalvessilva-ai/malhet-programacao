"""Spec 119/121 — atividade registrada no campo fora da programação: o mesmo caso de uso para o app (conta do Malhet) e para
o endereço dos encarregados (`/encarregado`, sessão pela matrícula)."""
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.campo.domain.registro import validar_registro
from app.modules.campo.infra.models import FotoCampoModel, RegistroAtividadeModel
from app.modules.frentes.infra.models import AreaFrenteModel, LocalFrenteModel
from app.shared.errors import DomainError, NotFoundError
from app.shared.tempo import hoje_local


def area_da_obra(s: Session, obra_id: int, area_id: int) -> AreaFrenteModel:
    a = s.get(AreaFrenteModel, area_id)
    if a is None or a.obra_id != obra_id:
        raise NotFoundError("Frente", area_id)
    return a


def frentes(s: Session, obra_id: int) -> list[dict]:
    """Frentes (CWA) ativas da obra, com o local, na ordem das Frentes."""
    locais = {x.id: x for x in s.scalars(select(LocalFrenteModel).where(LocalFrenteModel.obra_id == obra_id))}
    out = []
    for a in s.scalars(select(AreaFrenteModel).where(AreaFrenteModel.obra_id == obra_id)):
        if getattr(a, "ativo", True) is False:
            continue
        lc = locais.get(a.local_id)
        out.append({"id": a.id, "codigo": a.codigo, "descricao": a.descricao,
                    "local": f"{lc.codigo} · {lc.descricao}" if lc else None, "_ordem": ((lc.ordem if lc else 0), a.ordem, a.id)})
    out.sort(key=lambda x: x.pop("_ordem"))
    return out


def opcoes(s: Session, obra_id: int, area_id: int) -> list[dict]:
    """IWPs da WBS da frente, com CWP, grupo e o texto do item da PQ. Sem WBS: lista vazia (vale a busca na PQ)."""
    from app.modules.referencias.infra.pq_gateway import itens_pq
    from app.modules.wbs.infra.gateway import itens_da_area

    area_da_obra(s, obra_id, area_id)
    itens = itens_da_area(s, obra_id, area_id)
    pq = itens_pq(s, obra_id, {x["item_pq"] for x in itens if x["item_pq"]}) if itens else {}
    for x in itens:
        i = pq.get(x["item_pq"]) if x["item_pq"] else None
        x["descricao"] = i.texto_simova if i else None
        x["descricao_pq"] = i.descricao if i else None
        x["unidade"] = i.unid if i else None
    return itens


def buscar_pq(s: Session, obra_id: int, q: str, limite: int = 30) -> list[dict]:
    """Itens (folhas) da PQ vigente pelo código ou pela descrição."""
    from sqlalchemy import or_

    from app.modules.referencias.infra.models import ItemPqModel
    from app.modules.referencias.infra.pq_gateway import versao_pq_vigente

    vig = versao_pq_vigente(s, obra_id)
    termo = (q or "").strip()
    if not vig or len(termo) < 2:
        return []
    itens = s.scalars(select(ItemPqModel).where(ItemPqModel.versao_id == vig, ItemPqModel.folha.is_(True),
                                                or_(ItemPqModel.item.ilike(f"{termo}%"), ItemPqModel.descricao.ilike(f"%{termo}%")))
                      .order_by(ItemPqModel.ordem, ItemPqModel.id).limit(min(limite, 60)))
    return [{"item": i.item, "descricao": i.descricao, "unid": i.unid} for i in itens]


def registrar(s: Session, obra_id: int, area_id: int, wbs_no_id: int | None, item_pq: str | None, descricao: str,
              dia: date | None, por: str) -> RegistroAtividadeModel:
    from app.modules.referencias.infra.pq_gateway import itens_pq
    from app.modules.wbs.infra.gateway import itens_da_area

    hoje = hoje_local()
    dia = dia or hoje
    texto = validar_registro(descricao, dia, hoje)
    area = area_da_obra(s, obra_id, area_id)
    item_pq, desc_item = (item_pq or "").strip() or None, None
    if wbs_no_id:  # o IWP tem de ser desta frente; o item da PQ vem dele
        iwp = next((x for x in itens_da_area(s, obra_id, area.id) if x["wbs_no_id"] == wbs_no_id), None)
        if iwp is None:
            raise DomainError("escolha um item da WBS desta frente", "wbs_no_id")
        item_pq = iwp["item_pq"]
        desc_item = " · ".join(x for x in (iwp["codigo"], iwp["cwp"]) if x)
    if item_pq:
        i = itens_pq(s, obra_id, {item_pq}).get(item_pq)
        if i is None:
            raise DomainError(f"item {item_pq} não está na PQ vigente", "item_pq")
        desc_item = " · ".join(x for x in (desc_item, f"{i.item} {i.texto_simova}") if x)
    r = RegistroAtividadeModel(obra_id=obra_id, data=dia, area_id=area.id, wbs_no_id=wbs_no_id or None, item_pq=item_pq,
                               descricao_item=desc_item[:300] if desc_item else None, descricao=texto, criado_por=por[:80])
    s.add(r)
    s.flush()
    s.refresh(r)
    return r


def como_dict(r: RegistroAtividadeModel, area: AreaFrenteModel | None, fotos: list[int]) -> dict:
    return {"id": r.id, "data": r.data.isoformat(), "area_id": r.area_id,
            "area": f"{area.codigo} · {area.descricao}" if area else None, "wbs_no_id": r.wbs_no_id,
            "item_pq": r.item_pq, "descricao_item": r.descricao_item, "descricao": r.descricao,
            "criado_por": r.criado_por, "criado_em": r.criado_em.isoformat() if r.criado_em else None, "fotos": fotos}


def do_dia(s: Session, obra_id: int, dia: date, por: str | None = None) -> list[dict]:
    """Registros do dia (de quem registrou, se `por`), mais novos primeiro, com as fotos."""
    q = select(RegistroAtividadeModel).where(RegistroAtividadeModel.obra_id == obra_id, RegistroAtividadeModel.data == dia)
    if por:
        q = q.where(RegistroAtividadeModel.criado_por == por[:80])
    rs = list(s.scalars(q.order_by(RegistroAtividadeModel.id.desc())))
    areas = {a.id: a for a in s.scalars(select(AreaFrenteModel).where(AreaFrenteModel.id.in_({r.area_id for r in rs} or {0})))}
    fotos: dict[int, list[int]] = {}
    for fid, aid in s.execute(select(FotoCampoModel.id, FotoCampoModel.alvo_id).where(
            FotoCampoModel.obra_id == obra_id, FotoCampoModel.alvo == "registro",
            FotoCampoModel.alvo_id.in_({r.id for r in rs} or {0})).order_by(FotoCampoModel.id)):
        fotos.setdefault(aid, []).append(fid)
    return [como_dict(r, areas.get(r.area_id), fotos.get(r.id, [])) for r in rs]
