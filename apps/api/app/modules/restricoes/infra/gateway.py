"""Linguagem publicada das restrições para as partes da obra (spec 139): quem aparece como responsável/gerência e a troca
da gerência antiga pela padronizada."""
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.modules.restricoes.infra.models import AcaoRestricaoModel as A


def responsaveis_e_gerencias(s: Session, obra_id: int) -> list[tuple[str | None, str | None, int]]:
    return [tuple(x) for x in s.execute(select(A.responsavel, A.gerencia, func.count()).where(A.obra_id == obra_id)
                                        .group_by(A.responsavel, A.gerencia)).all()]


def trocar_gerencia(s: Session, obra_id: int, de: str, para: str) -> int:
    return s.execute(update(A).where(A.obra_id == obra_id, A.gerencia == de).values(gerencia=para)).rowcount or 0


def trocar_responsavel(s: Session, obra_id: int, de: str, para: str, gerencia: str) -> int:
    """Responsável escrito à mão (sem diferença de caixa/espaços) vira o cadastrado — e a gerência dele junto (spec 139)."""
    alvo = " ".join(de.split()).upper()
    return s.execute(update(A).where(A.obra_id == obra_id, func.upper(func.trim(A.responsavel)) == alvo)
                     .values(responsavel=para, gerencia=gerencia).execution_options(synchronize_session=False)).rowcount or 0
