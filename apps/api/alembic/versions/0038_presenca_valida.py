"""Leitura de presença válida × duplicada (dois celulares leram a mesma pessoa no dia)

Revision ID: 0038_presenca_valida
Revises: 0037_paginas_mobile
"""
import sqlalchemy as sa
from alembic import op

revision = "0038_presenca_valida"
down_revision = "0037_paginas_mobile"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("presenca_leitura", sa.Column("valida", sa.Boolean, nullable=False, server_default="true"))
    # leituras antigas: vale a mais cedo de cada pessoa no dia
    op.execute("""
        UPDATE presenca_leitura p SET valida = (p.id = (
            SELECT q.id FROM presenca_leitura q
            WHERE q.obra_id = p.obra_id AND q.colaborador_id = p.colaborador_id AND q.data = p.data
            ORDER BY q.hora, q.id LIMIT 1))
    """)


def downgrade() -> None:
    op.drop_column("presenca_leitura", "valida")
