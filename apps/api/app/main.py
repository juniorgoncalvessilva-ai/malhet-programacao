import logging
import os
from contextlib import asynccontextmanager

import app.core.authkit  # noqa: F401  (antes de qualquer import do kit)
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from modules.auth.presentation.container import build_auth
from modules.auth.presentation.router import router as auth_router

import app.models  # noqa: F401  (registra os modelos)
from app.core.config import get_settings
from app.modules.cadastros.api.router import router as cadastros
from app.modules.catalogo.api.router import router as catalogo
from app.modules.frentes.api.router import router as frentes
from app.modules.planejamento.api.router import router as planejamento
from app.modules.equipes.api.router import router as equipes
from app.modules.integracao_simova.api.router import router as simova
from app.modules.obras.api.router import router as obras
from app.modules.obras.application.acessos import garantir_superadmin
from app.modules.obras.infra.contas_authkit import ContasAuthKit
from app.modules.programacao.api.router import router as programacao
from app.modules.referencias.api.router import router as referencias
from app.modules.ssma.api.router import router as ssma
from app.modules.efetivo.api.router import router as efetivo
from app.modules.wbs.api.router import router as wbs
from app.modules.indicadores.api.desvios import router as desvios
from app.modules.indicadores.api.router import router as indicadores
from app.modules.lookahead.api.router import router as lookahead
from app.modules.restricoes.api.router import router as restricoes
from app.modules.campo.api.router import router as campo
from app.shared.errors import DomainError, NotFoundError


log = logging.getLogger("malhet")

# Contas promovidas a Super Admin no boot: SUPERADMIN_* e o admin semente SEED_ADMIN_* (mesmo e-mail/senha do Coolify)
_SUPERADMINS = (("SUPERADMIN_EMAIL", "SUPERADMIN_PASSWORD"), ("SEED_ADMIN_EMAIL", "SEED_ADMIN_PASSWORD"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    contas = ContasAuthKit(app.state.auth)
    for var_email, var_senha in _SUPERADMINS:
        email = os.getenv(var_email, "").strip()
        try:
            await garantir_superadmin(contas, email, os.getenv(var_senha, ""))
            if email:
                log.warning("Super Admin garantido: %s (%s)", email, var_email)
        except Exception as exc:  # senha fora da regra etc.: não derruba a API
            log.error("Não foi possível garantir o Super Admin %s (%s): %s", email, var_email, exc)
    yield


app = FastAPI(title="Malhet · Programação × Simova", version="0.4.0", lifespan=lifespan)
app.state.auth = build_auth()
app.add_middleware(
    CORSMiddleware, allow_origins=get_settings().cors_list, allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept-Language", "X-CSRF-Token"],
    expose_headers=["Content-Disposition", "X-Itens"],
)


@app.exception_handler(DomainError)
async def _domain(_: Request, exc: DomainError):
    return JSONResponse(status_code=422, content={"detail": exc.mensagem, "campo": exc.campo})


@app.exception_handler(NotFoundError)
async def _not_found(_: Request, exc: NotFoundError):
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(HTTPException)
async def _http(_: Request, exc: HTTPException):
    # o auth-kit levanta HTTPException com o corpo {ok, errors, message} já pronto
    if isinstance(exc.detail, dict):
        return JSONResponse(exc.detail, status_code=exc.status_code)
    return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)


@app.get("/health", tags=["infra"])
def health():
    return {"status": "ok"}


app.include_router(auth_router, prefix="/api", tags=["auth (auth-kit)"])
for r in (obras, frentes, catalogo, planejamento, cadastros, referencias, equipes, programacao, simova, ssma, efetivo, wbs, desvios, indicadores, lookahead, restricoes, campo):
    app.include_router(r, prefix="/api")
