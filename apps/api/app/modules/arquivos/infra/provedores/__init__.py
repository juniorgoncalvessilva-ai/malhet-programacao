"""Adaptadores de nuvem disponíveis: só os que têm as credenciais do app configuradas no servidor (variáveis de ambiente)."""
import httpx

from app.core.config import get_settings
from app.modules.arquivos.domain.provedor import PROVEDORES, Provedor
from app.shared.errors import DomainError

_TRANSPORTE: httpx.BaseTransport | None = None  # testes trocam por um transporte simulado


def _credenciais(nome: str) -> tuple[str, str]:
    c = get_settings()
    return {"google": (c.google_client_id, c.google_client_secret), "onedrive": (c.ms_client_id, c.ms_client_secret),
            "dropbox": (c.dropbox_app_key, c.dropbox_app_secret)}.get(nome, ("", ""))


def disponiveis() -> dict[str, bool]:
    return {p: all(_credenciais(p)) for p in PROVEDORES}


def provedor(nome: str) -> Provedor:
    from app.modules.arquivos.infra.provedores.dropbox import Dropbox
    from app.modules.arquivos.infra.provedores.google import GoogleDrive
    from app.modules.arquivos.infra.provedores.onedrive import OneDrive

    classes = {"google": GoogleDrive, "onedrive": OneDrive, "dropbox": Dropbox}
    if nome not in classes:
        raise DomainError(f"provedor desconhecido: {nome}", "provedor")
    cid, segredo = _credenciais(nome)
    if not (cid and segredo):
        raise DomainError(f"{PROVEDORES[nome]} não está habilitado no servidor (faltam as credenciais do app)", "provedor")
    return classes[nome](cid, segredo, _TRANSPORTE)
