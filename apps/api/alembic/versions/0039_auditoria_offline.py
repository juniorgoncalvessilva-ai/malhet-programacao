"""auditoria offline (spec 072): id gerado no celular e hora do registro no aparelho

Revision ID: 0039_auditoria_offline
Revises: 0038_presenca_valida
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '0039_auditoria_offline'
down_revision: Union[str, Sequence[str], None] = '0038_presenca_valida'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('auditoria_registro', sa.Column('id_local', sa.String(length=64), nullable=True))
    op.add_column('auditoria_registro', sa.Column('registrado_em', sa.DateTime(timezone=True), nullable=True))
    op.create_unique_constraint('uq_auditoria_registro_id_local', 'auditoria_registro', ['obra_id', 'id_local'])


def downgrade() -> None:
    op.drop_constraint('uq_auditoria_registro_id_local', 'auditoria_registro', type_='unique')
    op.drop_column('auditoria_registro', 'registrado_em')
    op.drop_column('auditoria_registro', 'id_local')
