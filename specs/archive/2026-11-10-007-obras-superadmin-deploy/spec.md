# 007 — Super Admin, obras, acesso de usuários por obra e deploy no Coolify
Pedido: "Crie o Super Admin e a página para criar a obra e Usuários para ter acesso a ela. Faça deploy limpando a VPS e no Coolify".

## Negócio
- [x] Obra como limite de todos os dados; papéis na obra: admin, planejador, encarregado (com crachá), leitor
- [x] Super Admin (papel `superadmin` no RBAC do auth-kit) cria obras e dá acesso em qualquer obra
## Backend
- [x] Módulo `obras` (Obra, AcessoObra), `ContasGateway` sobre o auth-kit (conta criada já confirmada com senha inicial)
- [x] `obra_id` em cadastros, versões, vínculos, equipes e programação; `ContextoObra` por cabeçalho `X-Obra-Id`
  > 2026-11-10 — decisão: chaves naturais do Simova passam a ser (obra_id, código).
- [x] Encarregado só programa/exclui itens do próprio crachá
- [x] Seed `SUPERADMIN_EMAIL/PASSWORD` idempotente no boot
- [x] Testes: superadmin, criação de obra/acessos, 400/403/404, isolamento entre obras, regras do encarregado — 18 verdes
## Frontend
- [x] `ObraProvider` + seletor de obra na lateral; menu filtrado por papel; estado "sem obra"
- [x] Telas Administrar › Obras e usuários (Super Admin) e Acessos da obra (admin da obra)
- [x] Ações escondidas conforme o papel nas telas existentes
  > Verificado com Playwright: superadmin cria 2 obras, libera planejador e encarregado; planejador entra sem menu Administrar.
## Deploy
- [x] Dockerfiles (api com migração no boot; web standalone) e `docker-compose.coolify.yml`
  > Stack subida localmente com docker compose: db/api/web saudáveis, login e criação de obra pelo navegador.
- [x] Guia `docs/deploy-coolify.md` e `infra/limpar-vps.sh` (simulação por padrão, preserva o Coolify)
- [ ] Deploy na VPS 179.199.156.129 — **bloqueado**: o ambiente da sessão não alcança IPs diretos (proxy) e o
      código ainda não está num repositório GitHub que o Coolify possa puxar.
