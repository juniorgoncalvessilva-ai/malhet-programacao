"""DTOs de entrada/saída dos casos de uso de auth."""
from __future__ import annotations
from dataclasses import dataclass


@dataclass(frozen=True)
class RegisterInput:
    email: str
    password: str
    locale: str = "pt-BR"


@dataclass(frozen=True)
class VerifyEmailInput:
    token: str


@dataclass(frozen=True)
class LoginInput:
    email: str
    password: str
    mfa_code: str | None = None
    device: str | None = None
    ip: str | None = None


@dataclass(frozen=True)
class RefreshInput:
    refresh_token: str


@dataclass(frozen=True)
class TokenPair:
    access_token: str
    refresh_token: str
    mfa_required: bool = False


@dataclass(frozen=True)
class RegisterOutput:
    user_id: str
    verification_token: str  # em produção só vai por e-mail; útil para testes/dev


@dataclass(frozen=True)
class EmailInput:
    email: str


@dataclass(frozen=True)
class ResetPasswordInput:
    token: str
    new_password: str


@dataclass(frozen=True)
class ChangePasswordInput:
    user_id: str
    current_password: str
    new_password: str


@dataclass(frozen=True)
class LogoutInput:
    refresh_token: str


@dataclass(frozen=True)
class MfaSetupOutput:
    otpauth_uri: str
    backup_codes: tuple[str, ...]  # mostrados 1x ao usuário; só o hash é guardado


@dataclass(frozen=True)
class MfaConfirmInput:
    user_id: str
    code: str


@dataclass(frozen=True)
class MfaDisableInput:
    user_id: str
    password: str
