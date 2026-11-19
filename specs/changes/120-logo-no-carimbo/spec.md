# 120 — Logo da empresa no carimbo da foto

Toda foto de campo carimbada (spec 119) leva a logo da contratada da Marca da obra no canto de baixo, à direita, num cartão
branco (a logo costuma ser escura e sem fundo), sem cobrir o texto (o texto encolhe para caber ao lado).

- `useLogoNoCarimbo` (components/Mobile/Fotos.tsx) carrega a logo da obra corrente e guarda no aparelho reduzida (até 360 px,
  PNG) em `malhet.logo-carimbo.<obra>`: a foto tirada sem internet também sai com a logo. Trocar a logo na Marca da obra
  atualiza; tirar a logo tira do carimbo.
- Montado no `MobileShell` (todo o app de campo), em `TirarFotos` e em `useEnviarFoto` (telas do computador).
- Vale para todas as fotos que passam por `carimbarFoto`: atividade, atividade fora da programação, ocorrência, restrição,
  auditoria, ação 5W2H e etilômetro.

E2E: com a marca de teste, a logo fica no aparelho e a foto registrada, baixada, sai com a logo no carimbo.
