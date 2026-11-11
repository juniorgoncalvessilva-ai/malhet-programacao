"""Traz a WBS do cronograma vigente (P6) para a WBS de execução, sem perder nada que já existe.

- Área (CWA das Frentes) → CWP (níveis do P6 abaixo do CWA) → Grupo (do item no Catálogo) → IWP (atividade do P6
  cuja descrição é a de um item da PQ; âncora = código da atividade).
- Roda a cada importação do cronograma: o que já existe é atualizado (casa pela âncora), o que é novo entra, e o que
  sumiu do P6 fica marcado "fora do cronograma" — nunca apagado (programações continuam apontando para ele).
- Nós criados à mão não são tocados.
"""
from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.catalogo.infra.models import TipoAtividadeModel
from app.modules.frentes.infra.models import AreaFrenteModel
from app.modules.referencias.application.importar_takeoff import blocos_por_area, escolher_item
from app.modules.referencias.infra.models import AtividadeCronogramaModel, ItemPqModel, VersaoReferenciaModel
from app.modules.wbs.domain.cronograma import escolher_area, ler_caminho, normalizar_descricao
from app.modules.wbs.infra.models import WbsNoModel


def _vigente(s: Session, obra_id: int, tipo: str) -> int | None:
    return s.scalar(select(VersaoReferenciaModel.id).where(VersaoReferenciaModel.obra_id == obra_id,
                                                           VersaoReferenciaModel.tipo == tipo,
                                                           VersaoReferenciaModel.vigente.is_(True)))


