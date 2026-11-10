"""Obra e acesso de usuários. A obra é o limite de todos os dados (cadastros, versões, equipes, programação)."""
from dataclasses import dataclass
from enum import StrEnum

from app.shared.errors import DomainError


class PapelObra(StrEnum):
    ADMIN = "admin"  # carrega versões, importa cadastros, envia FT ao Simova, dá acesso
    PLANEJADOR = "planejador"  # programa, aprova, mantém vínculos e equipes
    ENCARREGADO = "encarregado"  # programa (rascunho) a própria equipe
    LEITOR = "leitor"  # só consulta

    @property
    def nivel(self) -> int:
        return {"leitor": 0, "encarregado": 1, "planejador": 2, "admin": 3}[self.value]

    def pode(self, minimo: "PapelObra") -> bool:
        return self.nivel >= minimo.nivel


@dataclass(frozen=True)
class DadosObra:
    codigo: str
    nome: str
    contrato: str | None = None
    cliente: str | None = None

    def __post_init__(self) -> None:
        if not self.codigo.strip() or len(self.codigo.strip()) > 12:
            raise DomainError("código da obra: 1 a 12 caracteres (vai no selo da obra)", "codigo")
        if len(self.nome.strip()) < 3:
            raise DomainError("nome da obra muito curto", "nome")
