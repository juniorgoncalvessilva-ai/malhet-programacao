# Spec 023 — Programação concluída não muda: só por revisão

## Regra
Fluxo **rascunho → emitida → concluída**.
- `POST /programacoes/{id}/concluir` (planejador, só emitida): congela a foto (`programacao_conclusao`, nº 1, 2…).
- Concluída: nada muda — previsto, realizado, quantidade do período, linhas (incluir/editar/excluir, PTO), SSMA,
  reabrir e excluir a programação respondem 422 (`servico.exigir_aberta`).
- `POST /programacoes/{id}/revisar {motivo}` (planejador, motivo obrigatório ≥ 5 caracteres): registra motivo, quem e
  quando na conclusão vigente e volta para **emitida** (realizado aberto; para mexer no previsto, reabrir). Ao terminar,
  concluir de novo gera a conclusão seguinte. A foto de cada conclusão fica em `GET /programacoes/{id}/conclusoes/{n}`.
- Visão traz `conclusoes` (histórico). Migração `0016_conclusao`.

## Tela
Botões Concluir (com confirmação) e Revisar (formulário de motivo); selo "Concluída"; histórico de conclusões e
revisões; campos travados; SSMA só leitura quando concluída; listas mostram "Concluída".
