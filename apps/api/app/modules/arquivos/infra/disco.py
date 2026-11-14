"""Disco da VPS: cache quente dos arquivos (originais recentes + miniaturas sempre). Caminho: <dir>/<obra>/<uid[:2]>/<uid>."""
import os
import shutil
from pathlib import Path

from app.core.config import get_settings


def raiz() -> Path:
    return Path(get_settings().arquivos_dir)


def caminho(obra_id: int, uid: str, mini: bool = False) -> Path:
    return raiz() / str(obra_id) / uid[:2] / (f"{uid}.mini.jpg" if mini else uid)


def gravar(obra_id: int, uid: str, dados: bytes, mini: bool = False) -> None:
    p = caminho(obra_id, uid, mini)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(p.suffix + ".tmp")
    tmp.write_bytes(dados)
    os.replace(tmp, p)  # atômico: nunca fica meio arquivo


def ler(obra_id: int, uid: str, mini: bool = False) -> bytes | None:
    p = caminho(obra_id, uid, mini)
    return p.read_bytes() if p.exists() else None


def apagar(obra_id: int, uid: str, mini: bool = False) -> None:
    caminho(obra_id, uid, mini).unlink(missing_ok=True)


def uso() -> dict:
    r = raiz()
    r.mkdir(parents=True, exist_ok=True)
    total, usado, livre = shutil.disk_usage(r)
    return {"total": total, "usado": usado, "livre": livre}
