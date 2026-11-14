"""Dropbox (API v2). App do tipo "App folder": o app só mexe na pasta dele (Aplicativos/<app>)."""
import json
from urllib.parse import urlencode

from app.modules.arquivos.domain.provedor import Conexao, Credencial
from app.modules.arquivos.infra.provedores.base import Base

API = "https://api.dropboxapi.com/2"
CONTEUDO = "https://content.dropboxapi.com/2"


def _arg(d: dict) -> str:
    # o cabeçalho Dropbox-API-Arg precisa ser ASCII: caracteres fora disso vão escapados (\uXXXX)
    return json.dumps(d, ensure_ascii=True)


class Dropbox(Base):
    nome = "Dropbox"
    token_url = "https://api.dropboxapi.com/oauth2/token"

    def url_autorizacao(self, state: str, retorno: str) -> str:
        return "https://www.dropbox.com/oauth2/authorize?" + urlencode({
            "client_id": self.client_id, "redirect_uri": retorno, "response_type": "code", "state": state,
            "token_access_type": "offline", "scope": "files.content.write files.content.read account_info.read"})

    def conectar(self, codigo: str, retorno: str) -> Conexao:
        t = self._pedir_token({"grant_type": "authorization_code", "code": codigo, "redirect_uri": retorno})
        conta = None
        try:
            r = self.http.post(f"{API}/users/get_current_account", headers={"Authorization": f"Bearer {t['access_token']}"})
            conta = r.json().get("email")
        except Exception:  # noqa: BLE001  (só para mostrar a conta)
            pass
        return Conexao(t["refresh_token"], conta)

    def enviar(self, cred: Credencial, caminho: list[str], nome: str, dados: bytes, mime: str, substituir: bool = False) -> str:
        arg = {"path": "/" + "/".join([*caminho, nome]), "mode": "overwrite" if substituir else "add",
               "autorename": not substituir, "mute": True}
        r = self._req("POST", f"{CONTEUDO}/files/upload", "enviar arquivo", content=dados,
                      headers=self._cab(cred, **{"Content-Type": "application/octet-stream", "Dropbox-API-Arg": _arg(arg)}))
        return r.json()["id"]

    def baixar(self, cred: Credencial, ref: str) -> bytes:
        return self._req("POST", f"{CONTEUDO}/files/download", "baixar arquivo",
                         headers=self._cab(cred, **{"Dropbox-API-Arg": _arg({"path": ref})})).content
