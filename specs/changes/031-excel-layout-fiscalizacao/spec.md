# 031 — Pareto e Plano de Ação 6WLA exportados no layout das planilhas da obra (envio à fiscalização)

## Pareto de Desvios (`indicadores/application/excel_pareto.py`, `GET /desvios/excel`)
- **Gráfico**: título "Pareto de Desvios | obra", faixas verdes (007E7A) "Acompanhamento | Principais Problemas" e três
  gráficos de barras com o valor: ACUMULADO (vermelho C00000, maior no topo), SEMANA ATUAL (última semana com
  desvio) e POR FRENTE DE SERVIÇO (verde 00B050).
- **Detalhamento**: layout da aba da obra — título 26 pt, faixa "Detalhamento" (B2:K2), cabeçalho 006666 branco
  16 pt com filtro, linhas Arial 12 com borda fina, ID em cinza, Atividade impactada na coluna M, zoom 60 %, sem
  grade. **Status com ícones (3 símbolos, sem o número): 1 = ✖ vermelho, 2 = ! amarelo, 3 = ✔ verde.**
- **Dados**: semana atual, acumulado por causa (com total), matriz causa × semana e por frente de serviço (valores
  que alimentam os gráficos).

## Plano de Ação 6WLA (`restricoes/application/planilha.py`, `GET /restricoes/excel`)
- **Ações**: layout da aba da obra — faixas verdes, PRAZO, REPROGRAMADO (laranja FFC000), CONCLUSÃO (vermelho
  C00000), Calibri 16, STATUS 2 e 6M em cinza, FAROL por fórmula com **4 semáforos** (1 vermelho atrasado,
  2 amarelo reprogramado, 3/4 verde), STATUS 2 por fórmula com HOJE(), listas de seleção, filtro, zoom 50 %.
- **PAINEL AÇÃO**: rosca de status, status por responsável (empilhado, pendentes), por semana do projeto, por
  áreas/ativos (pendente × concluído × cancelado), 6M e gerência; tabelas que alimentam os gráficos à direita.

Peças comuns em `app/shared/excel.py` (faixa, barras com rótulo só do valor, caber na largura da folha).
Testes: `tests/test_indicadores.py`, `tests/test_restricoes.py`.
