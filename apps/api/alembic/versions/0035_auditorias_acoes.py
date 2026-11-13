"""Ações 5W2H, modelos de auditoria e registros de auditoria

Revision ID: 0035_auditorias_acoes
Revises: 0034_presenca
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0035_auditorias_acoes"
down_revision = "0034_presenca"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "acao_5w2h",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("obra_id", sa.Integer, sa.ForeignKey("obra.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("numero", sa.Integer, nullable=False),
        sa.Column("origem", sa.String(12), nullable=False),
        sa.Column("origem_id", sa.Integer),
        sa.Column("origem_texto", sa.String(200)),
        sa.Column("o_que", sa.String(600), nullable=False),
        sa.Column("por_que", sa.String(600)),
        sa.Column("onde", sa.String(200)),
        sa.Column("area_id", sa.Integer, sa.ForeignKey("area_frente.id", ondelete="SET NULL"), index=True),
        sa.Column("quando", sa.Date, index=True),
        sa.Column("data_execucao", sa.Date, index=True),
        sa.Column("quem", sa.String(150)),
        sa.Column("como", sa.String(600)),
        sa.Column("quanto", sa.String(120)),
        sa.Column("acompanhamento", sa.String(300)),
        sa.Column("status", sa.String(12), nullable=False, index=True),
        sa.Column("conclusao_texto", sa.Text),
        sa.Column("concluida_em", sa.DateTime(timezone=True)),
        sa.Column("eficaz", sa.Boolean),
        sa.Column("verificada_em", sa.DateTime(timezone=True)),
        sa.Column("historico", JSONB),
        sa.Column("criado_por", sa.String(80), nullable=False),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("obra_id", "numero", name="uq_acao_5w2h_numero"),
    )
    op.create_index("ix_acao_5w2h_origem", "acao_5w2h", ["obra_id", "origem", "origem_id"])
    op.create_table(
        "auditoria_modelo",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("obra_id", sa.Integer, sa.ForeignKey("obra.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("nome", sa.String(120), nullable=False),
        sa.Column("setor", sa.String(60)),
        sa.Column("padrao", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("ativo", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("config", JSONB, nullable=False),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "auditoria_registro",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("obra_id", sa.Integer, sa.ForeignKey("obra.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("modelo_id", sa.Integer, sa.ForeignKey("auditoria_modelo.id", ondelete="RESTRICT"), nullable=False, index=True),
        sa.Column("numero", sa.Integer, nullable=False),
        sa.Column("tipo", sa.String(60)),
        sa.Column("tipo_registro", sa.String(120)),
        sa.Column("data", sa.Date, nullable=False, index=True),
        sa.Column("area_id", sa.Integer, sa.ForeignKey("area_frente.id", ondelete="SET NULL"), index=True),
        sa.Column("local", sa.String(200)),
        sa.Column("area_texto", sa.String(250)),
        sa.Column("equipe_id", sa.Integer, sa.ForeignKey("equipe.id", ondelete="SET NULL")),
        sa.Column("engenheiro", sa.String(150)),
        sa.Column("encarregado", sa.String(150)),
        sa.Column("rac", sa.String(150)),
        sa.Column("nao_conformidade", sa.Text),
        sa.Column("medida_corretiva", sa.Text),
        sa.Column("ver_agir", sa.Boolean),
        sa.Column("plano_responsavel", sa.String(150)),
        sa.Column("plano_prazo", sa.Date),
        sa.Column("acompanhamento", sa.String(300)),
        sa.Column("respostas", JSONB),
        sa.Column("status", sa.String(10), nullable=False, index=True),
        sa.Column("acao_id", sa.Integer, sa.ForeignKey("acao_5w2h.id", ondelete="SET NULL")),
        sa.Column("auditor_id", sa.String(80), nullable=False),
        sa.Column("auditor", sa.String(150)),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("enviado_em", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("obra_id", "numero", name="uq_auditoria_registro_numero"),
    )


def downgrade() -> None:
    op.drop_table("auditoria_registro")
    op.drop_table("auditoria_modelo")
    op.drop_index("ix_acao_5w2h_origem", table_name="acao_5w2h")
    op.drop_table("acao_5w2h")
