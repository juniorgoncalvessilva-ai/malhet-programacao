# 096 — Landing: menos espaço entre seções e cubo centralizado no celular

## Pedido
"Ficou com muitos espaços em branco entre as sessões, o cubo no mobile ficou deslocado — ele pode formar acima ou abaixo
do texto de forma centralizada."

## O que muda (`components/Marca/Landing.tsx`)
- `empilhado()`: tela em pé (altura > largura × 1,05) ou largura < 900 px → layout empilhado. Vale também para o
  celular em "versão para computador" e dobrável aberto, que passavam dos 900 px e caíam no layout de tela larga.
- Empilhado: cubo centralizado acima do texto (`deslocX 0`, `deslocY -0.2`, `escala 0.26`), texto embaixo.
- Abertura mais curta (150vh empilhado / 165vh largo); o título não some mais ao rolar, só sobe um pouco.
- Cena "o problema" presa (sticky) só em tela deitada com altura ≥ 640 px e por 200vh (antes 260vh); no celular rola normal.
- Seções com `py-16 sm:py-24` (antes `py-24 sm:py-36`); margens internas de Espaço/pilares menores.

## Aceite
- iPhone 14 e viewport 980×2000: cubo centralizado acima do texto, sem rolagem horizontal, sem erro no console.
- Desktop: layout e transições iguais, com menos vazio entre as seções.
