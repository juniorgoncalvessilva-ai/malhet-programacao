# Auth kit

Módulo de autenticação pronto para copiar para outro app Python (FastAPI). Cobre cadastro com verificação de e-mail, login, refresh com rotação, 2FA (TOTP + códigos de backup), reset e troca de senha, sessões, RBAC e os avisos por e-mail.

Este repositório é uma cópia. O app que originou o módulo continua com a sua própria pasta. Quando o módulo mudar lá, copie de novo por cima — ou passe a importar este repo como pacote.

## O que entra

- `src/modules/auth` — domínio, casos de uso, SQL/memória, rotas `/auth`
- `src/shared` — Result, settings, i18n (o módulo depende disso)
- `locales/pt-BR` e `locales/en`
- `alembic/` — tabelas `auth_*`
- `tests/` — rode com `python tests/test_auth_flow.py` (e os outros `test_auth_*.py`, `test_cipher.py`, `test_rbac.py`)

## Como ligar num app novo

1. Copie `src/modules/auth`, `src/shared`, `locales` e `alembic` para o backend.
2. `pip install -r requirements.txt`
3. Copie `.env.example` para `.env`. Em produção defina `JWT_SECRET`, `MFA_CIPHER_KEY`, `MFA_BACKUP_PEPPER` e `DATABASE_URL`.
4. `AUTH_ISSUER` é o nome no app autenticador.
5. `HIBP=1` consulta senhas vazadas (sem a senha inteira sair do servidor). Sem isso, a checagem fica desligada.
6. Na subida: `PYTHONPATH=src` e `from modules.auth.presentation.app import create_app`.
7. `alembic upgrade head` com `DATABASE_URL` apontando para o Postgres.

Sem `DATABASE_URL` a API usa memória e hash PBKDF2. Serve para teste. Com a URL: Postgres, Argon2id e rate-limit na tabela `auth_rate_hits`.

Access token vai no JSON. Refresh fica em cookie `httpOnly`. Refresh e logout exigem o header `X-CSRF-Token` igual ao cookie `csrf_token`.

## Telas

As telas ficam no app que consome este módulo. O contrato HTTP, os cookies e as variáveis estão em [docs/implementacao.md](docs/implementacao.md).
