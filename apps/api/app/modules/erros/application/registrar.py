"""Guardar relatos (spec 098): idempotente pelo id do aparelho; o erro do próprio servidor também entra por aqui."""
import traceback
import uuid
from collections.abc import Callable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.erros.domain.relato import Relato
from app.modules.erros.infra.models import ErroRelatoModel

ObraExiste = Callable[[Session, int], bool]


def registrar(s: Session, r: Relato, *, usuario_id: str | None, usuario_email: str | None, obra_id: int | None,
              obra_existe: ObraExiste) -> ErroRelatoModel:
    atual = s.scalar(select(ErroRelatoModel).where(ErroRelatoModel.id_local == r.id_local))
    if atual is not None:  # reenvio da fila do aparelho
        if r.comentario and not atual.comentario:
            atual.comentario = r.comentario
        return atual
    m = ErroRelatoModel(
        id_local=r.id_local, codigo=r.codigo, grupo=r.grupo, origem=r.origem, tipo=r.tipo, mensagem=r.mensagem,
        local=r.local, acao=r.acao, status=r.status, pilha=r.pilha, comentario=r.comentario, versao=r.versao,
        navegador=r.navegador, obra_id=obra_id if obra_id and obra_existe(s, obra_id) else None,
        usuario_id=usuario_id, usuario_email=usuario_email,
    )
    s.add(m)
    s.flush()
    return m


def relato_do_servidor(exc: BaseException, metodo: str, rota: str) -> Relato:
    """Exceção não tratada na API vira relato: tipo, mensagem e o fim da pilha (onde quebrou)."""
    pilha = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__)[-12:])
    return Relato.de_entrada(id_local=uuid.uuid4().hex, origem="api", tipo="servidor",
                             mensagem=f"{type(exc).__name__}: {exc}", local=rota, acao=f"{metodo} {rota}",
                             status=500, pilha=pilha, versao=None)
