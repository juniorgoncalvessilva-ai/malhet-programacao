# 114 — Líder sem equipe reivindica a equipe; Planejamento/ADM aprova

## Por quê
Encarregado que ainda não tem equipe no Malhet não tinha o que fazer no link. Ele sabe quem está com ele — mas a
equipe só deve valer depois que o Planejamento conferir.

## O que muda
- Entram no link também as pessoas com **função de liderança** no efetivo (`funcao_de_lider`: encarregado, líder, mestre,
  supervisor, feitor), mesmo sem equipe.
- Sem equipe (ou "Formar outra equipe"): o líder informa a **disciplina**, aponta as pessoas (matrícula ou nome, mostrando
  em que equipe estão hoje) e uma observação → **pedido pendente** (`lider_pedido_equipe`). Reenviar corrige o pendente;
  dá para cancelar. Nada muda nas equipes até a aprovação. O Planejamento é avisado no sino (abre Acesso dos líderes).
- Acesso dos líderes › "Quem está pedindo equipe?": o Planejamento/administrador confere (quem sai de qual equipe) e
  **aprova** — cria a equipe no padrão de nome da obra (spec 107, editável), o líder como encarregado, e traz as pessoas
  pelo `Alocador` (saem da outra equipe, histórico "aprovado por …") — ou **recusa com motivo**, que o líder vê no link.
- Rotas: `POST/DELETE /portal/{codigo}/pedidos`, `GET /lideres/pedidos`, `POST /lideres/pedidos/{id}/aprovar|recusar`.

## Aceite
`tests/test_portal_lider.py::test_reivindicar_equipe_com_aprovacao`; e2e: encarregado sem equipe (115052) entra, monta a
equipe com 2 pessoas, envia; o Planejamento aprova e o link mostra EQUIPE.24_TERRAPLENAGEM com as 2 pessoas.
