# 100 — Super admin altera a numeração das revisões

## Pedido
"Opção do Super Admin de alterar a revisão da programação, para não poluir o arquivo impresso."

## Como funciona
- Painel **Revisões emitidas** (só super admin, `RevisoesProgramacao.tsx`): cada revisão tem o campo
  "nº no documento"; **Salvar numeração** grava o que mudou; **Numerar em sequência (0, 1, 2…)** aparece quando há
  buracos (revisões excluídas ou de teste).
- `PUT /programacoes/{pid}/emissoes/numeracao` `{mapa: {atual: novo}}` ou `{sequencial: true}` — só super admin.
  Regras (`planejamento/domain/revisoes.py`): número de 0 a 999, sem repetir, e a ordem não muda (a emitida depois tem
  número maior — é ela a vigente).
- `servico.renumerar_emissoes`: troca em duas passadas (números temporários) para permitir 2 ↔ 1; atualiza a foto de cada
  emissão (`revisao`, e guarda `revisao_original`), o histórico dos indicadores (`programacao_fato.revisao`) e a foto
  da conclusão; a próxima emissão continua do maior número. O conteúdo das revisões não muda.
- A lista de emissões mostra "(emitida como rev. N)" quando foi renumerada.

## Aceite
- `tests/test_item_pq_revisoes.py`: rev. 3 → 1 (foto, fatos, vigente e próxima emissão), ordem invertida recusada,
  sequência tira buracos, admin da obra recebe 403.
