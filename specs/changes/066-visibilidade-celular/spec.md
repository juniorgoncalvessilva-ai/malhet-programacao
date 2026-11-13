# 066 — Visibilidade do celular por pessoa (Acessos)

## Pedido
No controle de acesso, escolher as telas e os itens do menu do celular (app de campo) que cada pessoa vê.

## Solução
- `acesso_obra.paginas_mobile` (migração 0037), separada das páginas do web (`paginas`): nenhuma marcada = todas as telas
  que o papel permite; **Início** e **Programação** ficam sempre abertos. `PUT /obras/{id}/acessos/{aid}/paginas` aceita
  `paginas_mobile` (e `so_mobile` para mudar só o celular); `GET /obras/minhas` devolve `paginas_mobile`.
- Telas do celular em `src/components/Mobile/menu.ts` (`MENU_MOBILE`): Lançar, Presença, Ocorrências, Restrições,
  Pendências (barra) e Auditorias e Ações 5W2H (atalhos do Início), cada uma com o papel mínimo (Auditorias/Ações também
  para a Segurança).
- `useObra().podeVerMobile(url)`: papel + lista da pessoa. A barra de baixo mostra só as liberadas (colunas se ajustam), os
  atalhos do Início e os botões do detalhe da atividade também; abrir uma tela não liberada volta para o Início.
- Acessos e usuários: no quadro "Páginas" da pessoa, a seção **Celular (app de campo)** com as telas (descrição e papel
  mínimo); "Só a programação vigente" fecha web e celular; "Liberar todas" volta a valer o papel.
- Como no web, a lista controla o que aparece; as regras de papel continuam valendo na API.
- Teste: `tests/test_auth.py::test_telas_do_celular_por_pessoa`.
