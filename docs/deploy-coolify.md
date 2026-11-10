# Deploy no Coolify (VPS 179.199.156.129)

O painel do Coolify fica em `http://179.199.156.129:8000`. A aplicação sobe em `http://179.199.156.129:3000`.
Três serviços (`docker-compose.coolify.yml`): **db** (Postgres 16, volume `malhet-pg`), **api** (FastAPI;
na subida roda `alembic upgrade head` e garante o Super Admin) e **web** (Next.js standalone; o navegador chama
`/backend/api/*` e o Next repassa para `http://api:8000`). Só o `web` é publicado.

## 1. Limpar a VPS (opcional, preserva o Coolify)
No painel do Coolify, apague os recursos antigos que não vai usar (Projects › recurso › Delete). Depois, por SSH:

```bash
bash infra/limpar-vps.sh
```

Isso só **mostra** o que seria removido. Conferido, rode de verdade (pede para digitar LIMPAR):

```bash
bash infra/limpar-vps.sh --apagar
```

`--volumes` também apaga volumes sem uso. São dados de bancos antigos: só com backup.

## 2. Criar o recurso
1. Coolify › Projects › New › **+ New Resource** › *Public/Private Repository (GitHub)* › este repositório, branch `main`.
2. Build Pack: **Docker Compose**. Docker Compose Location: `/docker-compose.coolify.yml`.
3. Environment Variables (modelo em `.env.coolify.example`):

| Variável | Valor |
| --- | --- |
| `POSTGRES_PASSWORD` | senha forte |
| `JWT_SECRET` | 64+ caracteres aleatórios (`openssl rand -base64 48`) |
| `MFA_CIPHER_KEY` | `python3 -c "import os,base64;print(base64.urlsafe_b64encode(os.urandom(32)).decode())"` |
| `MFA_BACKUP_PEPPER` | outro aleatório |
| `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` | conta do Super Admin (10+ caracteres, letra e número) |
| `APP_URL` | `http://179.199.156.129:3000` |
| `WEB_PORT` | `3000` |
| `COOKIE_SECURE` | `0` em http pelo IP; `1` quando tiver domínio com https |

4. **Deploy**. A primeira build leva alguns minutos (npm ci + next build). Os healthchecks seguram o `web` até a API ficar pronta.
5. Abra `http://179.199.156.129:3000`, entre com o Super Admin, vá em **Administrar › Obras e usuários**,
   crie a obra e libere os usuários. Depois, na obra: Cadastros Simova (OPER.xlsx + FRENTE.xlsx) e
   Referências (planilha auxiliar).

## 3. Depois do primeiro acesso
- Troque a senha do Super Admin; pode deixar `SUPERADMIN_*` configurado (o boot só garante que a conta exista).
- Domínio: em *Domains* do serviço `web` informe `https://programacao.suaempresa.com.br`, mude `COOKIE_SECURE=1`,
  `HSTS=1`, `APP_URL` e faça redeploy. Aí a porta 3000 pode ser fechada no firewall.
- Backup: Coolify › recurso › *Backups* do serviço `db` (ou `pg_dump` agendado).
- E-mail: `MAIL_PROVIDER=smtp` + `SMTP_*`. Sem isso os e-mails do auth-kit saem só no log da API.
