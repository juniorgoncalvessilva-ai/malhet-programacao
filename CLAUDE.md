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
  situação de mobilização, movimentos, sem dados pessoais sensíveis (exceções com aceite LGPD por finalidade: descritor facial —
  spec 063 — e foto do rosto no momento da assinatura + coordenadas — spec 074). De-para função do efetivo → recurso da CPU
  (`de_para_funcao`, gateway `funcoes_por_cracha` usado em `composicao_efetiva`). Equipes a partir do efetivo e
  exportação no layout Simova (`equipes/domain/simova_equipe.py::linha_simova`). Organograma em
  `efetivo/domain/organograma.py`. Spec 015. Aba "Resumo por função" (`ResumoEfetivo`, `src/lib/efetivo/resumo.ts`):
  contagens e gráficos agrupados do efetivo, cada número com memória. Spec 051.
- Equipes × efetivo: o número antes do nome ("115532 :: JOSÉ") é a matrícula — `separar_cracha` +
  `LocalizadorEfetivo` + `equipes/application/vincular_efetivo.py` (ao salvar/importar e `POST /equipes/vincular-efetivo`).
  Spec 016. Uma equipe por funcionário: entrar numa equipe tira das outras (líder — encarregado/responsável/supervisor — pode
  estar em várias), tudo por `equipes/application/alocacao.py::Alocador` com movimento `EQUIPE` (`de_equipe_id`/`para_equipe_id`);
  aba Movimentações (`GET /equipes/movimentacoes`). Nome padrão `equipe_config` (`EQUIPE.{n}_{disciplina}`, número automático,
  `disciplina_padrao`, aba Configuração). Spec 107.
  Acesso dos líderes (`lideres/`, spec 111; endereço fixo spec 115): `/encarregado` sem conta do Malhet — matrícula + senha
  (inicial 123456, cria a dele no primeiro acesso ali mesmo; Argon2, JWT próprio com `obra` e `versao`, `Tentativas`); a obra sai
  da matrícula (`POST /portal/entrar`; em várias obras devolve `escolher`), vê as equipes que lidera, "Não está comigo" (vai para
  outro encarregado ou sem equipe) e "Trazer alguém" (busca no efetivo), tudo pelo `Alocador`; rotas públicas `/portal/*`
  (`X-Portal-Token`, sem código). Links antigos `/equipe/<codigo>` só redirecionam (`GET /portal/link/{codigo}` → `?obra=`).
  Tela `/app/lideres`: endereço da obra e da empresa (copiar/WhatsApp), líderes sem a função de encarregado, redefinir/bloquear.
  Endereço por empresa e obra (spec 117): `/encarregado/<empresa>/<obra>` e `/encarregado/<empresa>` saem sozinhos do nome da
  contratada e do código da obra (`lideres/domain/rota.py::slug`, sem contratada = `malhet`; `application/rotas.py::resolver`,
  `GET /portal/rota/{empresa}[/{obra}]`): marca antes do login, empresa só aceita as obras dela (`entrar(..., empresa)`), a obra
  manda (nome antigo da empresa corrige o endereço), `/encarregado` e links antigos herdam o endereço da obra (`guardarRota`).
  Quem está em Acesso dos líderes entra (spec 118): matrícula comparada por `normalizar_codigo` (zero à esquerda, ponto, ".0" do
  Excel; `_norm_sql` no banco) na lista e no login; encarregado de equipe fora do efetivo entra no 1º acesso e vira cadastro
  pendente (`_encarregado_fora_do_efetivo`); a mensagem diz o motivo (senha, não é líder, outra obra, não encontrada).
  Marca da empresa (spec 113): `GET /portal/marca/{obra_id}` no navegador (obra lembrada no aparelho) — título, ícone (logo),
  `theme-color`, abertura com a logo e faixas de cima/baixo na cor (`textoSobre`, tokens no `.portal-lider`). Reivindicar equipe
  (spec 114): função de liderança entra sem equipe (`funcao_de_lider`), pede a equipe (`lider_pedido_equipe`) e o Planejamento
  aprova (cria no padrão de nome, líder = encarregado, pessoas pelo `Alocador`) ou recusa com motivo em Acesso dos líderes.
