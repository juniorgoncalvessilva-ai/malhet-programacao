# CLAUDE.md — Malhet · Programação de Obra × Simova

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
- Auth = **auth-kit** copiado em `vendor/auth_kit` (não edite o kit além de `domain/rbac.py`; para atualizar, copie
  de novo e registre o commit em `vendor/auth_kit/ORIGEM`). Ponte em `app/core/authkit.py` (sys.path + .env) e
  `app/core/auth.py`: rotas usam `Depends(usuario_atual)` (obra.usar) ou `Depends(usuario_admin)` (obra.administrar).
  Casos de uso recebem só `usuario.id`.
- **Tudo é por obra**: toda tabela de dados tem `obra_id`; rotas recebem `ContextoObra` via `Depends(ler|programar|
  planejar|administrar)` (`app/core/auth.py`, cabeçalho `X-Obra-Id`) e repositórios/gateways recebem `obra_id` no
  construtor. Nova tabela de dados sem `obra_id` = bug. Teste de isolamento em `tests/test_auth.py`.
- CPU da obra = relatório "Composição de Preços Unitários" (.xls) → `referencias/domain/cpu_obra.py` (leitura +
  achatamento das auxiliares) e `referencias/infra/cpu_gateway.py` (item PQ → HH/un, governa, índice). Spec 009.
- Equipes: cadastro do Simova (`equipes/domain/simova_equipe.py`), composição efetiva pelos membros
  (`equipes/infra/composicao.py`). Papel `seguranca` só edita SSMA (`Depends(ssma)`). Excel do cliente (layout S32)
  em `planejamento/application/exportar_cliente.py`. Spec 010.
- Catálogo: tipo = item da PQ (`tipo_atividade.item_pq`, um por obra); PQ com estrutura (títulos/folhas) em
  `item_pq` (`folha`, `nivel`, `ordem`), lida por `referencias/infra/pq_gateway.py`. Spec 011.
  Grupo com um ou vários itens da PQ (lote ou lista por linha, `PUT /catalogo/itens-pq/{item}/grupo`); nome
  simplificado por obra+item (`pq_nome_simplificado`, `ItemPqInfo.texto_simova`) é o texto do Simova. Spec 021.
- SSMA: listas suspensas vêm de `ssma/` (`cadastro_ssma`, gateway `CadastroSsmaGateway.conferir`). Técnico/RAC/PTS/
  ART/ATA = segurança; PTO = Planejamento (linha da programação). Spec 012.
- SSMA/PTO: RAC/PTS/ART/ATA/PTO são listas na linha (JSONB, `lista_da_linha`) e aceitam arquivos (`anexo_ssma`,
  `validar_anexo`). Spec 014.
- Efetivo (`efetivo/`): planilha do DP com **matrícula como chave** (reimportar não apaga; `no_ultimo_arquivo`),
  situação de mobilização, movimentos, sem dados pessoais sensíveis. De-para função do efetivo → recurso da CPU
  (`de_para_funcao`, gateway `funcoes_por_cracha` usado em `composicao_efetiva`). Equipes a partir do efetivo e
  exportação no layout Simova (`equipes/domain/simova_equipe.py::linha_simova`). Organograma em
  `efetivo/domain/organograma.py`. Spec 015.
- Equipes × efetivo: o número antes do nome ("115532 :: JOSÉ") é a matrícula — `separar_cracha` +
  `LocalizadorEfetivo` + `equipes/application/vincular_efetivo.py` (ao salvar/importar e `POST /equipes/vincular-efetivo`).
  Spec 016.
- Organograma: `components/Obra/OrganogramaArvore.tsx` (recolher por nível, folhas empilhadas, zoom/arrastar/tela cheia).
  Quadro de totais no fim da planilha do efetivo é ignorado (`e_quadro_de_totais`). Spec 017.
- Setores da obra (`setor_obra`, responsável do efetivo, cor) e `organograma_config` (responsável geral + cores por
  nível); `equipe.setor_id`. Spec 018. Disciplinas (`subsetor_obra`, `equipe.subsetor_id`): Organograma =
  Obra → Setor → Disciplina → Equipe → Função; responsáveis só na própria caixa. Spec 019.
- Frentes: lista da obra `CWA | Ativo | DESCRICAO CWA | Local` (`interpretar_lista_cwa`); Local pelo nome com código
  L1, L2…; `area_frente.ativo_codigo` → TAG do take-off. Formato antigo CODIGO | DESCRICAO ainda aceito. Spec 020.
- Cronograma segue a estrutura do Primavera: `atividade_cronograma.wbs_niveis` (nome, código, ordem por nível) e
  `ordem_p6`; listas e linhas da programação ordenam por ela. Spec 013.
- Fórmulas da planilha auxiliar ficam em `referencias/domain/indice.py` e `programacao/domain/{calendario,gargalo,
  sequenciador}.py` — qualquer mudança de cálculo começa por um teste em `tests/test_motor_planilha.py`.

## Front (apps/web) — AI Coders Starter Kit + identidade Malhet
- Visual = design system CorpMind do canvas Malhet (skill `ui-malhet`): tokens em `src/css/malhet.css`, classes
  Tailwind `m-*`, componentes em `src/components/Obra/ui.tsx`, shell em `src/components/Malhet/`. Não use as cores
  do kit (`primary`, `dark-*`, `gray-*`) em telas novas.
- Páginas da obra em `src/app/[locale]/app/(obra)/` (o `layout.tsx` só monta com obra escolhida); menu em
  `src/components/Malhet/menu.ts`. Fluxo principal (spec 008): Importações → Frentes → Catálogo → Programações
  (montar → emitir → imprimir → FT). Hooks em `src/hooks/programacao/planejamento.ts`.
- Obra corrente: `useObra()` (`src/lib/obra/ObraProvider.tsx`): obras, papel, `pode('planejador')`, superadmin.
  `useApi()` já manda o `X-Obra-Id`; trocar de obra remonta as telas. Esconda ações que o papel não permite.
- **Memória de cálculo**: todo número calculado na tela usa `<Calculado>` (`components/Obra/Calculado.tsx`) e abre a
  conta + fontes (origem e linha/campo). Backend: `app/shared/memoria.py` (`Memoria`, `Fonte`, `pacote`); CPU com linha do
  arquivo (`cpu_linha`, `cpu_obra.rastrear`, `referencias/application/memoria_cpu.py`). Número novo sem memória = bug. Spec 022.
- Exclusão/remoção sempre pede confirmação com `useConfirmar()` (`components/Obra/Confirmar.tsx`); nunca
  `window.confirm`. Vários valores de lista: `components/Obra/MultiSelecao.tsx`.
- Sessão: `useSessao()` (`src/lib/auth/AuthProvider.tsx`). Código antigo do kit usa o shim `src/lib/auth/compat.ts`.
- API só via `useApi()` + TanStack Query (`queries.ts`), sempre por `/backend/api` (rewrite do Next). Tipos em
  `src/lib/api/types.ts`.

## Comandos
- API: `cd apps/api && .venv/bin/pytest -q` · `.venv/bin/alembic revision --autogenerate -m "..."` · `.venv/bin/alembic upgrade head`
- Web: `cd apps/web && npx tsc --noEmit && npm run build`
- Deploy: `docker-compose.coolify.yml` + `docs/deploy-coolify.md`

## Regras
- Nunca remova testes para "fazer passar". Rode pytest + tsc antes de concluir.
- Planilhas com nomes/crachás reais não vão para o git (`data/local/`). `apps/api/data/simova/` só tem cadastros.
- Layout das planilhas do Simova é contrato: `integracao_simova/domain/layout.py`.
