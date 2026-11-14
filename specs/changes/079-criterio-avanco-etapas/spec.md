# 079 — Critério de avanço · etapas no IWP da WBS · etapa sem avanço (só esforço)

## Pedido
Descer um nível abaixo do IWP na WBS para etapas sem avanço físico prático mas com esforço (ex.: pré-armação do aço fora do
local, que acelera a montagem). Tela de critério de avanço com as etapas e o percentual financeiro de cada uma (planilha
"Critério de medição" anexada). A etapa entra na programação e conta o esforço sem poluir o valor financeiro.

## Planilha (aba CRITÉRIO DE MEDIÇÃO)
`CRITÉRIO MEDIÇÃO | DESCRITIVO DO CRITÉRIO | ETAPAS | DESCRITIVO DA ETAPA | DESCRITIVO DOCUMENTO | PERCENTUAL`. O descritivo
começa pelo item da PQ ("23.1 ESTRUTURA METÁLICA…") — o critério vale para ele e os de baixo (23.1.x). O mesmo código CMS
aparece em itens diferentes: chave = código + item. Etapas que não somam 100% são avisadas (não bloqueiam).

## O que muda
- Módulo `criterios/` (`criterio_medicao`, `criterio_etapa`: nº, nome, documento, percentual, sem_avanco). Importar
  (reimportar atualiza sem quebrar a WBS), criar/editar à mão (inclusive etapa sem avanço), `GET /criterios/do-item`.
  Tela `/app/criterios` (indicadores, soma com memória, itens da PQ cobertos, editor de etapas, "+ Etapa sem avanço").
- WBS: tipo **etapa** abaixo do IWP (`wbs_no.etapa_id`, `percentual`, `sem_avanco`; nome em `elemento`; código `…-E1`).
  Botão **critério** no IWP cria as etapas do critério do item (`POST /wbs/nos/{id}/aplicar-criterio`); "+ Etapa" à mão.
- Programação: linha pode ser etapa (`programacao_linha.etapa_nome/etapa_percentual/sem_avanco`). Enviar o IWP com
  etapas leva **as etapas** (uma linha cada). Descrição "… — Etapa"; `pu` = PU do item × % da etapa (Excel do cliente e
  impressão faturam por ele); **sem avanço = 0** (não fatura, não soma quantidade no resumo), mas a capacidade/HH continuam.
  Selo "sem avanço"/"etapa X%" na linha.
- Plano de 90 dias e migração usam o mesmo gateway (etapas entram também).

## Testes
`tests/test_criterios.py` (domínio, importação, etapa sem avanço, aplicar critério, programação e plano).