- Organograma: `components/Obra/OrganogramaArvore.tsx` (recolher por nível, folhas empilhadas, zoom/arrastar/tela cheia).
  Quadro de totais no fim da planilha do efetivo é ignorado (`e_quadro_de_totais`). Spec 017. Editar equipes pelo
  organograma (`EdicaoOrganograma`; `POST/DELETE /equipes/{id}/membros`, mover com `de_equipe_id`). Spec 049. Arrastar e
  soltar/lote (`POST /equipes/membros/lote`), migrar/tirar função, supervisor (líder intermediário, `equipe.supervisor_id`,
  `PUT /equipes/lideranca/definir`) e visibilidade (`src/lib/efetivo/visibilidade.ts`). Spec 052. "+ pessoa"/"+ função" abrem
  card por cima da tela (`CardIncluir`, `createPortal`, fora do zoom). Spec 056. Listas de mover/migrar mostram
  "EQUIPE — Enc. NOME" (`rotuloEquipe`). Spec 057. Impressão: nomes sem rolagem (listas longas em colunas, `dividirEmColunas`),
  "Expandir tudo ▾" só caixas/com nomes, espessura das linhas (`--linha`) e exportar A0–A3 PDF/JPG com cabeçalho e logos
  (`ExportarOrganograma.tsx`, html-to-image + jsPDF). Spec 058.
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
  atividades alternadas C5D9F1, spec 059) no Excel do cliente, na tela e na impressão; Gantt com "Classificar por" e "Agrupar por"
  (frente/encarregado, linha-resumo). Spec 055. Itens não cumpridos em cards (um por vez, passa ao próximo sem motivo ao registrar,
  minimizar/ver todos) e cálculo da CPU por linha recolhível (`usePreferencia`, `lib/preferencia.ts`). Spec 105. Excluir revisão emitida só pelo super admin (`DELETE /programacoes/{pid}/emissoes/{rev}`,
  `excluir_emissao`; a anterior volta a vigente; última de concluída não sai; `RevisoesProgramacao`). Spec 060. Trocar o item da PQ da
  linha também emitida (`PUT …/linhas/{lid}/item-pq`, `item_pq_linha.py`, `TrocarItemPq`; tipo do item novo ou criado no grupo,
  IWP da WBS junto; a revisão emitida não muda, sai na próxima). Spec 099.
  Duplicar no mesmo CWA (spec 136): WBS `POST /wbs/nos/{id}/duplicar` (grupo com IWPs/etapas ou IWP → outro CWP do mesmo CWA,
  existente ou novo; não repete o que o destino tem) e programação `POST /programacoes/{pid}/linhas/duplicar` ("Duplicar linha" e
  "duplicar grupo" no cabeçalho do CWP; cópia logo abaixo, sem dias/qtd do período). Envio da WBS pula nó que sumiu
  (`iwps_abaixo` → `nos_inexistentes`); `useWbs` = `['wbs', obra]` sempre atual e a seleção é podada à árvore.
  Importar itens de outra programação (spec 116, `importar_linhas`, `ImportarProgramacao`): a anterior do mesmo tipo vem sugerida
  (`/importar/origens`, prévia `/importar/{de}`, `POST /importar`; criação com `copiar_de` usa a mesma regra), sem valores do dia,
  quantidade vazia ou o que faltou (`saldo_periodo`), concluída no projeto fica fora e linha repetida não duplica. Realizado confere o
  acumulado (`domain/acumulado.py`, `conferencia` na linha, memória `acumulado`): passar do total do projeto trava até
  `aceitar_excesso` (`excesso_projeto`, web e `/m/lancar`), passar do programado no período só avisa (`lib/programacao/acumulado.ts`). Super admin renumera as revisões emitidas
  (`PUT …/emissoes/numeracao`, `domain/revisoes.py`: sem repetir nem inverter a ordem; foto, fatos e conclusão). Spec 100.
