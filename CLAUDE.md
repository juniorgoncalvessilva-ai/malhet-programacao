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
  em `planejamento/application/exportar_cliente.py`. Spec 010. Líder da equipe = qualquer pessoa do efetivo
  (`equipe.responsavel_id` → `responsavel`, que é o Responsável da programação); programação filtra por encarregado
  (`FiltroEncarregado`, `src/lib/programacao/encarregado.ts`). Spec 047. Pessoa do efetivo em formulário = `BuscaEfetivo`
  (dropdown com busca; encarregado e funcionários da equipe). Spec 048.
- Catálogo: tipo = item da PQ (`tipo_atividade.item_pq`, um por obra); PQ com estrutura (títulos/folhas) em
  `item_pq` (`folha`, `nivel`, `ordem`), lida por `referencias/infra/pq_gateway.py`. Spec 011.
  Grupo com um ou vários itens da PQ (lote ou lista por linha, `PUT /catalogo/itens-pq/{item}/grupo`); nome
  simplificado por obra+item (`pq_nome_simplificado`, `ItemPqInfo.texto_simova`) é o texto do Simova. Spec 021.
  Grupos em massa no layout OPER_GRUPO, `grupo_atividade.unidade` e tabela `unidade_medida` (aba UNIDADE_MEDIDA do
  Simova; unidade do item da PQ casada em `catalogo/domain/unidades.py`); excluir item do grupo leva os IWPs. Spec 028.
- SSMA: listas suspensas vêm de `ssma/` (`cadastro_ssma`, gateway `CadastroSsmaGateway.conferir`). Técnico/RAC/PTS/
  ART/ATA = segurança; PTO = Planejamento (linha da programação). Spec 012.
- SSMA/PTO: RAC/PTS/ART/ATA/PTO são listas na linha (JSONB, `lista_da_linha`) e aceitam arquivos (`anexo_ssma`,
  `validar_anexo`). Spec 014.
- Efetivo (`efetivo/`): planilha do DP com **matrícula como chave** (reimportar não apaga; `no_ultimo_arquivo`),
  situação de mobilização, movimentos, sem dados pessoais sensíveis. De-para função do efetivo → recurso da CPU
  (`de_para_funcao`, gateway `funcoes_por_cracha` usado em `composicao_efetiva`). Equipes a partir do efetivo e
  exportação no layout Simova (`equipes/domain/simova_equipe.py::linha_simova`). Organograma em
  `efetivo/domain/organograma.py`. Spec 015. Aba "Resumo por função" (`ResumoEfetivo`, `src/lib/efetivo/resumo.ts`):
  contagens e gráficos agrupados do efetivo, cada número com memória. Spec 051.
- Equipes × efetivo: o número antes do nome ("115532 :: JOSÉ") é a matrícula — `separar_cracha` +
  `LocalizadorEfetivo` + `equipes/application/vincular_efetivo.py` (ao salvar/importar e `POST /equipes/vincular-efetivo`).
  Spec 016.
- Organograma: `components/Obra/OrganogramaArvore.tsx` (recolher por nível, folhas empilhadas, zoom/arrastar/tela cheia).
  Quadro de totais no fim da planilha do efetivo é ignorado (`e_quadro_de_totais`). Spec 017. Editar equipes pelo
  organograma (`EdicaoOrganograma`; `POST/DELETE /equipes/{id}/membros`, mover com `de_equipe_id`). Spec 049. Arrastar e
  soltar/lote (`POST /equipes/membros/lote`), migrar/tirar função, supervisor (líder intermediário, `equipe.supervisor_id`,
  `PUT /equipes/lideranca/definir`) e visibilidade (`src/lib/efetivo/visibilidade.ts`). Spec 052. "+ pessoa"/"+ função" abrem
  card por cima da tela (`CardIncluir`, `createPortal`, fora do zoom). Spec 056.
- Setores da obra (`setor_obra`, responsável do efetivo, cor) e `organograma_config` (responsável geral + cores por
  nível); `equipe.setor_id`. Spec 018. Vista por frente (`?vista=frente`): Obra → Setor (dono) → Frente (local) → Área →
  Equipe; frente da equipe = `equipe.frente_codigo` (área/local) ou a área da programação mais recente
  (`frentes_das_equipes`). Spec 042. Disciplinas (`subsetor_obra`, `equipe.subsetor_id`): Organograma =
  Obra → Setor → Disciplina → Equipe → Função; responsáveis só na própria caixa. Spec 019. Responsável (qualquer pessoa do
  efetivo, `equipe.responsavel_id`) é o nível abaixo do dono do setor: Setor → Responsável → Disciplina/Frente → Equipe.
  Spec 050.
