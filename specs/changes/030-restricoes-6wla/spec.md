# 030 — Restrições do look-ahead, Ishikawa (6M) e Plano de Ação 6WLA

## Modelo (`acao_restricao`) = aba Ações do Plano de Ação
Nº · ATIVIDADE · IMPEDITIVO · AÇÕES · SEMANA (calculada) · ÁREA (texto + área da obra quando casa) · ID · REUNIÃO ·
RESPONSÁVEL · GERÊNCIA · PRAZO início/término · REPROGRAMADO data/nº · CONCLUSÃO · STATUS 1 · FAROL · STATUS 2 · 6M ·
OBSERVAÇÕES; vínculos opcionais com linha da programação e equipe (vindos do cartão do look-ahead).

## Fórmulas (portadas das colunas G, S e T — `restricoes/domain/acao.py`)
- semana = da data reprogramada; sem ela, a do término (numeração da obra, 01/11/2026 = S31 — igual à planilha).
- farol 4 concluído · 2 reprogramado (hoje ≥ término e ≤ reprogramado) · 1 atrasado (hoje ≥ término) · 3 no prazo.
  Como na planilha, no próprio dia do término já conta atrasado. Cancelado não tem farol.
- Reprogramar guarda a nova data, soma 1 no nº e põe o motivo nas observações; o prazo original fica.

## Ishikawa
`GET /restricoes/ishikawa`: pendentes por 6M (MDO, MET, MAT, MAQ, MAB, MED, não classificado), por status,
gerência, área, responsável e semana, cada número com memória (lista das ações).

## Planilha
- `POST /restricoes/importar`: .xlsm/.xlsx, aba Ações (cabeçalho achado pelo texto); reimportar atualiza pelo Nº.
- `GET /restricoes/excel`: aba Ações no mesmo layout (C..V), FAROL e STATUS 2 por fórmula com HOJE(), listas de
  validação (STATUS 1, 6M, IMPEDITIVO), filtros e painel congelado; aba PAINEL AÇÃO com as contagens (no lugar das
  tabelas dinâmicas).

## Testes
`test_motor_planilha.py` (farol), `tests/test_restricoes.py` (importar, reprogramar, Ishikawa, Excel),
`test_cpu_obra.py` (restrição marcando o cartão do look-ahead).