- App de campo (`src/app/[locale]/m`): aba Programação (`m/vigente`) com `DetalheAtividade` (frente, quantitativo, efetivo,
  atalhos Lançar/Ocorrência com `?data=&linha=`); Lançar com setas/arrastar e frente em destaque; ocorrência com várias
  causas (um desvio por causa, fotos por causa); área da restrição em lista com busca; carimbo de data/hora + frente nas
  fotos da restrição (`carimbarFoto`). Spec 061. Toda foto de campo sai carimbada (data/hora + linhas + obra) em `useEnviarFoto`
  (`extra.carimbo`; já carimbada não repete). Registrar atividade fora da programação (spec 119): `/m/lancar/registrar` →
  frente (CWA) → IWP da WBS da frente com CWP e grupo (`wbs/infra/gateway.py::itens_da_area`, filtro) ou item da PQ → texto
  livre → fotos (`registro_atividade`, `campo/api/registros.py`, foto alvo `registro`; entra no book como atividade "Fora da
  programação"). Baixar foto: `GET /fotos/{id}/arquivo?baixar=true` (nome AAAAMMDD-HHMM-frente-tipo-id, `nome_para_baixar`),
  `baixarFoto` (compartilhar no app nativo) na foto ampliada e no book. Logo da contratada (Marca da obra) no canto do carimbo
  (spec 120, `useLogoNoCarimbo`: no `MobileShell`, `TirarFotos` e `useEnviarFoto`; guardada reduzida no aparelho por obra,
  `malhet.logo-carimbo.<obra>`, para carimbar offline). "Fotos" (`/m/fotos`, a mesma tela) na barra do encarregado (spec 121:
  `MENU_PADRAO`/`PADRAO`, migração 0057 põe nos menus já salvos com `incluir_na_barra`) e aba "Fotos da atividade" no
  `/encarregado` (`FotosAtividade`, rotas `/portal/frentes|registros|registros/opcoes|pq|fotos/{id}`; o líder vê e baixa só as
  dele; `campo/application/registros.py` é o caso de uso dos dois; logo do carimbo por `definirLogoCarimbo`). Marcar na foto
  (spec 122): lápis em cada foto ainda não enviada (`TirarFotos` e `FotosAtividade`) abre o Excalidraw (`MarcarFoto` →
  `MarcarFotoEditor`, carregado só ao tocar; foto travada no fundo, traço vermelho) e devolve a foto do mesmo tamanho marcada
  (o carimbo entra depois, no envio). Fontes em `public/excalidraw` (`scripts/copiar-excalidraw.mjs`, fora do git, SW guarda).
- Documentos controlados (`documentos/`, spec 123 · ISO 9001:2015 7.5): LDO (`documento`, código do cliente único por obra,
  importar planilha `POST /documentos/ldo`, Excel `GET /documentos/ldo.xlsx`), revisões pelo arquivo (`POST /documentos/revisoes`:
  DWG → DXF no conversor separado `apps/api/conversor/dwg2dxf.mjs` — GPL/LibreDWG, só no servidor, Node copiado na imagem da API —,
  DXF → carimbo/TAGs/folha PDF+PNG com ezdxf em `infra/desenho.py`; revisão existente não é sobrescrita). Vigente calculada
  (`domain/documento.py::vigente`: a mais nova que libera o uso — para construção/aprovado/liberado/como construído; letras antes de
  números; anterior = superada; cancelada na última = nenhuma). Ligações Zettelkasten (`documento_vinculo`: aplica_a/referencia/
  baseado_em/substitui → frente, WBS, grupo, documento; TAG do desenho sugere a frente, `sugerido` até confirmar), citado por, grafo
  (`GET /documentos/grafo`, `GrafoDocumentos`), GRD recebida/emitida com itens, ciência e Excel (`grd`, `grd_item`), leituras
  (`documento_leitura`: quem abriu qual revisão, web/campo/portal). Campo só vê a vigente ligada (confirmada) à frente, ao IWP/CWP ou
  ao grupo (`GET /documentos/campo?linha_id|area_id`): `/m/documentos`, seção no `DetalheAtividade`, aba Projetos no `/encarregado`
  (`/portal/documentos`). Arquivos no acervo (`zettel` pasta `05-documentos`, tipos `documento`/`documento-visual`). Tela
  `/app/documentos` (Pastas | LDO | Consolidado | GRDs | Conexões | Importar), `VerRevisao` (zoom, PDF, original).
  Take-off pelo projeto (spec 124, `documentos/domain/takeoff.py` + `infra/desenho.py::levantar` + `application/takeoff.py`):
  quadros montados pela posição dos textos (TABELA DE FERROS, RESUMO AÇO conferido pela NBR 7480 e pela soma da tabela, lista de
  materiais), anotações com unidade, camadas e blocos (unidade do desenho + `fator`); `takeoff_projeto` por revisão com memória,
  chave estável (Δ da revisão anterior, decisões herdadas, aceitar de novo), item da PQ sugerido (nunca vincula sozinho; unidade
  igual ou kg↔t, `fator_de_conversao`) e frente pela ligação do documento. Comparação projeto × planilha (TAG) × IWP e
  `POST /documentos/takeoff/iwp` (`wbs/infra/gateway.py::iwps_do_item|definir_quantidade_iwp`, origem na observação do IWP). Aba
  "Take-off do projeto" — desde a spec 127 tela própria `/app/takeoff` (`?doc=`), fora de Documentos (`TakeoffProjeto`); aba Conexões
  de Documentos só para o super admin.
  LDO do contrato (spec 128, `documentos/domain/ldo.py`): cabeçalho achado por nome em cada aba (pacote = aba), folha de rosto =
  a própria LDO (documento LIS com histórico e o .xlsx no acervo), TE em letra (`TIPO_EMISSAO`, E/G liberam), duas "Disciplina"
  (sigla/nome), Observações = CWA/local → `casar_local` (código confirma; TAG/nome da área sugere), revisão com `motivo`,
  `ldo_enviada_em`, `apresentado`, `apresentado_para`, `ldo`. Frentes pela planilha de CWAs (`frentes/domain/planilha_cwa.py`,
  `POST /frentes/planilha/previa` e `/frentes/planilha`): a aba da contratada filtrada pela coluna Empresa é a WBS de execução.
  Pastas e Consolidado (spec 129, `documentos/domain/pastas.py` + `application/pastas.py`, `documento_pasta`): pasta = regra
  (tipos/disciplinas/pacotes), não lugar — o documento aparece em toda pasta que cumpre, nada é movido; a obra recebe a cópia da
  pasta-modelo (10 Contrato e listas · 20 Projetos · 30 Especificações · 40 Procedimentos · 50 Normas · 60 Complementares),
  "Sem pasta" com sugestão, restaurar o modelo; `GET /documentos?pasta_id=` (0 = sem pasta). Arquivo baixado = `OBRA_CÓDIGO_Rrev_TE`
  (`nome_padrao`/`nomeArquivo`). Consolidado `GET /documentos/consolidado` (semana/mês; assinado = arquivo/ciência, pendente).
  Abas Pastas (padrão) · Lista · Consolidado · GRDs · Conexões · Importar (`PastasDocumentos`, `ConsolidadoDocumentos`).
  GRD no modelo do contrato (spec 130, `documentos/domain/grd.py`): atenção/emitente com área-cargo, referência, itens com folhas,
  status (letra do TE), finalidade da remessa 1–7, via (OR/CC/CO/CH/AD/OT), formato e vias; `POST /documentos/grds/importar` (GRD
  recebida em Excel → revisões registradas + planilha no acervo, `grd.arquivo_id`); `planilhas.grd_xlsx` no layout com legendas e
  assinaturas. Pastas com natureza (documento/registro), responsável, meio, local e retenção → `GET /documentos/plano-arquivamento.xlsx`.
  `VerRevisao carimbo`: vigente "CÓPIA CONTROLADA", superada/cancelada "DOCUMENTO OBSOLETO".
  Take-off a partir dos projetos (spec 131): `GET /documentos/takeoff/projetos` (situação lido/a_ler/sem_quantidade/sem_desenho/
  sem_arquivo por documento; `documento_revisao.takeoff_em|takeoff_qtd|takeoff_obs`) e `POST /documentos/takeoff/levantar` (lotes de
  25, `refazer`); a tela (`ProjetosTakeoff`) lê sozinha o que está a ler. PDF com camada de texto (`infra/pdf.py`, pdfminer.six) usa o
  mesmo leitor de quadros.
  Enviar e relacionar (spec 132, aba "Enviar e relacionar", `EnviarDocumentos`): arrastar vários arquivos por tipo (+ GRD);
  `domain/casamento.py::casar` acha o código da LDO no carimbo → nome → texto do PDF e a revisão (carimbo, `_R4`/`rev B`, única
  pendente na LDO) e `application/envio.py::enviar` (`POST /documentos/enviar`) registra sozinho; o que não casa vai a
  `documento_recebido` (acervo, motivo, sugestões) para associar à LDO, criar o documento ou relacionar a outros
  (`/documentos/recebidos/{rid}/associar|novo`, DELETE descarta). Nunca chuta código fora da LDO (só o do carimbo com revisão).
  Controle de projetos por ativo (spec 133, `domain/controle_ativo.py`, `application/controle_ativo.py`): planilha STATUS | Ativo |
  Projeto | Disciplina | OBS (grupos, mesclas, vários CWAs por célula, "Cancelado") → `controle_ativo`(+`_projeto`); TAG/CWA único
  confirmam a frente e ligam os projetos da LDO (aplica_a), nome só sugere, cancelado não liga, fora da LDO só listado (dica
  `_parecidos`); `GET /documentos/ativos/situacao` (pior status + vigentes/total com memória) alimenta `PilulaProjetos`
  (`useSituacaoProjetos`) na WBS e no plano (aviso + restrição de projeto). Conexões: "Projetos por ativo" | "Mapa das ligações".
  Explorador GED (spec 134, aba "Explorar pastas", `ExploradorDocumentos`): árvore (Todos · Recentes · pastas · Sem pasta) com
  subpastas pelos níveis da pasta (`documento_pasta.subpastas`: pacote/frente/disciplina/tipo/ano, `NIVEIS`, padrão projetos =
  pacote → frente → disciplina), trilha, busca global, lista, "Enviar aqui"/arrastar (spec 132) e prévia da revisão vigente com
  carimbo, tela cheia, PDF, baixar, ficha e link. `/documentos/pastas` traz `membros`/`sem_pasta_ids`; documento traz `frentes`.
  Enviar/atualizar arquivo (spec 135, `ArquivoDoDocumento` na prévia, `POST /documentos/{id}/arquivo` → `atualizar_arquivo`): sem
  arquivo = "Enviar arquivo da rev. X" (a da LDO) + "Copiar código"; com arquivo = nova revisão (`proxima_revisao`) ou corrigir a
  mesma com motivo (anterior em `documento_arquivo_anterior`, no histórico e em `_em_uso`); nó "Sem arquivo (a receber)" (`temArquivo`).
- Book de fotos (`/app/fotos`, `GET /fotos/book`, `campo/application/book.py`): atividades/ocorrências/restrições por frente,
  atividade ou data, impressão com logos. Spec 062. Inclui auditorias (antes/depois) e evidências das ações 5W2H (`tipo=auditoria|acao`). Spec 070.
- Apropriação de presença (`presenca/`): `identificacao_pessoa` (código, NFC, descritor facial com consentimento — só o
  descritor, nunca a foto) e `presenca_leitura` (`id_local` idempotente); `/presenca/base|leituras|dia|identificacoes`;
  capacidade com os presentes (`capacidade_com_presentes`). Celular `/m/presenca` (botão central), offline em IndexedDB
  (`src/lib/presenca/`), service worker `public/sw.js` (campo rede-primeiro, estáticos e `/models/face` em cache), sessão e
  obras lembradas no aparelho. Web: `/app/presenca` e `/app/efetivo/identificacao`. Modelos copiados do npm no build
  (`scripts/copiar-modelos-face.mjs`, fora do git). Câmera/NFC/SW exigem HTTPS. Spec 063. Crachá não cadastrado → cadastro rápido
  (`CadastroRapido`): vincular à pessoa do efetivo (`/presenca/vincular`, fila offline) ou cadastro simplificado nome + função
  do de-para (`/presenca/pessoa-simplificada`, `colaborador.cadastro_pendente`) com alerta `CadastrosPendentes`. Spec 065. Matrícula
  que já é do efetivo junta os cadastros (`unificar`, todas as FKs de `colaborador` + identificação) após confirmar; rosto que não
  bate abre `CadastroRosto` (vincular com `face`+consentimento, offline) e `rostoLiberado` aceita termo pendente. Spec 103. Com o cartão aberto o
  `LeitorFacial` fica `pausado` (não lê e congela o vídeo; miniatura do rosto só em memória). Spec 106. iPhone (sem Web NFC):
  link `/m/presenca?c=&m=` gravado no crachá (`gravarCracha`, Android) ou em etiqueta QR (`CrachasLink.tsx`), QR/código pela
  câmera com ZXing quando não há `BarcodeDetector` (`leitores.ts`, `codigoLido`). Spec 067. Duplicidade entre celulares: vale a
  leitura mais cedo (`presenca_leitura.valida`, `validas`), `GET /presenca/hoje` avisa "já registrado por outro celular". Spec 069.
  Presença do dia em abas Equipes (agrupadas por setor, cartões compactos; atividades só com `?atividades=true`) | Indicadores
  (`GET /presenca/indicadores`, `presenca/domain/indicadores.py`, `PresencaIndicadores.tsx`: taxa, absenteísmo, chegada, meio). Spec 071.
- Auditorias por modelo (`auditorias/`: `auditoria_modelo` com tipos/registros/campos, Segurança padrão; `auditoria_registro`
  com VER E AGIR — SIM pede foto do depois, NÃO abre ação 5W2H; texto do WhatsApp `texto_envio`) e plano de ação 5W2H
  (`acoes/`: `acao_5w2h`, eventos andamento/concluir com evidência/verificar eficácia/cancelar, `candidatas` e `de-origem`
  de ocorrências e restrições). Web `/app/auditorias`, `/app/auditorias/modelos`, `/app/acoes`; celular `/m/auditorias`,
  `/m/acoes` (`components/Auditoria/`, `src/lib/auditorias`). Spec 064.
  Exclusão com autoridade (`exclusoes/`, spec 112): auditoria feita e foto do book saem só pelo super admin ou por quem ele
  habilitar (`exclusao_permissao`), com motivo; histórico `exclusao_registro` (cópia dos dados, quem, quando, por quê; também
  habilitar/desabilitar e as exclusões comuns). Ação 5W2H da auditoria fica ("auditoria excluída"). Tela `/app/exclusoes`,
  `ExcluirComMotivo`, `usePodeExcluir`.
  Offline (spec 072): fila genérica no aparelho (`src/lib/offline/{db,fila}.ts`, `SincronizarFila`, `registrarEnvio`) — grava tudo
  antes de enviar; `POST /auditorias/registros/completo` (tudo ou nada, `id_local` idempotente); listas com `comCopia`; SW `aquecer`.
- Controle preventivo — etilômetro (`preventivos/`, spec 073): faixas configuráveis (`domain/etilometro.py`), aparelhos com
  calibração, evento (fotos aparelho/calibração, responsável assina com crachá no início e no fim) e testes assinados pelo
  colaborador (rosto/crachá/tela, `components/Preventivos/Assinar.tsx`), contraprova com cronômetro; tudo offline pela fila
  (tipo `etilometro`). Celular `/m/preventivos/etilometro` (aparelho também é cadastrado ali — spec 086), web `/app/preventivos`. Leitores em `components/Mobile/Leitores.tsx`.
- LGPD (`lgpd/`, spec 074): termo versionado por obra (`lgpd_termo`, `domain/termo.py`: finalidades biometria/foto_assinatura/
  localizacao, SIM/NÃO cada), aceite/recusa colhido no celular (`/m/lgpd`, `ColetaTermo`, fila `lgpd`; base do celular traz `lgpd`
  por pessoa), revogação apaga o rosto. Evidência de cada assinatura (`assinatura_evidencia`, fila `evidencia`, `guardarEvidencia`):
  foto do rosto só com aceite, coordenadas só com aceite, hash SHA-256 conferido. Relatório com logos e mapa em `/app/lgpd`;
  cada foto aberta/relatório gerado vai para `assinatura_acesso`.
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
  ← TASKRSRC, copiados em `plano_item.recursos`); `/planos/tirar-concluidas`. Spec 044. Janela do item até 1100 dias
  (`MAX_DIAS_JANELA`; atividades longas do P6) e puxar recusa só a que não passa (`recusadas`). Spec 109.
  Plano no padrão da programação (Local → Área → CWP → atividades, cores S27) e "Inserir pela WBS" em árvore com caixas
  (inclusive fora do cronograma). Spec 081.
  6WLA em Excel no layout da obra (aba 6 semanas, `Exportar6wla`): cronograma vigente + plano nas 7 semanas, WBS do P6, linha de
  base escolhida, 6M = restrições pendentes; `planos/domain/seis_semanas.py` + `application/seis_semanas.py`
  (`GET /planos/seis-semanas.xlsx`, fórmulas na aba "Dados - Semanas"). Dia da obra = `app/shared/tempo.py::hoje_local()`
  (servidor em UTC). Spec 108. Cor de formatação condicional vai no `bgColor` (`_cf`) e linhas agrupadas pela WBS (+/−). Spec 110.
