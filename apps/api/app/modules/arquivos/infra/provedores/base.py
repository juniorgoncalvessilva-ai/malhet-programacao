"""O que os três adaptadores têm em comum: renovar o access token pelo refresh token e traduzir os erros HTTP."""
import base64
import json
import time

import httpx

from app.modules.arquivos.domain.provedor import Credencial, ErroProvedor

TEMPO = httpx.Timeout(60.0, connect=15.0)


class Base:
    nome = "?"
    token_url = ""

    def __init__(self, client_id: str, client_secret: str, transporte: httpx.BaseTransport | None = None):
        self.client_id, self.client_secret = client_id, client_secret
        self.http = httpx.Client(timeout=TEMPO, transport=transporte, follow_redirects=True)

    # --- OAuth -------------------------------------------------------------------------------------------------------
    def _dados_token(self, extra: dict) -> dict:
        return {"client_id": self.client_id, "client_secret": self.client_secret, **extra}

    def _pedir_token(self, extra: dict) -> dict:
        r = self.http.post(self.token_url, data=self._dados_token(extra))
        if r.status_code >= 400:
            corpo = r.text[:300]
            permanente = r.status_code in (400, 401) and ("invalid_grant" in corpo or "expired" in corpo or "revoked" in corpo)
            raise ErroProvedor(f"{self.nome}: token recusado ({r.status_code}) {corpo}", permanente)
        return r.json()

    def _acesso(self, cred: Credencial) -> str:
        if cred.access_token and time.time() < cred.expira - 60:
            return cred.access_token
        t = self._pedir_token({"grant_type": "refresh_token", "refresh_token": cred.refresh_token})
        cred.access_token = t["access_token"]
        cred.expira = time.time() + float(t.get("expires_in", 3600))
        if t.get("refresh_token"):  # rotação (OneDrive)
            cred.refresh_token = t["refresh_token"]
        return cred.access_token

    def _cab(self, cred: Credencial, **extra) -> dict:
        return {"Authorization": f"Bearer {self._acesso(cred)}", **extra}

    # --- HTTP --------------------------------------------------------------------------------------------------------
    def _conferir(self, r: httpx.Response, acao: str) -> httpx.Response:
        if r.status_code < 400:
            return r
        if r.status_code in (401, 403) and "insufficient" not in r.text.lower():
            raise ErroProvedor(f"{self.nome}: sem permissão ao {acao} ({r.status_code}) {r.text[:200]}", r.status_code == 401)
        raise ErroProvedor(f"{self.nome}: falha ao {acao} ({r.status_code}) {r.text[:200]}")

    def _req(self, metodo: str, url: str, acao: str, **kw) -> httpx.Response:
        try:
            r = self.http.request(metodo, url, **kw)
        except httpx.HTTPError as e:
            raise ErroProvedor(f"{self.nome}: sem conexão ao {acao}: {e}") from e
        return self._conferir(r, acao)


def email_do_id_token(id_token: str | None) -> str | None:
    """E-mail da conta no id_token que veio direto do servidor de token (TLS) — só para mostrar qual conta ligou."""
    if not id_token or id_token.count(".") != 2:
        return None
    meio = id_token.split(".")[1]
    try:
        return json.loads(base64.urlsafe_b64decode(meio + "=" * (-len(meio) % 4))).get("email")
    except (ValueError, json.JSONDecodeError):
        return None
