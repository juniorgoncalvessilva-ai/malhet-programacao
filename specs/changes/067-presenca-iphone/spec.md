# 067 — Presença no iPhone: link gravado no crachá, QR pela câmera e etiquetas

## Problema
No iPhone (Chrome ou Safari) a leitura NFC não funciona: a Apple não libera a Web NFC para nenhum navegador; só o
próprio iOS lê a tag (e só o link gravado nela). Também não há leitor de código de barras nativo no navegador do iPhone.

## Solução
- **Link no crachá**: `/m/presenca?c=CODIGO&m=nfc|qr` registra a presença ao abrir (o link some da barra). No iPhone,
  aproximar o crachá gravado com o link → notificação do iOS → a Presença abre e registra; código desconhecido abre o
  cadastro rápido (spec 065). `codigoLido` tira o código de dentro do link em qualquer leitura (NFC no Android, QR, campo).
- **Gravar o link nos crachás** (Chrome no Android, Web NFC `write`): em Efetivo › Crachá e rosto, "Gravar link nos
  crachás NFC" em sequência (aproxima, grava, próximo; pular). Código gravado = matrícula (ou crachá/código).
- **QR e código de barras pela câmera em qualquer celular**: sem o `BarcodeDetector` do navegador (iPhone/Safari), o
  leitor ZXing em JavaScript (`@zxing/browser`, carregado só quando precisa) lê QR, Code 128/39, EAN etc.
- **Etiquetas QR** para imprimir (4 por linha, com nome, matrícula, função e equipe): o QR é o link da Presença.
- Aba "Crachá" no iPhone explica as opções (link no crachá, Código pela câmera, Rosto) e o celular abre em "Código".

## Limites
- No iPhone cada crachá NFC passa pela notificação do iOS (um toque por pessoa); para fila grande, use a câmera
  (QR/código) ou o rosto. Câmera e NFC continuam exigindo HTTPS.
