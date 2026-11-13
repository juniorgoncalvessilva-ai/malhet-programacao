# 063 — Apropriação de presença: crachá (NFC/QR), rosto e lista, sem internet

## Pedido
Apropriar as pessoas no dia (inspirado no ADC do Malhet e no canvas "Presença da equipe"): ler o crachá ou o rosto,
saber quem está presente e, com a distribuição das equipes, ver a capacidade produtiva diária. Leitura rápida, sem
internet, guardada no celular e sincronizada em sequência. Página na mobilização para cadastrar rosto/crachá. Atalho no
centro do menu mobile, em destaque.

## Regras
- Presente no dia = pelo menos uma leitura da pessoa na data (vale a primeira: hora e meio). Ler de novo só avisa
  "já registrado" (não gera outro registro).
- Cada leitura nasce no celular com `id_local`; o envio é idempotente (reenviar a fila não duplica).
- Meios: `nfc` (crachá NFC: número de série da tag ou a matrícula gravada nela), `qr`/`codigo` (câmera ou leitor
  de código de barras Bluetooth/USB, que digita no campo), `facial`, `manual` (lista da equipe).
- Rosto (LGPD): só com consentimento registrado (quem e quando); guardamos **apenas o descritor de 128 números**, nunca a
  foto; apagar a qualquer momento. O reconhecimento roda no celular (modelos em `/models/face`); limiar 0,5 de distância
  e folga sobre o 2º mais parecido; duas leituras seguidas da mesma pessoa confirmam.
- Capacidade do dia: em cada linha da programação do dia, a mesma conta da equipe (gargalo da CPU) só com os membros
  presentes × fator do dia (`planejamento/application/servico.py::capacidade_com_presentes`); sem membros cadastrados = —,
  ninguém presente = 0.

## Implementação
- API (`app/modules/presenca`): `identificacao_pessoa` (código, NFC, descritor, consentimento) e `presenca_leitura`
  (migração 0034). Rotas: `GET /presenca/base` (pessoas com equipe, códigos, NFC e rosto — para o celular),
  `POST /presenca/leituras` (fila), `GET /presenca/dia` (por equipe: presentes, HH, por função, pessoas, linhas com
  capacidade programada × com os presentes), `GET/PUT /presenca/identificacoes`.
- Celular: `/m/presenca` (botão central "Presença" na barra), abas Crachá (Web NFC) | Código (campo + câmera
  BarcodeDetector) | Rosto | Lista; retorno grande (verde/amarelo/vermelho) + vibração e bipe; contador por equipe.
  Offline: base e leituras no IndexedDB (`src/lib/presenca/offline.ts`), envio em lotes (`sincronizar`) após cada leitura,
  ao voltar a rede e a cada 20–30 s em qualquer tela (`SincronizarPresenca`); service worker guarda as páginas do campo
  (rede primeiro), os arquivos do build e os modelos; sessão e lista de obras lembradas no aparelho para abrir sem rede
  (o servidor continua exigindo a sessão válida em cada chamada).
- Web: `/app/presenca` "Presença do dia" (com memória de cálculo do HH e da capacidade) e `/app/efetivo/identificacao`
  "Crachá e rosto" (código, ler NFC, cadastrar/apagar rosto com consentimento; avisa se o rosto parece com outra pessoa).
- Testes: `tests/test_presenca.py`.

## Limitações
- Câmera, NFC e o service worker exigem **HTTPS** (ou localhost). Pelo IP em http funcionam só o campo de código
  (digitação/leitor de código) e a lista, com fila no aparelho enquanto a página estiver aberta.
- Web NFC só no Chrome do Android; leitura de código pela câmera no Chrome do Android (BarcodeDetector).
