"""Spec 119 — registrar no campo uma atividade que não está na programação: frente (CWA) → IWP da WBS (com CWP e grupo)
ou item da PQ → o que foi feito; as fotos vão por `POST /fotos` com alvo = registro."""
from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, ler, programar
from app.core.db import get_session
from app.modules.campo.domain.registro import validar_registro
from app.modules.campo.infra.models import FotoCampoModel, RegistroAtividadeModel
from app.modules.frentes.infra.models import AreaFrenteModel
from app.modules.obras.domain.obra import PapelObra
from app.shared.errors import DomainError, NotFoundError
from app.shared.tempo import hoje_local

router = APIRouter(prefix="/campo/registros", tags=["campo (mobile)"])


def _area(s: Session, obra_id: int, area_id: int) -> AreaFrenteModel:
    a = s.get(AreaFrenteModel, area_id)
    if a is None or a.obra_id != obra_id:
        raise NotFoundError("Frente", area_id)
    return a


@router.get("/opcoes")
def opcoes(area_id: int, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """O que dá para escolher na frente: os IWPs da WBS (com CWP, grupo e o texto do item da PQ). Sem WBS: lista vazia —
    a tela oferece a busca na PQ."""
    from app.modules.referencias.infra.pq_gateway import itens_pq
    from app.modules.wbs.infra.gateway import itens_da_area

    _area(s, c.obra_id, area_id)
    itens = itens_da_area(s, c.obra_id, area_id)
    pq = itens_pq(s, c.obra_id, {x["item_pq"] for x in itens if x["item_pq"]}) if itens else {}
    for x in itens:
        i = pq.get(x["item_pq"]) if x["item_pq"] else None
        x["descricao"] = i.texto_simova if i else None
        x["descricao_pq"] = i.descricao if i else None
        x["unidade"] = i.unid if i else None
    return {"itens": itens}


class RegistroIn(BaseModel):
    data: date | None = None
    area_id: int
    wbs_no_id: int | None = None
    item_pq: str | None = Field(None, max_length=40)
    descricao: str = Field(max_length=500)


def _out(r: RegistroAtividadeModel, area: AreaFrenteModel | None, fotos: list[int]) -> dict:
    return {"id": r.id, "data": r.data.isoformat(), "area_id": r.area_id,
            "area": f"{area.codigo} · {area.descricao}" if area else None, "wbs_no_id": r.wbs_no_id,
            "item_pq": r.item_pq, "descricao_item": r.descricao_item, "descricao": r.descricao,
            "criado_por": r.criado_por, "criado_em": r.criado_em.isoformat() if r.criado_em else None, "fotos": fotos}


@router.post("", status_code=201)
def registrar(d: RegistroIn, s: Session = Depends(get_session), c: ContextoObra = Depends(programar)):
    from app.modules.referencias.infra.pq_gateway import itens_pq
    from app.modules.wbs.infra.gateway import itens_da_area

    hoje = hoje_local()
    dia = d.data or hoje
    texto = validar_registro(d.descricao, dia, hoje)
    area = _area(s, c.obra_id, d.area_id)
    item_pq, desc_item = (d.item_pq or "").strip() or None, None
    if d.wbs_no_id:  # o IWP tem de ser desta frente; o item da PQ vem dele
        iwp = next((x for x in itens_da_area(s, c.obra_id, area.id) if x["wbs_no_id"] == d.wbs_no_id), None)
        if iwp is None:
            raise DomainError("escolha um item da WBS desta frente", "wbs_no_id")
        item_pq = iwp["item_pq"]
        desc_item = " · ".join(x for x in (iwp["codigo"], iwp["cwp"]) if x)
    if item_pq:
        i = itens_pq(s, c.obra_id, {item_pq}).get(item_pq)
        if i is None:
            raise DomainError(f"item {item_pq} não está na PQ vigente", "item_pq")
        desc_item = " · ".join(x for x in (desc_item, f"{i.item} {i.texto_simova}") if x)
    r = RegistroAtividadeModel(obra_id=c.obra_id, data=dia, area_id=area.id, wbs_no_id=d.wbs_no_id or None,
                               item_pq=item_pq, descricao_item=(desc_item or None) and desc_item[:300], descricao=texto,
                               criado_por=c.usuario.email or c.usuario.id)
    s.add(r)
    s.flush()
    s.refresh(r)
    return _out(r, area, [])


@router.get("")
def listar(data: date | None = None, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Registros do dia (padrão: hoje), mais novos primeiro, com as fotos."""
    dia = data or hoje_local()
    rs = list(s.scalars(select(RegistroAtividadeModel).where(RegistroAtividadeModel.obra_id == c.obra_id,
                                                             RegistroAtividadeModel.data == dia)
                        .order_by(RegistroAtividadeModel.id.desc())))
    areas = {a.id: a for a in s.scalars(select(AreaFrenteModel).where(AreaFrenteModel.id.in_({r.area_id for r in rs} or {0})))}
    fotos: dict[int, list[int]] = {}
    for fid, aid in s.execute(select(FotoCampoModel.id, FotoCampoModel.alvo_id).where(
            FotoCampoModel.obra_id == c.obra_id, FotoCampoModel.alvo == "registro",
            FotoCampoModel.alvo_id.in_({r.id for r in rs} or {0})).order_by(FotoCampoModel.id)):
        fotos.setdefault(aid, []).append(fid)
    return [_out(r, areas.get(r.area_id), fotos.get(r.id, [])) for r in rs]


@router.delete("/{rid}", status_code=204)
def excluir(rid: int, s: Session = Depends(get_session), c: ContextoObra = Depends(programar)):
    """Só sem fotos (a foto do book tem o seu caminho de exclusão, com motivo — spec 112) e por quem registrou ou o
    Planejamento."""
    r = s.get(RegistroAtividadeModel, rid)
    if r is None or r.obra_id != c.obra_id:
        raise NotFoundError("Registro", rid)
    if r.criado_por != (c.usuario.email or c.usuario.id) and not c.papel.pode(PapelObra.PLANEJADOR):
        raise DomainError("só quem registrou (ou o Planejamento) exclui o registro")
    if s.scalar(select(FotoCampoModel.id).where(FotoCampoModel.obra_id == c.obra_id, FotoCampoModel.alvo == "registro",
                                                FotoCampoModel.alvo_id == rid)):
        raise DomainError("o registro tem fotos: exclua as fotos antes")
    s.delete(r)
