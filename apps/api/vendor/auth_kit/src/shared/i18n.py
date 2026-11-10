"""i18n mínimo: carrega locales/<locale>/*.json e traduz por chave."""
from __future__ import annotations
import json
from functools import lru_cache
from pathlib import Path

_LOCALES_DIR = Path(__file__).resolve().parents[2] / "locales"
_SUPPORTED = ("pt-BR", "en")
_DEFAULT = "pt-BR"


@lru_cache(maxsize=None)
def _catalog(locale: str) -> dict[str, str]:
    data: dict[str, str] = {}
    base = _LOCALES_DIR / locale
    if base.is_dir():
        for f in base.glob("*.json"):
            data.update(json.loads(f.read_text(encoding="utf-8")))
    return data


def resolve_locale(preferred: str | None) -> str:
    if preferred in _SUPPORTED:
        return preferred  # type: ignore[return-value]
    return _DEFAULT


def t(key: str, locale: str | None = None, **params) -> str:
    loc = resolve_locale(locale)
    msg = _catalog(loc).get(key) or _catalog(_DEFAULT).get(key) or key
    try:
        return msg.format(**params) if params else msg
    except Exception:
        return msg
