# Spec 020 — Frentes no padrão da obra: CWA | Ativo | DESCRICAO CWA | Local

## Objetivo
Importar a lista de frentes como a obra mantém: cada linha é uma **área** (CWA), com o **Ativo** (ED-1800AA-04, "-" =
sem ativo), a **descrição** e o **Local** que a agrupa (Novo CMD, Nova Oficina, TR/ Pilha Feijão…).

## Regras (`frentes/domain/frentes.py`)
- `eh_formato_cwa`: lista com 4 colunas (tab ou ;); cabeçalho `CWA` ignorado. O formato antigo CODIGO | DESCRICAO
  continua aceito (`interpretar_lista` decide).
- Local criado pelo nome (espaços normalizados, sem diferença de maiúsculas); código Simova automático `L1, L2…`
  (`codigo_de_local`) para não colidir com os CWAs na exportação FRENTE; editável na tela.
- Ativo guardado em `area_frente.ativo_codigo` (migração `0013_ativo_area`); a TAG do take-off sai do Ativo
  (`normalizar_tag`), senão da descrição. Ativo sem número (ST-1640AA) não vira TAG.
- CWA repetido na obra ganha sufixo (.1, .2…), como antes.
- Reimportar casa a área por CWA + Ativo, depois CWA + TAG, depois CWA + descrição: atualiza local, ordem e
  descrição sem duplicar (programações continuam apontando para a mesma área).
- Na lista nova, locais antigos que ficaram sem área (ex.: 1, S2 do formato antigo) são removidos antes de gerar os
  códigos, liberando o código para a área de mesmo CWA. Locais com áreas fora da lista ficam.

## Tela
Modelo e instruções no novo formato; coluna e campo "Ativo"; Local mostrado pelo nome com código e nº de áreas;
código do Local opcional (automático).

## Testes
`tests/test_frentes_cwa.py` com a lista da obra (`tests/dados/frentes_cwa.txt`, só ativos, sem dados pessoais).

## Ajuste (pedido seguinte)
- **CWA é o código**: o campo/coluna "Código Simova" saiu da tela; o código da área é sempre o CWA (código enviado é
  ignorado; mudar o CWA muda o código). Só CWA repetido na obra sai com sufixo (.1, .2) no Simova, porque o FRENTE
  exige código único — a tela mostra "no Simova: 004.09.2" apenas nessas linhas.
- **Excluir todas** (`DELETE /frentes`, admin, com confirmação): apaga áreas e locais; área usada em programação fica
  (com o local dela) e a resposta informa quantas ficaram.
- **TAG só quando casa com o take-off**: `AreaOut.no_takeoff` (TAG do Ativo existe na aba MC da PQ vigente,
  `pq_gateway.tags_do_takeoff`). A coluna TAG saiu; aparece "take-off · TAG" sob o Ativo só quando casa.
