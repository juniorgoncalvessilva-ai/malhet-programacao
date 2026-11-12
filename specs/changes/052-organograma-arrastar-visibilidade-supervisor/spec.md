# Spec 052 — Organograma: funções, arrastar e soltar, visibilidade e supervisores

## Pedido
1) Migrar, incluir e deletar funções pelo organograma. 2) Arrastar e soltar um ou vários colaboradores entre equipes.
3) Visibilidade por função, engenheiro, líderes, frente de serviço e outras opções. 4) Líder intermediário
(supervisor) que une equipes, escolhido em todo o efetivo.

## Entrega
- API: `POST /equipes/membros/lote` {itens: [{cracha, de_equipe_id}], para_equipe_id|null} — move/inclui várias
  pessoas (ou tira, sem destino); o que não dá volta em `erros` (ex.: encarregado). `PUT /equipes/lideranca/definir`
  {equipes, papel: responsavel|supervisor, colaborador_id|null}. `equipe.supervisor_id` (migração `0032`),
  `EquipeOut.supervisor_efetivo`; formulário de Equipes com "Supervisor / líder intermediário" (busca no efetivo).
- Organograma: nível `supervisor` — Setor → Responsável → **Supervisor** → Disciplina/Frente → Equipe; supervisor só
  na própria caixa; disciplina vazia duplicada sai.
- Web (modo "Editar equipes"):
  - pessoas com caixa de seleção e arrastáveis (arrastar uma marcada leva todas as marcadas) para o cartão de uma
    equipe ou para "Sem equipe" (tira); barra da seleção: mover para…, tirar das equipes;
  - cartão da função: arrastável (leva a função inteira), "todas", "migrar função para…", "tirar função";
  - cartão da equipe: "+ pessoa" (busca no efetivo), "+ função" (escolhe a função e marca quem entra; sem equipe vem
    marcado), caixa "equipe" para definir responsável/supervisor de várias equipes de uma vez.
- Visibilidade (`src/lib/efetivo/visibilidade.ts`): filtros por setor, responsável, supervisor, disciplina, frente,
  área, equipe, encarregado e função; esconder níveis (responsáveis, supervisores, disciplinas, frentes, áreas,
  funções → pessoas direto na equipe) e os ramos "Sem equipe"/"Em mobilização"; contagens refeitas. Botões de nível
  por tipo de caixa (funcionam com ou sem responsável/supervisor).

## Teste
`tests/test_organograma_lote.py`; e2e: arrastar 2 marcadas para outra equipe, supervisor em 2 equipes, filtro por
função e funções escondidas.
