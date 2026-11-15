# Spec 087 — Ficha do colaborador (CRUD) e controle da mobilização

## Pedido
"Em Efetivo e mobilização busque no Planning Control a ficha do colaborador e crie o CRUD para editar, criar e deletar
funcionário. Traga também a página para controle de mobilização do colaborador: queremos ter dados e controle do avanço
do funcionário em mobilização, queremos metrificar o esforço de cada aquisição."

## Ficha do colaborador (`efetivo`)
- Origem: `EmployeeEditModal` do Planning Control (dados, profissional, documentos, horários, observações).
- **Só dados operacionais** (regra do CLAUDE.md: efetivo sem dados pessoais sensíveis). Entram em `colaborador`:
  apelido, e-mail corporativo, centro de custo, tipo de contrato, turno, horas/dia, alojamento, folga de campo, fim da
  experiência, brigadista, periculosidade, insalubridade, CNH (categoria/validade), observações.
  **Não entram**: CPF, RG, PIS, endereço, telefone, nascimento, filiação, raça/cor, tipo sanguíneo, título, reservista
  (o teste do efetivo garante que `telefone`, `cpf`, `endereco`… não existem no modelo).
- `GET/POST/PUT/DELETE /efetivo/colaboradores[/{id}]` (`planejar` para escrever). Validação no domínio (`Ficha`):
  nome, e-mail, horas 1–24, categoria da CNH, tipo de contrato, demissão ≥ admissão.
- Chave pela mesma regra da planilha (`chave_cadastro`): próprio = matrícula; terceiro = EMPRESA:matrícula; sem
  matrícula = provisória pelo nome (a planilha do DP completa depois). Matrícula/crachá repetidos → 422.
- Editar registra movimento de situação/função; crachá novo vai para as equipes (membro e encarregado).
- Excluir: só cadastro por engano. Com leituras de presença, termo LGPD, assinaturas ou testes de etilômetro → 422
  ("desmobilize"); encarregado de equipe → 422; membro sai da equipe.
- Tela: nome clicável na lista do Efetivo abre a ficha (janela com abas Dados | Contrato e jornada | ASO e treinamentos |
  Mobilização | Histórico); "Novo colaborador" no cabeçalho; excluir com `useConfirmar`.

## Mobilização (`mobilizacao/`)
- Origem: `lib/mobilization/pipeline.ts` do Planning Control. Etapas: Solicitação → Seleção → Exames → ASO →
  Contratação ⇄ Treinamento → Documentação ao cliente → Aprovação → Crachá (`domain/pipeline.py`, `Processo` imutável).
- Regras: só conclui a etapa aberta; `treinamento_antes` inverte Contratação/Treinamento; **ASO só com ASO apto e
  válido** (spec 088); Documentação ao cliente exige Contratação concluída e treinamentos exigidos em dia (função sem
  exigência → confirmar a matriz); Crachá aberto = AGUARDANDO_CRACHA; Crachá concluído = MOBILIZADO; desistência fecha
  a etapa aberta; "voltar" desfaz a última conclusão; conclusão até 1 min antes da entrada vale como a entrada.
- Tabelas (todas com `obra_id`): `mobilizacao_processo`, `mobilizacao_passagem` (etapa, entrou/saiu, quem, observação),
  `mobilizacao_meta` (dias por faixa: Seleção, Admissão/ASO, Contratação, Treinamentos, Documentação, Aprovação, Crachá).
- Integração com o efetivo: pessoa nova entra como "Em processo" (chave provisória); Contratação grava matrícula/admissão;
  Crachá grava o crachá; a situação do colaborador acompanha o processo (Em processo → Aguardando crachá → Mobilizado;
  Desistência). Cada mudança vira movimento do efetivo.
- Métricas (`domain/metricas.py`, com memória em cada número): em andamento, lead time (solicitação → crachá, média e
  mediana), % dentro das metas, fora da meta agora, desistências (taxa), esforço por etapa (média de dias e participação
  no total = onde vai o esforço), funil (quantos chegaram a cada etapa), faixas × meta, por função (lead time, gargalo).
- API: `/mobilizacao/etapas|processos|processos/{id}/concluir|desistir|voltar|metas|metricas`.
- Tela `/app/efetivo/mobilizacao` (menu "Mobilização"): Processos (quantos em cada etapa, filtros, trilho das 9 etapas com
  dias, concluir com matrícula/crachá, registrar ASO na hora, desistência, voltar, excluir), Métricas do esforço, Metas.

## Testes
`tests/test_mobilizacao.py` (domínio do funil, métricas, CRUD da ficha, ponta a ponta com ASO/treinamento) e e2e no navegador.
