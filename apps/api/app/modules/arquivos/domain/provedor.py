"""Porta dos provedores de nuvem (spec 082). Cada adaptador (Google Drive, OneDrive, Dropbox) fala por CAMINHO
(["Malhet", "obras", "310", "20-campo-fotos"]) — quem precisa de ids (Google) resolve e guarda o mapa das pastas.
"""
from dataclasses import dataclass, field
from typing import Protocol

PROVEDORES = {"google": "Google Drive", "onedrive": "OneDrive", "dropbox": "Dropbox"}


class ErroProvedor(Exception):
    """`permanente`: a conexão não vale mais (token revogado) — só reconectando. Senão, tenta de novo depois."""

    def __init__(self, msg: str, permanente: bool = False):
        super().__init__(msg)
        self.permanente = permanente


@dataclass
class Credencial:
    """Mutável de propósito: o OneDrive troca o refresh token a cada renovação; quem chama salva o novo."""
    refresh_token: str
    access_token: str | None = None
    expira: float = 0.0
    pastas: dict[str, str] = field(default_factory=dict)  # caminho → id remoto (Google) e arquivos substituíveis


@dataclass(frozen=True)
class Conexao:
    refresh_token: str
    conta: str | None = None


class Provedor(Protocol):
    nome: str

    def url_autorizacao(self, state: str, retorno: str) -> str: ...

    def conectar(self, codigo: str, retorno: str) -> Conexao: ...

    def enviar(self, cred: Credencial, caminho: list[str], nome: str, dados: bytes, mime: str, substituir: bool = False) -> str:
        """Grava o arquivo no caminho (cria as pastas que faltarem) e devolve a referência remota. `substituir`: mesmo
        nome no mesmo lugar é trocado (índices `00-indice.md`); senão nunca sobrescreve."""
        ...

    def baixar(self, cred: Credencial, ref: str) -> bytes: ...
