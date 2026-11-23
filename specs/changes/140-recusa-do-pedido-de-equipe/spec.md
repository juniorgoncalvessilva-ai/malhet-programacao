# 140 — Recusa do pedido de equipe volta para o líder

## Pedido (usuário, 23/11/2026)
"Ao ser recusado deve sair [da lista de] ação e retornar para o solicitante que seu pedido foi recusado e deve fazer uma nova
solicitação." (Acesso dos líderes › "Quem está pedindo equipe?", spec 114)

## O que muda
- Acesso dos líderes (`PedidosEquipe`): o pedido decidido sai da lista na hora (aprovado ou recusado, sem esperar recarregar); o
  botão é "Recusar e devolver ao líder" (pede o motivo, mín. 5 letras, com dica) e o aviso diz que o líder vê o motivo e faz uma
  nova solicitação. A API já tirava o recusado da fila (`situacao = recusado`).
- Link do líder (`PortalLider`): com o último pedido recusado aparece o quadro "Seu pedido foi recusado em dd/mm · Motivo: … · Faça
  uma nova solicitação"; o formulário já vem com a disciplina e as pessoas do pedido recusado para corrigir e "Enviar nova
  solicitação". Líder que já tem equipe e pediu outra vê o mesmo aviso no topo com "Fazer uma nova solicitação".

## Verificação
`tests/test_portal_lider.py`: depois de recusar, a fila do Planejamento fica vazia, o líder vê `recusado` com o motivo e um novo
pedido entra como pendente.