- Critério de avanço (`criterios/`, spec 079): planilha "Critério de medição" (código CMS + item da PQ → etapas com % do valor),
  etapa **sem avanço** = só esforço. WBS ganha o nível Etapa abaixo do IWP (`wbs_no.etapa_id/percentual/sem_avanco`, código
  `…-E1`, botão "critério" = `aplicar-criterio`); IWP com etapas vai à programação/plano como as etapas
  (`programacao_linha.etapa_*`): `pu` = PU × %, sem avanço = 0 (não fatura nem soma quantidade; HH/capacidade continuam).
- Associar cronograma ↔ WBS (spec 080): `GET /wbs/associacao` com sugestões, `PUT /wbs/nos/{id}/atividade` (leva o ID às
  programações em rascunho) e na linha da programação (`PUT …/linhas/{lid}/atividade`, `AssociarAtividadeLinha`). Desde a
  spec 084 é feito na própria WBS (botão "Associar cronograma", `CelulaCronograma`; `/app/wbs/associacao` só redireciona).
- Critério pela PQ (spec 083): vínculo item da PQ → critério por `resolver_criterio` (vínculo na linha `criterio_item_pq` →
  código CMS da PQ → critério manual do item → grupo do CMS; a numeração da planilha de critérios é do catálogo, não da PQ);
  sugestão pela descrição nunca vincula sozinha. Tela "Pela PQ" (`GET /criterios/pq`, `PUT /criterios/pq/{item}/vinculo`).
