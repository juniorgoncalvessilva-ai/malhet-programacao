# API Python (FastAPI) + auth-kit. Na subida aplica as migrações (Alembic) e cria/garante o Super Admin.
FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app
COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install "fastapi>=0.115" "uvicorn[standard]>=0.30" "sqlalchemy>=2.0" \
    "psycopg[binary]>=3.2" "alembic>=1.13" "pydantic-settings>=2.4" "openpyxl>=3.1" "xlrd>=2.0.1" "python-multipart>=0.0.9" \
    "pyjwt[crypto]>=2.9" "httpx>=0.27" "cryptography>=43" "argon2-cffi>=23.1" "pillow>=10.4"
COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app
COPY vendor ./vendor
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x /app/entrypoint.sh
RUN useradd -r -u 10001 api && chown -R api /app
USER api
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=120s --retries=8 \
  CMD python -c "import urllib.request as u,sys; o=u.build_opener(u.ProxyHandler({})); sys.exit(0 if o.open('http://127.0.0.1:8000/health',timeout=4).status==200 else 1)"
CMD ["/app/entrypoint.sh"]
