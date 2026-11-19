# 116 — Importar a programação anterior e conferir o realizado acumulado

## 1. Importar itens da programação anterior
- Dentro da programação em rascunho (Planejamento): botão **Importar itens**; programação vazia mostra o convite
  "Começar pelos itens da programação anterior?".
- Origem: a anterior do mesmo tipo vem sugerida (`GET /programacoes/{pid}/importar/origens`); qualquer outra pode ser escolhida.
- Prévia (`GET /programacoes/{pid}/importar/{de}`): cada linha com projeto, resta, o que faltou no período e a situação
  **Entra · Já está nesta · Concluída no projeto**. Marca/desmarca item a item.
- `POST /programacoes/{pid}/importar {de, linhas?, quantidade: vazia|saldo, incluir_concluidas}`:
  vem a linha (área, tipo, item Simova, PQ, IWP/etapa da WBS, cronograma, plano, equipe, responsável, natureza, SSMA/PTO,
  observação), **sem os valores do dia**. Quantidade do período: em branco ou "o que faltou" = máx(0; programado − realizado
  do período), limitado ao que resta do projeto (memória `saldo_periodo`). Linha repetida (mesmo IWP/etapa, ou mesma
  área+tipo+item+PQ+etapa) não duplica; concluída no projeto só vem se marcada.
- Nova programação: "Reaproveitar itens de" já vem com a anterior do mesmo tipo e usa a mesma regra (`copiar_de`).

## 2. Conferir o realizado acumulado
- `domain/acumulado.py::conferir`: acumulado = feito antes do período + realizado no período; comparado com o total do projeto
  (qtd de projeto da linha, senão o take-off da TAG) e com o programado do período (qtd do período, senão a soma do previsto).
- Situações: em andamento · concluiu · acima do projeto · sem projeto; e "acima do programado" à parte.
- Passar do total do projeto **trava** o lançamento (422 `campo=excesso_projeto`) até a pessoa confirmar (`aceitar_excesso`):
  quantidade errada, unidade trocada ou aditivo ainda não lançado. Passar do programado no período **só avisa**.
- Vale em `PUT …/linhas/{lid}/valores` (celular) e `PUT …/salvar` (tela); as duas devolvem a `conferencia`.
- Visão da programação traz `conferencia` por linha; memória `acumulado` (feito antes + período × projeto × programado).
- Tela (modo Realizado): "acum. X / Y" embaixo do total, ao vivo com o que foi digitado, em vermelho (passou do projeto),
  âmbar (acima do programado) ou verde (concluída). Celular (Lançar o dia): quadro "Acumulado no projeto" com barra e aviso.

## Testes
`tests/test_importar_e_acumulado.py` (domínio, trava/confirmação, salvar em lote, importação com saldo, sem duplicar,
concluídas, emitida não recebe, acumulado entre semanas, memórias). E2E: nova com a anterior sugerida, importar pela tela,
confirmação ao passar do projeto na tela e no celular.
