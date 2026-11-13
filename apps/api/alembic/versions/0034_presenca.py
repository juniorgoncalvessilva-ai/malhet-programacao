"""Apropriação de presença: identificação (crachá, NFC, rosto) e leituras do dia

Revision ID: 0034_presenca
Revises: 0033_sequencia_programacao
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0034_presenca"
down_revision = "0033_sequencia_programacao"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "identificacao_pessoa",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("obra_id", sa.Integer, sa.ForeignKey("obra.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("colaborador_id", sa.Integer, sa.ForeignKey("colaborador.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("codigo", sa.String(60)),
        sa.Column("nfc_serial", sa.String(60)),
        sa.Column("face_descritor", JSONB),
        sa.Column("face_em", sa.DateTime(timezone=True)),
        sa.Column("consentimento_em", sa.DateTime(timezone=True)),
        sa.Column("consentimento_por", sa.String(80)),
        sa.Column("atualizado_por", sa.String(80)),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("obra_id", "colaborador_id", name="uq_identificacao_pessoa"),
        sa.UniqueConstraint("obra_id", "codigo", name="uq_identificacao_codigo"),
        sa.UniqueConstraint("obra_id", "nfc_serial", name="uq_identificacao_nfc"),
    )
    op.create_table(
        "presenca_leitura",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("obra_id", sa.Integer, sa.ForeignKey("obra.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("id_local", sa.String(64), nullable=False),
        sa.Column("colaborador_id", sa.Integer, sa.ForeignKey("colaborador.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("data", sa.Date, nullable=False),
        sa.Column("hora", sa.DateTime(timezone=True), nullable=False),
        sa.Column("meio", sa.String(10), nullable=False),
        sa.Column("equipe_id", sa.Integer, sa.ForeignKey("equipe.id", ondelete="SET NULL")),
        sa.Column("dispositivo", sa.String(120)),
        sa.Column("registrado_por", sa.String(80), nullable=False),
        sa.Column("recebido_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("obra_id", "id_local", name="uq_presenca_id_local"),
    )
    op.create_index("ix_presenca_obra_data", "presenca_leitura", ["obra_id", "data"])


def downgrade() -> None:
    op.drop_index("ix_presenca_obra_data", table_name="presenca_leitura")
    op.drop_table("presenca_leitura")
    op.drop_table("identificacao_pessoa")
