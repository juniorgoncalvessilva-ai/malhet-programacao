"""Aderência física e financeira da programação semanal (spec 104): painel, histórico, modelo e apresentação."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, Response, UploadFile
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.auth import ContextoObra, ler, planejar
from app.core.db import get_session
from app.modules.aderencia.application import dados as dd
from app.modules.aderencia.application.importar import PPTX, bytes_do_modelo, importar, modelo_da_obra
from app.modules.aderencia.domain.aderencia import Registro, chave_nome
from app.modules.aderencia.infra.models import AderenciaHistoricoModel
from app.shared.errors import DomainError

router = APIRouter(prefix="/aderencia", tags=["aderência semanal"])


def _obra(s: Session, obra_id: int) -> str:
    from app.modules.obras.infra.models import ObraModel

    o = s.get(ObraModel, obra_id)
    return o.nome if o else "Obra"


def _modelo_info(s: Session, obra_id: int) -> dict | None:
    m, herdado = modelo_da_obra(s, obra_id)
    if m is None:
        return None
    return {"nome": m.nome, "contratada": m.contratada, "enviado_em": m.enviado_em, "enviado_por": m.enviado_por, "herdado": herdado}


@router.get("")
def painel(semana: int | None = None, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """A semana N: anteriores por responsável, ranking acumulado, semana anterior e meta da semana (com marcos)."""
    return {**dd.painel(s, c.obra_id, semana), "obra": _obra(s, c.obra_id), "modelo": _modelo_info(s, c.obra_id)}


@router.post("/importar")
def importar_apresentacao(arquivo: UploadFile = File(...), modelo: bool = Form(True), historico: bool = Form(True),
                          s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """A apresentação anterior (.pptx): vira o modelo da obra (fundos e rodapé da contratada) e as semanas que ela traz
    entram no histórico, tomadas como reais."""
    dados = arquivo.file.read()
    return importar(s, c.obra_id, arquivo.filename or "apresentacao.pptx", dados, c.usuario.email or c.usuario.id,
                    modelo=modelo, historico=historico)


class LinhaHistIn(BaseModel):
    responsavel: str
    programado: float
    realizado: float | None = None


class SemanaHistIn(BaseModel):
    itens: list[LinhaHistIn]


@router.put("/historico/{semana}")
def gravar_semana(semana: int, d: SemanaHistIn, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    """Digita ou corrige uma semana do histórico (substitui a semana inteira)."""
    regs = [Registro(semana, " ".join(x.responsavel.split()), round(x.programado, 2),
                     round(x.realizado, 2) if x.realizado is not None else None, "historico") for x in d.itens]
    chaves = [chave_nome(r.responsavel) for r in regs]
    if len(set(chaves)) != len(chaves):
        raise DomainError("o mesmo responsável aparece duas vezes na semana", "itens")
    s.execute(delete(AderenciaHistoricoModel).where(AderenciaHistoricoModel.obra_id == c.obra_id, AderenciaHistoricoModel.semana == semana))
    for r, k in zip(regs, chaves):
        s.add(AderenciaHistoricoModel(obra_id=c.obra_id, semana=semana, responsavel=r.responsavel, responsavel_chave=k,
                                      programado=r.programado, realizado=r.realizado, origem="manual",
                                      criado_por=c.usuario.email or c.usuario.id, criado_em=datetime.now(timezone.utc)))
    s.flush()
    return {"semana": semana, "itens": len(regs)}


@router.delete("/historico/{semana}", status_code=204)
def apagar_semana(semana: int, s: Session = Depends(get_session), c: ContextoObra = Depends(planejar)):
    s.execute(delete(AderenciaHistoricoModel).where(AderenciaHistoricoModel.obra_id == c.obra_id, AderenciaHistoricoModel.semana == semana))


@router.get("/apresentacao")
def apresentacao(semana: int | None = None, s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """A apresentação da semana no modelo da contratada (.pptx)."""
    from app.modules.aderencia.application.apresentacao import gerar

    dados = dd.painel(s, c.obra_id, semana)
    m, _ = modelo_da_obra(s, c.obra_id)
    conteudo = gerar(dados, _obra(s, c.obra_id), bytes_do_modelo(s, m) if m else None)
    nome = f"Aderencia_semanal_S{dados['semana']}.pptx"
    return Response(conteudo, media_type=PPTX, headers={"Content-Disposition": f'attachment; filename="{nome}"'})


@router.get("/modelo")
def modelo(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    return _modelo_info(s, c.obra_id)


@router.get("/semanas")
def semanas(s: Session = Depends(get_session), c: ContextoObra = Depends(ler)):
    """Semanas com programação semanal emitida no sistema (para escolher a apresentação)."""
    progs = dd.programacoes_por_semana(s, c.obra_id)
    hist = sorted({h for (h,) in s.execute(select(AderenciaHistoricoModel.semana).where(AderenciaHistoricoModel.obra_id == c.obra_id))})
    return {"sistema": sorted(progs), "historico": hist}
