"""wbs_no.codigo_p6: código WBS do nó no Primavera (ida e volta da WBS de execução)

Revision ID: 0028_wbs_codigo_p6
Revises: 0027_marca_obra
"""
import sqlalchemy as sa
from alembic import op

revision = "0028_wbs_codigo_p6"
down_revision = "0027_marca_obra"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("wbs_no", sa.Column("codigo_p6", sa.String(200), nullable=True))
    op.create_index("ix_wbs_no_codigo_p6", "wbs_no", ["codigo_p6"])
    # áreas ativas das Frentes que ainda não estão na WBS de execução entram nela (spec 040)
    op.execute("""
        INSERT INTO wbs_no (obra_id, pai_id, tipo, seq, area_id, origem, fora_cronograma, ativo)
        SELECT a.obra_id, NULL, 'area',
               COALESCE((SELECT MAX(w.seq) FROM wbs_no w WHERE w.obra_id = a.obra_id AND w.pai_id IS NULL), 0)
                 + ROW_NUMBER() OVER (PARTITION BY a.obra_id ORDER BY a.cwa, a.codigo),
               a.id, 'manual', false, true
        FROM area_frente a
        WHERE a.ativo AND NOT EXISTS (SELECT 1 FROM wbs_no w WHERE w.area_id = a.id AND w.tipo = 'area')
    """)


def downgrade() -> None:
    op.drop_index("ix_wbs_no_codigo_p6", table_name="wbs_no")
    op.drop_column("wbs_no", "codigo_p6")