- Ciclo do plano (spec 084): WBS → "Enviar ao plano 90 dias" (`/planos/itens/da-wbs`); plano puxa da programação corrente
  (`/planos/programacao/previa`, `/planos/itens/da-programacao`, liga `programacao_linha.plano_item_id`); restrições abrem
  abaixo da atividade; look-ahead `?origem=plano` (`dias_do_plano`).
- Início do celular só com o que fazer e atalhos (sem lista de atividades). Spec 078.
- Aderência semanal (spec 104, `aderencia/`): financeiro = qtd × PU por responsável da linha; painel da semana N (anteriores,
  ranking, semana anterior, meta + marcos) em `domain/aderencia.py`; semanas sem programação emitida vêm do histórico
  (`aderencia_historico`, lido da apresentação anterior por `ler_historico`); modelo .pptx da obra/contratada
  (`apresentacao_modelo`, herdado pela `nome_contratada`) e `application/apresentacao.py` (python-pptx: mantém capa,
  divisória, encerramento e mestre; redesenha as folhas). Tela `/app/aderencia`. `ResumoProgramacao` com coluna R$.
- Resumo do dia — check out (spec 101): `GET /campo/resumo-dia` (`campo/application/resumo_dia.py`: atividades com realizado/
  foto no dia, ocorrências, restrições, auditorias, equipes × atividades, fotos — tudo Local → Área → CWP) e texto do WhatsApp
  por parte em `campo/domain/resumo_dia.py` (`textos`, `juntar`). Tela `/app/resumo-dia` e `/m/resumo` (`ResumoDia.tsx`):
  escolher partes, editar, copiar, wa.me e compartilhar com fotos no celular (`lib/resumo/whatsapp.ts`). Equipes impactadas
  pelas ocorrências (equipe da linha do desvio + presença do dia, `impactadas`) logo abaixo das ocorrências. Spec 102.
