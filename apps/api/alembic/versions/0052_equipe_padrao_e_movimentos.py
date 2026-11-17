"""Spec 107: padrão de nome das equipes (equipe_config) e as equipes de origem/destino no movimento.

Revision ID: 0052_equipe_padrao
Revises: 0051_aderencia
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0052_equipe_padrao"
down_revision: Union[str, Sequence[str], None] = "0051_aderencia"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "equipe_config",
        sa.Column("obra_id", sa.Integer(), nullable=False),
        sa.Column("modelo_nome", sa.String(length=60), nullable=False),
        sa.Column("digitos", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["obra_id"], ["obra.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("obra_id"),
    )
    op.add_column("movimento_efetivo", sa.Column("de_equipe_id", sa.Integer(), nullable=True))
    op.add_column("movimento_efetivo", sa.Column("para_equipe_id", sa.Integer(), nullable=True))
    op.create_index("ix_movimento_efetivo_de_equipe_id", "movimento_efetivo", ["de_equipe_id"])
    op.create_index("ix_movimento_efetivo_para_equipe_id", "movimento_efetivo", ["para_equipe_id"])
    op.create_foreign_key("fk_movimento_de_equipe", "movimento_efetivo", "equipe", ["de_equipe_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_movimento_para_equipe", "movimento_efetivo", "equipe", ["para_equipe_id"], ["id"], ondelete="SET NULL")
    # movimentos antigos: liga pelo nome da equipe (o que ainda existe com o mesmo nome)
    op.execute("""UPDATE movimento_efetivo m SET de_equipe_id = e.id FROM equipe e
                  WHERE m.tipo = 'EQUIPE' AND e.obra_id = m.obra_id AND e.nome = m.de""")
    op.execute("""UPDATE movimento_efetivo m SET para_equipe_id = e.id FROM equipe e
                  WHERE m.tipo = 'EQUIPE' AND e.obra_id = m.obra_id AND e.nome = m.para""")


def downgrade() -> None:
    op.drop_constraint("fk_movimento_para_equipe", "movimento_efetivo", type_="foreignkey")
    op.drop_constraint("fk_movimento_de_equipe", "movimento_efetivo", type_="foreignkey")
    op.drop_index("ix_movimento_efetivo_para_equipe_id", table_name="movimento_efetivo")
    op.drop_index("ix_movimento_efetivo_de_equipe_id", table_name="movimento_efetivo")
    op.drop_column("movimento_efetivo", "para_equipe_id")
    op.drop_column("movimento_efetivo", "de_equipe_id")
    op.drop_table("equipe_config")
