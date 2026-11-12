# Spec 041 — Programação vigente visível para todo mundo

## Pedido
A Programação vigente deve ficar visível para todo mundo.

## Situação
No computador já estava aberta a qualquer papel (`podeVer` libera `/app/vigente`; API com `Depends(ler)`). No celular,
`/app/vigente` levava ao "Lançar" e o app de campo não tinha tela da vigente.

## Entrega
- `/m/vigente`: última emissão da programação vigente, dia a dia (chips; começa no dia de hoje), por local/área, com
  previsto × realizado, encarregado e botão do Excel. Sem filtro de papel nem de páginas.
- Barra do app de campo ganha "Vigente" (6 itens); `rotaDoCampo('/app/vigente')` → `/m/vigente`.
