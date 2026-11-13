# 072 — Auditoria sem internet, sem risco de perder o registro

## Pedido
"Tanto isso [controle preventivo] quanto a auditoria precisa funcionar offline para garantir a velocidade, não pode
haver risco de perda das informações."

## Como funciona
1. **Registrar**: o formulário confere o modelo no próprio aparelho (`lib/auditorias/fila.ts::pendencias`, mesma regra do
   servidor), carimba as fotos (data/hora, frente, tipo) e grava **o registro inteiro com as fotos** na fila do IndexedDB
   (`lib/offline/fila.ts`, loja `fila` do banco `malhet-campo` v2) **antes** de qualquer envio.
2. **Enviar**: com internet, sobe na hora num envio único `POST /auditorias/registros/completo` (multipart: `dados` JSON,
   `momentos` antes/depois, `fotos`) que cria o registro, grava as fotos e finaliza — tudo ou nada. Sem internet, a tela
   diz "guardada no aparelho" e a pessoa segue para a próxima; o texto do WhatsApp sai do aparelho
   (`textoEnvio`, mesma regra de `texto_envio`) com "Nº a definir".
3. **Sincronizar**: `SincronizarFila` (no app de campo e no web) sobe a fila em ordem ao abrir, quando a rede volta e a
   cada 30 s. Cada registro tem `id_local` (gerado no aparelho, gravado em `auditoria_registro.id_local`, único por obra):
   se a resposta se perder e o envio repetir, o servidor devolve o registro já gravado (`repetido`), sem duplicar
   registro, foto ou ação 5W2H.
4. **Nada some sozinho**: pendente fica até o servidor confirmar; recusado (4xx de regra) fica guardado com o motivo
   (`FilaAuditorias`: Tentar de novo / Descartar com confirmação); enviado sai do aparelho 7 dias depois.
   Fotos guardadas como bytes (ArrayBuffer) — Blob no IndexedDB falha em alguns iPhones.

## Abrir sem internet
- Modelos, opções, frentes, registros e ações têm cópia no aparelho (`comCopia`, `networkMode: 'always'`).
- O service worker "aquece" as telas do campo uma vez por dia/versão (mensagem `aquecer`): guarda a página e os arquivos
  do build dela, então a tela abre sem rede mesmo que nunca tenha sido aberta.

## Base para a spec 073
A fila é genérica (`registrarEnvio(tipo, …)`): o etilômetro usa a mesma.

## Teste
`tests/test_auditorias.py::test_auditoria_feita_sem_internet_envia_de_uma_vez` (tudo ou nada, idempotência, momentos).
e2e: celular offline → registra → lista "esperando internet" → online → sobe com número e plano de ação.
