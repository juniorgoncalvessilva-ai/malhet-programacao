"""Rotas HTTP do módulo auth."""
from __future__ import annotations
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from shared.i18n import t
from ..domain.rbac import Permission
from ..application.dto import (
    RegisterInput, VerifyEmailInput, LoginInput, RefreshInput, EmailInput,
    ResetPasswordInput, ChangePasswordInput, LogoutInput, MfaConfirmInput, MfaDisableInput)
from .http import (
    RegisterBody, TokenBody, LoginBody, EmailBody, ResetBody, ChangeBody, CodeBody, PasswordBody,
    locale_of, from_result, fail, _auth, _ip, _limited, _csrf_ok, _stamp, _clear, require_user)
from shared.result import Error

router = APIRouter(prefix="/auth")


@router.post("/register")
async def register(body: RegisterBody, request: Request):
    locale = locale_of(request)
    blocked = await _limited(request, "register", _auth(request).register_limit, 3600)
    if blocked:
        return blocked
    result = await _auth(request).register.execute(RegisterInput(body.email, body.password, body.locale or locale))
    if result.failed:
        return fail(result.errors, locale)
    return JSONResponse(status_code=201, content={
        "ok": True,
        "message_key": "register.success",
        "message": t("register.success", locale),
    })


@router.post("/verify-email")
async def verify_email(body: TokenBody, request: Request):
    result = await _auth(request).verify.execute(VerifyEmailInput(body.token))
    return from_result(result, locale_of(request))


@router.post("/resend")
async def resend(body: EmailBody, request: Request):
    blocked = await _limited(request, "resend", 3, 3600)
    if blocked:
        return blocked
    result = await _auth(request).resend.execute(EmailInput(body.email))
    return from_result(result, locale_of(request))


@router.post("/login")
async def login(body: LoginBody, request: Request):
    locale = locale_of(request)
    app = _auth(request)
    ip = _ip(request)
    email = (body.email or "").strip().lower()
    by_ip = await app.limiter.hit(f"login:ip:{ip}", limit=app.login_limit, window_s=60)
    by_acct = await app.limiter.hit(f"login:acct:{email}", limit=app.login_limit, window_s=60) if email else True
    if not by_ip or not by_acct:
        return fail([Error("rateLimited")], locale, 429)
    result = await app.login.execute(LoginInput(
        body.email, body.password, body.mfa_code, device=request.headers.get("user-agent"), ip=ip))
    if result.failed:
        return fail(result.errors, locale)
    pair = result.value
    if pair.mfa_required:
        return JSONResponse(status_code=200, content={
            "ok": True,
            "data": {"mfa_required": True, "access_token": ""},
            "message_key": "login.mfaRequired",
            "message": t("login.mfaRequired", locale),
        })
    resp = JSONResponse(status_code=200, content={
        "ok": True,
        "data": {"access_token": pair.access_token, "mfa_required": False},
        "message_key": "login.success",
        "message": t("login.success", locale),
    })
    return _stamp(resp, pair.refresh_token)


@router.post("/refresh")
async def refresh(request: Request):
    locale = locale_of(request)
    if not _csrf_ok(request):
        return fail([Error("auth.csrf")], locale, 403)
    raw = request.cookies.get("refresh_token") or ""
    result = await _auth(request).refresh.execute(RefreshInput(raw))
    if result.failed:
        return fail(result.errors, locale)
    resp = JSONResponse(status_code=200, content={"ok": True, "data": {"access_token": result.value.access_token, "mfa_required": False}})
    return _stamp(resp, result.value.refresh_token)


@router.post("/logout")
async def logout(request: Request):
    locale = locale_of(request)
    if not _csrf_ok(request):
        return fail([Error("auth.csrf")], locale, 403)
    raw = request.cookies.get("refresh_token") or ""
    result = await _auth(request).logout.execute(LogoutInput(raw))
    return _clear(from_result(result, locale))


@router.post("/logout-all")
async def logout_all(request: Request):
    user = await require_user(request, Permission.SESSIONS_REVOKE)
    result = await _auth(request).logout_all.execute(user.id)
    return _clear(from_result(result, locale_of(request)))


@router.post("/password/forgot")
async def forgot(body: EmailBody, request: Request):
    blocked = await _limited(request, "forgot", 5, 3600)
    if blocked:
        return blocked
    result = await _auth(request).forgot.execute(EmailInput(body.email))
    return from_result(result, locale_of(request))


@router.post("/password/reset")
async def reset(body: ResetBody, request: Request):
    result = await _auth(request).reset.execute(ResetPasswordInput(body.token, body.new_password))
    return from_result(result, locale_of(request))


@router.post("/password/change")
async def change(body: ChangeBody, request: Request):
    user = await require_user(request, Permission.PASSWORD_CHANGE)
    result = await _auth(request).change.execute(
        ChangePasswordInput(user.id, body.current_password, body.new_password))
    return from_result(result, locale_of(request))


@router.post("/mfa/enable")
async def mfa_enable(request: Request):
    user = await require_user(request, Permission.MFA_MANAGE)
    result = await _auth(request).enable_mfa.execute(user.id)
    if result.failed:
        return fail(result.errors, locale_of(request))
    return JSONResponse(status_code=200, content={"ok": True, "data": {
        "otpauth_uri": result.value.otpauth_uri,
        "backup_codes": list(result.value.backup_codes),
    }})


@router.post("/mfa/confirm")
async def mfa_confirm(body: CodeBody, request: Request):
    user = await require_user(request, Permission.MFA_MANAGE)
    result = await _auth(request).confirm_mfa.execute(MfaConfirmInput(user.id, body.code))
    return from_result(result, locale_of(request))


@router.post("/mfa/disable")
async def mfa_disable(body: PasswordBody, request: Request):
    user = await require_user(request, Permission.MFA_MANAGE)
    result = await _auth(request).disable_mfa.execute(MfaDisableInput(user.id, body.password))
    return from_result(result, locale_of(request))


@router.get("/me")
async def me(request: Request):
    user = await require_user(request, Permission.ME)
    return JSONResponse(status_code=200, content={"ok": True, "data": {
        "id": user.id, "email": user.email, "roles": list(user.roles),
        "locale": user.locale, "mfa_enabled": user.mfa_enabled,
    }})


@router.get("/sessions")
async def sessions(request: Request):
    user = await require_user(request, Permission.SESSIONS_READ)
    rows = await _auth(request).sessions.list_for_user(user.id)
    return JSONResponse(status_code=200, content={"ok": True, "data": [{
        "id": s.id, "device": s.device, "ip": s.ip,
        "created_at": s.created_at.isoformat(),
        "expires_at": s.expires_at.isoformat() if s.expires_at else None,
        "revoked": s.revoked_at is not None,
    } for s in rows if s.active]})


@router.get("/admin/ping")
async def admin_ping(request: Request):
    await require_user(request, Permission.USERS_ADMIN)
    return JSONResponse(status_code=200, content={"ok": True, "data": {"ok": True}})
