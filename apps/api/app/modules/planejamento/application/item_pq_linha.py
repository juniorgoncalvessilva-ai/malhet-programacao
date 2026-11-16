"""Trocar o item da PQ de uma linha da programação (spec 099), inclusive depois de emitida.

A linha mede no tipo do Catálogo (tipo = item da PQ): trocar o item é trocar o tipo — o do item novo, ou um tipo novo no
mesmo grupo quando o item ainda não está no Catálogo — e refazer o complemento (código Simova) no tipo novo. A revisão
já emitida continua como foi impressa (a foto não muda); a correção sai na próxima revisão. Programação concluída só
muda depois de "Revisar" (com motivo). Com IWP da WBS, o IWP também pode ser corrigido, e com ele as linhas das outras
programações abertas daquele IWP.
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.catalogo.api.router import _novo_tipo, obter_ou_criar_item
from app.modules.catalogo.domain import catalogo as cat
from app.modules.catalogo.infra.models import GrupoAtividadeModel, ItemSimovaModel, TipoAtividadeModel
from app.modules.planejamento.infra.models import LinhaProgramacaoModel, ProgramacaoModel
from app.modules.referencias.infra.pq_gateway import itens_pq
from app.modules.wbs.infra.models import WbsNoModel
from app.shared.errors import DomainError, NotFoundError


def _aplicar(s: Session, obra_id: int, ln: LinhaProgramacaoModel, t: TipoAtividadeModel) -> str | None:
    """Põe a linha no tipo novo; o complemento (texto do Simova) é refeito no tipo novo."""
    aviso, novo_item = None, None
    if ln.item_simova_id:
        velho = s.get(ItemSimovaModel, ln.item_simova_id)
        if velho is not None and velho.complemento:
            item, _, aviso = obter_ou_criar_item(s, obra_id, t, velho.complemento, t.item_pq)
            novo_item = item.id
    ln.tipo_id, ln.item_pq, ln.item_simova_id = t.id, t.item_pq, novo_item
    return aviso


def trocar_item_pq(s: Session, obra_id: int, p: ProgramacaoModel, lid: int, item: str, tambem_na_wbs: bool) -> dict:
    if p.status == "concluida":
        raise DomainError("programação concluída: clique em Revisar (com o motivo) para trocar o item da PQ")
    ln = next((x for x in p.linhas if x.id == lid), None)
    if ln is None:
        raise NotFoundError("Linha", lid)
    item = (item or "").strip()
    info = itens_pq(s, obra_id, {item}).get(item)
    if info is None:
        raise DomainError(f"o item {item or '(vazio)'} não está na PQ vigente", "item_pq")
    if not info.folha:
        raise DomainError(f"{item} é um título da PQ: escolha um item com unidade", "item_pq")
    if ln.item_pq == item:
        raise DomainError(f"a linha já está no item {item}", "item_pq")
    atual = s.get(TipoAtividadeModel, ln.tipo_id)
    t = s.scalar(select(TipoAtividadeModel).where(TipoAtividadeModel.obra_id == obra_id, TipoAtividadeModel.item_pq == item))
    tipo_criado = None
    if t is None:  # item fora do Catálogo: entra no mesmo grupo da atividade atual
        g = s.get(GrupoAtividadeModel, atual.grupo_id)
        t = _novo_tipo(s, obra_id, g, item, None, None)
        tipo_criado = cat.codigo_tipo(g.numero, t.numero)
    antes = ln.item_pq
    avisos = [a for a in [_aplicar(s, obra_id, ln, t)] if a]

    na_wbs, outras = False, 0
    if tambem_na_wbs and ln.wbs_no_id:
        n = s.get(WbsNoModel, ln.wbs_no_id)
        iwp = n if n is not None and n.tipo == "iwp" else (s.get(WbsNoModel, n.pai_id) if n is not None and n.tipo == "etapa" else None)
        if iwp is not None and iwp.obra_id == obra_id:
            grupo_no = s.get(WbsNoModel, iwp.pai_id)
            irmaos = s.scalars(select(WbsNoModel).where(WbsNoModel.pai_id == iwp.pai_id, WbsNoModel.id != iwp.id,
                                                        WbsNoModel.tipo == "iwp"))
            if grupo_no is None or grupo_no.grupo_id != t.grupo_id:
                avisos.append(f"na WBS o IWP continua no item {antes}: o item {item} é de outro grupo do Catálogo — "
                              "corrija na WBS (ou vincule o item ao grupo do IWP)")
            elif any(x.tipo_atividade_id == t.id for x in irmaos):
                avisos.append(f"na WBS já existe um IWP do item {item} neste grupo — corrija na WBS")
            else:
                iwp.tipo_atividade_id, iwp.item_pq = t.id, item
                na_wbs = True
                nos = {iwp.id, *s.scalars(select(WbsNoModel.id).where(WbsNoModel.pai_id == iwp.id))}
                q = (select(LinhaProgramacaoModel).join(ProgramacaoModel, ProgramacaoModel.id == LinhaProgramacaoModel.programacao_id)
                     .where(ProgramacaoModel.obra_id == obra_id, ProgramacaoModel.status != "concluida",
                            LinhaProgramacaoModel.wbs_no_id.in_(nos), LinhaProgramacaoModel.id != ln.id))
                for outra in s.scalars(q):
                    if outra.item_pq != item:
                        aviso = _aplicar(s, obra_id, outra, t)
                        if aviso:
                            avisos.append(aviso)
                        outras += 1
    if ln.etapa_nome:
        avisos.append("linha de etapa do critério de avanço: as etapas vieram do item antigo — confira o critério do "
                      "item novo na WBS")
    s.flush()
    return {"id": ln.id, "antes": antes, "item_pq": item, "descricao": info.descricao, "tipo_criado": tipo_criado,
            "wbs_atualizada": na_wbs, "outras_linhas": outras, "avisos": avisos,
            # emitida: a revisão impressa não muda; a correção vale a partir da próxima
            "precisa_nova_revisao": p.status == "emitida", "proxima_revisao": p.revisao}
