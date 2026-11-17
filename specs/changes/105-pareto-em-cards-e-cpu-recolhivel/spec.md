# 105 — Programação: itens não cumpridos em cards, bloco minimizável e cálculo da CPU recolhível

## Pedido
"Melhorar o layout dos itens não cumpridos (Pareto): um por vez, cards que vão passando à medida do preenchimento;
opção de minimizar esse bloco (o foco é a programação estar visível); botão para minimizar os itens da CPU de cada linha
e exibir quando necessário."

## Como funciona
- `DesviosDaProgramacao`: barra de progresso "N de M com motivo" (sempre visível); números dos itens (verde = com
  motivo, laranja = falta) para ir direto; **um card por vez** com o formulário já aberto; "Registrar e ir ao próximo"
  grava e passa sozinho para o próximo item sem causa (‹ › navegam); item que já tem motivo aceita "outro motivo".
  "Ver todos" mostra a lista inteira; **Minimizar/Mostrar** recolhe o bloco. As duas escolhas ficam lembradas no navegador.
- Linha da programação: o cálculo da CPU (HH/un, governa, índice, capacidade) fica **escondido por padrão**; o botão
  "Cálculo da CPU" mostra/esconde em todas as linhas (lembrado). Os alertas da linha continuam sempre visíveis.
- `lib/preferencia.ts` (`usePreferencia`): preferência de tela em localStorage, sincronizada entre os componentes.

## Aceite
- e2e: CPU escondida/visível; card da vez, registro passa ao próximo sem motivo; minimizado continua após recarregar.
