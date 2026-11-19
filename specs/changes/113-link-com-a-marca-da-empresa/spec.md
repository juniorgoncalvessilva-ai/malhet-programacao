# 113 — Link dos líderes com a marca da empresa e fim do "Loading chunk failed"

## Por quê
1. O link do encarregado é da obra — sabemos de qual empresa ele é antes de qualquer login. Ele deve abrir com a
   identidade da empresa (logo, cor), não do Malhet.
2. "Loading chunk 6910 failed" (tela de cadastro) continuou aparecendo: a tela de login/cadastro não tinha a checagem
   de "versão nova no ar" e abas antigas (de antes da spec 109) seguiam relatando.

## O que muda
### Marca no link (`/equipe/<codigo>`)
- `GET /portal/{codigo}` traz `marca` (cor, nome da contratada/contratante, logos disponíveis, versão) e
  `GET /portal/{codigo}/logo/{contratada|contratante}` serve a logo sem login.
- A página é montada no servidor com a marca: título da aba "Empresa · Minha equipe" (sem "| Malhet"), ícone = logo da
  empresa (inclusive o que o Next insere depois — `MutationObserver`), `theme-color` = cor da empresa (barra do navegador
  do celular).
- Abertura do app com a logo da empresa; **faixas de cima e de baixo na cor da empresa** (texto branco ou escuro pelo
  contraste, `textoSobre`); botões, foco e busca herdam a cor (tokens `--m-accent*` no `.portal-lider`); rodapé
  "Empresa · Cliente · com Malhet". Sem marca cadastrada, o verde do Malhet.
### Versão nova no ar
- `lib/erros/versaoNova.ts`: `versaoNoAr`, `abaDeVersaoAntiga`, `tratarVersaoVelha` — chunk que falha numa aba de build
  antigo recarrega sem relatar (até 3 vezes em 5 min, sem ciclo); só vira relato se a versão é a atual.
- `CapturaErros` (todas as páginas, inclusive login/cadastro/link): ao voltar para a aba, build novo no ar = recarrega
  (não com a pessoa digitando).

## Aceite
`tests/test_portal_lider.py::test_link_com_a_marca_da_empresa`; e2e no celular: aba "Empresa Teste · Minha equipe",
ícones = logo, theme-color e faixas em #C8102E, abertura com a logo.
