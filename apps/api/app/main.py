import logging
import os
from contextlib import asynccontextmanager

import app.core.authkit  # noqa: F401  (antes de qualquer import do kit)
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import DEFAULT_EXCLUDED_CONTENT_TYPES, GZipMiddleware
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
from app.modules.campo.api.fotos import router as fotos
from app.modules.obras.api.marca import router as marca
from app.modules.planos.api.router import router as planos
from app.modules.presenca.api.router import router as presenca
from app.modules.acoes.api.router import router as acoes
from app.modules.auditorias.api.router import router as auditorias
from app.modules.preventivos.api.router import router as preventivos
from app.modules.lgpd.api.router import router as lgpd
from app.modules.perfil.api.router import router as perfil
from app.modules.notificacoes.api.router import router as notificacoes
from app.modules.criterios.api.router import router as criterios
from app.modules.arquivos.api.router import router as armazenamento
from app.modules.treinamentos.api.router import router as treinamentos
from app.modules.mobilizacao.api.router import router as mobilizacao
from app.modules.erros.api.router import router as erros
from app.modules.aderencia.api.router import router as aderencia
from app.modules.lideres.api.router import publico as portal_lider, router as lideres
from app.modules.arquivos.application import fila as fila_arquivos
import app.modules.campo.application.arquivos  # noqa: F401  (registra as fotos na fila de arquivos)
import app.modules.ssma.application.arquivos  # noqa: F401  (registra os anexos de SSMA)
import app.modules.aderencia.application.importar  # noqa: F401  (registra os modelos de apresentação)
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
    fila_arquivos.iniciar()  # spec 082: sobe à nuvem, migra os arquivos do banco e libera o disco
    yield


from app.core.mudancas import MudancasMiddleware, marca as marca_mudancas  # noqa: E402
from app.core.auth import UsuarioAtual, usuario_atual  # noqa: E402
from fastapi import Depends  # noqa: E402

app = FastAPI(title="Malhet · Programação × Simova", version="0.4.0", lifespan=lifespan)
app.state.auth = build_auth()
# Spec 082: JSON grande (visão da programação, listas) vai comprimido — no 4G do campo faz diferença. Nível 5 poupa a
# vCPU; imagens e arquivos já comprimidos ficam de fora (padrão do Starlette). Fica por dentro do
# MudancasMiddleware: ele reenvia a resposta em pedaços e o gzip por fora comprimiria até as respostas pequenas.
_JA_COMPRIMIDOS = ("application/pdf", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                   "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
app.add_middleware(GZipMiddleware, minimum_size=1000, compresslevel=5,
                   exclude_content_types=DEFAULT_EXCLUDED_CONTENT_TYPES + _JA_COMPRIMIDOS)
app.add_middleware(MudancasMiddleware)
app.add_middleware(
    CORSMiddleware, allow_origins=get_settings().cors_list, allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept-Language", "X-CSRF-Token"],
    expose_headers=["Content-Disposition", "X-Itens"],
)


@app.get("/api/mudancas", tags=["tempo real"])
async def mudancas(request: Request, _: UsuarioAtual = Depends(usuario_atual)):
    """Marca das mudanças da obra (X-Obra-Id): mudou → a tela recarrega os dados abertos."""
    bruto = request.headers.get("x-obra-id")
    return {"marca": marca_mudancas(int(bruto) if bruto and bruto.isdigit() else None)}


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


def _guardar_erro_do_servidor(exc: Exception, metodo: str, rota: str, obra: str | None) -> tuple[str, str]:
    """Spec 098: a exceção não tratada vira relato (com sessão própria — a da requisição já voltou atrás)."""
    from app.core.db import SessionLocal
    from app.modules.erros.application.registrar import registrar, relato_do_servidor
    from app.modules.erros.infra.obras import obra_existe

    rel = relato_do_servidor(exc, metodo, rota)
    with SessionLocal() as s:
        registrar(s, rel, usuario_id=None, usuario_email=None, obra_id=int(obra) if obra and obra.isdigit() else None,
                  obra_existe=obra_existe)
        s.commit()
    return rel.codigo, rel.id_local


@app.exception_handler(Exception)
async def _inesperado(request: Request, exc: Exception):
    """Erro que ninguém previu: a equipe Malhet fica sabendo sozinha e a pessoa recebe um código para citar."""
    from starlette.concurrency import run_in_threadpool

    log.exception("Erro não tratado em %s %s", request.method, request.url.path)
    rota = getattr(request.scope.get("route"), "path", None) or request.url.path
    try:
        codigo, ref = await run_in_threadpool(_guardar_erro_do_servidor, exc, request.method, rota, request.headers.get("x-obra-id"))
    except Exception:  # guardar o relato nunca pode piorar o erro
        log.exception("Não foi possível guardar o relato do erro")
        codigo = ref = None
    msg = "Algo deu errado no servidor." + (f" Já avisamos a equipe Malhet (código {codigo})." if codigo else "")
    # erro_ref: a tela usa para a pessoa completar com "o que você fazia" (POST /erros/comentario)
    return JSONResponse({"detail": msg, "erro_id": codigo, "erro_ref": ref}, status_code=500)


@app.get("/health", tags=["infra"])
def health():
    return {"status": "ok"}


app.include_router(auth_router, prefix="/api", tags=["auth (auth-kit)"])
for r in (obras, frentes, catalogo, planejamento, cadastros, referencias, equipes, programacao, simova, ssma, efetivo, wbs, desvios, indicadores, lookahead, restricoes, campo, fotos, marca, planos, presenca, acoes, auditorias, preventivos, lgpd, perfil, notificacoes, criterios, armazenamento, treinamentos, mobilizacao, erros, aderencia, lideres, portal_lider):
    app.include_router(r, prefix="/api")
