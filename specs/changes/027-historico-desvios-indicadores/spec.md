# 027 — Histórico da programação, desvios (Pareto) e Indicadores

## Por quê
Gerar KPIs de programado × realizado × capacidade produtiva, apontar erro de programação e registrar o motivo de
cada item não cumprido no mesmo formato do Pareto semanal de desvios da obra.

## Histórico (`programacao_fato`, módulo `indicadores/`)
- Uma linha por linha da programação × dia, com o nome das dimensões copiado (equipe, encarregado, grupo, item,
  área, local, WBS): o histórico não muda se o cadastro mudar.
- **Emitir** grava a revisão (previsto, modo do previsto, capacidade do dia nas duas bases, sugestão do botão,
  HH previsto); a revisão anterior fica `vigente = false` (histórico de reprogramação).
- **Concluir** regrava a revisão vigente com o realizado, o HH da CPU (realizado × HH/un) e o HH da equipe
  programada (pessoas × jornada × fator do dia — o apontamento do Simova ainda está em implantação).
- Entram os dias com previsto, realizado, sugestão ou capacidade (a capacidade conta em todo dia útil do período).
- `registrar.py` recebe a visão congelada (foto), não os modelos do planejamento.

## Desvios (`desvio`, `causa_desvio`)
- Layout do Pareto semanal (aba Detalhamento): Dia · Semana · ID · Classificação · Desvio · Frente de serviço ·
  Ação · Responsabilidade · Responsabilidade-Gerência · Status (1 pendente, 2 em andamento, 3 concluído) ·
  Atividade impactada. Semana = numeração da obra (01/11/2026 = S31).
- Classificações por obra: nascem com as 30 do Pareto (`domain/causas.py`); editáveis; a importação cria as que
  faltam. Semeadura com `ON CONFLICT DO NOTHING` (telas pedem ao mesmo tempo).
- **Concluir exige causa**: cada linha com previsto > realizado precisa de pelo menos um desvio ligado a ela
  (`exigir_causas`). Desvio de programação concluída só muda por revisão.
- Importar `.xlsx` (aba Detalhamento): ocorrências repetidas contam (são recorrência); reimportar só traz o que
  passa da quantidade já existente por (dia, classificação, desvio, frente). Exportar no mesmo layout + aba Dados.

## Indicadores (`domain/kpi.py`; unidade = atividade = linha de uma programação)
PPC, aderência, carga (previsto ÷ capacidade; > 110 % sobre, < 70 % sub), erro de programação, erro de previsão,
realizado ÷ capacidade, eficiência de HH, por modo (capacidade × manual × ajustado), por encarregado, por semana,
Pareto e lista "fora da capacidade". Indicadores com realizado só usam programações concluídas. Todo número tem
memória de cálculo (`memorias` na resposta de `GET /indicadores`).

## API
`GET /indicadores?de&ate&encarregado&equipe_id&grupo&item_pq&area_id&modo` ·
`/desvios` (GET, POST, PUT/DELETE `/{id}`), `/desvios/causas` (GET, POST, PUT), `/desvios/programacao/{pid}`,
`POST /desvios/importar`, `GET /desvios/excel`.

## Telas
Programação (emitida/concluída): painel "Itens não cumpridos — motivo (Pareto)". Menu Programar: Desvios (Pareto)
e Indicadores.

## Testes
`tests/test_indicadores.py` (KPIs, leitura e importação do Pareto), `test_cpu_obra.py` (fluxo emitir → realizado →
desvio → concluir → indicadores), `test_programacao_simplificada.py` (concluir bloqueado sem causa).
