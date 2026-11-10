# Implementar este auth num app novo

Guia para colar o módulo e ligar. O código já faz cadastro, verificação de e-mail, login, refresh, logout, 2FA, senha, sessões e papéis `user` / `admin`.

## 1. Copiar

Para a pasta do backend do app novo:

- `src/modules/auth`
- `src/shared`
- `locales/`
- `alembic/` e `alembic.ini` (se o app ainda não tem Alembic; se já tem, copie só `alembic/versions/0001_auth.py` e ajuste o `down_revision`)
- `requirements.txt` (junte com as deps que o app já usa)

`src/shared` não é opcional. O módulo importa `Result`, `settings` e `i18n` dali.

## 2. Ambiente

Copie `.env.example` para `.env`. Não commite o `.env`.

| Variável | Para que serve | Em produção |
|---|---|---|
| `DATABASE_URL` | Postgres. Sem ela, tudo fica em memória (só teste). | obrigatória |
| `JWT_SECRET` | Assina o access token. Sem `MFA_CIPHER_KEY` / `MFA_BACKUP_PEPPER`, também deriva essas chaves. | segredo próprio, 256 bits |
| `MFA_CIPHER_KEY` | Chave AES-256-GCM do segredo TOTP. 32 bytes em base64-url. | defina; não dependa do JWT |
| `MFA_BACKUP_PEPPER` | Pepper dos códigos de backup. | defina; não dependa do JWT |
| `AUTH_ISSUER` | Nome que aparece no app autenticador. | o nome do app |
| `HIBP` | `1` recusa senha vazada (k-anonimato). `0` desliga. | `1` se a rede até a API da HIBP existir |
| `CORS_ORIGINS` | Origens do front, separadas por vírgula. | a origem real, com `https` |
| `COOKIE_SECURE` | `1` marca o cookie de refresh como Secure. | `1` atrás de HTTPS |
| `COOKIE_SAMESITE` | `lax` por padrão. | `lax`, ou `none` se o front estiver noutro site (aí Secure é obrigatório) |
| `HSTS` | `1` envia Strict-Transport-Security. | `1` só com HTTPS estável |
| `MAIL_PROVIDER` | `console` imprime o e-mail. `smtp` envia de verdade se `SMTP_HOST` existir. | `smtp` |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Cria um admin na subida se o e-mail ainda não existe. Senha: 10+ caracteres, letra e número. | vazio depois do primeiro boot |

Senha aceita: no mínimo 10 caracteres, com letra e número.

## 3. Subir

```
pip install -r requirements.txt
alembic upgrade head
$env:PYTHONPATH="src"
python -m uvicorn main:app --reload
```

`main.py` lê o `.env` antes de montar a app. A função é `create_app()` em `modules.auth.presentation.app`.

Para encaixar num FastAPI que já existe, monte o mesmo router e o mesmo `build_auth()`:

```python
from modules.auth.presentation.container import build_auth
from modules.auth.presentation.router import router

app.state.auth = build_auth()
app.include_router(router)
```

O router espera `request.app.state.auth`. CORS precisa de `credentials` e dos headers `Authorization`, `Content-Type`, `Accept-Language`, `X-CSRF-Token`.

## 4. Contrato HTTP

Prefixo `/auth`. Sucesso: `{ "ok": true, "message_key", "message", "data"? }`. Erro: `{ "ok": false, "errors": [{ "key", "params", "field" }], "message" }`. O front traduz pela `key` (pt-BR e en em `locales/`).

| Método | Caminho | Corpo | Auth |
|---|---|---|---|
| POST | `/auth/register` | `email`, `password`, `locale?` | não |
| POST | `/auth/verify-email` | `token` | não |
| POST | `/auth/resend` | `email` | não |
| POST | `/auth/login` | `email`, `password`, `mfa_code?` | não |
| POST | `/auth/refresh` | cookie | cookie + `X-CSRF-Token` |
| POST | `/auth/logout` | cookie | cookie + CSRF |
| POST | `/auth/logout-all` | — | Bearer |
| POST | `/auth/password/forgot` | `email` | não |
| POST | `/auth/password/reset` | `token`, `new_password` | não |
| POST | `/auth/password/change` | `current_password`, `new_password` | Bearer |
| POST | `/auth/mfa/enable` | — | Bearer |
| POST | `/auth/mfa/confirm` | `code` | Bearer |
| POST | `/auth/mfa/disable` | `password` | Bearer |
| GET | `/auth/me` | — | Bearer |
| GET | `/auth/sessions` | — | Bearer |

Login devolve `data.access_token` no JSON. O refresh vai no cookie `httpOnly` `refresh_token` (path `/`). O cookie `csrf_token` não é httpOnly: o front lê e manda no header `X-CSRF-Token` em refresh e logout. Chamadas com cookie usam `credentials: include`.

Se a conta tem 2FA, o login sem código devolve `data.mfa_required: true` e não cria sessão. O segundo login manda `mfa_code` (6 dígitos do TOTP, ou um código de backup de uso único).

`/auth/mfa/enable` devolve a URI `otpauth` e os códigos de backup uma vez. Só o hash fica gravado.

Cadastro de e-mail que já existe responde o mesmo sucesso de um cadastro novo. O token de verificação só vai por e-mail.

## 5. O que mudar por app

- `AUTH_ISSUER`
- `CORS_ORIGINS` e a origem do front
- Textos de e-mail nos casos de uso (`register_user`, `password`, `mfa`, `login`) se o produto não for em português
- Papéis em `domain/rbac.py` se precisar de mais do que `user` e `admin`
- Título do FastAPI em `presentation/app.py` (hoje `auth`)

Não coloque regra de senha, sessão ou papel dentro de rota. A regra fica no caso de uso ou no objeto de valor. A rota só traduz HTTP.

## 6. Front

O access token fica só em memória. No 401 de rota autenticada, o cliente chama `POST /auth/refresh` com o CSRF e tenta uma vez. Sem cookie, manda o usuário ao login.

Locale: header `Accept-Language` (`pt` → pt-BR, `en` → en).

## 7. Testar

Na raiz deste repo:

```
python tests/test_auth_flow.py
python tests/test_auth_extended.py
python tests/test_auth_http.py
python tests/test_auth_db.py
python tests/test_cipher.py
python tests/test_rbac.py
```

Os testes não precisam de Postgres. `test_auth_db.py` sobe um SQLite temporário e roda o Alembic.

## 8. Tetos conhecidos

- Sem `DATABASE_URL`, repositório e rate-limit são em memória. Não use isso com mais de um processo.
- Cada chamada de repositório SQL é uma transação. Não há transação atravessando dois repositórios.
- O rate-limit no banco confere e insere em seguida; duas requisições no mesmo instante podem passar juntas.
- HIBP fora do ar não bloqueia a senha.
- Aviso de aparelho novo compara o header `User-Agent` com sessões ainda ativas.
