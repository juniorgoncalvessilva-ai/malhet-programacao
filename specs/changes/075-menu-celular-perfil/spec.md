# 075 — Menu do celular por perfil e por pessoa · página de perfil com avatar

## Pedido
Mudar o menu inferior do celular para facilitar o uso, personalizável de acordo com o perfil do usuário; um local para
personalizar o perfil e configurar telas e menu; página de profile com foto de avatar.

## O que muda
- **Barra de baixo** (`components/Mobile/BarraCampo.tsx`): até 4 atalhos + botão central em destaque + **Mais** (folha com
  todas as outras telas liberadas, Notificações com contagem, Meu menu, trocar obra, Sair). Nome curto na barra (`curto`).
- **Quem decide a barra**: ajuste da própria pessoa (`menu_mobile_pessoal`, por obra) → padrão do perfil/papel na obra
  definido pelo admin (`menu_mobile_perfil`, tela web **Menu do celular** `/app/menu-celular`) → padrão do sistema
  (`perfil/domain/menu.py::PADRAO` = `MENU_PADRAO` no front). A permissão continua valendo (papel + Acessos › Celular).
  Cópia no aparelho (`comCopia`) — abre sem internet.
- **Perfil** (`perfil_usuario`, da conta, sem obra_id como as tabelas do auth-kit): nome de exibição, telefone, avatar
  (recortado quadrado 256 px JPEG no servidor). Celular `/m/perfil` e web `/app/perfil` (`FormPerfil`, `MeuMenu`,
  `EditorMenu` com prévia da barra, ↑↓ e ★ para o centro). Avatar no cabeçalho do web, no Início e no Mais (`Avatar`).
- Rotas: `GET/PUT /perfil`, `PUT/DELETE/GET /perfil/avatar`, `GET /menu-mobile`, `PUT/DELETE /menu-mobile/meu`,
  `PUT/DELETE /menu-mobile/perfis/{papel}` (admin).

## Testes
`tests/test_perfil_menu.py`; e2e: barra padrão, Mais, perfil com foto, menu pessoal salvo mudando a barra.
