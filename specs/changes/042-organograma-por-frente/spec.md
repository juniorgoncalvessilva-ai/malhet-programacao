# Spec 042 — Organograma por frente de trabalho

## Pedido
Visualização do organograma pela frente de serviço, com a estrutura das frentes abaixo do dono do setor:
Gerente → Dono do setor → Frente de trabalho → Equipes.

## Entrega
- `GET /efetivo/organograma?vista=frente`: Obra (gerente = responsável geral) → Setor (dono = responsável) → Frente
  (Local das Frentes) → Área → Equipe → Função. Disciplinas ficam só na vista por setor. Equipe sem frente →
  "Sem frente" dentro do setor. Mesmas pessoas e contagens da vista por setor.
- Frente da equipe (`efetivo/api/router.py::frentes_das_equipes`): a escolhida no cadastro da equipe
  (`equipe.frente_codigo` = código da área ou do local); sem ela, a área mais frequente da equipe na programação mais
  recente em que aparece.
- Níveis `frente`/`area` com cor configurável (Setores e cores); por padrão herdam a cor do setor.
- Web: Organograma com "Por setor | Por frente de trabalho" (lembrado no navegador), níveis Setores/Frentes/Áreas/
  Equipes/Funções; em Equipes o campo "Frente de trabalho" virou lista Local → Áreas.

## Teste
`tests/test_efetivo.py::test_efetivo_equipes_simova_depara_organograma` (Sem frente → Local → Área → Equipe).
