# 009 · CPU da obra (Composição de Custo Unitário) como base de todos os cálculos

## Por quê
A planilha auxiliar (abas RECURSOS/ÍNDICES) era uma cópia manual da CPU. A obra tem o relatório oficial
"COMPOSIÇÃO DE PREÇOS UNITÁRIOS" (.xls exportado do orçamento): é ele que deve alimentar HH, índice, recurso que
governa, capacidade da equipe e gargalo.

## Leitura do relatório (`referencias/domain/cpu_obra.py`)
- `Serviço da Planilha: 1.08.03.01.02 …` → item da PQ, normalizado para `1.8.3.1.2` (formato do take-off).
- `… - Composição: ESP.48.155` logo abaixo → composição principal do item; `Total do item` → custo unitário.
- Composição auxiliar só é detalhada na 1ª vez em que aparece → dicionário global de composições.
- Achatamento: h/un de cada função = Σ coef × quantidades da árvore de auxiliares. Linha em **HH** = mão de obra
  (MOD), em **H** = equipamento (EQU); a linha HH é a função (não abre "Servente" em hora normal/improdutiva/abono).
- Nome do recurso sem `*`, sem "Salário Hora -/Hora Normal -", maiúsculas → Capitalizado (casa com as equipes).
- Recurso que governa = oficial de maior h/un; servente, ajudante, auxiliar, encarregado… são apoio
  (sem oficial → maior MOD; sem MOD → maior equipamento).

## Cálculos (`planejamento/application/servico.py::calculo_linha`)
- HH do dia = quantidade × HH/un (soma da MOD da composição).
- Índice (un/dia por pessoa) = jornada ÷ h/un do recurso que governa; oficiais do dia = quantidade ÷ índice.
- Capacidade da equipe = jornada ÷ max(h/un da função ÷ quantidade na equipe) — gargalo; função que a CPU pede e a
  equipe não tem = apoio externo; sem o recurso que governa = capacidade zero.
- Alerta por dia quando o previsto passa da capacidade; FT recebe `HH_<DIA>`; impressão ganha coluna HH prev.

## Checklist
- [x] Importar .xls/.xlsx (`POST /importar/cpu`) → versão CPU vigente: `cpu_recurso`, `cpu_composicao`, `cpu_servico`
- [x] Rastreio `GET /cpu/item?item=` e lista de funções `GET /cpu/recursos`
- [x] Programação: cálculo por linha, HH por dia/total, capacidade e gargalo da equipe, alerta
- [x] FT com HH; impressão com HH previsto
- [x] Importações: bloco "CPU da obra" no lugar da planilha auxiliar + consulta de item
- [x] Equipes: criar equipe, incluir/remover função com nomes sugeridos da CPU
- [x] Testes: domínio (hierarquia, achatamento, auxiliar repetida, circular, governa), fluxo HTTP, arquivo real

## Evidência (10/11/2026)
- `pytest -q`: 31 passed. Arquivo real: 491 itens, 1.109 composições, 3.201 recursos.
- 1.8.3.1.2 (ESP.48.155, concreto fck 30): Pedreiro governa (1,3 h/m³ → 6,92 m³/dia), 4,658 HH/m³, custo R$ 1.002,68.
- Equipe 4 pedreiros + 6 serventes: capacidade 19,29 m³/dia (gargalo Servente); 35 m³ no dia → alerta;
  55 m³ na semana → 256,2 HH e R$ 71.254,14 na impressão.
