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

## 4. Deploy automático pelo GitHub Actions
`.github/workflows/deploy-coolify.yml` chama `POST /api/v1/deploy?uuid=…` do Coolify a cada push em `main`
(e pelo botão *Run workflow* na aba Actions). Cadastre uma vez o secret **`COOLIFY_TOKEN`**
(Coolify › Keys & Tokens › API tokens, com permissão de deploy) em Settings › Secrets and variables › Actions.
Opcional: variáveis `COOLIFY_URL` e `COOLIFY_UUID` (padrão: `http://179.199.156.129:8000` e `zhailxjohc52ohmgm36jzdpp`).

## Memória da VPS
O `next build` usa ~1,5 GB (limitado por `NODE_OPTIONS` no `apps/web/Dockerfile`). Com 2 GB de RAM ou menos, crie
swap antes do primeiro deploy, senão o build morre com `signal SIGKILL`:

```bash
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile && echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## Armazenamento de arquivos: disco + Google Drive / OneDrive / Dropbox (spec 082)

Fotos e anexos ficam no volume `malhet-prog-arquivos` (`/data/arquivos`) e sobem, por obra, para a nuvem escolhida na
tela **Armazenamento** (`/app/armazenamento`, só administrador). Os que estavam no banco migram sozinhos, aos poucos.

1. `APP_URL` precisa ser o endereço público **https** (ex.: `https://malhet.com`): é para onde o login do provedor volta.
2. `ARMAZENAMENTO_CHAVE`: 64+ caracteres aleatórios (cifra os tokens). Se ficar vazia, usa o `JWT_SECRET`; trocar
   qualquer um dos dois obriga a conectar a nuvem de novo.
3. Cadastre o app só dos provedores que vai usar (os outros ficam desabilitados na tela). Endereço de retorno de cada um:
   `<APP_URL>/backend/api/armazenamento/oauth/<google|onedrive|dropbox>/retorno`.

| Provedor | Onde | O que configurar | Variáveis |
|---|---|---|---|
| Google Drive | console.cloud.google.com → novo projeto → *APIs e serviços* | Ativar **Google Drive API**; *Tela de consentimento OAuth* (externo, publicar); *Credenciais* → ID do cliente OAuth "Aplicativo da Web" com o retorno acima. Escopo usado: `drive.file` (o app só vê o que ele criou — não exige verificação do Google) | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| OneDrive | portal.azure.com → *Microsoft Entra ID* → *Registros de aplicativo* | Contas "qualquer organização + pessoais"; plataforma Web com o retorno acima; *Certificados e segredos* → novo segredo; permissões delegadas `Files.ReadWrite.AppFolder`, `User.Read`, `offline_access` (na empresa, o admin pode precisar *Conceder consentimento*) | `MS_CLIENT_ID`, `MS_CLIENT_SECRET` |
| Dropbox | dropbox.com/developers/apps → *Create app* | *Scoped access* + **App folder**; em *Permissions* marcar `files.content.write`, `files.content.read`, `account_info.read`; em *OAuth 2 › Redirect URIs* o retorno acima | `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET` |

Na nuvem, a obra fica em `Malhet/obras/<CODIGO-obra>/` com as pastas `10-programacoes … 90-arquivo-morto`; cada arquivo
leva um `.md` com os metadados (Zettelkasten). Rosto, evidências LGPD e coordenadas nunca saem do servidor.
`ARQUIVOS_LIMITE_GB` (padrão 25) é o quanto de originais o disco segura antes de liberar os já enviados.

## Imagens prontas do GitHub Actions (spec 085) — a VPS não compila mais

Com 1 vCPU e 4 GB, compilar o Next na VPS travava o Coolify (deploy parava no meio). Agora:
1. A cada push em `main`, o workflow **Deploy no Coolify** monta as imagens `malhet-api` e `malhet-web` no GitHub
   (com cache) e publica em `ghcr.io/juniorgoncalvessilva-ai/` com as tags `latest` e o commit.
2. Depois dispara o deploy no Coolify. Com `docker-compose.coolify.imagens.yml` a VPS só baixa e sobe as imagens.

**Uma vez só, para ligar:**
1. Deixe os pacotes públicos (o repositório já é público): github.com → seu perfil → *Packages* → `malhet-api` →
   *Package settings* → *Change visibility* → **Public**. Repita para `malhet-web`. (Eles aparecem depois do primeiro
   push com este workflow.) Preferindo privado: na VPS, `docker login ghcr.io -u <usuário>` com um token
   *read:packages* — o Coolify usa o login do Docker do servidor.
2. Actions → **Coolify** → Run workflow → `acao = usar-imagens`. Ele troca o *Docker Compose Location* do recurso para
   `/docker-compose.coolify.imagens.yml`, faz o deploy e testa. Para voltar a compilar na VPS: `acao = usar-build`.
3. Fixar uma versão (voltar atrás): variável `IMAGEM_TAG=<commit>` no Coolify e redeploy (vazio = `latest`).

**Swap (recomendado na KVM1):** no terminal da VPS, uma vez:
```bash
fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab && sysctl vm.swappiness=10 && echo 'vm.swappiness=10' >> /etc/sysctl.conf
```
