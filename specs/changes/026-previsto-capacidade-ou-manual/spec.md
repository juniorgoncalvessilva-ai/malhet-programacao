# 026 — Previsto pela capacidade ou manual (encarregado)

## Por quê
O planejador quer programar pela capacidade produtiva do item (CPU × equipe) ou aceitar o quantitativo do
encarregado (filling). Para depois medir **erro de programação × capacidade**, cada linha guarda como o previsto
foi feito e a capacidade que o sistema teria sugerido, mesmo quando o encarregado programa à mão.

## Regras
- Botões na programação (rascunho, papel encarregado+): **Pela capacidade** e **Manual (encarregado)**, por linha
  ou para todas.
- `programacao_linha.modo_previsto`: `capacidade` | `manual` (padrão) | `ajustado` (veio da capacidade e o
  previsto de algum dia foi alterado à mão).
- fator do dia = horas do dia ÷ 9 h (SEG–QUI 9 h, SEX 8 h, SÁB/DOM 0 h; na semanal a sexta e o sábado
  anteriores ficam com 0 h, como na planilha auxiliar) — `programacao/domain/previsto.py`.
- capacidade do dia = capacidade da linha (base da programação: equipe completa ou recurso que governa) × fator.
- previsto pela capacidade = capacidade do dia, somando até o limite: qtd do período; sem ela, o que resta do
  projeto antes do período; sem nenhum, sem limite. "Pela capacidade" substitui o previsto da linha.
- Linha sem capacidade (sem equipe, sem item da PQ/CPU, equipe sem quem governa) é pulada com o motivo.
- A visão devolve em `calc`: `fator_dia`, `horas_dia`, `capacidade_dia`, `capacidade_equipe_dia`,
  `capacidade_governa_dia`, `previsto_sugerido`, `total_sugerido`, `total_capacidade`, `limite_sugestao`.
- Memória de cálculo: `capacidade_dia:{i}` e `previsto_sugerido`.

## API
`PUT /programacoes/{pid}/modo-previsto {modo: capacidade|manual, linhas: [ids] | null}` →
`{aplicadas, puladas: [{linha, id, descricao, motivo}]}`.

## Testes
`test_motor_planilha.py::test_previsto_pela_capacidade_usa_fator_do_dia_e_para_no_limite`,
`test_cpu_obra.py::test_fluxo_cpu_calcula_hh_indice_capacidade_e_ft` (botões, ajustado, memória).

## Próximas (mesma demanda)
- 027: histórico (fato por linha × dia, gravado ao emitir e completado ao concluir) + desvios do Pareto.
- 028: página Indicadores (PPC, aderência, erro de programação × capacidade, Pareto).
