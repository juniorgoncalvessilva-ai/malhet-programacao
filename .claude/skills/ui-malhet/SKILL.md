---
name: ui-malhet
description: Criar ou ajustar telas do front no padrão visual Malhet (design system CorpMind — Figtree, teal claro / carvão escuro). Use em qualquer página, componente ou ajuste de layout em apps/web.
---
Fonte da verdade: canvas Malhet (`project/ds/corpmind/tokens.json`, telas AC01 Montar programação, NV01 Navegação,
BR03 Login). No código: `src/css/malhet.css` (variáveis claro/escuro) e cores Tailwind `m-*`.

Anatomia de uma tela (`src/app/[locale]/app/(obra)/programacao/page.tsx` é a referência):
1. `<Cabecalho eyebrow cor titulo descricao acoes>`: eyebrow 11px CAIXA ALTA com quadradinho na cor da etapa
   (`--m-proc-planejar` azul, `--m-proc-executar` verde, `--m-proc-medir` âmbar, `--m-proc-administrar` rosa).
   O título é uma **frase com o estado** ("Semana de 16/11: 2 atividades, todas dentro da capacidade"), não um rótulo.
2. Faixa de `<Indicador>` (carimbo, raio 14).
3. `<Painel titulo subtitulo acoes>`: o título é uma **pergunta** ("A equipe dá conta?"); raio 20, borda
   `m-stroke-subtle`, **sem sombra**.
4. `<Tabela>` com cabeçalho 11px CAIXA ALTA, células 13px, números à direita (`tdNum`), `tabular-nums`.
5. Status com `<Pilula tom>`; filtros com `<Chip ativo>`; botões `<Botao>` em pill (primário = `m-accent-strong`).

Regras: texto principal `m-text-primary`, apoio `m-text-tertiary`, metadados `m-text-muted` (4.5:1).
Terracota só para total de restrições. Ícones `lucide-react` stroke 1.75, nunca emoji. Foco visível 2px.
Toda tela funciona a 390px (menu vira gaveta, tabelas rolam). Novo item de menu: `src/components/Malhet/menu.ts`.
