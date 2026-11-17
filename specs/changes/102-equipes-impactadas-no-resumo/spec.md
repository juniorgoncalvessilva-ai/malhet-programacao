# 102 — Equipes impactadas pelas ocorrências no resumo do dia

## Pedido
"Faltou as equipes impactadas pelas ocorrências. Crie mais um quadrante das equipes impactadas."

## Como funciona
- Novo quadrante **Quem foi impactado?** logo abaixo das ocorrências no resumo do dia (spec 101).
- Equipe impactada = a equipe da linha da programação da atividade impactada (`desvio.linha_id → programacao_linha.equipe_id`),
  agrupando as ocorrências de cada equipe: causa, descrição, status, atividade (com o código da área) e o não cumprido.
- Junto vai a presença da equipe no dia (presentes/total, a mesma do quadrante Equipes).
- Ocorrência sem linha ou com linha sem equipe conta em `sem_equipe` (a tela e o texto avisam).
- `GET /campo/resumo-dia` devolve `impactadas = {itens, total, ocorrencias, sem_equipe}`; texto `*EQUIPES IMPACTADAS (n)*`
  em `campo/domain/resumo_dia.py` (`_impactada`), entre Ocorrências e Restrições; parte escolhível como as outras.

## Aceite
- `tests/test_resumo_dia.py`: sem equipe na linha → `sem_equipe`; com equipe → equipe, área e texto na ordem certa.
