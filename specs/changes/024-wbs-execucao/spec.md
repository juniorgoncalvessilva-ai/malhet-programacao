# Spec 024 — WBS de execução (etapa 1): Área → CWP → Grupo → IWP

## Objetivo
Criar na programação atividades que o cronograma não tem ou não detalha. Estrutura própria da obra (o cronograma
segue como referência; a exportação para o P6 vem depois):

| Nível | O que é | De onde vem |
|---|---|---|
| Área | CWA (004.05 …) | Frentes |
| CWP | elemento + texto complementar ("Radier" · "Eixo A–B") | digitado |
| Grupo | Concreto, Forma, Aço… | Catálogo |
| IWP | item da PQ do grupo; quantidade digitada ou take-off (item × TAG da área) | PQ |

Etapas por critério de medição (% por etapa) ficam para a etapa 2.

## Modelo
`wbs_no` (módulo `wbs`): `obra_id`, `pai_id` (RESTRICT), `tipo` (area|cwp|grupo|iwp), `seq`, `area_id`, `elemento`,
`complemento`, `grupo_id`, `tipo_atividade_id`, `item_pq`, `quantidade`, `id_crono` (âncora futura), `observacao`,
`ativo`. `programacao_linha.wbs_no_id` (SET NULL). Migração `0017_wbs`.

## Regras (`wbs/domain/wbs.py`)
- Hierarquia fixa (área sem pai; CWP sob área; grupo sob CWP; IWP sob grupo). Repetidos no mesmo pai: 422.
- IWP só com item da PQ vinculado àquele grupo no Catálogo (o ID Simova continua g.t / g.t.n).
- Código: `CWA-CWP-grupo-IWP` (`004.05-01-1-01`); caminho legível para a tela.
- Excluir só nó sem filhos e sem programação (IWP em programação: inativar).
- Linha da programação com `wbs_no_id`: área, tipo, item da PQ, quantidade (se digitada no IWP) e texto complementar
  (= CWP, "Radier - Eixo A–B") vêm do IWP (`wbs/infra/gateway.iwp_para_linha`). Copiar programação leva o vínculo.

## API
`GET /wbs` (árvore com código, caminho, quantidade efetiva e origem, uso em programação), `POST /wbs/nos`,
`PUT /wbs/nos/{id}` (texto do CWP, quantidade do IWP, observação, ativo), `DELETE /wbs/nos/{id}`.

## Tela
"WBS de execução" (menu Programar): árvore com + CWP / + Grupo / + IWP, editar, excluir com confirmação, quantidade com
memória de cálculo (digitada × take-off). Programação › Nova linha: "Da WBS de execução (IWP)" preenche e trava área,
grupo e atividade; a linha mostra o selo "WBS 004.05-01-1-01".

## Etapa 1b — WBS do cronograma (P6) entra na WBS de execução
- A cada importação do .xer (e no botão "Atualizar pela WBS do cronograma", `POST /wbs/sincronizar-cronograma`):
  - **Área** = nível "CWA 004.05 - …" do caminho (o mais fundo), casado com a área das Frentes pelo CWA (CWA repetido:
    pela área cujo Ativo aparece no nome do nível).
  - **CWP** = níveis do P6 abaixo do CWA: o 1º é o elemento, os demais o complemento ("Sapatas" · "Fustes"); sem
    nível abaixo, "Geral". Âncora `chave_p6` (caminho normalizado); CWP manual com o mesmo texto é adotado.
  - **IWP** = atividade cuja descrição é a de um item folha da PQ (normalizada; repetida: desempate pela área da TAG,
    `escolher_item` do take-off), com o item em um grupo do Catálogo; âncora = código da atividade (`id_crono`).
  - Só ramos de construção (nível "CWP…"); EWP/PWP ficam de fora.
- Preservação: nada é apagado. Nó do P6 que sumiu da revisão vigente fica `fora_cronograma` (volta ao normal se a
  atividade voltar); IWP que mudou de lugar no P6 acompanha; nós manuais não são tocados. `origem` = manual | p6.
- Linha da programação a partir de IWP do P6 já recebe o `id_crono` da atividade. Migração `0018_wbs_p6`.
- Resultado informa: novos/atualizados/fora do cronograma, atividades fora do ramo de construção, sem item da PQ,
  com item sem grupo no Catálogo (vincular e atualizar de novo) e CWA sem área nas Frentes.

## Etapa 1c — Enviar da WBS para a programação
- WBS de execução: caixa de seleção em cada nó; marcar área/CWP/grupo leva todos os IWPs ativos abaixo.
  "Enviar para" (programações em rascunho) → painel com equipe, natureza e previsto no período por IWP.
- `POST /programacoes/{id}/linhas/da-wbs {nos, equipe_id, natureza, qtd_periodo{iwp: q}}` (programar, só rascunho):
  cada IWP vira linha (mesma regra de `wbs_no_id`); IWP que já está na programação não duplica; informa
  `criadas`, `ja_estavam` e `nos_sem_iwp`.
