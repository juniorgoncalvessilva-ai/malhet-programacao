import os

os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg://app:app@localhost:5432/programacao_test"
)
os.environ.setdefault("AUTH_DISABLED", "true")
os.environ.setdefault("JWT_SECRET", "segredo-de-teste-com-mais-de-32-caracteres")
# arquivos (spec 082): disco temporário e sem a tarefa em segundo plano (os testes chamam a fila na mão)
import tempfile  # noqa: E402

os.environ["ARQUIVOS_DIR"] = tempfile.mkdtemp(prefix="malhet-arquivos-")
os.environ["ARQUIVOS_FILA"] = "false"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import app.core.authkit  # noqa: E402,F401
import app.models  # noqa: E402,F401
from app.core.db import Base, engine  # noqa: E402
from modules.auth.infra.models import Base as AuthBase  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture()
def client():
    from app.shared.cache_leitura import limpar

    limpar()  # cada teste recria o banco: nada guardado de um teste vale no outro
    for md in (Base.metadata, AuthBase.metadata):
        md.drop_all(engine)
        md.create_all(engine)
    with TestClient(app) as c:
        r = c.post("/api/admin/obras", json={"codigo": "310", "nome": "Obra 310 · teste"})
        assert r.status_code == 201, r.text
        c.headers["X-Obra-Id"] = str(r.json()["id"])
        yield c
