# Spec 051 — Resumo por função e gráficos do efetivo

## Pedido
Em Efetivo e mobilização, um resumo por função dos funcionários e gráficos que facilitem ver o efetivo agrupado,
numa aba da página.

## Entrega
- Aba "Resumo por função" (`components/Obra/ResumoEfetivo.tsx`, contas em `src/lib/efetivo/resumo.ts`), a partir
  do efetivo já carregado: escopo Ativos (mobilizados e afastados) | Em mobilização | Todos (menos desmobilizados) e
  filtro por empresa.
- Indicadores: pessoas, funções, MOD, MOI, em equipe, sem equipe.
- Gráficos: pessoas por função (20 maiores; empilhado por situação fora dos ativos), roscas de situação, tipo de MO e
  equipes, barras por DP, empresa e função da composição (de-para), colunas de admissões por mês (12 meses).
- Tabela por função: total, por situação, em equipe, sem equipe e tipo de MO; a linha abre os nomes.
- Todo número abre a memória de cálculo (critério da contagem, as pessoas que entraram e a coluna da planilha do DP).
  `Rosca` ganhou cores e rótulo próprios.
