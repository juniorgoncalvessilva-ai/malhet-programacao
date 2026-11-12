"""Importa todos os modelos para o metadata (Alembic e testes)."""
from app.core.db import Base  # noqa: F401
from app.modules.cadastros.infra import models as _cadastros  # noqa: F401
from app.modules.referencias.infra import models as _referencias  # noqa: F401
from app.modules.equipes.infra import models as _equipes  # noqa: F401
from app.modules.programacao.infra import models as _programacao  # noqa: F401
from app.modules.obras.infra import models as _obras  # noqa: F401
from app.modules.frentes.infra import models as _frentes  # noqa: F401
from app.modules.catalogo.infra import models as _catalogo  # noqa: F401
from app.modules.planejamento.infra import models as _planejamento  # noqa: F401
from app.modules.ssma.infra import models as _ssma  # noqa: F401
from app.modules.efetivo.infra import models as _efetivo  # noqa: F401
from app.modules.wbs.infra import models as _wbs  # noqa: F401
from app.modules.indicadores.infra import models as _indicadores  # noqa: F401
from app.modules.restricoes.infra import models as _restricoes  # noqa: F401
from app.modules.campo.infra import models as _campo  # noqa: F401
