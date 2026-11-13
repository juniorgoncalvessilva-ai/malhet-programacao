# 077 — Super admin testa tudo

## Pedido
Para o perfil super admin, configurar o menu para que ele possa testar tudo.

## O que muda
- Super admin vê todas as telas no web e no celular (barra + Mais com tudo) e todas as notificações da obra.
- **Testar como perfil** (Mais do celular, menu da conta no web, botão na tela Menu do celular): escolhe Administrador,
  Planejador, Encarregado, Segurança ou Leitor e o app passa a mostrar menus, telas e ações daquele papel (sem as listas
  de páginas por pessoa). Faixa "Testando como …" com "sair do teste" (`AvisoTeste`/`FaixaTeste`). Fica na aba
  (sessionStorage). Só a tela muda — o servidor continua tratando como super admin (`ObraProvider.simulando/simular/superadminReal`;
  `GET /menu-mobile?papel=` devolve o menu do perfil testado).
