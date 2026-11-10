# 001 — Fundação: monorepo, cadastros Simova, referências versionadas, programação por capacidade

Skills: `model-modulo-api`, `db-migracao`, `integracao-simova`.

## Negócio
- [x] Hierarquia FRENTE → OPER_GRUPO → OPER → FT e qualidade de dados documentadas
  > 2026-11-10 — `docs/dominio.md`. Decisão: OPER com chave (grupo, código); OPER_GRUPO com id surrogate (códigos 28–33 duplicados no Simova).
- [x] Versões de referência com vigente por tipo + vínculo por chaves estáveis
  > 2026-11-10 — pedido do usuário ("local para vincular a versão vigente do cronograma… PQ, CPU e SIMOVA"). Índice único parcial `uq_versao_vigente_por_tipo`.
## Backend
- [x] Domínio `ItemProgramacao` imutável + capacidade + motor portado (índice, calendário, gargalo, sequenciador)
  > 2026-11-10 — portado de programacao_v5.py e do script de sequência. Desvio: gargalo/PRAZO ainda não entram no caso de uso (spec 002).
- [x] Importadores: OPER.xlsx, FRENTE.xlsx, FT, planilha auxiliar (ATIVIDADES/PQ/RECURSOS/ÍNDICES/EQUIPES)
  > 2026-11-10 — carga real: 4.228 atividades, 487 itens PQ, 1.187 linhas CPU, 5 índices em ~2 s; 5 equipes. Avisos de duplicados.
- [x] Exportadores: FT_IMPORT_INTERMEDIARIA (layout exato) e OPERs novas
## Persistência
- [x] PostgreSQL + Alembic (migração inicial)
## API
- [x] Routers cadastros, referências, equipes, programação, simova; erros 422/404
## Frontend
- [x] Starter kit sem Supabase; páginas Programação, Referências, Equipes, Cadastros; modo dev sem Clerk
  > 2026-11-10 — `tsc` e `next build` ok; telas verificadas com Playwright e dados reais.
## Verificação
- [x] 17 testes (domínio + motor + fluxo ponta a ponta com OPER/FRENTE reais)
  > 2026-11-10 — índice orçado C-23440 = 8,0863 (planilha: 8,08625).
