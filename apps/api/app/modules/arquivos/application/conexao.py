"""Conexão da obra com o provedor de nuvem (OAuth) — o `state` assinado leva obra e pessoa até a volta do login."""
import hashlib
import hmac
import json
import os
import time
from base64 import urlsafe_b64decode, urlsafe_b64encode

from app.core.config import get_settings
from app.modules.arquivos.domain.provedor import Credencial
from app.modules.arquivos.infra.models import ArmazenamentoObraModel
from app.modules.arquivos.infra.segredo import cifrar, decifrar
from app.shared.errors import DomainError

VALIDADE_STATE = 15 * 60


def _chave() -> bytes:
    return (get_settings().armazenamento_chave or os.getenv("JWT_SECRET", "") or "dev").encode()


def criar_state(obra_id: int, usuario_id: str, provedor: str) -> str:
    corpo = urlsafe_b64encode(json.dumps({"o": obra_id, "u": usuario_id, "p": provedor, "t": int(time.time())}).encode()).decode()
    assinatura = hmac.new(_chave(), corpo.encode(), hashlib.sha256).hexdigest()[:32]
    return f"{corpo}.{assinatura}"


def ler_state(state: str, provedor: str) -> dict:
    corpo, _, assinatura = state.partition(".")
    certa = hmac.new(_chave(), corpo.encode(), hashlib.sha256).hexdigest()[:32]
    if not hmac.compare_digest(assinatura, certa):
        raise DomainError("retorno do login inválido", "state")
    d = json.loads(urlsafe_b64decode(corpo.encode()))
    if d.get("p") != provedor or time.time() - d.get("t", 0) > VALIDADE_STATE:
        raise DomainError("o login demorou demais ou é de outro provedor: conecte de novo", "state")
    return d


def retorno_oauth(provedor: str) -> str:
    return f"{get_settings().app_url.rstrip('/')}/backend/api/armazenamento/oauth/{provedor}/retorno"


def credencial(cfg: ArmazenamentoObraModel) -> Credencial:
    token = decifrar(cfg.token_cifrado)
    if not token:
        raise DomainError("a conexão com a nuvem precisa ser refeita (chave do servidor mudou)", "provedor")
    return Credencial(refresh_token=token, pastas=dict(cfg.pastas or {}))


def salvar_credencial(cfg: ArmazenamentoObraModel, cred: Credencial) -> None:
    """Guarda o que mudou durante o uso: token renovado (OneDrive) e o mapa de pastas (Google)."""
    if decifrar(cfg.token_cifrado) != cred.refresh_token:
        cfg.token_cifrado = cifrar(cred.refresh_token)
    if (cfg.pastas or {}) != cred.pastas:
        cfg.pastas = dict(cred.pastas)
