# 106 — Câmera parada no cadastro do rosto e janela de deploy sem relato

## Por quê
1. Na presença pelo rosto, quando aparece "Rosto não cadastrado" e o apontador vira o celular para escolher o nome,
   a câmera continuava lendo — inclusive o rosto do próprio apontador.
2. Os relatos E-43CFA2, E-F6D4EB, E-7BE0E0, E-2F2316, E-B2CA7B, E-B46EA7, E-C211E0 e E-8913FE eram todos 502/503 em
   consultas automáticas (`/mudancas`, `/notificacoes/contagem`, `/erros/resumo`, `/presenca/hoje`, `/obras/minhas`)
   no horário de deploy: a API reiniciando por alguns segundos. Não é defeito e poluía o painel de erros.

## O que muda
### Rosto (o mais barato em escala: nada roda no aparelho enquanto o cartão está aberto)
- `LeitorFacial` com `pausado`: o laço de leitura só dorme (sem `lerRosto`) e o `<video>` é pausado — o quadro do rosto
  lido fica congelado ao fundo, escurecido pelo cartão. Ao fechar, o vídeo volta e a leitura recomeça.
- `onDesconhecido(descritor, foto)`: `foto` é o recorte do rosto (URL de objeto, só em memória) mostrado como miniatura
  em `CadastroRosto` ("Rosto lido pela câmera"); a página revoga a URL ao fechar. A foto nunca é enviada nem guardada.
- Corrigido: a página passava `pessoas.filter(...)` novo a cada renderização e o leitor reabria a câmera a cada
  redesenho. Agora a lista é memorizada e o leitor lê a lista por ref (só reabre ao trocar de câmera/limite).

### Janela de deploy
- `lib/erros/relatar.ts`: 502/503 não viram relato nem aviso por até 90 s; cada resposta da API (qualquer status que
  não seja 502/503) zera a contagem (`apiRespondeu`, chamado por `client.ts`). Passou de 90 s sem resposta: um único
  relato "API indisponível há mais de N s" com o aviso "O servidor está fora do ar".
- 504 continua sendo relatado (tempo esgotado com a API no ar = rota lenta).
- Servidor: `Relato.transitorio` (tipo api, 502/503, ação `GET …`) é aceito e descartado — limpa a fila de aparelhos
  com versão antiga.

## Aceite
- Teste `test_janela_de_deploy_nao_vira_relato`.
- e2e (vídeo falso com rosto de amostra da biblioteca): cartão abre com miniatura, vídeo pausado e o mesmo quadro 8 s
  depois; ao fechar volta a tocar. 503 em `/mudancas` etc.: 0 relatos em 64 s, 1 depois de 90 s, não repete, zera ao voltar.
