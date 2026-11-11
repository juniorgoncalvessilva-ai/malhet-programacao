"""Linguagem publicada da PQ vigente para outros módulos (catálogo, programação)."""
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.referencias.infra.models import ItemPqModel, NomeSimplificadoPqModel, VersaoReferenciaModel


@dataclass(frozen=True)
class ItemPqInfo:
    item: str
    descricao: str
    unid: str | None
    quantidade: float | None
    pu: float | None
    folha: bool
    nome_simplificado: str | None = None

    @property
    def texto_simova(self) -> str:
        """Texto do tipo no Simova: o nome simplificado, senão a descrição da PQ."""
        return self.nome_simplificado or self.descricao


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
    nomes = nomes_simplificados(s, obra_id)
    return {x.item: ItemPqInfo(x.item, x.descricao, x.unid, x.quantidade, x.pu, x.folha, nomes.get(x.item))
            for x in s.scalars(q)}


def nomes_simplificados(s: Session, obra_id: int) -> dict[str, str]:
    return {m.item: m.nome for m in s.scalars(select(NomeSimplificadoPqModel)
                                              .where(NomeSimplificadoPqModel.obra_id == obra_id))}


def salvar_nome_simplificado(s: Session, obra_id: int, item: str, nome: str | None) -> None:
    """Grava (ou apaga, se vazio) o nome simplificado do item da PQ."""
    m = s.scalar(select(NomeSimplificadoPqModel).where(NomeSimplificadoPqModel.obra_id == obra_id,
                                                       NomeSimplificadoPqModel.item == item))
    if not nome:
        if m is not None:
            s.delete(m)
        return
    if m is None:
        s.add(NomeSimplificadoPqModel(obra_id=obra_id, item=item, nome=nome))
    else:
        m.nome = nome


def tags_do_takeoff(s: Session, obra_id: int) -> set[str]:
    """TAGs que têm quantidade no take-off (aba MC) da PQ vigente."""
    from app.modules.referencias.infra.models import PqQuantidadeTagModel

    vid = versao_pq_vigente(s, obra_id)
    if vid is None:
        return set()
    return set(s.scalars(select(PqQuantidadeTagModel.tag).where(PqQuantidadeTagModel.versao_id == vid).distinct()))


def quantidades_por_tag(s: Session, obra_id: int, itens: set[str]) -> dict[tuple[str, str], float]:
    """(item, TAG) → quantidade do take-off (aba MC) na PQ vigente."""
    from app.modules.referencias.infra.models import PqQuantidadeTagModel

    vid = versao_pq_vigente(s, obra_id)
    if vid is None or not itens:
        return {}
    out: dict[tuple[str, str], float] = {}
    for x in s.scalars(select(PqQuantidadeTagModel).where(PqQuantidadeTagModel.versao_id == vid,
                                                          PqQuantidadeTagModel.item.in_(itens))):
        out[(x.item, x.tag)] = out.get((x.item, x.tag), 0.0) + float(x.quantidade or 0)
    return out
