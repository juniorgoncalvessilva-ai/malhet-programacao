from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import app.models  # noqa: F401  (registra os modelos)
from app.core.config import get_settings
from app.modules.cadastros.api.router import router as cadastros
from app.modules.equipes.api.router import router as equipes
from app.modules.integracao_simova.api.router import router as simova
from app.modules.programacao.api.router import router as programacao
from app.modules.referencias.api.router import router as referencias
from app.shared.errors import DomainError, NotFoundError

app = FastAPI(title="Programação de Obra × Simova", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=get_settings().cors_list, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"], expose_headers=["Content-Disposition", "X-Itens"])


@app.exception_handler(DomainError)
async def _domain(_: Request, exc: DomainError):
    return JSONResponse(status_code=422, content={"detail": exc.mensagem, "campo": exc.campo})


@app.exception_handler(NotFoundError)
async def _not_found(_: Request, exc: NotFoundError):
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.get("/health", tags=["infra"])
def health():
    return {"status": "ok"}


for r in (cadastros, referencias, equipes, programacao, simova):
    app.include_router(r, prefix="/api")
