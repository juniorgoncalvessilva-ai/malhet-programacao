# 076 — Central de notificações

## Pedido
Local de alerta de notificações.

## O que muda
- `notificacao` (alerta da obra endereçado a papéis e/ou pessoas, gravidade info/atenção/crítico, tela do web e do celular,
  autor — quem causou não recebe —, chave para não repetir) e `notificacao_lida` (cada pessoa marca o que leu).
  `notificacoes/application.notificar(...)` é a linguagem publicada; falha nunca derruba a operação de quem chamou.
- Eventos: etilômetro reprovado na contraprova ou recusa (crítico → segurança/planejamento/admin); recusa e revogação do
  termo LGPD (segurança/admin); cadastro rápido pendente (gestão); ação 5W2H criada (gestão + segurança); programação
  emitida (todos).
- Super admin vê todas as notificações da obra (para testar — spec 077).
- Front: sino com contagem e as últimas no cabeçalho do web (`Sino`), página `/app/notificacoes`; no celular, sino no Início,
  contagem no botão Mais e `/m/notificacoes`; toque abre a tela do assunto e marca lida; "marcar todas". Contagem a cada 30 s.
  "Avisar neste aparelho": aviso do sistema com o app aberto (service worker `showNotification`, toque abre as
  notificações). Push com o app fechado (Web Push/VAPID) fica para depois.

## Testes
`tests/test_notificacoes.py`; e2e: sino web/celular, lista, abrir leva à tela do assunto.
