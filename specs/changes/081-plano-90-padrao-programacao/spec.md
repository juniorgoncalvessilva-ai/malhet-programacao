# 081 — Plano de 90 dias no padrão da programação mensal · inserir pela WBS

## O que muda
- Grade de 90 dias / 6 semanas no padrão da programação: Local (faixa vermelha) → Área (azul) → CWP → atividades em linhas
  alternadas (C5D9F1), com WBS, etapa (selo), item da PQ, equipe, quantidade, situação e as semanas à direita. Marcos no topo.
  `GET /planos` traz `wbs_codigo`, `cwp`, `item_pq`, `unidade` e `etapa`.
- **Inserir pela WBS**: árvore com caixas de marcar (área, CWP, grupo, IWP ou etapa), busca, marca "fora do cronograma";
  IWP com etapas entra como as etapas; itens fora do cronograma entram com a janela informada.

## Testes
`tests/test_criterios.py` (itens do plano com etapa e CWP, fora do cronograma) e `tests/test_plano_90.py`.
