# 011 · Cronograma no padrão do design, excluir equipes, catálogo com o tipo vindo da PQ

## 1. Cronograma
- Tabela no padrão do design (VisualPlan "Cronograma" e "Boletim de medição"): faixas de cabeçalho (Estrutura,
  Datas, Avanço, Linha do tempo), WBS numerada (1, 1.2, 1.2.3 na ordem do P6), linha de estrutura com datas
  agregadas, % ponderado pela duração e nº de atrasadas, borda à esquerda por situação, barra de Gantt com avanço e
  linha de hoje.
- Ordenação clicando no cabeçalho: ID/WBS, atividade, ordem do P6, início, fim, duração, % — crescente/decrescente,
  aplicada à estrutura inteira (nós e atividades).
- Filtros com vários valores e combináveis: Status, O.S./nível 1, CWA, Situação (atrasada, já programada, não
  programada), fim a partir de / início até, período da programação; chips removíveis e "Limpar filtros".

## 2. Equipes
- Excluir equipe (uma ou várias selecionadas), com confirmação. Linhas de programação ficam sem equipe; emissões
  não mudam.

## 3. Catálogo: o tipo é o item da PQ
- Importação da PQ do contrato (abas **PQ** e **MC**) com a estrutura da aba: títulos níveis 1–4, itens (folhas),
  código da atividade, critério (CMS), quantidade, preço, total, ordem. O take-off antigo (PQ CONTRATO + MC FRENTES)
  continua aceito. A MC dá a quantidade por TAG casando pelo código da atividade; código repetido em blocos da PQ
  (título de nível 1 repetido, ex.: seções 6–9 = área 1485AA) vai para o bloco da área da TAG.
- `tipo_atividade.item_pq`: o tipo **é** um item da PQ (um item → um tipo por obra); descrição e unidade vêm da
  PQ vigente. Some a tabela `tipo_item_pq` (migração leva o primeiro item de cada tipo).
- Catálogo: grupos (criar, editar, excluir vazio) → itens da PQ vinculados (mover de grupo, renumerar, inativar,
  desvincular se não usado) → complementos. Painel "Aba PQ do contrato" com a estrutura e seleção para vincular.
- Programação: a linha mede no item do tipo (backend força `item_pq = tipo.item_pq`).
- Próxima etapa (fora desta spec): coluna na PQ com texto simplificado para o OPER do Simova.

## Evidência (10/11/2026)
- `pytest -q`: 38 passed (estrutura da PQ, MC por TAG, bloco por área, vincular/desvincular, excluir equipe).
- PQ real Rev.11: 487 itens + 387 títulos; 2.076 quantidades por TAG (285 linhas da MC sem item na PQ, avisadas).
- Navegador: filtros Status (2) + Situação "Atrasada" = 90 atividades; ID decrescente reordena a WBS inteira
  (2.5.7 → 2.5.7.2 → 2.5.7.1 → 2.5.6 …); vincular 1.8.3.1.2 ao grupo → tipo 1.2; excluir equipe 21 → 20.
