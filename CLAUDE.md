# CLAUDE.md — Programação de Obra × Simova

Leia antes de gerar código: `docs/PRD.md`, `docs/dominio.md` e a skill do tipo de mudança em `.claude/skills/`.
Toda mudança não trivial nasce como spec em `specs/changes/NNN-nome/spec.md` (use `/spec-executar`).

## Linguagem ubíqua (use estes termos no código, telas e specs)
FRENTE (local) → OPER_GRUPO → OPER (atividade padrão) → FT (linha de programação do Simova).
Versão de referência (CRONOGRAMA, PQ, CPU, INDICES, SIMOVA) · **vigente** · vínculo · encarregado (crachá) ·
equipe (frente de trabalho) · PE (produção esperada) · HH · índice (un/dia por oficial) · recurso que governa ·
gargalo · base PRAZO/CAPACIDADE · emitir.

## Arquitetura (apps/api)
- Módulo = contexto delimitado em `app/modules/<modulo>/{domain,application,infra,api}`.
- **domain**: dataclasses imutáveis (frozen) com validação no `__post_init__`; métodos devolvem clones (`replace`).
  Sem SQLAlchemy, FastAPI ou I/O. Erros de regra = `DomainError`.
- **application**: casos de uso (comandos). Recebem portas (`Protocol`) — nunca a Session diretamente, exceto
  cargas/importações de planilha.
- **infra**: modelos SQLAlchemy, repositórios e gateways. Um módulo lê outro **só** por gateway/linguagem publicada
  (ex.: `programacao/infra/catalogo_gateway.py` → `OperInfo`).
- **api**: routers FastAPI finos; consultas simples direto no router (CQRS leve).
- Infra de auth (JWT Clerk) fica em `app/core/auth.py`; casos de uso recebem só `usuario.id`.
- Fórmulas da planilha auxiliar ficam em `referencias/domain/indice.py` e `programacao/domain/{calendario,gargalo,
  sequenciador}.py` — qualquer mudança de cálculo começa por um teste em `tests/test_motor_planilha.py`.

## Front (apps/web) — AI Coders Starter Kit
- Reaproveite layout/sidebar/i18n do kit (`.rules/` do kit continua válido). Páginas da obra em
  `src/app/[locale]/app/(obra)/`; componentes em `src/components/Obra/`; hooks em `src/hooks/programacao/`.
- API só via `useApi()` + TanStack Query (`queries.ts`). Tipos espelham os schemas da API em `src/lib/api/types.ts`.
- Menu em `src/hooks/useNavigation.ts` (seção OBRA) + chaves em `messages/{pt-BR,en}.json`.

## Comandos
- API: `cd apps/api && .venv/bin/pytest -q` · `.venv/bin/alembic revision --autogenerate -m "..."` · `.venv/bin/alembic upgrade head`
- Web: `cd apps/web && npx tsc --noEmit && npm run build`

## Regras
- Nunca remova testes para "fazer passar". Rode pytest + tsc antes de concluir.
- Planilhas com nomes/crachás reais não vão para o git (`data/local/`). `apps/api/data/simova/` só tem cadastros.
- Layout das planilhas do Simova é contrato: `integracao_simova/domain/layout.py`.
