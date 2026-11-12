# Spec 045 — Atualização em tempo real (sem recarregar a página)

## Pedido
Hoje é preciso recarregar a página para ver as alterações. Tudo deve se atualizar sozinho, com o dado real.

## Entrega
- API: `app/core/mudancas.py` — middleware soma 1 no contador da obra (X-Obra-Id) a cada POST/PUT/PATCH/DELETE com
  sucesso (fora auth e prévias); `GET /api/mudancas` devolve a marca (id do processo + contadores). Processo único
  (uvicorn sem workers); com mais de um, trocar por LISTEN/NOTIFY.
- Web: `src/lib/tempo-real` — `SincronizarDados` (Shell e app do celular) confere a marca a cada 3 s com a aba
  visível (e ao voltar para a aba); mudou → recarrega as consultas abertas. `useApi` recarrega tudo logo depois de
  cada post/put/del (quem salvou vê na hora). As logos (blob) não recarregam.
- Deploy novo: `next.config` grava `NEXT_PUBLIC_VERSAO` no build e `/api/versao` devolve a do servidor; diferente →
  recarrega a página (com formulário em edição, avisa com "Atualizar agora").

## Teste
`tests/test_mudancas.py`; e2e com dois navegadores: o segundo viu a atividade criada pelo primeiro em ~3 s.
