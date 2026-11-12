# Spec 053 — Resumo da programação por frente e por responsável/encarregado

## Pedido
Numa aba da página da programação, um resumo do programado por frente e por responsável/encarregado, com a quantidade
somada por unidade de medida e a opção de expandir os itens da frente.

## Entrega
- Aba "Resumo por frente e responsável" na programação (a aba "Programação" continua montando como antes; trocar de aba
  não perde o que está digitado).
- `components/Obra/ResumoProgramacao.tsx`: duas tabelas — Frente → Área → atividade e Responsável → Encarregado →
  atividade — com nº de linhas, uma coluna por unidade de medida (soma do previsto e do realizado do período; unidades
  diferentes não se somam) e HH previsto; expandir/recolher por linha e "expandir tudo"; total da programação.
- Ver: previsto e realizado | só previsto | só realizado. Nome da atividade segue o botão de nomes (spec 046).
- Toda soma abre a memória de cálculo (as linhas somadas, de onde vem cada valor).
