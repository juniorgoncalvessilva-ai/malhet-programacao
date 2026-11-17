# 104 — Aderência física e financeira da programação semanal + apresentação no modelo da contratada

## Pedido
"Representação visual para análise da aderência física e financeira da programação semanal, no modelo em anexo
(apresentação S32 da Cardan). Não temos as semanas anteriores: tomar os valores apresentados como reais. Da S33 temos a
área do CMD e vamos acrescentar as demais. Manter exatamente o layout, importar os fundos e transformar em padrão das
apresentações da empresa." No futuro (plano de 90/30 dias) a meta financeira do mês e os comparativos.
Junto (pedido no meio): coluna financeira (R$) no "Resumo por frente e responsável", em previsto e real.

## Regras (`aderencia/domain/aderencia.py`)
- Financeiro da linha = quantidade × PU do item da PQ (etapa: PU × peso; sem avanço = 0). Responsável = o da linha.
- Por semana × responsável: programado, realizado, saldo = realizado − programado, aderência financeira = realizado ÷
  programado; física = atividades cumpridas (realizado ≥ previsto) ÷ programadas (só semanas do sistema).
- Semana N: anteriores (≤ N−2, últimas 4 por responsável + acumulado), ranking pelo programado acumulado, semana
  anterior (N−1), meta da semana N (participação, avanço previsto = meta ÷ valor do contrato, Σ qtd × PU da PQ) e
  marcos prioritários (maiores valores até 80% da meta, no máx. 8, por frente).
- Semana com programação semanal emitida/concluída no sistema usa o sistema; sem ela, o histórico.

## Histórico e modelo
- `POST /aderencia/importar` (.pptx): `ler_historico` lê os blocos "1º NOME" + linhas "S27 | programado | realizado"
  (lado a lado), a semana anterior ("Semana 31" + PLANEJADO/REALIZADO) e a meta ("META FINANCEIRA", só programado) →
  `aderencia_historico` (semana × responsável, chave sem acento). O arquivo vira o modelo da obra (`apresentacao_modelo`,
  arquivo tipo `modelo-apresentacao`, pasta 80-modelos). Obra sem modelo usa o de outra obra da mesma contratada
  (`marca_obra.nome_contratada`) — padrão da empresa. Nada do arquivo vai para o git.
- `PUT/DELETE /aderencia/historico/{semana}`: digitar/corrigir/apagar uma semana.

## Apresentação (`aderencia/application/apresentacao.py`, python-pptx)
- Do modelo ficam mestre e layouts (fundo, rodapé laranja, logos, nº da página), capa (obra e "SEMANA N" trocadas),
  divisória e encerramento (obra trocada). Os slides de dados de referência saem; entram, no layout de conteúdo, as
  folhas redesenhadas com as posições/cores/fontes medidas no modelo: semanas anteriores por engenheiro (2×2),
  ranking, semana anterior (com aderência física quando há), panorama da meta e marcos (2 por folha).
  Slides mantidos ganham nomes internos altos (sem colidir com os novos).
- `GET /aderencia/apresentacao?semana=N` → `Aderencia_semanal_SN.pptx`. Sem modelo: 16:9 em branco com o mesmo desenho.

## Tela
- `/app/aderencia` (Planejamento › Aderência semanal; `TELAS_WEB`): semana, Apresentação (PPTX), Importar apresentação;
  indicadores (meta, avanço, aderência financeira/física da anterior, acumulado) com memória; ranking com as semanas;
  semana anterior; meta com marcos; evolução semana a semana com origem (sistema/histórico) e edição do histórico.
- `ResumoProgramacao`: coluna R$ (previsto e realizado) com a conta qtd × PU de cada linha.

## Aceite
- `tests/test_aderencia.py`: formatação, leitura (blocos lado a lado, semana anterior), painel, marcos, importação +
  sistema + apresentação (capa/encerramento/folhas), correção manual, modelo herdado da contratada.
- e2e: apresentação S32 da obra importada no banco local (restaurado depois): S27–S31 e meta S32 lidas, totais conferidos;
  tela e download do .pptx; render das folhas comparado ao modelo.

## Depois
- Meta financeira do mês e comparativos a partir do plano de 90/30 dias.
- Slide "Comparativo de efetivo Vale × Cardan" (precisa do previsto do cliente por função).
