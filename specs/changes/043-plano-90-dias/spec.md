# Spec 043 — Plano de 90 dias, 6 semanas e pull planning (limpar restrições → programação)

## Pedido
Programação de 6 semanas, 90 dias e pull planning da obra, onde seja possível limpar as restrições. Foco nos 90 dias:
migrar as atividades pensadas para a programação mensal e semanal e tratar as restrições alimentando o Restrições (6WLA).
Também: aba do navegador "Contratada | Obra" com o ícone da contratada.

## Entrega
- Módulo `planos/`: `plano_item` (P90-0001: atividade pensada ou marco; área, IWP da WBS ou área + tipo, equipe,
  janela, quantidade, marco que a puxa, análise de restrições). Migração `0029`.
- Situação derivada (`planos/domain/plano.py`): a analisar → com restrição → liberado → programado.
- Restrições: `POST /planos/itens/{id}/restricoes` cria a ação no Plano de Ação (6WLA, referência = código do item,
  área e equipe do item, `acao_restricao.plano_item_id`); `POST /planos/restricoes/{aid}/limpar` conclui/cancela;
  concluir no próprio 6WLA também libera o item. "Analisado, sem restrições" libera sem ação.
- Puxar da WBS (`/planos/itens/da-wbs`): cada IWP abaixo do nó vira item (datas do P6 quando vazias).
- Levar à programação: `GET /planos/migrar/{pid}` (itens do período + quantidade sugerida proporcional aos dias,
  com memória de cálculo) e `POST /planos/migrar` (linha da programação com `plano_item_id`). Semanal: só item sem
  restrição pendente; mensal: entra com aviso. Não duplica.
- Web `/app/plano` (Programar → Plano de 90 dias): abas 90 dias (13 semanas em barras por área, marcos ◆),
  6 semanas (make-ready com restrições pendentes e prazo), Pull planning (por marco, atividades puxadas, alerta se
  termina depois do marco) e Levar à programação; detalhe com restrições (levantar, limpar, cancelar).
- Aba do navegador: `TituloAba` (`components/Obra/LogosObra.tsx`) → "Contratada | Obra" (nome em Marca da obra,
  `PUT /obra/marca/nomes`; sem nome = Malhet) e favicon = logo da contratada (sem logo = Malhet).

## Teste
`tests/test_plano_90.py` (domínio, restrição → 6WLA, semanal bloqueia / mensal avisa, limpar → semanal, sem
duplicar, marco solto ao excluir, nomes da marca).
