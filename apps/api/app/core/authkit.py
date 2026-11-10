"""Ponte para o auth-kit (vendor/auth_kit, cópia de juniorgoncalvessilva-ai/auth-kit).

O kit usa pacotes de topo `modules.auth` e `shared` e lê o ambiente na importação, então:
1) carrega o .env em os.environ; 2) põe vendor/auth_kit/src no sys.path. Importe este módulo antes do kit.
"""
import sys
from pathlib import Path

_SRC = Path(__file__).resolve().parents[2] / "vendor" / "auth_kit" / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from modules.auth.infra.envfile import load_dotenv  # noqa: E402

load_dotenv()
