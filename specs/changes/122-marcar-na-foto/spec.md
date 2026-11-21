# 122 — Marcar na foto (Excalidraw)

## Por quê
Foto de campo mostra a frente, mas não diz onde está o problema. O encarregado precisa circular a trinca, apontar a
interferência ou escrever "falta escoramento" antes de enviar.

## Decisão
- Biblioteca `@excalidraw/excalidraw` 0.18.1 (MIT, ativa). Escolhida na avaliação da lista de projetos open source
  (ver "Avaliação" abaixo).
- Cada foto tirada e ainda não enviada ganha um **lápis** (`BotaoMarcar`) em `TirarFotos` (atividade, ocorrência,
  restrição, auditoria, ação 5W2H, etilômetro, registro de atividade) e em `FotosAtividade` (`/encarregado`).
- O lápis abre por cima da tela o editor (`MarcarFotoEditor`): a foto entra **travada** no fundo, já com o traço à mão
  vermelho escolhido; dá para circular, seta, retângulo, texto, apagar e desfazer. **Usar** devolve a foto do mesmo
  tamanho com a marcação (o que passar da borda é cortado); sem nenhuma marcação, a foto fica como estava.
- O momento da foto é mantido (`momentoDaFoto`): o carimbo de data/hora, frente e logo entra depois, no envio, por cima.
- O Excalidraw só é baixado quando a pessoa toca no lápis (`next/dynamic`). As fontes vêm do próprio Malhet
  (`public/excalidraw/fonts`, copiadas do npm no build por `scripts/copiar-excalidraw.mjs`, fora do git) e o service worker
  guarda `/excalidraw/` e os arquivos do build: depois de aberta uma vez com internet, a marcação funciona offline.

## Avaliação dos projetos da lista (licença conferida na busca do GitHub em 21/11/2026)
| Projeto | Licença | Uso no Malhet |
|---|---|---|
| excalidraw/excalidraw | MIT | **adotado** (esta spec) |
| sgasser/pasteguard | Apache-2.0 | regra para qualquer recurso de IA com dados do efetivo |
| AmoabaKelvin/logdeck | GPL-3.0 | logs/alertas leves dos containers (serviço separado) |
| openobserve/openobserve | AGPL-3.0 | observabilidade completa quando houver mais obras (serviço separado) |
| workersio/breakscale | MIT | teste de carga antes de crescer (o link da lista, xevrion/breakscale, não foi achado) |
| presenton/presenton | Apache-2.0 | apresentação narrativa da reunião semanal (a .pptx no modelo do cliente continua) |
| melgarafael/DeskcommCRM | MIT | referência para lançar pelo WhatsApp |
| kenryu42/cc-safety-net | MIT | desenvolvimento (bloqueia comando destrutivo do agente) |
| generalaction/emdash, Maxteabag/sqlit, vercel-labs/agent-browser | Apache-2.0 / MIT / Apache-2.0 | desenvolvimento |
| langgenius/dify | outra (restringe SaaS multiempresa) | não adotar |

## Testes
E2E no celular: registro de atividade → lápis → traço sobre a foto → Usar → registrar → foto baixada com a marcação em
vermelho, o carimbo e a logo; nenhuma fonte buscada fora do Malhet.
