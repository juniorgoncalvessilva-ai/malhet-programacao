# 119 — Carimbo em toda foto, registrar atividade fora da programação e baixar foto

## 1. Carimbo de data e hora
Só as fotos de restrição, auditoria e ação 5W2H passavam por `carimbarFoto`; as de **Lançar o dia** e de **Ocorrência**
subiam sem a data/hora escrita. Agora o carimbo fica no envio (`useEnviarFoto`): toda foto sai com a data e a hora em que
foi tirada, as linhas do contexto (`extra.carimbo`: frente, atividade, "OCORRÊNCIA") e a obra. Foto que já passou por
`carimbarFoto` não é carimbada de novo. A miniatura mostra antes de enviar o que vai na foto.

## 2. Registrar atividade (fora da programação)
- Celular: `/m/lancar/registrar` (ícone de câmera), atalho no Início e no Lançar o dia ("Registrar atividade fora da
  programação"); vale para quem lança (encarregado+).
- Passos: **onde** (frente/CWA, lista com busca) → **o quê**: os IWPs da WBS daquela frente com grupo e CWP
  (`GET /campo/registros/opcoes`, filtro quando há muitos); "não está na lista" ou frente sem WBS → busca no item/descritivo da
  PQ; nada serve → só o texto → **o que foi feito** (texto livre, obrigatório) → **fotos** (pelo menos uma).
- `registro_atividade` (obra, data até 31 dias atrás, frente, IWP, item da PQ, texto do item na hora, descrição, quem).
  `POST/GET /campo/registros`, `DELETE` só sem fotos e por quem registrou ou o Planejamento. O IWP precisa ser da frente;
  o item da PQ precisa estar na PQ vigente.
- Fotos com alvo `registro`, carimbadas com "ATIVIDADE FORA DA PROGRAMAÇÃO", frente, item e o texto. Entram no book de
  fotos como atividade, marcadas "Fora da programação".

## 3. Baixar a foto
`GET /fotos/{id}/arquivo?baixar=true` devolve o original como anexo com nome `AAAAMMDD-HHMM-<frente>-<tipo>-<id>.jpg`.
Botão **Baixar** na foto ampliada do celular e no book (cartão e ampliada). No app nativo abre o compartilhar do celular
(Salvar imagem, WhatsApp), porque o WebView não salva download.

## Testes
`tests/test_registro_atividade.py`. E2E: atalhos, frente → IWP → foto → registro; filtro da WBS; item da PQ; foto baixada com
o carimbo e o nome; foto do Lançar o dia carimbada; book com "Fora da programação" e download.