- Frentes: lista da obra `CWA | Ativo | DESCRICAO CWA | Local` (`interpretar_lista_cwa`); Local pelo nome com código
  L1, L2…; `area_frente.ativo_codigo` → TAG do take-off. Formato antigo CODIGO | DESCRICAO ainda aceito. Spec 020.
- WBS de execução (`wbs/`): Área → CWP (elemento + complemento) → Grupo → IWP (item da PQ); `programacao_linha.wbs_no_id`
  (IWP define área, tipo, item, qtd e o texto complementar = CWP). Programação concluída só muda por revisão
  (`exigir_aberta`, `programacao_conclusao`). Specs 023–024. Programação mostra Local → Área → CWP → linhas
  (`linha.cwp`, `porCwp`) e o nome "Reduzido + complemento" (padrão) ou "Descritivo da PQ" (`BotaoNomes`,
  `descricao_reduzida`/`descricao_completa`, Excel `?nomes=`). Spec 046. Aba "Resumo por frente e responsável"
  (`ResumoProgramacao`): somas por unidade de medida, frente → área e responsável → encarregado, com memória. Spec 053.
  Sequência (`planejamento/domain/sequencia.py`, `programacao_linha.predecessoras` TI/II/TT/IT + lag, `programacao.sequenciada`,
  `PUT /programacoes/{pid}/sequencia`), aba "Sequência (Gantt)" no modelo do MS Project (predecessoras "3TI+2 dias"), distribuição sugerida nos dias vazios e "Por encarregado"
  (`agruparPorEncarregado`). Spec 054. Cores do modelo S27 (local vermelho FF0000 na linha toda, área azul 173761,
  atividades alternadas D6DCE4) no Excel do cliente, na tela e na impressão; Gantt com "Classificar por" e "Agrupar por"
  (frente/encarregado, linha-resumo). Spec 055.
- Cronograma segue a estrutura do Primavera: `atividade_cronograma.wbs_niveis` (nome, código, ordem por nível) e
  `ordem_p6`; listas e linhas da programação ordenam por ela. Spec 013.
- Previsto pela capacidade × manual (encarregado): `programacao_linha.modo_previsto` (capacidade|manual|ajustado),
  `programacao/domain/previsto.py` (capacidade × horas do dia ÷ 9 h até a qtd do período), `PUT /programacoes/{pid}/
  modo-previsto`; a capacidade do dia e a sugestão saem sempre em `calc` (base dos KPIs). Spec 026.
- Indicadores (`indicadores/`): histórico `programacao_fato` (linha × dia) gravado ao emitir e regravado ao concluir
  (`application/registrar.py`, a partir da foto); desvios no layout do Pareto semanal (`desvio`, `causa_desvio`,
  importar/exportar a aba Detalhamento); concluir exige causa para cada item não cumprido (`exigir_causas`); KPIs em
  `indicadores/domain/kpi.py` (PPC, aderência, carga e erro × capacidade, por modo/encarregado) com memória. Spec 027.
- Look-ahead das equipes (`lookahead/`): blocos equipe × atividade × área a partir dos dias programados
  (`domain/blocos.py`), cor da disciplina/setor, `GET /lookahead`. Spec 029. Restrições 6WLA (`restricoes/`): aba Ações
  do Plano de Ação (farol/status das fórmulas da planilha em `domain/acao.py`), Ishikawa 6M, importar/exportar Excel;
  restrição pendente marca o cartão do look-ahead. Spec 030. Excel do Pareto (Gráfico/Detalhamento/Dados, status com
  ícones 1 ✖ 2 ! 3 ✔) e do Plano de Ação (Ações com farol de semáforos + PAINEL AÇÃO) no layout da obra para a
  fiscalização: `indicadores/application/excel_pareto.py`, `restricoes/application/planilha.py`, `app/shared/excel.py`. Spec 031. Tela de Restrições em abas (Ações | Painel | Importar), gráficos do PAINEL AÇÃO
  pela mesma conta do Excel (`restricoes/domain/painel.py`), edição na linha e observação datada (`anotar`). Spec 032.
- Marca da obra (`marca_obra`, `app/shared/marca.py`): logos do contratante/contratada (ou Malhet) em todo documento
  (`inserir_logos`, `cor_excel`) e cor do cliente (`/obra/marca`, `MinhaObra.cor` → tokens `--m-accent*`). Documento
  novo usa `marca_da_obra` e `<LogosObra>`; não fixe a cor do Malhet. Spec 039.
- WBS × Frentes × Primavera: área das Frentes entra sozinha na WBS (`wbs/application/p6.py::garantir_areas`);
  `wbs_no.codigo_p6` = código WBS do P6 (5.4.3.4) é a chave da ida e volta; `POST /wbs/exportar-p6` devolve o .xer
  com a WBS acrescentada (`wbs/domain/xer.py`, bytes do P6 intactos, IWP → atividade EXE-00000); a sincronização casa
  CWP pelo código e IWP pelo Activity ID. Spec 040.