def sincronizar(s: Session, obra_id: int) -> dict:
    vcron = _vigente(s, obra_id, "CRONOGRAMA")
    if vcron is None:
        return {"atividades": 0, "aviso": "sem cronograma vigente"}
    atividades = list(s.scalars(select(AtividadeCronogramaModel).where(AtividadeCronogramaModel.versao_id == vcron)
                                .order_by(AtividadeCronogramaModel.ordem_p6, AtividadeCronogramaModel.id)))
    areas = list(s.scalars(select(AreaFrenteModel).where(AreaFrenteModel.obra_id == obra_id)))
    area_por_id = {a.id: a for a in areas}
    lista_areas = [(a.id, a.cwa, a.ativo_codigo) for a in areas if a.ativo]
    # PQ vigente: descrição → itens (desempate pela área da TAG, como no take-off)
    vpq = _vigente(s, obra_id, "PQ")
    pq = list(s.scalars(select(ItemPqModel).where(ItemPqModel.versao_id == vpq).order_by(ItemPqModel.ordem))) if vpq else []
    por_desc: dict[str, list[str]] = defaultdict(list)
    for x in pq:
        if x.folha:
            por_desc[normalizar_descricao(x.descricao)].append(x.item)
    bloco_da_secao, area_do_bloco = blocos_por_area(
        [{"item": x.item, "nivel": x.nivel, "folha": x.folha, "descricao": x.descricao} for x in pq])
    tipo_do_item = {t.item_pq: t for t in s.scalars(select(TipoAtividadeModel).where(
        TipoAtividadeModel.obra_id == obra_id, TipoAtividadeModel.item_pq.is_not(None)))}

    nos = list(s.scalars(select(WbsNoModel).where(WbsNoModel.obra_id == obra_id)))
    area_no = {n.area_id: n for n in nos if n.tipo == "area"}
    filhos: dict[int, list[WbsNoModel]] = defaultdict(list)
    for n in nos:
        if n.pai_id:
            filhos[n.pai_id].append(n)
    iwp_por_crono = {n.id_crono: n for n in nos if n.tipo == "iwp" and n.id_crono}
    r = {"atividades": len(atividades), "fora_do_ramo_de_construcao": 0, "sem_area": set(), "sem_item_pq": 0,
         "sem_grupo": set(), "atividades_sem_grupo": 0, "areas_novas": 0, "cwps_novos": 0, "grupos_novos": 0, "iwps_novos": 0,
         "iwps_atualizados": 0}
    vistos: set[int] = set()

    def novo(**k) -> WbsNoModel:
        pai = k.get("pai_id")
        irmaos = filhos[pai] if pai else [x for x in area_no.values()]
        n = WbsNoModel(obra_id=obra_id, origem="p6", seq=k.pop("seq", None) or max([x.seq for x in irmaos], default=0) + 1, **k)
        s.add(n)
        s.flush()
        if pai:
            filhos[pai].append(n)
        return n

    for at in atividades:
        cam = ler_caminho([x.get("nome", "") for x in (at.wbs_niveis or [])])
        if cam is None:
            r["fora_do_ramo_de_construcao"] += 1
            continue
        aid = escolher_area(cam.cwa, cam.nome_cwa, lista_areas)
        if aid is None:
            r["sem_area"].add(cam.cwa)
            continue
        an = area_no.get(aid)
        if an is None:
            an = novo(tipo="area", area_id=aid, pai_id=None)
            area_no[aid] = an
            r["areas_novas"] += 1
        vistos.add(an.id)
        # CWP: pela âncora do caminho; um CWP manual com o mesmo texto é adotado
        cwp = next((x for x in filhos[an.id] if x.tipo == "cwp" and x.chave_p6 == cam.chave), None) or next(
            (x for x in filhos[an.id] if x.tipo == "cwp" and not x.chave_p6
             and normalizar_descricao(x.elemento) == normalizar_descricao(cam.elemento)
             and normalizar_descricao(x.complemento) == normalizar_descricao(cam.complemento)), None)
        if cwp is None:
            cwp = novo(tipo="cwp", pai_id=an.id, elemento=cam.elemento, complemento=cam.complemento, chave_p6=cam.chave)
            r["cwps_novos"] += 1
        else:
            cwp.chave_p6 = cam.chave
            if cwp.origem == "p6":
                cwp.elemento, cwp.complemento = cam.elemento, cam.complemento
        vistos.add(cwp.id)
        # IWP: item da PQ pela descrição da atividade
        area = area_por_id[aid]
        item = escolher_item(por_desc.get(normalizar_descricao(at.atividade), []), area.tag or area.ativo_codigo or "",
                             bloco_da_secao, area_do_bloco)
        if item is None:
            r["sem_item_pq"] += 1
            continue
        t = tipo_do_item.get(item)
        if t is None:
            r["sem_grupo"].add(item)
            r["atividades_sem_grupo"] += 1
            continue
        gn = next((x for x in filhos[cwp.id] if x.tipo == "grupo" and x.grupo_id == t.grupo_id), None)
        if gn is None:
            from app.modules.catalogo.infra.models import GrupoAtividadeModel

            g = s.get(GrupoAtividadeModel, t.grupo_id)
            gn = novo(tipo="grupo", pai_id=cwp.id, grupo_id=t.grupo_id, seq=g.numero if g else None)
            r["grupos_novos"] += 1
        vistos.add(gn.id)
        iwp = iwp_por_crono.get(at.id_crono)
        if iwp is None:
            iwp = novo(tipo="iwp", pai_id=gn.id, tipo_atividade_id=t.id, item_pq=item, id_crono=at.id_crono)
            iwp_por_crono[at.id_crono] = iwp
            r["iwps_novos"] += 1
        else:
            if iwp.pai_id != gn.id:  # mudou de lugar no P6: acompanha
                filhos[iwp.pai_id] = [x for x in filhos[iwp.pai_id] if x.id != iwp.id]
                iwp.pai_id = gn.id
                filhos[gn.id].append(iwp)
            iwp.tipo_atividade_id, iwp.item_pq = t.id, item
            r["iwps_atualizados"] += 1
        vistos.add(iwp.id)
    # o que veio do P6 e não está mais no cronograma vigente fica marcado (não apaga)
    fora = 0
    for n in s.scalars(select(WbsNoModel).where(WbsNoModel.obra_id == obra_id, WbsNoModel.origem == "p6")):
        n.fora_cronograma = n.id not in vistos
        fora += n.fora_cronograma
    s.flush()
    r["fora_do_cronograma"] = fora
    r["sem_area"] = sorted(r["sem_area"])
    r["itens_sem_grupo"] = len(r["sem_grupo"])
    r["sem_grupo"] = sorted(r["sem_grupo"])[:200]
    return r
