"""spec 121: "Fotos" (registro de fotos da atividade) na barra do encarregado também nos menus já salvos por obra

Revision ID: 0057_fotos_na_barra
Revises: 0056_registro_atividade
"""
import json

import sqlalchemy as sa
from alembic import op

revision = "0057_fotos_na_barra"
down_revision = "0056_registro_atividade"
branch_labels = None
depends_on = None


def upgrade() -> None:
    from app.modules.perfil.domain.menu import incluir_na_barra

    con = op.get_bind()
    for id_, menu in con.execute(sa.text("select id, menu from menu_mobile_perfil where papel = 'encarregado'")).all():
        m = menu if isinstance(menu, dict) else json.loads(menu)
        barra = incluir_na_barra(list(m.get("barra") or []), m.get("destaque"), "/m/fotos", "/m/lancar")
        if barra != m.get("barra"):
            con.execute(sa.text("update menu_mobile_perfil set menu = cast(:m as jsonb) where id = :id"),
                        {"m": json.dumps({**m, "barra": barra}), "id": id_})


def downgrade() -> None:
    pass  # a escolha volta a ser do admin da obra em Menu do celular
