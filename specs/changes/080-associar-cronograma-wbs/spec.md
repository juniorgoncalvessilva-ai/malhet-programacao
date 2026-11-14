# 080 — Associar ID do cronograma importado à WBS (tela + direto na programação)

## O que muda
- `GET /wbs/associacao`: IWPs e etapas ativos com a atividade ligada e, para os sem atividade, até 3 sugestões (mesmo item da
  PQ, mesma área/CWA, palavras da descrição); atividades do cronograma vigente sem WBS.
- `PUT /wbs/nos/{id}/atividade`: liga/desliga a atividade (confere no cronograma vigente) e leva o ID para as linhas
  daquele nó nas programações em **rascunho**.
- `PUT /programacoes/{pid}/linhas/{lid}/atividade`: associar na própria programação sem travar o fluxo (vale também em
  emitida — a revisão emitida guarda o que estava; concluída não); opção de gravar também na WBS.
- Tela `/app/wbs/associacao` (filtros sem/ligados/todos, área, busca, sugestões clicáveis, "Aceitar 1ª sugestão", busca de
  atividade `BuscaAtividadeCrono`) e botão "associar ID do cronograma" na linha da programação (`AssociarAtividadeLinha`).

## Testes
`tests/test_associacao_cronograma.py`.
