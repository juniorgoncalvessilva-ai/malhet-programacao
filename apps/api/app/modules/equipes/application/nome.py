"""Nome da equipe nova no padrão da obra (spec 107): "EQUIPE.{n}_{disciplina}", número = maior já usado + 1."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.equipes.domain.alocacao import MODELO_PADRAO, nome_padrao, proximo_numero
from app.modules.equipes.infra.models import EquipeConfigModel, EquipeModel


def config_da_obra(s: Session, obra_id: int) -> EquipeConfigModel:
    return s.get(EquipeConfigModel, obra_id) or EquipeConfigModel(obra_id=obra_id, modelo_nome=MODELO_PADRAO, digitos=1)


def nomes_da_obra(s: Session, obra_id: int) -> list[str]:
    return list(s.scalars(select(EquipeModel.nome).where(EquipeModel.obra_id == obra_id)))


def nome_da_nova_equipe(s: Session, obra_id: int, disciplina: str | None) -> str:
    cf = config_da_obra(s, obra_id)
    return nome_padrao(cf.modelo_nome, proximo_numero(cf.modelo_nome, nomes_da_obra(s, obra_id)), disciplina, cf.digitos)
