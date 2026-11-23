# 136 — Envio da WBS com a árvore atual e duplicar grupo/IWP no mesmo CWA

## Pedidos (usuário, 23/11/2026)
1. "Nó da WBS '880' não encontrado … não consigo enviar itens da WBS para programação, nem os itens que estão na aplicação
   estão aparecendo na WBS." (POST `/programacoes/4/linhas/da-wbs` 404 repetido; `POST /wbs/nos` 422)
2. "Configure a opção de duplicar grupos e IWP na programação. As duplicações devem ocorrer no mesmo CWA." — escolhido: os
   dois (copiar a estrutura na WBS e repetir linhas na programação).

## Causa provável (1)
A tela enviava a seleção feita sobre uma árvore que não era mais a do servidor: a seleção não era limpa quando a WBS
recarregava (o nó sumia da tela e continuava selecionado, sem como desmarcar), a WBS ficava 5 min em cache com a chave
`['wbs']` (sem a obra) e a troca da obra por outro caminho que não o seletor não limpava o cache. Um único nó que não existe
derrubava o envio inteiro com 404. O 422 de criar nó é o servidor recusando o que já existe ("já está neste grupo/CWP") — de
novo a tela mostrando uma árvore velha. Não houve acesso ao banco de produção para confirmar qual dos caminhos ocorreu; a
correção cobre todos.

## O que muda
- `wbs/infra/gateway.py::iwps_abaixo` devolve `(iwps, vazios, inexistentes)`: nó que não existe mais nesta obra é pulado e
  informado (`nos_inexistentes` em `/programacoes/{pid}/linhas/da-wbs` e `/planos/itens/da-wbs`); se nenhum existe, 422
  "atualize a página".
- Front: `useWbs` com a chave `['wbs', obra]`, sem cache velho (`staleTime: 0`, `refetchOnMount: 'always'`); a seleção da WBS é
  podada para os nós da árvore atual e só eles vão no envio (programação e plano); depois de erro a árvore recarrega.
  `ObraProvider` limpa o cache sempre que a obra muda (não só pelo seletor).
- **Duplicar na WBS** (`POST /wbs/nos/{nid}/duplicar`): grupo (com IWPs e etapas) ou IWP para outro CWP do **mesmo CWA** —
  escolhido ou criado na hora (`novo_cwp_elemento/complemento`); grupo de destino achado ou criado; IWP que o destino já tem não
  repete; quantidades só com `quantidades`; a atividade do cronograma não vai junto. Botão de cópia nas linhas de grupo e IWP.
- **Duplicar na programação** (`POST /programacoes/{pid}/linhas/duplicar`, rascunho): a linha do IWP ("Duplicar linha") ou
  todas as linhas do CWP ("duplicar grupo" no cabeçalho do CWP), logo abaixo, no mesmo CWA, com a mesma equipe (ou outra,
  `equipe_id`), sem valores dos dias, sem quantidade do período e sem predecessoras.

## Verificação
`tests/test_wbs.py` (nó inexistente pulado; só inexistente = 422), `tests/test_duplicar.py` (WBS: grupo para outro CWP com IWPs e
etapas, sem repetir, IWP para CWP novo com quantidade, outro CWA/mesmo CWP/CWP como origem = 422, obra isolada; programação:
grupo e linha, mesmo CWA, sem qtd do período, linha inexistente = 404). E2E local: grupo 004.05-01-1 duplicado para
"Radier - Teste duplicação"; enviado à programação mensal; "Duplicar linha" 1 → 2 e "duplicar grupo" 2 → 4, sem erros.
