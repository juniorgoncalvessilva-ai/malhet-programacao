# 057 — Encarregado nas listas de equipe do organograma

## Problema
Ao migrar/mover colaboradores ou funções pelo organograma, as listas suspensas mostravam só o nome da equipe
(EQUIPE.10_FORMA…), difícil de reconhecer no campo.

## Solução
- `EdicaoOrganograma.equipes` passa a levar `encarregado` (nome do encarregado no efetivo; senão `encarregado_nome` sem a
  matrícula "115532 :: ").
- `rotuloEquipe` (`components/Obra/OrganogramaArvore.tsx`) monta "EQUIPE — Enc. NOME" (ou "— sem encarregado") e é usado
  em todas as listas de destino do organograma: migrar função, mover pessoa e "mover para a equipe…" da barra de seleção.
- Sem mudança na API.

## Aceite
- Em modo de edição, o dropdown "migrar função para…" lista "EQUIPE — Enc. NOME".
