# Spec 047 — Filtro por encarregado e líder da equipe pelo efetivo

## Pedido
Na programação, um filtro por encarregado. Nas equipes, selecionar um engenheiro/supervisor do efetivo para liderar a
equipe e preencher o Responsável na programação.

## Entrega
- `equipe.responsavel_id` (FK colaborador, migração `0031`): ao salvar, o nome do líder vira `equipe.responsavel`
  (que já é o Responsável das linhas da programação sem responsável próprio). `EquipeOut.responsavel_efetivo`.
- Web Equipes: "Líder (engenheiro/supervisor do efetivo)" — engenheiros, supervisores, coordenadores, gerentes, mestres
  e encarregados gerais não desmobilizados (ou todo o efetivo); sem líder, o nome continua digitável.
- Web Programação (montar e impressão/vigente): `FiltroEncarregado` (`src/lib/programacao/encarregado.ts`) — só as
  linhas do encarregado (crachá/nome) ou "Sem encarregado"; áreas/locais vazios somem; soma do dia e HH da impressão
  pelo filtro.

## Teste
`tests/test_equipe_lider.py`.
