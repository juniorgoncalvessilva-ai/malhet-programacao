"""Resolve um vínculo contra as versões VIGENTES de cronograma, PQ, CPU e índices."""
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.referencias.domain import indice as ind
from app.modules.referencias.infra.models import (
    AtividadeCronogramaModel,
    CpuRecursoModel,
    IndiceEspecificoModel,
    ItemPqModel,
    VersaoReferenciaModel,
    VinculoReferenciaModel,
)

JORNADA_REFERENCIA = 9.0


@dataclass(frozen=True)
class VinculoResolvido:
    vinculo_id: int
    id_crono: str | None
    atividade: str | None
    item_pq: str | None
    descricao_pq: str | None
    composicao: str | None
    unid: str | None
    qtd: float | None
    recurso_governa: str | None
    indice_orcado_un_dia: float | None
    indice_especifico: str | None
    hh_por_unidade: float | None
    pendencias: tuple[str, ...]


class ResolvedorReferencias:
    def __init__(self, session: Session, obra_id: int, jornada: float = JORNADA_REFERENCIA):
        self.s = session
        self.obra_id = obra_id
        self.jornada = jornada

    def versoes_vigentes(self) -> dict[str, int]:
        q = select(VersaoReferenciaModel.tipo, VersaoReferenciaModel.id).where(
            VersaoReferenciaModel.obra_id == self.obra_id, VersaoReferenciaModel.vigente.is_(True))
        return {t: i for t, i in self.s.execute(q)}

    def vinculo_da_oper(self, grupo: str, oper: str, vinculo_id: int | None = None) -> VinculoReferenciaModel | None:
        if vinculo_id:
            v = self.s.get(VinculoReferenciaModel, vinculo_id)
            return v if v is not None and v.obra_id == self.obra_id else None
        return self.s.scalar(
            select(VinculoReferenciaModel)
            .where(
                VinculoReferenciaModel.obra_id == self.obra_id,
                VinculoReferenciaModel.simova_grupo_codigo == grupo,
                VinculoReferenciaModel.simova_oper_codigo == oper,
                VinculoReferenciaModel.ativo.is_(True),
            )
            .order_by(VinculoReferenciaModel.id)
            .limit(1)
        )

    def resolver(self, v: VinculoReferenciaModel) -> VinculoResolvido:
        vig = self.versoes_vigentes()
        pend: list[str] = []
        ativ = None
        if v.id_crono:
            if "CRONOGRAMA" not in vig:
                pend.append("sem versão vigente de CRONOGRAMA")
            else:
                ativ = self.s.scalar(select(AtividadeCronogramaModel).where(
                    AtividadeCronogramaModel.versao_id == vig["CRONOGRAMA"],
                    AtividadeCronogramaModel.id_crono == v.id_crono))
                if ativ is None:
                    pend.append(f"atividade {v.id_crono} não existe no cronograma vigente")
        item_pq_cod = v.item_pq or (ativ.item_pq if ativ else None)
        pq = None
        if item_pq_cod and "PQ" in vig:
            pq = self.s.scalar(select(ItemPqModel).where(
                ItemPqModel.versao_id == vig["PQ"], ItemPqModel.item == item_pq_cod))
            if pq is None:
                pend.append(f"item {item_pq_cod} não existe na PQ vigente")
        composicao = v.composicao or (pq.composicao if pq else None) or (ativ.composicao if ativ else None)

        recursos: list[ind.RecursoCpu] = []
        if composicao and "CPU" in vig:
            recursos = [
                ind.RecursoCpu(r.recurso, r.tipo, r.coef_por_unidade)
                for r in self.s.scalars(select(CpuRecursoModel).where(
                    CpuRecursoModel.versao_id == vig["CPU"], CpuRecursoModel.composicao == composicao))
            ]
            if not recursos:
                pend.append(f"composição {composicao} não existe na CPU vigente")

        especifico = None
        if v.indice_codigo and "INDICES" in vig:
            m = self.s.scalar(select(IndiceEspecificoModel).where(
                IndiceEspecificoModel.versao_id == vig["INDICES"], IndiceEspecificoModel.codigo == v.indice_codigo))
            if m:
                especifico = ind.IndiceEspecifico(m.codigo, m.funcao_governa, m.indice_un_dia, m.ajudante,
                                                  m.ajudantes_por_oficial)
            else:
                pend.append(f"índice específico '{v.indice_codigo}' não existe na versão vigente")

        # recurso que governa: o informado na PQ/cronograma (gerado pelo vínculo PQ×CPU); senão, o maior coef. MOD
        gov_nome, gov_coef = None, None
        for fonte in (pq, ativ):
            if fonte is not None and fonte.recurso_governa and fonte.coef_governa:
                gov_nome, gov_coef = fonte.recurso_governa, fonte.coef_governa
                break
        if gov_nome is None and (g := ind.recurso_que_governa(recursos)):
            gov_nome, gov_coef = g.recurso, g.coef_por_unidade
        orcado = ind.indice_orcado(self.jornada, gov_coef)
        if especifico:
            hh = ind.hh_por_unidade_especifico(especifico, self.jornada)
        elif recursos:
            hh = ind.hh_por_unidade_mod(recursos, ind.coeficientes_usados(recursos, jornada=self.jornada))
        else:
            hh = None
            if not v.indice_codigo:
                pend.append("sem CPU nem índice específico: HH não será calculado")

        return VinculoResolvido(
            vinculo_id=v.id,
            id_crono=v.id_crono,
            atividade=ativ.atividade if ativ else None,
            item_pq=item_pq_cod,
            descricao_pq=pq.descricao if pq else None,
            composicao=composicao,
            unid=(ativ.unid if ativ else None) or (pq.unid if pq else None),
            qtd=(ativ.qtd_takeoff if ativ else None) or (pq.quantidade if pq else None),
            recurso_governa=especifico.funcao_governa if especifico else gov_nome,
            indice_orcado_un_dia=round(orcado, 4) if orcado else None,
            indice_especifico=v.indice_codigo,
            hh_por_unidade=hh or None,
            pendencias=tuple(pend),
        )
