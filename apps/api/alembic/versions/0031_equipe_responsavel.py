"""equipe.responsavel_id: engenheiro/supervisor do efetivo que lidera a equipe

Revision ID: 0031_equipe_responsavel
Revises: 0030_recursos_cronograma
"""
import sqlalchemy as sa
from alembic import op

revision = "0031_equipe_responsavel"
down_revision = "0030_recursos_cronograma"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("equipe", sa.Column("responsavel_id", sa.Integer, sa.ForeignKey("colaborador.id", ondelete="SET NULL")))
    op.create_index("ix_equipe_responsavel_id", "equipe", ["responsavel_id"])


def downgrade() -> None:
    op.drop_index("ix_equipe_responsavel_id", table_name="equipe")
    op.drop_column("equipe", "responsavel_id")
