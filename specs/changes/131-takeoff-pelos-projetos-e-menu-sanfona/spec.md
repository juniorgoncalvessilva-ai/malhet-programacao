# 131 — Take-off a partir dos projetos, PDF com texto, menu em sanfona e "Documentos"

## Pedido (usuário, 22/11/2026)
1. No menu, "Documentos (LDO e GRD)" vira só "Documentos".
2. "Em Take off o mesmo não está servindo para o propósito: a partir da existência de projetos ele deve fazer o levantamento das
   quantidades, e hoje ele não faz nada." — o take-off só lia o desenho no instante do envio do DWG/DXF; projeto vindo da LDO, em
   PDF ou enviado antes da spec 124 ficava sem levantamento e a tela vazia.
3. A barra de rolagem do menu lateral incomoda: recolher os grupos (submenu só em último caso).

## O que muda
- **Take-off parte dos projetos** (`application/takeoff.py::projetos|levantar`, `GET /documentos/takeoff/projetos`,
  `POST /documentos/takeoff/levantar?refazer=`): cada documento com a revisão que vale (vigente; sem vigente, a mais nova com
  arquivo) e a situação — **lido** (com quantidades), **a ler**, **sem quantidade** (lido, sem quadro), **sem desenho** (imagem,
  planilha), **sem arquivo** (só na LDO). A revisão guarda `takeoff_em`, `takeoff_qtd` e `takeoff_obs` (o motivo quando não sai
  nada). O lote lê 25 por vez (a tela repete até zerar) e um arquivo ruim não para o lote.
- **Ao abrir a tela, o planejador já dispara a leitura do que está "a ler"** — a existência do projeto basta. Botões "Levantar" e
  "Ler tudo de novo", filtro por situação, "Ler/Ler de novo" por projeto (`ProjetosTakeoff`).
- **PDF com camada de texto** (`infra/pdf.py`, pdfminer.six — MIT): cada célula vira um `Texto` como o TEXT do DXF e o mesmo leitor
  de quadros/anotações serve; o PDF que chega como revisão já é lido. PDF em que o texto virou desenho (fonte SHX, escaneado) fica
  "sem quantidade" com o aviso "envie o DWG/DXF". A margem do quadro passou a acompanhar o espaço entre colunas (a escala letra ×
  coluna muda no PDF).
- **Menu em sanfona** (`Shell.tsx::GrupoLateral`): um grupo aberto por vez — o da tela atual —, os outros mostram só o nome e a
  quantidade de telas; sem barra de rolagem (e escondida se a tela for muito baixa). Submenu não foi preciso.

## Verificação
`tests/test_takeoff_lote.py` (PDF com texto dá o mesmo resumo de aço conferido; situação por projeto: DWG lido, PDF lido, imagem
sem desenho, LDO sem arquivo; revisão antiga "a ler" lida pelo lote; refazer) + suites de take-off e documentos. E2E: menu a
900 px de altura sem rolagem (conteúdo = altura), abrir um grupo fecha o outro; DWG real marcado "a ler" lido sozinho ao abrir o
take-off.
