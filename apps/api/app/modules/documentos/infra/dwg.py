"""DWG → DXF pelo conversor separado (`apps/api/conversor/dwg2dxf.mjs`, GPL — LibreDWG): a API só executa o programa e
lê o DXF. Sem Node ou sem o conversor instalado, o DWG fica guardado e a visualização avisa que não foi convertido."""
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from app.shared.errors import DomainError

CONVERSOR = Path(os.environ.get("CONVERSOR_DWG") or Path(__file__).resolve().parents[4] / "conversor" / "dwg2dxf.mjs")
TEMPO_S = int(os.environ.get("CONVERSOR_DWG_TEMPO", "120"))


def disponivel() -> bool:
    return bool(shutil.which(os.environ.get("NODE_BIN", "node"))) and CONVERSOR.exists() and \
        (CONVERSOR.parent / "node_modules" / "@mlightcad" / "libredwg-web").exists()


def dwg_para_dxf(dados: bytes) -> bytes:
    if not dados.startswith(b"AC10"):
        raise DomainError("o arquivo não é um DWG", "arquivo")
    if not disponivel():
        raise DomainError("conversor de DWG indisponível no servidor", "arquivo")
    with tempfile.TemporaryDirectory(prefix="dwg-") as d:
        ent, sai = Path(d) / "entrada.dwg", Path(d) / "saida.dxf"
        ent.write_bytes(dados)
        try:
            r = subprocess.run([os.environ.get("NODE_BIN", "node"), str(CONVERSOR), str(ent), str(sai)],
                               capture_output=True, timeout=TEMPO_S, cwd=str(CONVERSOR.parent))
        except subprocess.TimeoutExpired as e:
            raise DomainError("o DWG demorou demais para converter", "arquivo") from e
        if r.returncode != 0 or not sai.exists():
            raise DomainError("não consegui ler este DWG (versão ou arquivo danificado)", "arquivo")
        return sai.read_bytes()
