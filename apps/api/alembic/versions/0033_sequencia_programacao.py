"""Sequência da programação: ordem manual e ligações TI/II/TT/IT entre linhas

Revision ID: 0033_sequencia_programacao
Revises: 0032_equipe_supervisor
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0033_sequencia_programacao"
down_revision = "0032_equipe_supervisor"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("programacao", sa.Column("sequenciada", sa.Boolean, nullable=False, server_default="false"))
    op.add_column("programacao_linha", sa.Column("predecessoras", JSONB))


def downgrade() -> None:
    op.drop_column("programacao_linha", "predecessoras")
    op.drop_column("programacao", "sequenciada")
