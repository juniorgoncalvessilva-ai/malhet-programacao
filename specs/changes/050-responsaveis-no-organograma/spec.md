# Spec 050 — Responsáveis (engenheiros) das equipes no organograma

## Pedido
Em Equipes, selecionar os responsáveis (engenheiros) no efetivo para representá-los no organograma, abaixo do dono
do setor.

## Entrega
- Equipes: "Responsável (buscar no efetivo)" com a busca em todo o efetivo (`BuscaEfetivo`, sem separar por função:
  um MOD pode liderar a equipe); mostra o atual e "tirar"; sem responsável do efetivo, o nome continua digitável
  (não vira caixa).
- Organograma: nível `responsavel` — Obra → Setor (dono) → **Responsável** → Disciplina → Equipe → Função (e
  Setor → Responsável → Frente → Área → Equipe na vista por frente). O responsável fica só na própria caixa (fora das
  funções e da contagem). Disciplina cadastrada que ficaria vazia no setor por estar abaixo do responsável sai (a de
  baixo herda cor e responsável). Cor própria do nível em Setores e cores.

## Teste
`tests/test_equipe_lider.py::test_responsavel_abaixo_do_dono_do_setor`.
