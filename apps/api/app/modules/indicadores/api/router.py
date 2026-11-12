"""Indicadores: PPC, aderência, carga e erro de programação × capacidade, produtividade × CPU e Pareto."""
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, ler
from app.core.db import get_session
from app.modules.indicadores.application.painel import Filtros, painel

router = APIRouter(prefix="/indicadores", tags=["indicadores"])


@router.get("")
def indicadores(de: date | None = None, ate: date | None = None, encarregado: str | None = None,
                equipe_id: int | None = None, grupo: str | None = None, item_pq: str | None = None,
                area_id: int | None = None, modo: str | None = None,
                s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    return painel(s, c.obra_id, Filtros(de, ate, encarregado, equipe_id, grupo, item_pq, area_id, modo))
