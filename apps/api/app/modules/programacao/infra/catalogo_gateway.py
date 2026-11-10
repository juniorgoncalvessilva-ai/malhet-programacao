"""Adaptador: lê cadastros Simova + referências vigentes + equipes e entrega a linguagem publicada."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.cadastros.infra.models import FrenteModel, OperGrupoModel, OperModel
from app.modules.equipes.infra.models import EquipeModel
from app.modules.programacao.domain.capacidade import MembroEquipe
from app.modules.programacao.domain.ports import OperInfo
from app.modules.referencias.infra.resolvedor import ResolvedorReferencias


class SqlCatalogoGateway:
    def __init__(self, session: Session):
        self.s = session
        self.ref = ResolvedorReferencias(session)

    def oper(self, grupo_codigo: str, oper_codigo: str, vinculo_id: int | None = None) -> OperInfo | None:
        o = self.s.scalar(
            select(OperModel).where(OperModel.grupo_codigo == grupo_codigo, OperModel.codigo == oper_codigo)
        )
        if o is None:
            return None
        grupo = self.s.scalar(select(OperGrupoModel).where(OperGrupoModel.codigo == grupo_codigo).limit(1))
        vinc = self.ref.vinculo_da_oper(grupo_codigo, oper_codigo, vinculo_id)
        resolvido = self.ref.resolver(vinc) if vinc else None
        return OperInfo(
            grupo_codigo=o.grupo_codigo,
            grupo_descricao=grupo.descricao if grupo else "",
            codigo=o.codigo,
            descricao=o.descricao,
            tarefa_codigo=(vinc.simova_tarefa_codigo if vinc else None) or o.tarefa_codigo,
            vinculo_id=vinc.id if vinc else None,
            id_crono=vinc.id_crono if vinc else None,
            item_pq=resolvido.item_pq if resolvido else None,
            composicao=resolvido.composicao if resolvido else None,
            indice_hh_por_unidade=resolvido.hh_por_unidade if resolvido else None,
            versoes=self.ref.versoes_vigentes(),
        )

    def frente_existe(self, codigo: str) -> bool:
        return self.s.get(FrenteModel, codigo) is not None

    def equipe(self, encarregado_cracha: str) -> list[MembroEquipe]:
        equipes = self.s.scalars(
            select(EquipeModel).where(
                EquipeModel.encarregado_cracha == encarregado_cracha, EquipeModel.ativo.is_(True)
            )
        )
        return [
            MembroEquipe(c.recurso, c.tipo, c.quantidade, e.jornada_horas) for e in equipes for c in e.composicao
        ]
