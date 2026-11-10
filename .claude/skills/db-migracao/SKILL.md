---
name: db-migracao
description: Gerar e aplicar migração Alembic depois de alterar modelos SQLAlchemy em apps/api. Use sempre que mudar app/modules/*/infra/models.py.
---
1. Garanta que o modelo novo está importado em `app/models.py`.
2. `cd apps/api && .venv/bin/alembic revision --autogenerate -m "<verbo + objeto>"`
3. Revise o arquivo em `alembic/versions/`: índices parciais (`postgresql_where`), ARRAY/JSONB, `server_default`
   e drops inesperados. Nunca apague coluna com dados sem migração de dados explícita.
4. `.venv/bin/alembic upgrade head` e `.venv/bin/pytest -q` (os testes usam `create_all` no banco de teste).
