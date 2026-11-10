# Malhet · Programação de Obra × Simova

Aplicação web para montar a **programação diária/semanal da obra** de acordo com a **capacidade produtiva das
equipes**, usando a **versão vigente** do cronograma (P6), da PQ, da CPU e dos índices, e **retroalimentar o Simova**
(FT_IMPORT_INTERMEDIARIA + OPERs novas).

| Camada | Stack |
| --- | --- |
| Front | Next.js 15 (base: **AI Coders Starter Kit** — i18n, TanStack Query, Zustand, toasts, tema) com a identidade **Malhet** (design system CorpMind: Figtree, teal/carvão) em `apps/web` |
| Auth | **auth-kit** (`apps/api/vendor/auth_kit`): cadastro + verificação de e-mail, login, refresh em cookie com CSRF, 2FA TOTP, RBAC `user`/`admin` |
| API | Python 3.12+ · FastAPI · SQLAlchemy 2 · Alembic · Pydantic em `apps/api` |
| Banco | PostgreSQL 16 (substitui o Supabase do kit) |

## Como rodar

```bash
docker compose up -d db
```

```bash
cd apps/api && python3 -m venv .venv && .venv/bin/pip install -e ".[dev]" && cp .env.example .env
```

```bash
cd apps/api && .venv/bin/alembic upgrade head && .venv/bin/uvicorn app.main:app --reload --port 8000
```

```bash
cd apps/web && npm install && cp .env.local.example .env.local && npm run dev
```

Acesse <http://localhost:3000> e entre com o **Super Admin** do `.env` da API (`SUPERADMIN_EMAIL` /
`SUPERADMIN_PASSWORD`, criado ou garantido a cada boot). Em **Administrar › Obras e usuários** ele cria a obra e
libera os usuários. O navegador chama a API pelo
próprio Next em `/backend/api/*` (mesma origem: o cookie de refresh e o CSRF do auth-kit funcionam sem CORS).
Para desenvolver sem login: `AUTH_DISABLED=true` na API e `NEXT_PUBLIC_AUTH_DISABLED=true` no web.

Acesso por obra: todos os dados são separados por obra (cabeçalho `X-Obra-Id`). Papéis na obra:
`admin` (carrega versões, importa do Simova, envia a FT, dá acesso) · `planejador` (programa, aprova, vínculos,
equipes) · `encarregado` (programa só a própria equipe, pelo crachá) · `leitor`. O `superadmin` (papel da conta
no auth-kit) entra em todas as obras como admin.

Deploy: [docs/deploy-coolify.md](docs/deploy-coolify.md) (`docker-compose.coolify.yml`).
Documentação interativa da API: <http://localhost:8000/docs>.

Testes da API (precisa do banco `programacao_test`):

```bash
cd apps/api && .venv/bin/pytest -q
```

## Primeira carga (ordem)

0. **Obra e usuários** (Super Admin): crie a obra e libere os e-mails com o papel de cada um.
1. **Cadastros Simova** → `OPER.xlsx` + `FRENTE.xlsx` (tela *Cadastros Simova*). Gera a versão `SIMOVA` vigente.
2. **Referências** → `Programacao_auxiliar_vN.xlsx` (tela *Referências*). Abas ATIVIDADES, PQ, RECURSOS e ÍNDICES
   viram versões `CRONOGRAMA`, `PQ`, `CPU` e `INDICES` (vigentes).
3. **Equipes** → mesma planilha, aba EQUIPES. Informe o **crachá do encarregado** (o do Simova) em cada equipe.
4. **Vínculos** → ligue atividade do cronograma (ou item da PQ) ↔ OPER do Simova.
5. **Programação** → equipe + OPER + frente + PE/HH por dia → aprovar → **Exportar FT p/ Simova**.

## Estrutura

```
apps/api/app/modules/
  obras/              obra, acesso por obra (papel), Super Admin
  cadastros/          espelho Simova: FRENTE, OPER_GRUPO, OPER, TAREFA, MATERIAL, FUNÇÃO
  referencias/        versões (CRONOGRAMA, PQ, CPU, ÍNDICES, SIMOVA) + vínculo + motor de índices
  equipes/            equipe = frente de trabalho com composição por função
  programacao/        agregado ItemProgramacao, capacidade, calendário, gargalo, sequenciador
  integracao_simova/  importar OPER/FRENTE/FT · exportar FT_IMPORT_INTERMEDIARIA e OPERs novas
apps/api/vendor/auth_kit/  cópia do auth-kit (ORIGEM = repo@commit) + permissões obra.usar / obra.administrar
apps/web/src/app/[locale]/app/(obra)/   programacao · referencias · equipes · cadastros
apps/web/src/app/[locale]/auth/         entrar · cadastro · verificar (telas Malhet)
apps/web/src/components/Malhet/         shell (lateral, topo, trilha), menu, TelaAuth
apps/web/src/css/malhet.css             tokens CorpMind (claro/escuro)
docs/       PRD, domínio e regras de cálculo, legado (macros VBA da planilha v5)
specs/      Spec-Driven Development (changes/ → archive/)
.claude/skills/  skills do projeto (extraídas do código)
```
