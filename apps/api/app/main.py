import os
from contextlib import asynccontextmanager

import app.core.authkit  # noqa: F401  (antes de qualquer import do kit)
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from modules.auth.infra.seed import seed_admin
from modules.auth.presentation.container import build_auth
from modules.auth.presentation.router import router as auth_router

import app.models  # noqa: F401  (registra os modelos)
from app.core.config import get_settings
from app.modules.cadastros.api.router import router as cadastros
from app.modules.equipes.api.router import router as equipes
from app.modules.integracao_simova.api.router import router as simova
from app.modules.obras.api.router import router as obras
from app.modules.obras.application.acessos import garantir_superadmin
from app.modules.obras.infra.contas_authkit import ContasAuthKit
from app.modules.programacao.api.router import router as programacao
from app.modules.referencias.api.router import router as referencias
from app.shared.errors import DomainError, NotFoundError


@asynccontextmanager
async def lifespan(app: FastAPI):
    await seed_admin(app.state.auth)
    await garantir_superadmin(ContasAuthKit(app.state.auth), os.getenv("SUPERADMIN_EMAIL", "").strip(),
                              os.getenv("SUPERADMIN_PASSWORD", ""))
    yield


app = FastAPI(title="Malhet · Programação × Simova", version="0.3.0", lifespan=lifespan)
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
for r in (obras, cadastros, referencias, equipes, programacao, simova):
    app.include_router(r, prefix="/api")
