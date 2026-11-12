"""WBS de execução ↔ Primavera: áreas das Frentes entram na WBS, e o que foi criado aqui volta para o .xer.

- `garantir_areas`: toda área ativa das Frentes tem o nó de área na WBS (chamado ao criar/importar frentes).
- `exportar_xer`: recebe o .xer atual do cronograma e devolve o mesmo arquivo com a WBS de execução acrescentada
  (área → nível "CWA 004.07 - …", CWP → nível abaixo da área, IWP → atividade com o texto do item da PQ). Os
  códigos WBS e os Activity IDs criados ficam gravados nos nós; quando o cronograma atualizado for importado, a
  sincronização casa por eles e nada se perde nem duplica.
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.frentes.infra.models import AreaFrenteModel
from app.modules.referencias.infra.pq_gateway import itens_pq
from app.modules.wbs.domain import wbs as dom
from app.modules.wbs.domain.xer import EstruturaP6, Xer, nome_area
from app.modules.wbs.infra.models import WbsNoModel
from app.shared.errors import DomainError

PREFIXO_ATIVIDADE = "EXE-"


def garantir_areas(s: Session, obra_id: int) -> int:
    """Cria o nó de área para cada área ativa das Frentes que ainda não está na WBS. Devolve quantos criou."""
    tem = set(s.scalars(select(WbsNoModel.area_id).where(WbsNoModel.obra_id == obra_id, WbsNoModel.tipo == "area")))
    areas = list(s.scalars(select(AreaFrenteModel).where(AreaFrenteModel.obra_id == obra_id, AreaFrenteModel.ativo.is_(True))
                           .order_by(AreaFrenteModel.cwa, AreaFrenteModel.codigo)))
    seq = max(s.scalars(select(WbsNoModel.seq).where(WbsNoModel.obra_id == obra_id, WbsNoModel.pai_id.is_(None))), default=0)
    n = 0
    for a in areas:
        if a.id in tem:
            continue
        seq += 1
        s.add(WbsNoModel(obra_id=obra_id, pai_id=None, tipo="area", area_id=a.id, seq=seq, origem="manual"))
        n += 1
    if n:
        s.flush()
    return n


def tirar_area(s: Session, obra_id: int, area_id: int) -> None:
    """Antes de excluir a área nas Frentes: o nó dela sai da WBS se estiver vazio; com CWPs abaixo, não deixa."""
    for n in s.scalars(select(WbsNoModel).where(WbsNoModel.obra_id == obra_id, WbsNoModel.area_id == area_id)):
        if s.scalar(select(WbsNoModel.id).where(WbsNoModel.pai_id == n.id).limit(1)):
            raise DomainError("a área tem CWPs na WBS de execução: desative em vez de excluir")
        s.delete(n)
    s.flush()


def area_tem_wbs(s: Session, obra_id: int, area_id: int) -> bool:
    """A área tem algo abaixo dela na WBS (não pode sair junto com as frentes)."""
    no = s.scalar(select(WbsNoModel.id).where(WbsNoModel.obra_id == obra_id, WbsNoModel.area_id == area_id))
    return bool(no and s.scalar(select(WbsNoModel.id).where(WbsNoModel.pai_id == no).limit(1)))


def exportar_xer(s: Session, obra_id: int, conteudo: bytes) -> tuple[bytes, dict]:
    xer = Xer.ler(conteudo)
    p6 = EstruturaP6(xer)
    garantir_areas(s, obra_id)
    sem_codigo = s.scalar(select(WbsNoModel.id).where(WbsNoModel.obra_id == obra_id, WbsNoModel.origem == "p6",
                                                      WbsNoModel.tipo.in_(("area", "cwp")), WbsNoModel.codigo_p6.is_(None)).limit(1))
    if sem_codigo:  # WBS trazida do P6 antes do código WBS existir: carimba pela sincronização
        from app.modules.wbs.application.sincronizar_cronograma import sincronizar

        sincronizar(s, obra_id)
    nos = list(s.scalars(select(WbsNoModel).where(WbsNoModel.obra_id == obra_id, WbsNoModel.ativo.is_(True))))
    filhos: dict[int, list[WbsNoModel]] = {}
    for n in nos:
        if n.pai_id:
            filhos.setdefault(n.pai_id, []).append(n)
    areas = {a.id: a for a in s.scalars(select(AreaFrenteModel).where(AreaFrenteModel.obra_id == obra_id))}
    r = {"projeto": p6.projeto, "areas_no_p6": 0, "areas_novas": [], "cwps_novos": [], "atividades_novas": [],
         "iwps_sem_descricao": 0}
    pq = itens_pq(s, obra_id, {n.item_pq for n in nos if n.tipo == "iwp" and n.item_pq})

    def ordem(n: WbsNoModel):
        return (n.seq, n.id)

    raizes = sorted([n for n in nos if n.tipo == "area" and n.pai_id is None],
                    key=lambda n: (areas[n.area_id].cwa if n.area_id in areas else "", areas[n.area_id].codigo if n.area_id in areas else ""))
    for an in raizes:
        a = areas.get(an.area_id)
        if a is None or not a.ativo:
            continue
        # área: já está no P6 (pelo código gravado ou pelo CWA no nome do nível) ou entra agora
        if an.codigo_p6 and an.codigo_p6 in p6.por_codigo:
            r["areas_no_p6"] += 1
        elif (achado := p6.achar_area(a.cwa, a.ativo_codigo)) is not None:
            an.codigo_p6 = achado
            r["areas_no_p6"] += 1
        elif an.origem == "p6":  # veio do P6 e saiu de lá: não volta
            continue
        else:
            pai = p6.pai_da_area(a.cwa)
            curto = an.codigo_p6.rsplit(".", 1)[-1] if an.codigo_p6 and an.codigo_p6.rsplit(".", 1)[0] == pai else None
            an.codigo_p6 = p6.nova_wbs(xer, pai, nome_area(a.cwa, a.ativo_codigo, a.descricao), curto)
            r["areas_novas"].append(an.codigo_p6)
        for cwp in sorted(filhos.get(an.id, []), key=ordem):
            if cwp.tipo != "cwp":
                continue
            if cwp.codigo_p6 and cwp.codigo_p6 in p6.por_codigo:
                pass
            elif cwp.origem == "p6":  # saiu do P6: respeita
                continue
            else:
                cwp.codigo_p6 = p6.nova_wbs(xer, an.codigo_p6, dom.texto_cwp(cwp.elemento, cwp.complemento))
                r["cwps_novos"].append(cwp.codigo_p6)
            for g in sorted(filhos.get(cwp.id, []), key=ordem):
                for iwp in sorted(filhos.get(g.id, []), key=ordem):
                    if iwp.tipo != "iwp" or iwp.origem == "p6" or (iwp.id_crono and iwp.id_crono in p6.atividades):
                        continue
                    info = pq.get(iwp.item_pq)
                    if info is None:
                        r["iwps_sem_descricao"] += 1
                        continue
                    iwp.id_crono = iwp.id_crono or f"{PREFIXO_ATIVIDADE}{iwp.id:05d}"
                    # o nome é a descrição do item da PQ: é por ela que a sincronização reconhece o IWP na volta
                    p6.nova_atividade(xer, cwp.codigo_p6, iwp.id_crono, info.descricao)
                    r["atividades_novas"].append(iwp.id_crono)
    s.flush()
    return xer.gerar(), r
