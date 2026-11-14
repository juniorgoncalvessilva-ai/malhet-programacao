"""Quem usa arquivos se registra aqui (spec 082): o módulo dono sabe migrar o que guardava no banco e diz quais
arquivos ainda estão em uso. Assim a fila não lê tabela de outro módulo."""
from collections.abc import Callable
from dataclasses import dataclass

from sqlalchemy import Select
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class Usuario:
    nome: str
    tipos: tuple[str, ...]  # tipos de arquivo deste dono (zettel.TIPOS)
    migrar: Callable[[Session, int], int]  # (sessão, limite) → quantos moveu do banco para o disco
    em_uso: Callable[[], Select]  # SELECT dos ids de `arquivo` ainda referenciados (subconsulta no banco)


USUARIOS: dict[str, Usuario] = {}


def registrar(u: Usuario) -> None:
    USUARIOS[u.nome] = u