- Ficha do colaborador (spec 087): `GET/POST/PUT/DELETE /efetivo/colaboradores` (campos operacionais — nada de CPF, RG,
  telefone, endereço, nascimento ou saúde; `Ficha`, `chave_cadastro`); excluir só sem prova (presença, LGPD, assinatura,
  etilômetro). `FichaColaborador.tsx` (abas Dados | Contrato | ASO e treinamentos | Mobilização | Histórico).
  Mobilização (`mobilizacao/`): funil Solicitação → … → Crachá (`domain/pipeline.py`, ASO apto e treinamentos travam),
  passagens por etapa, metas por faixa, métricas do esforço com memória (`domain/metricas.py`); a situação do colaborador
  acompanha o processo. Tela `/app/efetivo/mobilizacao`.
- ASOs e treinamentos (`treinamentos/`, spec 088): catálogo (validade, impeditivo, todos), exigência por função, ASO (só
  resultado e datas), turmas, matriz e indicadores; `AptidaoGateway` publica a aptidão. Abas em `/app/ssma/cadastros`
  (`components/Treinamentos/`).
- Spec 089: função de contratação criada na obra (`depara_funcao.criada_na_obra`, `POST /efetivo/funcoes/nova`, lista
  `GET /efetivo/funcoes/lista` = `funcoes_de_contratacao`; vaga/processo exigem função da lista — `funcao_padronizada`;
  front `SeletorFuncao`). Vagas (`mobilizacao_vaga`, `domain/vaga.py`: RQ-0001, saldo, situação derivada) abertas pelo
  Planejamento, avisam a gestão e alimentam o processo (`vaga_id`; a Solicitação conta desde a abertura). Configurações:
  treinamento previsto em contrato por função (`mobilizacao_treinamento_previsto`, dias vira a meta de Treinamentos;
  horas × carga horária registrada, `cargas_registradas`). Abas Vagas | Processos | Métricas | Configurações.