- Plano de 90 dias (`planos/`): `plano_item` (atividade pensada/marco, IWP ou área+tipo, janela, marco que puxa) com
  situação derivada (analisar → restrição → liberado → programado); restrição do item = ação do 6WLA
  (`acao_restricao.plano_item_id`); migra para a programação (`programacao_linha.plano_item_id`; semanal só sem restrição
  pendente). Abas 90 dias | 6 semanas | Pull planning | Levar à programação em `/app/plano`. Aba do navegador
  "Contratada | Obra" + favicon da contratada (`TituloAba`, `marca_obra.nome_contratada`). Spec 043. Puxar de um período do
  cronograma (`/planos/itens/do-cronograma`, excluir concluídas) com os recursos do P6 (`atividade_cronograma.recursos`
  ← TASKRSRC, copiados em `plano_item.recursos`); `/planos/tirar-concluidas`. Spec 044.
- Fórmulas da planilha auxiliar ficam em `referencias/domain/indice.py` e `programacao/domain/{calendario,gargalo,
  sequenciador,previsto}.py` — qualquer mudança de cálculo começa por um teste em `tests/test_motor_planilha.py`.

## Front (apps/web) — AI Coders Starter Kit + identidade Malhet
- Visual = design system CorpMind do canvas Malhet (skill `ui-malhet`): tokens em `src/css/malhet.css`, classes
  Tailwind `m-*`, componentes em `src/components/Obra/ui.tsx`, shell em `src/components/Malhet/`. Não use as cores
  do kit (`primary`, `dark-*`, `gray-*`) em telas novas.
- Páginas da obra em `src/app/[locale]/app/(obra)/` (o `layout.tsx` só monta com obra escolhida); menu em
  `src/components/Malhet/menu.ts`. Fluxo principal (spec 008): Importações → Frentes → Catálogo → Programações
  (montar → emitir → imprimir → FT). Hooks em `src/hooks/programacao/planejamento.ts`.
- Obra corrente: `useObra()` (`src/lib/obra/ObraProvider.tsx`): obras, papel, `pode('planejador')`, superadmin,
  `podeVer(url)` (páginas liberadas por pessoa em `acesso_obra.paginas`; a Programação vigente `/app/vigente` fica sempre
  aberta). Cabeçalhos sem descrição (espaço). Acessos e usuários unificados em `/app/acessos`. Spec 033.
  `useApi()` já manda o `X-Obra-Id`; trocar de obra remonta as telas. Esconda ações que o papel não permite.
- **Memória de cálculo**: todo número calculado na tela usa `<Calculado>` (`components/Obra/Calculado.tsx`) e abre a
  conta + fontes (origem e linha/campo). Backend: `app/shared/memoria.py` (`Memoria`, `Fonte`, `pacote`); CPU com linha do
  arquivo (`cpu_linha`, `cpu_obra.rastrear`, `referencias/application/memoria_cpu.py`). Número novo sem memória = bug. Spec 022.
- Exclusão/remoção sempre pede confirmação com `useConfirmar()` (`components/Obra/Confirmar.tsx`); nunca
  `window.confirm`. Vários valores de lista: `components/Obra/MultiSelecao.tsx`.
- Sessão: `useSessao()` (`src/lib/auth/AuthProvider.tsx`). Código antigo do kit usa o shim `src/lib/auth/compat.ts`.
- API só via `useApi()` + TanStack Query (`queries.ts`), sempre por `/backend/api` (rewrite do Next). Tipos em
  `src/lib/api/types.ts`.
- Tempo real: `useApi` recarrega as consultas abertas depois de cada post/put/del; `SincronizarDados`
  (`src/lib/tempo-real`) confere `GET /api/mudancas` (middleware `app/core/mudancas.py`) a cada 3 s e recarrega quando
  outro usuário alterou a obra; versão do build (`/api/versao`) recarrega a página depois de deploy. POST só de
  consulta termina em `/previa` (não conta como mudança). Spec 045.

## Comandos
- API: `cd apps/api && .venv/bin/pytest -q` · `.venv/bin/alembic revision --autogenerate -m "..."` · `.venv/bin/alembic upgrade head`
- Web: `cd apps/web && npx tsc --noEmit && npm run build`
- Deploy: `docker-compose.coolify.yml` + `docs/deploy-coolify.md`

## Regras
- Nunca remova testes para "fazer passar". Rode pytest + tsc antes de concluir.
- Planilhas com nomes/crachás reais não vão para o git (`data/local/`). `apps/api/data/simova/` só tem cadastros.
- Layout das planilhas do Simova é contrato: `integracao_simova/domain/layout.py`.
