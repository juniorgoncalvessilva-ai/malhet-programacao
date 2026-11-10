"""Erros de domínio comuns (chaves i18n)."""
from .result import Error

INVALID_EMAIL = Error("validation.email.invalid", field_name="email")
WEAK_PASSWORD = Error("validation.password.tooWeak", field_name="password")
REQUIRED = lambda field_name: Error("validation.required", field_name=field_name)  # noqa: E731
