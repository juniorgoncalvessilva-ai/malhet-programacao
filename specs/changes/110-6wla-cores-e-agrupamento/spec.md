# 110 — 6WLA no Excel: azul #002060 nas semanas e agrupamento como no cronograma

## Por quê
Aberto no Excel, o 6WLA (spec 108) mostrava o "1" das semanas sem o azul-escuro — o Excel lê a cor do preenchimento de
formatação condicional no `bgColor`, e o arquivo só tinha o `fgColor` (o LibreOffice aceita os dois). E não dava para
recolher os níveis como no cronograma. A logo da contratada cobria o título do Ishikawa 6M.

## O que muda (`planos/application/seis_semanas.py`)
- `_cf(cor)`: preenchimento de formatação condicional com `fgColor` e `bgColor` — "1" das semanas em #002060 (texto da
  mesma cor, como na planilha da obra); 6M vermelho/verde idem.
- Agrupamento de linhas: `outline_level` = nível da WBS (até 7, limite do Excel), título acima dos filhos
  (`summaryBelow = False`) — os botões +/− recolhem O.S. → WBS → atividades.
- Logo da contratada na coluna AG, à direita do 6M.

## Aceite
`tests/test_seis_semanas.py`: regra do "1" com `bgColor` 002060; níveis 0/1/2 na estrutura e 1 no grupo do plano.
XML do arquivo gerado com os dados da obra conferido (dxf com bgColor, `outlinePr summaryBelow="0"`, níveis 1–7).
