# Spec 044 — Plano de 90 dias puxado de um período do cronograma, com recursos do P6

## Pedido
Puxar o plano de 90 dias de um período específico do cronograma, com opção de excluir as atividades concluídas, e
trazer os recursos alocados na atividade.

## Entrega
- Importação do .xer guarda os recursos de cada atividade (TASKRSRC + RSRC + UMEASURE) em
  `atividade_cronograma.recursos` (código, nome, tipo mão de obra/equipamento/material, orçado, restante, unidade;
  horas para mão de obra e equipamento). Versões antigas: reimportar o .xer. Migração `0030`.
- `POST /planos/cronograma/previa` e `POST /planos/itens/do-cronograma`: atividades do cronograma vigente que cruzam
  o período (De/Até), opção "Excluir concluídas" (padrão), "Só construção (CWP)" (padrão), filtro por texto e
  escolha das atividades. Área pelo CWA, IWP quando a WBS tem o Activity ID, recursos copiados para
  `plano_item.recursos`. Atividade já no plano (mesmo Activity ID) é atualizada (datas e recursos), sem duplicar.
- `POST /planos/tirar-concluidas`: exclui do plano o que está concluído no cronograma vigente (fica quem já está em
  programação ou tem restrição pendente no 6WLA).
- Web: botões "Puxar do cronograma" (período + prévia com seleção) e "Excluir concluídas"; detalhe do item com a
  tabela de recursos do P6 e o status da atividade no cronograma.

## Teste
`tests/test_plano_90.py::test_puxar_do_cronograma_por_periodo_com_recursos`.
