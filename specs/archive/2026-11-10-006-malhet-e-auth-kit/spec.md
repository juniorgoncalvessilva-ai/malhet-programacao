# 006 — Identidade Malhet e autenticação pelo auth-kit
Pedido do usuário: "Melhore o visual utilizando o design system do Malhet (nome e identidade) · para autenticação utilize o auth-kit".

## Backend
- [x] auth-kit copiado em `apps/api/vendor/auth_kit` (ORIGEM com commit) e montado em `/api/auth`
  > 2026-11-10 — ponte `app/core/authkit.py`; seed de admin no lifespan; handler de HTTPException no formato do kit.
- [x] RBAC: permissões `obra.usar` (user, admin) e `obra.administrar` (admin) — cargas, importações e envio da FT só admin
- [x] Migração `0002_auth_kit` (tabelas auth_*) e autogenerate ciente das duas metadatas
- [x] Teste `tests/test_auth.py`: 401 sem token, 403 para user em rota admin, /auth/me
  > 18 testes verdes.
## Frontend
- [x] Clerk removido (`@clerk/nextjs`, `svix`, páginas sign-in/up, profile, settings, api-demo, landing)
  > Decisão: shim `lib/auth/compat.ts` mantém store/analytics do kit funcionando sem reescrevê-los.
- [x] `AuthProvider`: token em memória, refresh por cookie + CSRF, 2FA no login; API pela mesma origem (`/backend`)
- [x] Tokens CorpMind (claro/escuro), Figtree, logo Malhet; shell (lateral 248px por etapa, topo 64px, trilha)
- [x] Telas Programação, Referências, Equipes, Cadastros e Entrar/Cadastro/Verificar no padrão Malhet
  > Verificado com Playwright: login real, refresh após reload, tema escuro, 390px.
## Pendências
- [ ] E-mail do auth-kit manda só o token (sem link): ajustar texto/URL quando houver domínio (`register_user`, `password`)
- [ ] Tela de redefinição de senha e de 2FA (o kit já expõe `/auth/password/*` e `/auth/mfa/*`)
