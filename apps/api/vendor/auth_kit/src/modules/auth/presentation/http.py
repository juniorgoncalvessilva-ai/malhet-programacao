"""Rotas /auth. Access no corpo; refresh só em cookie httpOnly. Papel relido do usuário."""
from __future__ import annotations
import hmac, secrets
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from shared.i18n import t
from shared.result import Result, Error
from shared.settings import settings
from ..domain.entities import User, UserStatus
from ..domain.rbac import Permission, authorize
from ..application.dto import (
    RegisterInput, VerifyEmailInput, LoginInput, RefreshInput, EmailInput,
    ResetPasswordInput, ChangePasswordInput, LogoutInput, MfaConfirmInput, MfaDisableInput)
from .container import AuthApp

router = APIRouter(prefix="/auth")

_STATUS = {
    "login.invalid": 401, "login.unverified": 403, "mfa.invalid": 401,
    "verify.invalid": 400, "password.change.wrongCurrent": 401,
    "auth.forbidden": 403, "auth.unauthenticated": 401, "auth.csrf": 403, "rateLimited": 429,
}


class RegisterBody(BaseModel):
    email: str
    password: str
    locale: str = "pt-BR"


class TokenBody(BaseModel):
    token: str


class LoginBody(BaseModel):
    email: str
    password: str
    mfa_code: str | None = None


class EmailBody(BaseModel):
    email: str


class ResetBody(BaseModel):
    token: str
    new_password: str


class ChangeBody(BaseModel):
    current_password: str
    new_password: str


class CodeBody(BaseModel):
    code: str


class PasswordBody(BaseModel):
    password: str


def locale_of(request: Request) -> str:
    raw = request.headers.get("accept-language", "")
    first = raw.split(",")[0].strip().lower()
    if first.startswith("pt"):
        return "pt-BR"
    if first.startswith("en"):
        return "en"
    return "pt-BR"


def error_body(errors: tuple[Error, ...] | list[Error], locale: str, status: int | None = None) -> tuple[int, dict]:
    items = list(errors) or [Error("login.invalid")]
    key = items[0].key
    code = status or (422 if key.startswith("validation.") else _STATUS.get(key, 400))
    return code, {
        "ok": False,
        "errors": [{"key": e.key, "params": e.params, "field": e.field_name} for e in items],
        "message": t(key, locale, **{k: str(v) for k, v in items[0].params.items()}),
    }


def fail(errors: tuple[Error, ...] | list[Error], locale: str, status: int | None = None) -> JSONResponse:
    code, body = error_body(errors, locale, status)
    return JSONResponse(body, status_code=code)


def from_result(result: Result, locale: str, *, status: int = 200, data=None) -> JSONResponse:
    if result.failed:
        return fail(result.errors, locale)
    body: dict = {"ok": True}
    if isinstance(result.value, str):
        body["message_key"] = result.value
        body["message"] = t(result.value, locale)
    if data is not None:
        body["data"] = data
    return JSONResponse(body, status_code=status)


def _auth(request: Request) -> AuthApp:
    return request.app.state.auth


def _ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


async def _limited(request: Request, bucket: str, limit: int, window_s: int) -> JSONResponse | None:
    # por IP e, quando o bucket traz a conta, a chave já distingue os dois
    allowed = await _auth(request).limiter.hit(f"{bucket}:{_ip(request)}", limit=limit, window_s=window_s)
    if allowed:
        return None
    return fail([Error("rateLimited")], locale_of(request), 429)


def _csrf_ok(request: Request) -> bool:
    cookie = request.cookies.get("csrf_token") or ""
    header = request.headers.get("x-csrf-token") or ""
    if not cookie or not header:
        return False
    return hmac.compare_digest(cookie, header)


def _stamp(response: JSONResponse, refresh: str) -> JSONResponse:
    csrf = secrets.token_urlsafe(32)
    max_age = settings.refresh_ttl_days * 86400
    response.set_cookie("refresh_token", refresh, httponly=True, secure=settings.cookie_secure,
                        samesite=settings.cookie_samesite, path="/", max_age=max_age)
    response.set_cookie("csrf_token", csrf, httponly=False, secure=settings.cookie_secure,
                        samesite=settings.cookie_samesite, path="/", max_age=max_age)
    return response


def _clear(response: JSONResponse) -> JSONResponse:
    response.delete_cookie("refresh_token", path="/")
    response.delete_cookie("csrf_token", path="/")
    return response


async def require_user(request: Request, permission: Permission) -> User:
    header = request.headers.get("authorization", "")
    token = header[7:].strip() if header.lower().startswith("bearer ") else ""
    payload = _auth(request).jwt.verify_access(token) if token else None
    user = await _auth(request).users.by_id(payload["sub"]) if payload else None
    locale = locale_of(request)
    if not user or not user.is_verified or user.status == UserStatus.BLOCKED:
        _, body = error_body([Error("auth.unauthenticated")], locale, 401)
        raise HTTPException(401, detail=body)
    if authorize(user.roles, permission).failed:
        _, body = error_body([Error("auth.forbidden")], locale, 403)
        raise HTTPException(403, detail=body)
    return user
