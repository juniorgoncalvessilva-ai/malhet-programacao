# Spec 017 — Organograma navegável (recolher, níveis, zoom) e quadro de totais do efetivo

## Organograma (`components/Obra/OrganogramaArvore.tsx`)
- Ramos recolhíveis (+N / −) em cada caixa com filhos; botões de nível: Setores, Supervisores (padrão), Equipes,
  Funções; Expandir tudo / Recolher tudo; contador de caixas visíveis.
- Listas longas de funções (> 12 folhas, ex.: Sem equipe, Em mobilização) só abrem no nível Funções ou no clique.
- Folhas (funções) empilhadas na vertical sob o pai: a árvore fica estreita.
- Zoom 30–160% (botões, Ctrl/⌘ + rolagem mantendo o ponto do cursor, 100%, Ajustar à tela), arrastar para navegar,
  tela cheia (Esc sai). Com busca, a árvore abre inteira.
- Caixas com fundo `--m-surface-raised` (o token `--m-surface` não existe e deixava a caixa transparente).

## Efetivo — quadro de totais
- A aba principal termina num quadro-resumo (DEMITIDOS 155, MOD 174, MOI 152, FÉRIAS 0…) que era lido como pessoa
  "em processo". `e_quadro_de_totais`: FUNÇÃO numérica e sem matrícula → linha ignorada.
- Na reimportação, registros fora do arquivo que são linha de total (função numérica, ou sem matrícula, função e
  crachá) são removidos (`linhas_de_total_removidas`). Pessoas reais continuam nunca sendo apagadas.
