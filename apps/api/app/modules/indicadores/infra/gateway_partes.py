"""Linguagem publicada dos desvios para as partes da obra (spec 139)."""
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.modules.indicadores.infra.models import DesvioModel as D


def responsaveis_e_gerencias(s: Session, obra_id: int) -> list[tuple[str | None, str | None, int]]:
    return [tuple(x) for x in s.execute(select(D.responsavel, D.gerencia, func.count()).where(D.obra_id == obra_id)
                                        .group_by(D.responsavel, D.gerencia)).all()]


def trocar_gerencia(s: Session, obra_id: int, de: str, para: str) -> int:
    return s.execute(update(D).where(D.obra_id == obra_id, D.gerencia == de).values(gerencia=para)).rowcount or 0
