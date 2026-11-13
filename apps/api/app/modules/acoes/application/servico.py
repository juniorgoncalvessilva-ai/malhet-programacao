"""Casos de uso das ações 5W2H (spec 064). `criar` também é a porta para os outros módulos (auditoria, ocorrência…)."""
from datetime import date, datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.acoes.domain.acao import Acao5W2H, ROTULO_STATUS, farol, preenchidos, proxima
from app.modules.acoes.infra.models import AcaoModel
from app.shared.errors import DomainError, NotFoundError

CAMPOS = ("o_que", "por_que", "onde", "area_id", "quando", "data_execucao", "quem", "como", "quanto", "acompanhamento")


def _anotar(a: AcaoModel, por: str, texto: str) -> None:
    a.historico = [{"em": datetime.now(timezone.utc).isoformat(), "por": por, "texto": texto[:500]}] + list(a.historico or [])


def criar(s: Session, obra_id: int, por: str, dados: dict, origem: str = "manual", origem_id: int | None = None,
          origem_texto: str | None = None) -> AcaoModel:
    Acao5W2H(dados.get("o_que") or "", dados.get("quem"), dados.get("quando"), dados.get("por_que"), dados.get("onde"),
             dados.get("como"), dados.get("quanto"))
    n = (s.scalar(select(func.max(AcaoModel.numero)).where(AcaoModel.obra_id == obra_id)) or 0) + 1
    a = AcaoModel(obra_id=obra_id, numero=n, origem=origem, origem_id=origem_id, origem_texto=origem_texto, criado_por=por,
                  status="aberta", **{k: dados.get(k) for k in CAMPOS})
    _anotar(a, por, f"Ação aberta{f' a partir de {origem_texto}' if origem_texto else ''}")
    s.add(a)
    s.flush()
    return a


def obter(s: Session, obra_id: int, aid: int) -> AcaoModel:
    a = s.get(AcaoModel, aid)
    if a is None or a.obra_id != obra_id:
        raise NotFoundError("Ação", aid)
    return a


def editar(s: Session, a: AcaoModel, por: str, dados: dict) -> AcaoModel:
    if a.status in ("concluida", "cancelada"):
        raise DomainError(f"ação {ROTULO_STATUS[a.status].lower()}: não muda mais")
    novo = {k: dados.get(k, getattr(a, k)) for k in CAMPOS}
    Acao5W2H(novo["o_que"] or "", novo["quem"], novo["quando"], novo["por_que"], novo["onde"], novo["como"], novo["quanto"])
    if novo["quando"] != a.quando and a.quando:
        _anotar(a, por, f"Prazo de {a.quando:%d/%m/%Y} para {novo['quando']:%d/%m/%Y}")
    for k, v in novo.items():
        setattr(a, k, v)
    s.flush()
    return a


def mudar(s: Session, a: AcaoModel, por: str, evento: str, texto: str | None = None, eficaz: bool | None = None,
          tem_evidencia: bool = False) -> AcaoModel:
    if evento == "concluir":
        if len((texto or "").strip()) < 3:
            raise DomainError("conte o que foi feito para concluir", "texto")
        if not tem_evidencia:
            raise DomainError("concluir exige evidência: envie a foto da adequação", "fotos")
    if evento == "cancelar" and len((texto or "").strip()) < 3:
        raise DomainError("informe o motivo do cancelamento", "texto")
    a.status = proxima(a.status, evento, eficaz=eficaz)
    agora = datetime.now(timezone.utc)
    if evento == "concluir":
        a.conclusao_texto, a.concluida_em = texto, agora
        _anotar(a, por, f"Concluída: {texto}")
    elif evento == "verificar":
        a.eficaz, a.verificada_em = eficaz, agora
        _anotar(a, por, f"{'Eficaz' if eficaz else 'Não eficaz: reaberta'}{f' — {texto}' if texto else ''}")
        if not eficaz:
            a.conclusao_texto, a.concluida_em = None, None
    elif evento == "cancelar":
        _anotar(a, por, f"Cancelada: {texto}")
    else:
        _anotar(a, por, texto or "Em andamento")
    if a.origem == "auditoria" and a.origem_id:
        from app.modules.auditorias.application import ao_mudar_acao  # a auditoria acompanha a ação dela

        ao_mudar_acao(s, a.obra_id, a.origem_id, a.status)
    s.flush()
    return a


def saida(a: AcaoModel, fotos: list[int], hoje: date | None = None) -> dict:
    d = {k: getattr(a, k) for k in ("id", "numero", "origem", "origem_id", "origem_texto", "status", "conclusao_texto", "eficaz",
                                     "criado_por", "historico") + CAMPOS}
    for k in ("quando", "data_execucao"):
        d[k] = d[k].isoformat() if d[k] else None
    d["concluida_em"] = a.concluida_em.isoformat() if a.concluida_em else None
    d["criado_em"] = a.criado_em.isoformat() if a.criado_em else None
    d["farol"] = farol(a.status, a.quando, hoje or date.today())
    d["preenchidos"] = preenchidos(d)
    d["fotos"] = fotos
    return d
