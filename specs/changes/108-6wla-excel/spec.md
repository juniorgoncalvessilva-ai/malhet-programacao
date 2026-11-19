# 108 — 6WLA (Sessão de Look Ahead) em Excel no layout da obra

## Por quê
A reunião de 6WLA usa a planilha "Filtragem … 6WLA" (aba "CRONOGRAMA 6WLA"): as atividades do cronograma P6 na
estrutura da WBS, as semanas corrente + 1ª a 6ª marcadas em azul-escuro e as restrições por 6M (Ishikawa). Ela era
montada à mão a partir do export do Primavera. O Plano de 90 dias já tem o cronograma, o plano e as restrições.

## Decisões (com o usuário)
- Linhas = **cronograma + plano**: todas as atividades do cronograma vigente que cruzam as 7 semanas, na WBS do P6, mais
  as do Plano de 90 dias que não aparecem no cronograma nessas semanas (grupo "PLANO DE 90 DIAS — NO PLANO, FORA DO
  CRONOGRAMA NESTAS SEMANAS").
- Linha de base escolhida na exportação entre as versões importadas do cronograma (padrão: a primeira).

## O que muda
- `planos/domain/seis_semanas.py`: janela (domingo da semana corrente + 6 semanas; `numero_semana`, a mesma numeração
  da aba "Dados - Semanas" — 12/04/2026 = S2), linhas-título da WBS com início/fim/avanço (média pela duração),
  variação = término da BL − término atual (como o P6), 6M = restrições pendentes (0 = levantada e resolvida).
- `planos/application/seis_semanas.py`: coleta (cronograma vigente, plano, linha de base pelo Activity ID, restrições
  pelo item do plano ou pela coluna ID do Plano de Ação; canceladas não contam) e o Excel:
  colunas B…AF iguais à planilha da obra (Local, Activity ID, Activity Name, % / Status, Start, Finish, BL, Variance,
  Indicador de Aderência, BL Semana, Semana Início/fim, Semana DD Cronograma, Semana Corrente, 1ª–6ª Semana, MÉTODO…
  MEIO AMBIENTE), mesmas fórmulas (PROCV na aba "Dados - Semanas"; `=SE(E(S$3>=$Q4;S$3<=$R4);"1";"")`), "1" pintado de
  azul-escuro 002060, títulos da WBS em amarelo/azul-escuro/azul-claro, semáforo no indicador, 6M vermelho/verde,
  logos da obra, filtro, painéis congelados, A3 paisagem.
- Rotas `GET /planos/seis-semanas/versoes|previa` e `GET /planos/seis-semanas.xlsx?referencia=&base_id=`.
- Tela: Plano de 90 dias › aba 6 semanas › "Quer levar o 6WLA para a reunião?" (`components/Plano/Exportar6wla.tsx`):
  semana, linha de base, prévia com memória e "Exportar 6WLA (Excel)".
- Dia da obra: `app/shared/tempo.py::hoje_local()` (Brasília). O servidor roda em UTC; entre 21h e meia-noite o
  `date.today()` já era o dia seguinte — corrigido no Resumo do dia, no "hoje" do app de campo e no 6WLA (achado pelo
  `test_resumo_dia` rodando às 22h).

## Aceite
- `tests/test_seis_semanas.py` (janela, WBS, semanas, BL/variação, 6M, Excel com cabeçalhos/fórmulas/cores/Dados - Semanas).
- e2e: tela mostra S33 a S39, 794 atividades (783 do cronograma, 11 do plano), baixa 6WLA_S33_a_S39.xlsx; render no
  LibreOffice conferido com a planilha da obra.
