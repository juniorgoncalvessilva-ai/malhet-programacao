"""Gerar notificações a partir dos outros módulos (spec 076): `notificar(s, obra_id, ...)` — linguagem publicada.
Nunca derruba quem chamou: um erro aqui não pode impedir de salvar um teste, um aceite ou uma emissão."""
import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.notificacoes.infra.models import NotificacaoModel

TODOS = ["admin", "planejador", "encarregado", "seguranca", "leitor"]
GESTAO = ["admin", "planejador"]
SEGURANCA = ["seguranca", "admin", "planejador"]
_log = logging.getLogger(__name__)


def notificar(s: Session, obra_id: int, *, tipo: str, titulo: str, texto: str | None = None, papeis: list[str] | None = None,
              usuarios: list[str] | None = None, url: str | None = None, url_mobile: str | None = None, gravidade: str = "info",
              autor_id: str | None = None, chave: str | None = None) -> NotificacaoModel | None:
    try:
        if chave and s.scalar(select(NotificacaoModel.id).where(NotificacaoModel.obra_id == obra_id, NotificacaoModel.chave == chave)):
            return None
        n = NotificacaoModel(obra_id=obra_id, tipo=tipo, gravidade=gravidade if gravidade in ("info", "atencao", "critico") else "info",
                             titulo=" ".join(titulo.split())[:150], texto=(texto or "")[:500] or None, url=url, url_mobile=url_mobile,
                             papeis=papeis or [], usuarios=[u for u in (usuarios or []) if u], autor_id=autor_id, chave=chave)
        with s.begin_nested():
            s.add(n)
            s.flush()
        return n
    except Exception:  # noqa: BLE001 — aviso nunca impede a operação principal
        _log.exception("falha ao gerar notificação %s", tipo)
        return None
