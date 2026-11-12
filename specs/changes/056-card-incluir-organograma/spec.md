# 056 — Card para incluir pessoa/função pelo organograma

## Problema
No organograma em modo de edição, "+ pessoa" e "+ função" abriam a busca dentro da caixa da equipe. Como a árvore fica
num contêiner com zoom (transform), a lista da busca ficava cortada e por baixo das outras caixas.

## Solução
- "+ pessoa" e "+ função" abrem um card centralizado por cima da tela (`CardIncluir` em
  `components/Obra/OrganogramaArvore.tsx`, renderizado com `createPortal` no `document.body`, fora da área com zoom).
- O card mostra a equipe ("Incluir na equipe · EQUIPE.X"), alterna entre **Pessoa** (`BuscaEfetivo`, busca no efetivo
  inteiro, mantém aberto para incluir várias seguidas, lista "Incluídos agora") e **Função inteira** (`IncluirFuncao`).
- Fecha pelo X, por "Concluir", clicando fora ou com Esc. Quem já está em outra equipe é movido (mesma regra da spec 049).
- Sem mudança na API.

## Aceite
- Clicar "+ pessoa" numa equipe abre o card visível inteiro, com a lista de resultados por cima do organograma.
- Escolher uma pessoa a inclui na equipe e ela aparece em "Incluídos agora"; Esc fecha.
