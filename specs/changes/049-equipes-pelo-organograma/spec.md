# Spec 049 — Incluir, mover e tirar pessoas das equipes pelo organograma

## Pedido
Acrescentar, migrar ou excluir profissionais das equipes pelo organograma.

## Entrega
- Organograma: nó de equipe com `ref` (id da equipe); pessoa com `equipe_id` e `papel` (membro | encarregado);
  sem equipe / em mobilização levam crachá (ou matrícula).
- API (planejar): `POST /equipes/{id}/membros` {cracha, nome?, de_equipe_id?} — inclui (nome e função do efetivo;
  fora do efetivo exige o nome) ou, com `de_equipe_id`, move; `DELETE /equipes/{id}/membros/{cracha}` — tira (a pessoa
  fica no efetivo, em "Sem equipe"). Encarregado só muda no cadastro da equipe; repetido não entra.
- Web: "Editar equipes" no Organograma (planejador): na lista de pessoas de cada função, "Mover" (escolhe a equipe) e
  "Tirar" (com confirmação); em "Sem equipe"/"Em mobilização", "pôr na equipe…"; no cartão da equipe, "+ pessoa" com a
  busca no efetivo (`BuscaEfetivo`). A árvore mantém o que está aberto quando os dados recarregam (só uma nova busca
  reabre pelo nível).

## Teste
`tests/test_organograma_edicao.py`.
