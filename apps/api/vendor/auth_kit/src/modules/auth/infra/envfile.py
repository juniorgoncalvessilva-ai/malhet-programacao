"""Carrega .env sem dependência. Não sobrescreve variável que já existe no ambiente."""
from __future__ import annotations
import os
from pathlib import Path


def load_dotenv() -> None:
    here = Path(__file__).resolve()
    candidates = [Path.cwd() / ".env", here.parents[4] / ".env", here.parents[5] / ".env"]
    for path in candidates:
        if not path.is_file():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key, value = key.strip(), value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value
        return
