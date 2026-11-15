"""Leitura mínima de outro módulo: só saber se a obra existe (o relato guarda a obra de onde veio)."""
from sqlalchemy.orm import Session

from app.modules.obras.infra.models import ObraModel


def obra_existe(s: Session, obra_id: int) -> bool:
    return s.get(ObraModel, obra_id) is not None
