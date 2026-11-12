"""Recursos alocados nas atividades do cronograma (P6 TASKRSRC) e no plano de 90 dias

Revision ID: 0030_recursos_cronograma
Revises: 0029_plano_90_dias
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0030_recursos_cronograma"
down_revision = "0029_plano_90_dias"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("atividade_cronograma", sa.Column("recursos", JSONB))
    op.add_column("plano_item", sa.Column("recursos", JSONB))


def downgrade() -> None:
    op.drop_column("plano_item", "recursos")
    op.drop_column("atividade_cronograma", "recursos")
