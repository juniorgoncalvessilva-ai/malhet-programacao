# 137 — Linha do CWP no Excel do cliente

## Pedido (usuário, 23/11/2026)
"Os itens de CWP não estão sendo exportados no Excel cliente, aí fica desorganizada a programação; inclua a linha na
exportação." Na tela a programação já mostra Local → CWA → CWP → atividades (spec 046, `porCwp`); o Excel do cliente (layout
S32/S27) ia direto do CWA para as atividades.

## O que muda
- `planejamento/application/exportar_cliente.py`: as linhas de cada CWA são agrupadas pelo CWP como na tela (`por_cwp`: primeiro
  as sem CWP, depois cada CWP na ordem em que aparece) e, antes das atividades de cada CWP, entra a faixa
  **"CWP 004.05-01 · Radier - Eixo A–B"** (sem código quando o CWP veio só do texto complementar): azul-claro DCE6F1 com o texto
  no azul da área (173761), negrito, J..AJ mesclado, da coluna G até a última. A numeração das atividades continua por CWA
  (4.1, 4.2…); a zebra das atividades segue contínua.
- Vale para o rascunho e para as revisões emitidas (a foto já traz o CWP; as antigas são completadas por `completar_foto`).

## Verificação
`tests/test_cwp_nomes.py`: no Excel, a faixa do CWP fica logo abaixo do CWA e acima da atividade, com o fundo DCE6F1.
Excel real da programação emitida da obra RSA: OBRA GERAL → CWA 004.00 → atividade sem CWP; NOVO CMD → CWA 004.02 →
"CWP 004.02-03 · Fundação do prédio - Radier" → 3.1…; "CWP Fundo canaleta 2A" (só texto) também aparece.
