# 112 — Excluir auditorias feitas e fotos do book (super admin ou habilitado), com histórico

## Por quê
Auditoria enviada (ou com ação 5W2H) não saía de jeito nenhum, e foto do book só saía por quem enviou ou pelo
Planejamento — sem registro. Registros errados (frente errada, duplicados, foto de outra obra) ficavam para sempre.

## O que muda (módulo `exclusoes/`)
- Quem exclui: o **super admin** e os profissionais que ele **habilitar** por obra (`exclusao_permissao`). Só o super admin
  habilita/desabilita (`PUT /exclusoes/permissoes/{usuario}`); a tela mostra a lixeira só para quem pode (`GET /exclusoes/eu`).
- `POST /exclusoes/auditorias/{id}` e `POST /exclusoes/fotos/{id}` exigem **motivo** (mín. 5 caracteres).
  - Auditoria: sai o registro e as fotos dele (antes/depois); a ação 5W2H aberta por ela **continua** (trabalho em
    andamento), sem o vínculo e com "— auditoria excluída" na origem.
  - Foto: sai do book (e o arquivo do servidor; no acervo da nuvem fica como histórico da obra).
- **Histórico** (`exclusao_registro`): tipo, resumo, **cópia dos dados** como estavam (inclusive as fotos e as ações
  mantidas), motivo, quem e quando. Também registra habilitar/desabilitar e as exclusões pelos caminhos comuns
  (foto apagada por quem enviou/Planejamento, rascunho de auditoria). `GET /exclusoes/historico?tipo=` para o super admin,
  o administrador da obra e os habilitados.
- Telas: botão "Excluir auditoria" no detalhe da auditoria (computador e celular), lixeira em cada foto do book, janela
  com motivo obrigatório (`ExcluirComMotivo`) e Administrar › **Exclusões** (`/app/exclusoes`): quem pode excluir
  (habilitar/desabilitar) e o histórico com a cópia de cada item.

## Aceite
- `tests/test_exclusoes.py`: regras; super admin exclui auditoria enviada com ação (ação mantida) e foto do book, com
  histórico; profissional sem habilitação não exclui, só o super admin habilita, habilitado exclui, desabilitar registra;
  exclusões pelos caminhos comuns também vão ao histórico.
- e2e: habilitar um profissional, excluir uma foto do book e a auditoria Nº 3 com motivo; o histórico mostra as três
  linhas e a cópia completa da auditoria.
