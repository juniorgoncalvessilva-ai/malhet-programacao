# 032 — Restrições em abas, painel com os gráficos do Excel, edição na linha e observação datada

- Página Restrições em abas: **Ações** (primeira e principal), **Painel · Ishikawa e gráficos** (indicadores, espinha 6M
  e os gráficos do PAINEL AÇÃO), **Importar** (planejador).
- Gráficos na tela = os do Excel, pela mesma conta (`restricoes/domain/painel.py`, usado pelo Excel e por
  `GET /restricoes/ishikawa` → `graficos`): status (rosca), status por responsável (pendentes, empilhado), por semana
  do projeto (pendentes), por gerência, por áreas/ativos (pendente × concluído × cancelado) e 6M (pendentes). Cada valor
  tem memória (lista das ações). Componentes em `components/Obra/GraficosRestricoes.tsx`.
- Edição na própria linha da tabela (sem formulário acima): lápis abre os campos nas colunas; nova restrição entra
  como linha no topo; reprogramar abre uma linha logo abaixo.
- Observações = histórico: `nova_observacao` entra no topo com a data de hoje (`dd/mm: texto`, `domain/acao.py::anotar`);
  a reprogramação também anota. `observacoes` vai a 4000 caracteres (migração 0024).
