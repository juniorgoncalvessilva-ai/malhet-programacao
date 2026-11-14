"""Google Drive (API v3). Escopo `drive.file`: o app só vê o que ele mesmo criou — não lê o resto do Drive e dispensa a
verificação pesada do Google. Funciona em Drive compartilhado (supportsAllDrives)."""
import json
from urllib.parse import urlencode

from app.modules.arquivos.domain.provedor import Conexao, Credencial, ErroProvedor
from app.modules.arquivos.infra.provedores.base import Base, email_do_id_token

API = "https://www.googleapis.com/drive/v3"
UPLOAD = "https://www.googleapis.com/upload/drive/v3"
PASTA = "application/vnd.google-apps.folder"
COMUM = {"supportsAllDrives": "true"}


class GoogleDrive(Base):
    nome = "Google Drive"
    token_url = "https://oauth2.googleapis.com/token"

    def url_autorizacao(self, state: str, retorno: str) -> str:
        return "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode({
            "client_id": self.client_id, "redirect_uri": retorno, "response_type": "code", "state": state,
            "scope": "https://www.googleapis.com/auth/drive.file openid email", "access_type": "offline", "prompt": "consent"})

    def conectar(self, codigo: str, retorno: str) -> Conexao:
        t = self._pedir_token({"grant_type": "authorization_code", "code": codigo, "redirect_uri": retorno})
        if not t.get("refresh_token"):
            raise ErroProvedor("o Google não devolveu o acesso permanente: remova o app em myaccount.google.com/permissions e conecte de novo", True)
        return Conexao(t["refresh_token"], email_do_id_token(t.get("id_token")))

    def _pasta(self, cred: Credencial, caminho: list[str]) -> str:
        pai = "root"
        for i, nome in enumerate(caminho):
            chave = "/".join(caminho[: i + 1])
            if chave in cred.pastas:
                pai = cred.pastas[chave]
                continue
            q = f"name = '{nome.replace(chr(39), '')}' and '{pai}' in parents and mimeType = '{PASTA}' and trashed = false"
            r = self._req("GET", f"{API}/files", "procurar pasta", headers=self._cab(cred),
                          params={"q": q, "fields": "files(id)", "includeItemsFromAllDrives": "true", **COMUM})
            achou = r.json().get("files") or []
            if achou:
                pai = achou[0]["id"]
            else:
                r = self._req("POST", f"{API}/files", "criar pasta", headers=self._cab(cred), params={"fields": "id", **COMUM},
                              json={"name": nome, "mimeType": PASTA, "parents": [pai]})
                pai = r.json()["id"]
            cred.pastas[chave] = pai
        return pai

    def enviar(self, cred: Credencial, caminho: list[str], nome: str, dados: bytes, mime: str, substituir: bool = False) -> str:
        chave_arq = "arquivo:" + "/".join([*caminho, nome])
        existente = cred.pastas.get(chave_arq) if substituir else None
        if existente:
            r = self._req("PATCH", f"{UPLOAD}/files/{existente}", "atualizar arquivo", headers=self._cab(cred, **{"Content-Type": mime}),
                          params={"uploadType": "media", "fields": "id", **COMUM}, content=dados)
            return r.json()["id"]
        pai = self._pasta(cred, caminho)
        # envio retomável: 1 pedido com os metadados, 1 com o conteúdo (sem o limite de 5 MB do multipart)
        r = self._req("POST", f"{UPLOAD}/files", "iniciar envio",
                      headers=self._cab(cred, **{"Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": mime}),
                      params={"uploadType": "resumable", "fields": "id", **COMUM}, content=json.dumps({"name": nome, "parents": [pai]}))
        sessao = r.headers.get("location")
        if not sessao:
            raise ErroProvedor("Google Drive: envio sem endereço de sessão")
        r = self._req("PUT", sessao, "enviar arquivo", headers={"Content-Type": mime}, content=dados)
        ref = r.json()["id"]
        if substituir:
            cred.pastas[chave_arq] = ref
        return ref

    def baixar(self, cred: Credencial, ref: str) -> bytes:
        return self._req("GET", f"{API}/files/{ref}", "baixar arquivo", headers=self._cab(cred), params={"alt": "media", **COMUM}).content
