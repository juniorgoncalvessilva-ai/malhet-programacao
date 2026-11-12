"""Marca da obra: cor do cliente e logos da contratada e do contratante (usadas na tela e nos documentos)."""
from typing import Literal

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, administrar, ler
from app.core.db import get_session
from app.modules.obras.infra.models import MarcaObraModel
from app.shared.errors import NotFoundError
from app.shared.marca import LIMITE_LOGO, validar_cor, validar_logo

router = APIRouter(prefix="/obra/marca", tags=["marca da obra"])
Qual = Literal["contratada", "contratante"]


def _marca(s: Session, obra_id: int, criar: bool = False) -> MarcaObraModel | None:
    m = s.get(MarcaObraModel, obra_id)
    if m is None and criar:
        m = MarcaObraModel(obra_id=obra_id)
        s.add(m)
        s.flush()
    return m


def _out(m: MarcaObraModel | None) -> dict:
    return {"cor": m.cor if m else None,
            "contratada": bool(m and m.tipo_contratada), "contratante": bool(m and m.tipo_contratante),
            "versao": int(m.atualizado_em.timestamp()) if m and m.atualizado_em else 0}


@router.get("")
def ver(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    return _out(_marca(s, c.obra_id))


class CorIn(BaseModel):
    cor: str | None = None


@router.put("/cor")
def cor(d: CorIn, s: Session = Depends(get_session), c: ContextoObra = Depends(administrar)):
    """Cor do cliente (#RRGGBB) no lugar do verde Malhet; vazio volta ao padrão."""
    m = _marca(s, c.obra_id, criar=True)
    m.cor = validar_cor(d.cor)
    s.flush()
    s.refresh(m)
    return _out(m)


@router.post("/logo/{qual}")
async def enviar_logo(qual: Qual, arquivo: UploadFile = File(...), s: Session = Depends(get_session),
                      c: ContextoObra = Depends(administrar)):
    conteudo = await arquivo.read(LIMITE_LOGO + 1)
    tipo = validar_logo(conteudo)
    m = _marca(s, c.obra_id, criar=True)
    setattr(m, f"logo_{qual}", conteudo)
    setattr(m, f"tipo_{qual}", tipo)
    s.flush()
    s.refresh(m)
    return _out(m)


@router.delete("/logo/{qual}")
def excluir_logo(qual: Qual, s: Session = Depends(get_session), c: ContextoObra = Depends(administrar)):
    m = _marca(s, c.obra_id)
    if m is not None:
        setattr(m, f"logo_{qual}", None)
        setattr(m, f"tipo_{qual}", None)
        s.flush()
        s.refresh(m)
    return _out(m)


@router.get("/logo/{qual}")
def logo(qual: Qual, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    m = _marca(s, c.obra_id)
    tipo = getattr(m, f"tipo_{qual}") if m else None
    if not tipo:
        raise NotFoundError("Logo", qual)
    return Response(getattr(m, f"logo_{qual}"), media_type=tipo, headers={"Cache-Control": "private, max-age=300"})
