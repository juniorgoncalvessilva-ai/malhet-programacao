"""Cadastro simplificado pelo campo (nome + função) com pendência para o DP/RH completar

Revision ID: 0036_cadastro_simplificado
Revises: 0035_auditorias_acoes
"""
import sqlalchemy as sa
from alembic import op

revision = "0036_cadastro_simplificado"
down_revision = "0035_auditorias_acoes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("colaborador", sa.Column("cadastro_pendente", sa.Boolean, nullable=False, server_default="false"))
    op.add_column("colaborador", sa.Column("cadastrado_por", sa.String(80)))
    op.add_column("colaborador", sa.Column("cadastrado_em", sa.DateTime(timezone=True)))


def downgrade() -> None:
    op.drop_column("colaborador", "cadastrado_em")
    op.drop_column("colaborador", "cadastrado_por")
    op.drop_column("colaborador", "cadastro_pendente")
