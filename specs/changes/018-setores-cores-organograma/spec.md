# Spec 018 — Setores da obra, responsáveis do efetivo e cores do organograma

## Objetivo
Cadastrar os setores da obra, cada um com um responsável escolhido no efetivo, e o responsável geral da obra.
O organograma passa a ser **Obra (responsável geral) → Setor (responsável) → Equipe (encarregado) → Função**: a linha
"supervisor/responsável" deixa de existir. Níveis e setores podem ser coloridos.

## Modelo
- `setor_obra` (efetivo): `obra_id`, `nome` (único na obra), `cor` (#RRGGBB), `ordem`, `responsavel_id` → colaborador.
- `organograma_config` (efetivo, um por obra): `responsavel_id` (responsável geral) e `cores` JSONB por nível
  (`obra`, `setor`, `equipe`, `funcao`; padrão em `CORES_PADRAO`).
- `equipe.setor_id` → `setor_obra` (SET NULL ao excluir o setor). Migração `0011_setores_organograma`.

## Regras
- Com setores cadastrados, o setor da equipe é o `setor_id` (sem setor → ramo "Sem setor"); sem nenhum setor, vale a
  frente ou o DP do encarregado, como antes. Setores cadastrados aparecem mesmo sem equipe, na ordem escolhida.
- Responsável geral e responsáveis de setor aparecem na caixa (`responsavel`), não nos ramos "Sem equipe"/"Em
  mobilização".
- Cor: setor com cor própria colore o setor e herda para as equipes e funções dele; sem cor, vale a cor do nível.
  Cores validadas (`validar_cor`/`validar_cores`).

## API
`GET/POST /efetivo/setores`, `PUT/DELETE /efetivo/setores/{id}` (equipes do setor no corpo),
`PUT /efetivo/organograma/config` (responsável geral + cores). `GET /efetivo/organograma` devolve `cores`.
`EquipeIn.setor_id`.

## Tela
- `/app/efetivo/setores`: responsável geral (`SeletorPessoa`, busca no efetivo), cores dos níveis (`SeletorCor`),
  setores em cartões coloridos, formulário com responsável, cor, ordem e equipes.
- Organograma: caixas de tamanho único (14rem × 6,75rem), faixa e rótulo na cor do nível/setor, título em até 2
  linhas, responsável/encarregado em até 2 linhas, texto completo na dica; legenda de cores; níveis Setores, Equipes
  (padrão), Funções.
- Equipes: campo "Setor da obra" no formulário e o setor (com a cor) na lista.
