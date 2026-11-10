"""Linguagem publicada da PQ vigente para outros módulos (catálogo, programação)."""
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.referencias.infra.models import ItemPqModel, VersaoReferenciaModel


@dataclass(frozen=True)
class ItemPqInfo:
    item: str
    descricao: str
    unid: str | None
    quantidade: float | None
    pu: float | None
    folha: bool


def versao_pq_vigente(s: Session, obra_id: int) -> int | None:
    return s.scalar(select(VersaoReferenciaModel.id).where(
        VersaoReferenciaModel.obra_id == obra_id, VersaoReferenciaModel.tipo == "PQ",
        VersaoReferenciaModel.vigente.is_(True)))


def itens_pq(s: Session, obra_id: int, codigos: set[str] | None = None) -> dict[str, ItemPqInfo]:
    vid = versao_pq_vigente(s, obra_id)
    if vid is None or codigos == set():
        return {}
    q = select(ItemPqModel).where(ItemPqModel.versao_id == vid)
    if codigos is not None:
        q = q.where(ItemPqModel.item.in_(codigos))
    return {x.item: ItemPqInfo(x.item, x.descricao, x.unid, x.quantidade, x.pu, x.folha) for x in s.scalars(q)}
