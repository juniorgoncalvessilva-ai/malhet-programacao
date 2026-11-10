#!/bin/sh
# Monta DATABASE_URL a partir das partes (senha escapada) quando não vier pronta; migra e sobe a API.
set -e
if [ -z "${DATABASE_URL:-}" ]; then
  DATABASE_URL=$(python -c 'import os, urllib.parse as u
print("postgresql+psycopg://%s:%s@%s:%s/%s" % (u.quote(os.environ["DB_USER"], safe=""), u.quote(os.environ["DB_PASSWORD"], safe=""),
      os.environ.get("DB_HOST", "db"), os.environ.get("DB_PORT", "5432"), os.environ["DB_NAME"]))')
  export DATABASE_URL
fi
echo "malhet-api: migrando banco em ${DB_HOST:-db}/${DB_NAME:-?}"
alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'
