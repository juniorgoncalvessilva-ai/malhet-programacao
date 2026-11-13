"""Registros feitos no celular sem internet (specs 063, 072, 073): cada um nasce com um id do aparelho (`id_local`).
O servidor guarda o id com o registro; reenviar a mesma fila devolve o que já foi gravado em vez de duplicar."""
import re

from app.shared.errors import DomainError

_ID = re.compile(r"^[A-Za-z0-9_-]{8,64}$")


def validar_id_local(v: str | None) -> str:
    if not v or not _ID.match(v):
        raise DomainError("id do registro no aparelho inválido", "id_local")
    return v
