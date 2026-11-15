# Spec 093 — Sem resto do kit e a empresa contratada em destaque dentro do app

## Pedido
1. "No topo de algumas páginas ainda aparece algo sobre starter kit; retire e coloque nosso favicon."
2. "Dentro do software, ao logar, tire o descritivo 'Programação' e coloque a logo da contratada a qual o usuário e o
   contrato estão atrelados; dê mais ênfase à empresa para que ela sinta que o software é dela."

## O que muda
- `src/config/app.ts`: título, descrição, palavras-chave, empresa, redes e contatos do kit (AI Coders) trocados pelos do
  Malhet ("Malhet · Gestão da execução de obras"); links de suporte/privacidade apontam para `/privacidade`.
- Favicon: `src/app/favicon.ico` (o do kit) substituído pelo "M" do Malhet (16/32/48 px) + `public/brand/favicon.svg`
  declarado no `layout.tsx`. Dentro de uma obra continua valendo a aba "Contratada | Obra" com o ícone da logo da
  contratada (spec 043).
- Barra lateral (`Malhet/Shell.tsx`, `MarcaContratada`): no topo, a **logo da contratada** da obra escolhida (Marca da
  obra); sem logo, as iniciais na cor da obra e o **nome da contratada** em destaque; sem marca cadastrada ou sem obra, a
  logo do Malhet. "Programação" saiu. Trilha do cabeçalho: "Contratada / tela". O Malhet fica como assinatura discreta
  ("com Malhet") no pé do menu.

## Verificação
tsc + build; navegador: título do login "Malhet · Gestão da execução de obras", ícones `/favicon.ico` e
`/brand/favicon.svg`; obra com logo, só com nome e sem marca.
