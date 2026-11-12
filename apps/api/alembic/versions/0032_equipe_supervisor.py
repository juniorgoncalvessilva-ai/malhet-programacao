"""equipe.supervisor_id: líder intermediário (supervisor) do efetivo que une equipes

Revision ID: 0032_equipe_supervisor
Revises: 0031_equipe_responsavel
"""
import sqlalchemy as sa
from alembic import op

revision = "0032_equipe_supervisor"
down_revision = "0031_equipe_responsavel"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("equipe", sa.Column("supervisor_id", sa.Integer, sa.ForeignKey("colaborador.id", ondelete="SET NULL")))
    op.create_index("ix_equipe_supervisor_id", "equipe", ["supervisor_id"])


def downgrade() -> None:
    op.drop_index("ix_equipe_supervisor_id", table_name="equipe")
    op.drop_column("equipe", "supervisor_id")
