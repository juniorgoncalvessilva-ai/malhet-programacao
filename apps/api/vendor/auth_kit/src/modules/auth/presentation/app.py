"""App FastAPI do módulo de auth. `uvicorn main:app` com PYTHONPATH=src."""
from __future__ import annotations
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from shared.settings import settings
from ..infra.seed import seed_admin
from .container import AuthApp, build_auth
from .router import router

_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"


def create_app(auth: AuthApp | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        await seed_admin(app.state.auth)
        yield

    app = FastAPI(title="auth", docs_url="/docs", lifespan=lifespan)
    app.state.auth = auth or build_auth()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Accept-Language", "X-CSRF-Token"],
    )

    @app.middleware("http")
    async def security_headers(request, call_next):
        response = await call_next(request)
        response.headers["Content-Security-Policy"] = _CSP
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        if settings.hsts:
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        return response

    @app.exception_handler(HTTPException)
    async def http_errors(_request, exc: HTTPException):
        if isinstance(exc.detail, dict):
            return JSONResponse(exc.detail, status_code=exc.status_code)
        return JSONResponse({"ok": False, "message": str(exc.detail)}, status_code=exc.status_code)

    @app.get("/health")
    async def health():
        return {"ok": True}

    app.include_router(router)
    return app
