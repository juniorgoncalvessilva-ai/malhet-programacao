"""Telas do celular liberadas por pessoa (acesso_obra.paginas_mobile)

Revision ID: 0037_paginas_mobile
Revises: 0036_cadastro_simplificado
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0037_paginas_mobile"
down_revision = "0036_cadastro_simplificado"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("acesso_obra", sa.Column("paginas_mobile", JSONB))


def downgrade() -> None:
    op.drop_column("acesso_obra", "paginas_mobile")
