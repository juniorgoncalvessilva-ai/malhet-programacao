# Spec 141 — Erros do painel: "[object Event]", "network error" e chunk na página pública

## Problema (painel `/app/admin/erros`, 19–23/11)
- **E-834852 "[object Event]"** (Script, celular, `/m/lancar`): uma promessa rejeitada com um `Event` (imagem que não abriu,
  `FileReader`) virava o texto "[object Event]": sem pista de qual imagem nem de onde.
- **E-743165 / E-AA7E0E "network error"** (Tela quebrou, celular, `/m` e `/m/notificacoes`): é o Safari dizendo que a conexão
  caiu no meio da resposta. Não é defeito do Malhet, mas aparecia como "Esta tela não conseguiu abrir" e virava relato.
- **E-53CEBA "Loading chunk 8892 failed"** em `/en`: página pública não tinha `error.tsx`; o chunk de build antigo caía no
  erro geral e era relatado em vez de recarregar (specs 109/113).
- **500 em `POST /documentos/48/arquivo`, `POST /documentos/revisoes` (×11), `GET /documentos/pastas`**: anteriores à spec 138
  (leitura do desenho que derrubava o envio) e à janela de deploy — já corrigidos; marcar como resolvidos (se voltarem, o
  painel reabre como "voltou").

## Regra
1. `lib/erros/relatar.ts::descreverMotivo(reason)`: `Error` → mensagem e pilha; `Event` → `Evento "error" em <img> endereço`
   (data:/blob: viram "imagem em memória"/"arquivo do aparelho"; sem query string); objeto com `message` → ela; resto → JSON curto.
   `CapturaErros` usa nas promessas e no erro de script.
2. Imagens e `FileReader` do celular (`Fotos.tsx`, `MarcarFotoEditor.tsx`) rejeitam com `Error` ("Não consegui abrir a imagem").
3. `ehErroDeRede`: "network error", "Failed to fetch", "Load failed", "NetworkError when attempting…", `net::ERR_…` (ou sem
   rede e a mensagem fala de fetch/load). `relatarErro` não relata js/promessa/tela sem rede; `FalhaTela` mostra
   "Sem conexão — A internet caiu no meio do caminho", tenta de novo sozinha no evento `online`; `global-error` não relata.
4. `app/[locale]/error.tsx` (páginas públicas) usa `FalhaTela` com início `/`: chunk velho recarrega, sem rede avisa.
5. Servidor: `Relato.transitorio` também descarta js/promessa/tela com mensagem de rede (`SEM_REDE`) — aparelhos com a versão
   antiga na fila não enchem o painel. Relato manual nunca é descartado.

## Testes
- `tests/test_erros.py::test_rede_que_caiu_nao_vira_relato`.
- e2e: promessa rejeitada com Event de imagem vai à fila descrita; "Failed to fetch" não entra na fila.
