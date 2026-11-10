# Programação de Obra × Simova

Aplicação web para montar a **programação diária/semanal da obra** de acordo com a **capacidade produtiva das
equipes**, usando a **versão vigente** do cronograma (P6), da PQ, da CPU e dos índices, e **retroalimentar o Simova**
(FT_IMPORT_INTERMEDIARIA + OPERs novas).

| Camada | Stack |
| --- | --- |
| Front | Next.js 15 (base: **AI Coders Starter Kit** — layout, sidebar, i18n, Clerk, TanStack Query, Zustand) em `apps/web` |
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

Sem chaves do Clerk, use `AUTH_DISABLED=true` e `NEXT_PUBLIC_AUTH_DISABLED=true` no `.env.local` do web (e
`AUTH_DISABLED=true` no `.env` da API). Documentação interativa da API: <http://localhost:8000/docs>.

Testes da API (precisa do banco `programacao_test`):

```bash
cd apps/api && .venv/bin/pytest -q
```

## Primeira carga (ordem)

1. **Cadastros Simova** → `OPER.xlsx` + `FRENTE.xlsx` (tela *Cadastros Simova*). Gera a versão `SIMOVA` vigente.
2. **Referências** → `Programacao_auxiliar_vN.xlsx` (tela *Referências*). Abas ATIVIDADES, PQ, RECURSOS e ÍNDICES
   viram versões `CRONOGRAMA`, `PQ`, `CPU` e `INDICES` (vigentes).
3. **Equipes** → mesma planilha, aba EQUIPES. Informe o **crachá do encarregado** (o do Simova) em cada equipe.
4. **Vínculos** → ligue atividade do cronograma (ou item da PQ) ↔ OPER do Simova.
5. **Programação** → equipe + OPER + frente + PE/HH por dia → aprovar → **Exportar FT p/ Simova**.

## Estrutura

```
apps/api/app/modules/
  cadastros/          espelho Simova: FRENTE, OPER_GRUPO, OPER, TAREFA, MATERIAL, FUNÇÃO
  referencias/        versões (CRONOGRAMA, PQ, CPU, ÍNDICES, SIMOVA) + vínculo + motor de índices
  equipes/            equipe = frente de trabalho com composição por função
  programacao/        agregado ItemProgramacao, capacidade, calendário, gargalo, sequenciador
  integracao_simova/  importar OPER/FRENTE/FT · exportar FT_IMPORT_INTERMEDIARIA e OPERs novas
apps/web/src/app/[locale]/app/(obra)/   programacao · referencias · equipes · cadastros
docs/       PRD, domínio e regras de cálculo, legado (macros VBA da planilha v5)
specs/      Spec-Driven Development (changes/ → archive/)
.claude/skills/  skills do projeto (extraídas do código)
```
