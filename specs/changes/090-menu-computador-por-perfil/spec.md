# Spec 090 — Menu do computador por perfil

## Pedido
"Igual fizemos o menu do mobile, para aparecer de acordo com o perfil de usuário precisamos fazer para o desktop, e
organizar o menu da sidebar com as funcionalidades de acordo com o perfil; aquilo que não estiver atrelado ao perfil não
deve aparecer."

## Regras
- Cada perfil (papel na obra) tem a lista ordenada de telas da barra lateral: o que o admin da obra definiu
  (`menu_web_perfil`, com `obra_id`) → o padrão do sistema (`perfil/domain/menu_web.py::PADRAO_WEB`).
- Tela fora do menu do perfil **não aparece** e o endereço direto volta para a Programação vigente (mesmo guarda da spec 033).
- Por cima: a permissão do papel (`TELAS_WEB`: PTO e Crachá e rosto = planejador+; ASOs, SSMA e LGPD = segurança/planejador/
  admin; Administrar = admin) — o editor só oferece as telas permitidas e a API recusa as outras; a lista por pessoa de
  Acessos e usuários ainda pode restringir mais.
- Sempre no menu: Programação vigente; para o admin, Acessos e usuários e Menus por perfil.
- Super admin vê tudo; "Testar como perfil" (spec 077) mostra o menu daquele perfil.

## Padrão do sistema
- Administrador: tudo. Planejador: tudo menos Administrar.
- Encarregado: vigente, programações, look-ahead, restrições, desvios, book de fotos, auditorias, 5W2H, controle preventivo,
  presença, equipes, organograma.
- Segurança: ASOs e treinamentos, SSMA da programação, controle preventivo, LGPD, auditorias, 5W2H, book de fotos,
  vigente, look-ahead, presença, efetivo, organograma (o grupo Segurança vem primeiro).
- Leitor: vigente, cronograma, plano de 90 dias, programações, look-ahead, restrições, desvios, indicadores, fotos, organograma.

## Barra lateral reorganizada
Grupos por área de trabalho: Planejamento · Campo e qualidade · Segurança (SSMA) · Efetivo e mobilização · Cadastros ·
Administrar. A ordem dos grupos e dos itens segue a ordem do menu do perfil (`menuDoPerfil`).

## API e telas
`GET /menu-web` (perfis: paginas, personalizado, permitidas), `PUT/DELETE /menu-web/perfis/{papel}` (admin).
Administrar › "Menus por perfil" (`/app/menu-celular`) com abas Computador (barra lateral) | Celular: marcar as telas de cada
perfil, subir/descer grupos, voltar ao padrão, "Ver como" (super admin). `useObra().menuWeb` + `podeVer`.

## Testes
`tests/test_menu_web.py` (urls do `menu.ts` = `TELAS_WEB`, padrões válidos, permissão, API, isolamento) e e2e.
