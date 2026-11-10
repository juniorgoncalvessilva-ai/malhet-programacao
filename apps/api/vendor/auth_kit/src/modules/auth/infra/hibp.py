"""Have I Been Pwned, API de range (k-anonimato). Só os 5 primeiros do SHA-1 saem daqui."""
from __future__ import annotations
import hashlib, os, urllib.request
from ..application.providers import BreachChecker, NeverBreached


def suffix_listed(body: str, suffix: str) -> bool:
    for line in body.splitlines():
        head, _, count = line.partition(":")
        if head.strip().upper() == suffix and count.strip() not in ("", "0"):
            return True
    return False


class HibpRange(BreachChecker):
    def breached(self, password: str) -> bool:
        digest = hashlib.sha1(password.encode()).hexdigest().upper()
        prefix, suffix = digest[:5], digest[5:]
        req = urllib.request.Request(
            f"https://api.pwnedpasswords.com/range/{prefix}",
            headers={"Add-Padding": "true", "User-Agent": "auth-module"},
        )
        try:
            with urllib.request.urlopen(req, timeout=3) as resp:
                body = resp.read().decode()
        except Exception:
            # ponytail: HIBP fora do ar não trava cadastro. Troque por fila se precisar falhar fechado.
            return False
        return suffix_listed(body, suffix)


def checker_from_env() -> BreachChecker:
    if os.getenv("HIBP", "").strip() in ("1", "true", "yes"):
        return HibpRange()
    return NeverBreached()
