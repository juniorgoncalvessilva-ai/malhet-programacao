# 125 — Menu pelo ciclo da obra, busca de telas e módulos por obra

## Por quê
O menu tinha 6 grupos e ~40 telas; "Planejamento" sozinho tinha 13, misturando escopo, prazo e resultado, e a barra lateral não
rolava (as últimas telas ficavam fora da tela). A ideia do CorpMind era separar por "apps" (VisualPlan, PlanningControl, PA-GPL…);
não seguimos: nome de app fala do sistema, não do trabalho; a mesma tela (Efetivo) serviria a vários apps; e a força do Malhet é a
costura desenho → WBS → plano → programação → campo → indicador. O que a separação por app resolve — vender por contrato — vira
**módulo ligado/desligado por obra**, sem mudar a estrutura do menu.

## O que muda
- **Grupos pela pergunta de quem usa** (cores de etapa do design system):
  Projeto e escopo (o que vamos construir?) · Planejar (quando e com quem?) · Executar (o que está acontecendo hoje?) ·
  Medir e melhorar (como foi?) · Pessoas e equipes · Segurança (SSMA) · Configurar.
- **No máximo 6 telas por grupo**; "Configurar" (implantação: importações, frentes, catálogo, setores, de-para, crachá e rosto,
  acessos, menus, marca, armazenamento, exclusões) fica **recolhido e sempre no fim**, aberto quando a tela atual é dele, lembrando a
  escolha (`usePreferencia`). Nenhum endereço mudou — links salvos continuam valendo.
- **Busca de telas (Ctrl+K / ⌘K ou "Buscar" no topo)**: título, palavras de cada tela (take-off, PPC, RDO, ASO, P6…) e grupo, sem
  acento; setas + Enter; só as telas que a pessoa pode ver. Novo passo no tutorial.
- **Barra lateral rola.**
- **Módulos por obra** (`obras/domain/modulos.py`): Documentos e take-off · Plano 90 dias e 6WLA · Auditorias e 5W2H · SSMA ·
  Presença por crachá e rosto · Mobilização e vagas · Aderência financeira. Super admin liga/desliga em Obras e usuários
  (`obra.modulos_desligados`, `GET /admin/modulos`); `/obras/minhas` devolve `telas_desligadas` e elas somem do computador, do
  celular e do editor de menus (endereço digitado volta à vigente). Núcleo não desliga. Os dados ficam; religar devolve tudo.
  Não é trava de segurança da API — é contrato (trava por rota fica para quando houver cobrança).
- Ordem de `TELAS_WEB` segue os grupos (padrão do admin/planejador abre por Projeto → Planejar → …).

## Verificação
- `tests/test_modulos_obra.py`: nomes e ordem dos grupos, ≤ 6 telas (menos Configurar), Configurar recolhido, telas dos módulos
  existem (web e celular), núcleo nunca desliga, validação e o ciclo desligar/religar pela API. `test_menu_web.py` segue valendo.
- E2E: menu nos 7 grupos, Configurar abre, Ctrl+K "take" → Documentos e take-off (Enter navega), desligar Documentos e SSMA some
  do menu e `/app/documentos` volta à vigente, religar volta.
