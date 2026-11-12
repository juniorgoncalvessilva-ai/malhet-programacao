"""Plano de 90 dias (6 semanas, pull planning), vínculos com programação e restrições; nomes da marca da obra

Revision ID: 0029_plano_90_dias
Revises: 0028_wbs_codigo_p6
"""
import sqlalchemy as sa
from alembic import op

revision = "0029_plano_90_dias"
down_revision = "0028_wbs_codigo_p6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "plano_item",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("obra_id", sa.Integer, sa.ForeignKey("obra.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("numero", sa.Integer, nullable=False),
        sa.Column("descricao", sa.String(300), nullable=False),
        sa.Column("area_id", sa.Integer, sa.ForeignKey("area_frente.id", ondelete="RESTRICT"), index=True),
        sa.Column("wbs_no_id", sa.Integer, sa.ForeignKey("wbs_no.id", ondelete="SET NULL"), index=True),
        sa.Column("tipo_id", sa.Integer, sa.ForeignKey("tipo_atividade.id", ondelete="SET NULL")),
        sa.Column("id_crono", sa.String(40)),
        sa.Column("equipe_id", sa.Integer, sa.ForeignKey("equipe.id", ondelete="SET NULL")),
        sa.Column("inicio", sa.Date, nullable=False, index=True),
        sa.Column("fim", sa.Date, nullable=False, index=True),
        sa.Column("quantidade", sa.Float),
        sa.Column("responsavel", sa.String(150)),
        sa.Column("marco", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("marco_id", sa.Integer, sa.ForeignKey("plano_item.id", ondelete="SET NULL")),
        sa.Column("analisado", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("analisado_em", sa.Date),
        sa.Column("observacao", sa.String(600)),
        sa.Column("criado_por", sa.String(80)),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("obra_id", "numero", name="uq_plano_item_numero"),
    )
    op.add_column("programacao_linha", sa.Column("plano_item_id", sa.Integer, sa.ForeignKey("plano_item.id", ondelete="SET NULL")))
    op.create_index("ix_programacao_linha_plano_item_id", "programacao_linha", ["plano_item_id"])
    op.add_column("acao_restricao", sa.Column("plano_item_id", sa.Integer, sa.ForeignKey("plano_item.id", ondelete="SET NULL")))
    op.create_index("ix_acao_restricao_plano_item_id", "acao_restricao", ["plano_item_id"])
    op.add_column("marca_obra", sa.Column("nome_contratada", sa.String(80)))
    op.add_column("marca_obra", sa.Column("nome_contratante", sa.String(80)))


def downgrade() -> None:
    op.drop_column("marca_obra", "nome_contratante")
    op.drop_column("marca_obra", "nome_contratada")
    op.drop_index("ix_acao_restricao_plano_item_id", table_name="acao_restricao")
    op.drop_column("acao_restricao", "plano_item_id")
    op.drop_index("ix_programacao_linha_plano_item_id", table_name="programacao_linha")
    op.drop_column("programacao_linha", "plano_item_id")
    op.drop_table("plano_item")
