# Spec 019 — Subsetores / disciplinas e responsáveis fora das listas de funções

## Objetivo
Organizar as equipes de um setor em disciplinas (subsetores: Formas, Armação, Concreto…). Organograma:
**Obra → Setor → Disciplina → Equipe → Função**. Equipe sem disciplina fica direto no setor.

## Modelo
- `subsetor_obra` (efetivo): `obra_id`, `setor_id` (CASCADE), `nome` (único no setor), `cor` (sem cor herda a do
  setor), `ordem`, `responsavel_id` → colaborador. `equipe.subsetor_id` (SET NULL). Migração `0012_subsetores`.
- Cor de nível `disciplina` em `CORES_PADRAO`/`organograma_config.cores`.

## Regras
- A disciplina define o setor da equipe (`_setor_e_disciplina` no cadastro de equipes; gateway
  `setor_da_disciplina`). Tirar a equipe do setor também a tira da disciplina; trocar de setor descarta disciplina
  de outro setor. Excluir disciplina mantém as equipes no setor; excluir setor exclui as disciplinas dele.
- Responsáveis (geral, setor, disciplina) aparecem só na própria caixa: não entram nas listas de funções nem na
  contagem, mesmo quando são encarregados ou membros de equipe (a equipe continua mostrando "Enc.: …").

## API
`POST /efetivo/setores/{id}/disciplinas`, `PUT/DELETE /efetivo/disciplinas/{id}` (corpo igual ao do setor, com
`equipes`). `GET /efetivo/setores` traz `disciplinas` por setor e `subsetor_id` nas equipes. `EquipeIn.subsetor_id`.

## Tela
- Setores da obra: disciplinas dentro do cartão do setor (cor, responsável, equipes), "+ Disciplina", editar/excluir
  com confirmação; cor do nível Disciplinas.
- Organograma: nível Disciplinas (Setores, Disciplinas, Equipes [padrão], Funções); legenda com Disciplina.
- Equipes: campo Disciplina (filtrado pelo setor) e "Setor / Disciplina" na lista.
