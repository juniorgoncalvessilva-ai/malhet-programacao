"""Casos de uso das auditorias (spec 064)."""
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.auditorias.domain.auditoria import MODELO_SEGURANCA, pendencias, validar_config
from app.modules.auditorias.infra.models import ModeloAuditoriaModel, RegistroAuditoriaModel
from app.modules.campo.infra.models import FotoCampoModel
from app.shared.errors import DomainError


def garantir_padrao(s: Session, obra_id: int) -> None:
    """Toda obra começa com o modelo de Segurança do Trabalho, marcado como padrão."""
    if s.scalar(select(ModeloAuditoriaModel.id).where(ModeloAuditoriaModel.obra_id == obra_id)) is None:
        cfg = validar_config(MODELO_SEGURANCA)
        s.add(ModeloAuditoriaModel(obra_id=obra_id, nome=cfg["nome"], setor=cfg["setor"], padrao=True, config=cfg))
        s.flush()


def contar_fotos(s: Session, obra_id: int, rid: int) -> tuple[int, int]:
    antes = depois = 0
    for (leg,) in s.execute(select(FotoCampoModel.legenda).where(FotoCampoModel.obra_id == obra_id, FotoCampoModel.alvo == "auditoria",
                                                                 FotoCampoModel.alvo_id == rid)):
        if (leg or "").startswith("depois"):
            depois += 1
        else:
            antes += 1
    return antes, depois


def como_dict(r: RegistroAuditoriaModel) -> dict:
    return {k: getattr(r, k) for k in ("id", "numero", "modelo_id", "tipo", "tipo_registro", "data", "area_id", "local", "area_texto",
                                       "equipe_id", "engenheiro", "encarregado", "rac", "nao_conformidade", "medida_corretiva", "ver_agir",
                                       "plano_responsavel", "plano_prazo", "acompanhamento", "respostas", "status", "acao_id", "auditor")}


def finalizar(s: Session, r: RegistroAuditoriaModel, cfg: dict, por: str) -> RegistroAuditoriaModel:
    """Confere o que o modelo exige; VER E AGIR = NÃO abre a ação 5W2H do plano de ação."""
    if r.status != "rascunho":
        raise DomainError("registro já enviado")
    falta = pendencias(cfg, como_dict(r), *contar_fotos(s, r.obra_id, r.id))
    if falta:
        raise DomainError("falta: " + ", ".join(falta), "pendencias")
    if r.ver_agir:
        r.status = "adequada"
    else:
        from app.modules.acoes.application import servico as acoes

        a = acoes.criar(s, r.obra_id, por, {
            "o_que": r.medida_corretiva or f"Corrigir: {r.nao_conformidade}", "por_que": f"{r.tipo_registro or r.tipo}: {r.nao_conformidade}",
            "onde": " / ".join(x for x in (r.local, r.area_texto) if x) or None, "area_id": r.area_id, "quando": r.plano_prazo,
            "quem": r.plano_responsavel, "acompanhamento": r.acompanhamento,
        }, origem="auditoria", origem_id=r.id, origem_texto=f"{r.tipo} Nº {r.numero}")
        r.acao_id, r.status = a.id, "plano"
    r.enviado_em = datetime.now(timezone.utc)
    s.flush()
    return r


def ao_mudar_acao(s: Session, obra_id: int, rid: int, status_acao: str) -> None:
    r = s.get(RegistroAuditoriaModel, rid)
    if r is None or r.obra_id != obra_id or r.status in ("rascunho", "adequada"):
        return
    r.status = "concluida" if status_acao == "concluida" else "plano"


def proximo_numero(s: Session, obra_id: int) -> int:
    return (s.scalar(select(func.max(RegistroAuditoriaModel.numero)).where(RegistroAuditoriaModel.obra_id == obra_id)) or 0) + 1