- Menu pelo ciclo da obra (spec 125): grupos Projeto e escopo · Planejar · Executar · Medir e melhorar · Pessoas e equipes ·
  Segurança (SSMA) · Configurar (recolhido, sempre no fim; `GrupoMenu.recolhido`), no máximo 6 telas por grupo (teste
  `test_modulos_obra.py`); a ordem de `TELAS_WEB` segue os grupos. Busca de telas Ctrl+K (`BuscaTelas`, `buscarTelas`,
  `ItemMenu.palavras`). Menu em sanfona (spec 131, `GrupoLateral`): um grupo aberto por vez (o da tela atual), sem barra de rolagem. Módulos contratados por obra (`obras/domain/modulos.py`:
  documentos, plano, auditorias, ssma, presenca, mobilizacao, aderencia; `obra.modulos_desligados`, super admin em Obras e
  usuários, `GET /admin/modulos`): `MinhaObra.telas_desligadas` some do computador e do celular (`podeVer`/`podeVerMobile`) e do
  editor de menus; os dados ficam. Não é trava da API — é contrato.
- Menu do computador por perfil (spec 090): `menu_web_perfil` (admin da obra) → `PADRAO_WEB` (`perfil/domain/menu_web.py`,
  `TELAS_WEB` = url → exigência do papel); fora do menu do perfil a tela não aparece e o endereço volta à vigente
  (`useObra().menuWeb` em `podeVer`). Barra lateral nos grupos da spec 125, ordenada pelo perfil (`menuDoPerfil`). Tela nova no menu = url em `menu.ts` **e**
  em `TELAS_WEB` (teste confere). Editor: Configurar › Menus por perfil (aba Computador, `MenuComputador.tsx`).
- Publicação nas lojas (spec 091): `docs/play-store.md`. Workflow *App nativo* gera o .aab (assinado com os secrets
  `ANDROID_KEYSTORE_*`, versão = execução do workflow) e envia à Play no disparo manual (`PLAY_SERVICE_ACCOUNT_JSON`).
  Ícones/splash em `apps/mobile/assets` e `apps/mobile/loja`; `allowBackup=false`; app nativo sem cadastro aberto
  (`emAppNativo` esconde "Criar conta"). Política pública `/[locale]/privacidade` (contato = `NEXT_PUBLIC_CONTATO_PRIVACIDADE`,
  variável `CONTATO_PRIVACIDADE` do repositório) — ao coletar dado novo, atualize a política e a Data safety.
- Dados da empresa não saem (spec 126): ato 6 "A guarda" na home (`Guarda`, `#guarda`, "O que é da obra fica com a obra"),
  só com o que o sistema já faz; política de privacidade diz que nada vai a IA de terceiros. **IA no Malhet só local** (servidor do
  Malhet ou da empresa) — nunca API externa (Claude, OpenAI…). Frase nova na home precisa de lastro no sistema. A home segue o
  Planejamento 360 (curso do autor, spec 127): "O ciclo inteiro, numa memória só" — Contrato · Escopo · Prazo · Campo · Medição ·
  Governança; nada de "apps" (VisualPlan, PlanningControl, ADC Digital) nem promessa sem lastro ("custo baixo").
- Página principal pública `/` (spec 092, `components/Marca/Landing.tsx`): a história da marca em sete atos — o 6º é "A guarda", spec 126 — (fonte: doc
  "Malhet — a história da marca"; voz direta, sem número não confirmado, IA nunca como manchete). Pedra bruta → pedra
  cúbica em canvas 3D que gira e segue o mouse (`components/Marca/PedraCubica.tsx`); leitura guiada pela rolagem (frases
  que acendem, linha em foco, cena presa — spec 094). Tela em pé ou < 900 px (`empilhado()`) = cubo centralizado acima do texto e cena
  sem prender; seções `py-16 sm:py-24` (spec 096). Login/cadastro na mesma linguagem com "Na obra agora" (`Malhet/TelaAuth.tsx`).
- Dentro do app a empresa é a contratada (spec 093): topo do menu = logo/nome da contratada (`MarcaContratada` no
  `Shell.tsx`, Marca da obra), trilha "Contratada / tela", Malhet só como "com Malhet" no pé. Nada do kit no título/ícone
  (`config/app.ts`, `src/app/favicon.ico`, `public/brand/favicon.svg`).
- Tutorial do primeiro acesso (spec 097): `components/Tutorial/{Tour,Tutoriais}.tsx`, alvos por `data-tour`; abre sozinho
  uma vez por conta (computador no `Shell`, celular no `MobileShell`), conteúdo pelo papel; `perfil_usuario.tutoriais` +
  `perfil/domain/tutorial.py::TUTORIAIS` (subir a versão = todos veem de novo); rever em menu da conta/Mais (`abrirTutorial`).
