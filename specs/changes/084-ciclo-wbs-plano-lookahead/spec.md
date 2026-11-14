# 084 — Ciclo WBS → plano de 90 dias → programação → look-ahead

## Pedido
1. Associar o cronograma na própria WBS de execução (lá já vem a estrutura do cronograma e nascem os itens novos).
2. Plano de 90 dias: puxar da programação corrente e, na WBS, "Enviar para o plano de 90 dias" — fechar o ciclo e
   alimentar as 6 semanas. Manter "Puxar do cronograma" (certo para cronograma que muda pouco).
3. Ao clicar na atividade do plano, as restrições abrem logo abaixo dela (não no fim da tabela).
4. Look-ahead das equipes com seletor para ver o caminhar das equipes no período de 90 dias.

## Como ficou
### WBS de execução (`/app/wbs`)
- Botão **Associar cronograma**: cada IWP/etapa mostra o ID ligado (com "trocar") ou as sugestões de `GET /wbs/associacao`
  (um clique liga; "buscar…" abre a busca do cronograma da área logo abaixo do nó); faixa com quantos estão ligados,
  "só os sem ID" e "Aceitar a 1ª sugestão de todos". `/app/wbs/associacao` virou atalho para `/app/wbs?associar=1`
  (item saiu do menu).
- Botão **Enviar ao plano 90 dias** com os nós marcados (vão os IWPs/etapas abaixo): janela opcional (vazia = datas da
  atividade do cronograma ligada), equipe; usa `POST /planos/itens/da-wbs` (não duplica).

### Plano de 90 dias (`/app/plano`)
- **Puxar da programação**: `GET /planos/programacao/previa?pid=` (vazio = corrente: a semanal de hoje → a mensal de hoje
  → a mais recente) e `POST /planos/itens/da-programacao`. Cada linha vira atividade com a janela dos dias previstos (sem
  previsto = o período), equipe, quantidade do período e IWP/área/tipo; a linha fica ligada ao item
  (`programacao_linha.plano_item_id`) → o item nasce "programado". Linha já ligada, mesmo IWP ou mesma atividade
  (área + tipo + descrição) já no plano: só liga, não duplica.
- "Puxar do cronograma" e "Inserir pela WBS" continuam.
- Clicar na atividade (90 dias e 6 semanas) abre o detalhe com as restrições numa linha logo abaixo dela; clicar de
  novo fecha.

### Look-ahead (`/app/lookahead`)
- Seletor **Programação | Plano 90 dias**. `GET /lookahead?origem=plano`: cada atividade do plano com área ocupa a
  equipe nos dias úteis da janela (`dias_do_plano`, quantidade repartida igual; marcos não entram), mesmos blocos,
  faixas e cores; restrições pendentes pelo item do plano. Plano: 6/9/13 semanas (padrão 13), colunas estreitas.

## Testes
`tests/test_plano_ciclo.py`: puxar da programação sem duplicar e ligando a linha, look-ahead pelo plano (dias úteis,
origem inválida, programação segue igual), repartição dos dias, marco fora e item sem tipo junto com item com tipo.
