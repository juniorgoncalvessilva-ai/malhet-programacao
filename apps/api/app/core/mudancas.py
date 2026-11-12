"""Mudanças por obra, para as telas se atualizarem sozinhas (sem recarregar a página).

Toda requisição que altera dados (POST/PUT/PATCH/DELETE com sucesso) soma 1 no contador da obra (cabeçalho
X-Obra-Id) ou no geral (telas de administração). As telas consultam `GET /api/mudancas` a cada poucos segundos e,
quando a marca muda, recarregam os dados abertos. A marca leva o id do processo: reiniciar a API também avisa.
A API roda em um processo (uvicorn sem workers); com mais de um, troque por LISTEN/NOTIFY do Postgres.
"""
import uuid
from collections import defaultdict

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

BOOT = uuid.uuid4().hex[:8]
_GERAL = "geral"
_contador: dict[str, int] = defaultdict(int)
_ESCRITA = {"POST", "PUT", "PATCH", "DELETE"}
_IGNORAR = ("/api/auth/",)  # login, refresh de token etc. não mudam dados da obra
_SO_LEITURA = ("/previa",)  # POST que só consulta (prévias)


def registrar(obra: str | None) -> None:
    _contador[obra or _GERAL] += 1


def marca(obra_id: int | None) -> str:
    return f"{BOOT}.{_contador[_GERAL]}.{_contador[str(obra_id)] if obra_id else 0}"


class MudancasMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        resp = await call_next(request)
        if (request.method in _ESCRITA and resp.status_code < 400 and request.url.path.startswith("/api/")
                and not request.url.path.startswith(_IGNORAR) and not request.url.path.endswith(_SO_LEITURA)):
            registrar(request.headers.get("x-obra-id"))
        return resp
