# 002 — MONTAR completo: base PRAZO/CAPACIDADE, gargalo, predecessoras e distribuição diária

Contexto: aba MONTAR da planilha v5 + macros Reorganizar/Sequenciar/Atualizar. Skills: `model-modulo-api`, `spec-executar`.

## Negócio
- [ ] Linha de planejamento (`LinhaMontar`): atividade do cronograma OU item PQ, qtd projeto/realizado/restante, índice (seletor PADRÃO/ORÇADO/AJUSTADO/específico), base PRAZO|CAPACIDADE, equipe da frente, sequência, 2 predecessoras (TI/II + lag)
- [ ] Alertas iguais à coluna Alerta (SEM QUANTIDADE, SEM ÍNDICE, SEM EQUIPE, EQUIPE SEM <gov>, não termina no período)
## Backend
- [ ] Caso de uso `PlanejarPeriodo`: calendário → índice usado → capacidade (PRAZO: índice × equipe p/ prazo; CAPACIDADE: `capacidade_da_equipe`) → `sequenciar` → `producao_com_sequencia`/`distribuir_no_periodo` → gera `ItemProgramacao` (PE por dia) em rascunho
- [ ] `fator_familia` (aba FAMILIAS) como versão `INDICES` ou tabela própria
- [ ] Testes comparando 3 linhas reais da planilha (D1..Dn) com tolerância 0,01
## Frontend
- [ ] Tela "Montar" (grade tipo planilha) com busca área → atividade, alertas e botão "Sequenciar equipes"
