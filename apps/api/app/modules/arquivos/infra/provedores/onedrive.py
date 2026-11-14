"""OneDrive (pessoal ou da empresa) pelo Microsoft Graph. Escopo `Files.ReadWrite.AppFolder`: o app só mexe na pasta
dele (Aplicativos/<app>), nada mais do OneDrive. Na empresa o admin do Entra pode precisar consentir."""
from urllib.parse import quote, urlencode

from app.modules.arquivos.domain.provedor import Conexao, Credencial
from app.modules.arquivos.infra.provedores.base import Base

GRAPH = "https://graph.microsoft.com/v1.0"
ESCOPO = "offline_access Files.ReadWrite.AppFolder User.Read"
SIMPLES = 4 * 1024 * 1024  # acima disso, sessão de envio em partes
PARTE = 10 * 327680  # múltiplo de 320 KiB (exigência do Graph)


class OneDrive(Base):
    nome = "OneDrive"
    token_url = "https://login.microsoftonline.com/common/oauth2/v2.0/token"

    def _dados_token(self, extra: dict) -> dict:
        return {**super()._dados_token(extra), "scope": ESCOPO}

    def url_autorizacao(self, state: str, retorno: str) -> str:
        return "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?" + urlencode({
            "client_id": self.client_id, "redirect_uri": retorno, "response_type": "code", "response_mode": "query",
            "scope": ESCOPO, "state": state, "prompt": "select_account"})

    def conectar(self, codigo: str, retorno: str) -> Conexao:
        t = self._pedir_token({"grant_type": "authorization_code", "code": codigo, "redirect_uri": retorno})
        conta = None
        try:
            me = self.http.get(f"{GRAPH}/me", headers={"Authorization": f"Bearer {t['access_token']}"}).json()
            conta = me.get("mail") or me.get("userPrincipalName")
        except Exception:  # noqa: BLE001  (só para mostrar a conta)
            pass
        return Conexao(t["refresh_token"], conta)

    @staticmethod
    def _caminho(caminho: list[str], nome: str) -> str:
        return "/".join(quote(p, safe="") for p in [*caminho, nome])

    def enviar(self, cred: Credencial, caminho: list[str], nome: str, dados: bytes, mime: str, substituir: bool = False) -> str:
        conflito = "replace" if substituir else "rename"
        alvo = f"{GRAPH}/me/drive/special/approot:/{self._caminho(caminho, nome)}:"
        if len(dados) <= SIMPLES:  # as pastas do caminho são criadas pelo próprio Graph
            r = self._req("PUT", f"{alvo}/content", "enviar arquivo", headers=self._cab(cred, **{"Content-Type": mime}),
                          params={"@microsoft.graph.conflictBehavior": conflito}, content=dados)
            return r.json()["id"]
        r = self._req("POST", f"{alvo}/createUploadSession", "iniciar envio", headers=self._cab(cred),
                      json={"item": {"@microsoft.graph.conflictBehavior": conflito}})
        url = r.json()["uploadUrl"]
        total, ultimo = len(dados), None
        for ini in range(0, total, PARTE):
            pedaco = dados[ini: ini + PARTE]
            ultimo = self._req("PUT", url, "enviar parte", content=pedaco,
                               headers={"Content-Range": f"bytes {ini}-{ini + len(pedaco) - 1}/{total}"})
        return ultimo.json()["id"]

    def baixar(self, cred: Credencial, ref: str) -> bytes:
        return self._req("GET", f"{GRAPH}/me/drive/items/{ref}/content", "baixar arquivo", headers=self._cab(cred)).content