- Relato automático de erros (spec 098, `erros/`): 5xx da API, tela quebrada (`error.tsx`), erro de script e relato manual
  → `lib/erros/relatar.ts` (fila no aparelho, código E-XXXXXX, "contar o que fazia"); exceção não tratada da API vira relato
  (500 com `erro_id`/`erro_ref`). Dado pessoal mascarado em `erros/domain/relato.py::limpar`. Super admin: `/app/admin/erros`
  (grupos, resolver/voltou). Erro novo em tela nova não precisa de nada: já é capturado. 502/503 por até 90 s = deploy: nem relato
  nem aviso (`apiRespondeu`; servidor descarta `Relato.transitorio`); depois, um único "API indisponível". Spec 106. Chunk do build
  antigo ("Loading chunk failed") recarrega a página uma vez em vez de relatar (`lib/erros/versaoNova.ts`). Spec 109. Aba de build
  antigo recarrega sem relatar (`tratarVersaoVelha`) e toda página confere a versão ao voltar para a aba. Spec 113.
- Escala na KVM1 (spec 082): rota/dependência que usa a Session é `def`, nunca `async def` (async + Session congela a API
  com o pool cheio; `tests/test_escala.py` varre as rotas). Upload em rota síncrona lê `arquivo.file.read()`. Pool por
  `DB_POOL_*`; gzip na API; tempo real confere a cada 15 s. Leitura cara = `app/shared/cache_leitura.py` (chave com a
  marca de mudanças da obra; só em rotas de leitura). Arquivos = módulo `arquivos/` (disco + Google Drive/OneDrive/Dropbox
  por obra, acervo Zettelkasten `Malhet/obras/<obra>/NN-pasta/AAAAMMDDhhmm-TIPO-curto.ext` + `.md`): arquivo novo entra por
  `arquivos.application.servico.guardar` (nunca LargeBinary novo); quem usa registra migrador/em-uso em `registro.py`;
  sensível (rosto, evidência LGPD, coordenadas) não vai à nuvem. Tela `/app/armazenamento`.
- Spec 085: imagens montadas no GitHub Actions (ghcr.io, `docker-compose.coolify.imagens.yml`, `coolify.py usar-imagens`);
  plano: Levar à programação por semana (corrente) e grade recolhível Local/Área/CWP; look-ahead impresso A0–A3
  (`ExportarQuadro` + `gerarFolha`); book com miniaturas P/M/G. App nativo em `apps/mobile` (Capacitor, plugin `NfcCracha`
  Swift/Java; web usa por `emAppNativo`/`temNfcNativo` em `lib/presenca/leitores.ts`; `docs/app-nativo.md`).
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
  aberta). Cabeçalhos sem descrição (espaço). Acessos e usuários unificados em `/app/acessos`. Spec 033. Celular por pessoa: `acesso_obra.paginas_mobile`,
  `podeVerMobile`, telas em `src/components/Mobile/menu.ts` (`MENU_MOBILE`; Início e Programação sempre). Spec 066. Liberar acesso de
  conta existente com senha = redefine (`redefinir_senha`; admin da obra só de quem está só nas obras dele). Spec 068.
  Barra do celular (`BarraCampo`): 4 atalhos + destaque + Mais; vale o ajuste da pessoa (`menu_mobile_pessoal`) → o padrão do
  perfil na obra (`menu_mobile_perfil`, `/app/menu-celular`) → `MENU_PADRAO`. Perfil da conta (`perfil_usuario`, sem obra_id:
  é da conta) com avatar em `/m/perfil` e `/app/perfil` (`FormPerfil`, `MeuMenu`, `EditorMenu`, `Avatar`). Spec 075. Notificações
  (`notificacoes/`, `notificar(...)` por papéis/pessoas, autor não recebe; sino `Sino`, `/app|m/notificacoes`). Spec 076. Super
  admin vê tudo e "Testar como perfil" (`useObra().simular`, só a tela muda). Spec 077.
  `useApi()` já manda o `X-Obra-Id`; trocar de obra remonta as telas. Esconda ações que o papel não permite.
- **Memória de cálculo**: todo número calculado na tela usa `<Calculado>` (`components/Obra/Calculado.tsx`) e abre a
  conta + fontes (origem e linha/campo). Backend: `app/shared/memoria.py` (`Memoria`, `Fonte`, `pacote`); CPU com linha do
  arquivo (`cpu_linha`, `cpu_obra.rastrear`, `referencias/application/memoria_cpu.py`). Número novo sem memória = bug. Spec 022.
- Carregamento = esqueleto, nunca texto: `components/Obra/Esqueleto.tsx` (`Carregando`, `LinhasCarregando`, `Esqueleto`),
  `Tabela vazio={CARREGANDO}`, `loading.tsx` nas rotas (spec 085).
- Exclusão/remoção sempre pede confirmação com `useConfirmar()` (`components/Obra/Confirmar.tsx`); nunca
  `window.confirm`. Vários valores de lista: `components/Obra/MultiSelecao.tsx`.
- Sessão: `useSessao()` (`src/lib/auth/AuthProvider.tsx`). Código antigo do kit usa o shim `src/lib/auth/compat.ts`.
- API só via `useApi()` + TanStack Query (`queries.ts`), sempre por `/backend/api` (rewrite do Next). Tipos em
  `src/lib/api/types.ts`.
- Tempo real: `useApi` recarrega as consultas abertas depois de cada post/put/del; `SincronizarDados`
  (`src/lib/tempo-real`) confere `GET /api/mudancas` (middleware `app/core/mudancas.py`) a cada 15 s (spec 082) e recarrega quando
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
