"""tabelas auth_* do auth-kit (vendor/auth_kit). O desenho mora em modules.auth.infra.models.Base.

Revision ID: 0002_auth_kit
Revises: 0001_inicial
"""
import app.core.authkit  # noqa: F401
from alembic import op
from modules.auth.infra.models import Base

revision = "0002_auth_kit"
down_revision = "0001_inicial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    Base.metadata.create_all(op.get_bind())


def downgrade() -> None:
    Base.metadata.drop_all(op.get_bind())
