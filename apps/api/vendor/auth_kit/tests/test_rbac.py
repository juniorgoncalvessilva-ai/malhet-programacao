"""RBAC: papel user não administra; admin sim; papel desconhecido não concede nada."""
from __future__ import annotations
import sys, pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "src"))

from modules.auth.domain.rbac import Permission, authorize


def main() -> None:
    assert authorize(("user",), Permission.ME).ok
    assert authorize(("user",), Permission.USERS_ADMIN).failed
    assert authorize(("user",), Permission.USERS_ADMIN).errors[0].key == "auth.forbidden"
    assert authorize(("admin",), Permission.USERS_ADMIN).ok
    assert authorize(("admin",), Permission.MFA_MANAGE).ok
    assert authorize(("ghost",), Permission.ME).failed
    print("RBAC OK")


if __name__ == "__main__":
    main()
