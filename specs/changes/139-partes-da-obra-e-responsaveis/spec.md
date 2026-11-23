# 139 — Partes da obra (gerências) e responsáveis padronizados

## Pedido (usuário, 23/11/2026)
"Em Responsáveis e Gerência, vamos criar uma tabela em configuração para inserir esses nomes e padronizar nosso sistema.
Gerência é sempre CONTRATADA - nome (CARDAN), CONTRATANTE - nome (VALE), FISCALIZAÇÃO - nome (TRACTEBEL), PROJETOS - nome
(WORLEY). Lista de responsáveis da contratada podemos atrelar ao efetivo; dos demais são digitados."

## O que muda
- Módulo `partes/`: `parte_obra` (obra, papel contratada|contratante|fiscalizacao|projetos, nome) e `responsavel_obra` (obra,
  papel, nome, função, `colaborador_id` do efetivo, ativo). `domain/partes.py`: `PAPEIS`, `gerencia(papel, nome)` →
  "CONTRATADA - CARDAN", `casar_gerencia` (texto antigo → gerência padronizada só quando uma parte casa sozinha, pelo nome da
  empresa em palavra inteira ou pelo papel/sinônimo: cliente, gerenciadora, projetista). Contratada e contratante começam com os
  nomes da Marca da obra. Migração `0069_partes_obra`.
- API: `GET /partes`, `PUT /partes/{papel}`, `POST|PUT|DELETE /partes/responsaveis` (responsável da contratada pelo
  `colaborador_id` do efetivo — nome e função vêm do efetivo; os outros digitados; repetido = 422), `GET /partes/padronizar`
  (prévia) e `POST /partes/padronizar` (troca as gerências antigas em restrições e desvios pelos gateways
  `restricoes/infra/gateway.py` e `indicadores/infra/gateway_partes.py`; lista os responsáveis usados que não estão cadastrados).
- Tela Configurar › **Partes e responsáveis** (`/app/partes`, planejador): as quatro partes com o nome e a gerência como fica;
  "O que já foi registrado à mão?" (padronizar N registros; responsáveis antigos com a parte sugerida e "incluir" — da contratada,
  pela pessoa do efetivo de mesmo nome quando houver); responsáveis por parte (contratada: "Incluir do efetivo" com `BuscaEfetivo`;
  demais: nome + função), inativar e excluir (com confirmação).
- `GerenciaResponsavel` (Gerência + Responsável como listas; escolher o responsável preenche a gerência; valor antigo aparece como
  "(antigo)") nos desvios da programação (itens não cumpridos), nas restrições (6WLA, edição na linha) e nas restrições do plano de
  90 dias (agora com a gerência).

## Verificação
`tests/test_partes.py`: gerência padronizada; partes com os nomes da Marca; responsável da contratada pelo efetivo, repetido e
de outra parte pelo efetivo = 422; digitado com função; inativar; obra isolada; `casar_gerencia` (nome, sinônimo, já padronizada,
ambígua); padronizar (prévia não grava, aplica 3 registros, responsável antigo com a parte sugerida). E2E com os dados reais da
obra: "Padronizar 605 registro(s)" (CARDAN → CONTRATADA - CARDAN 420, VALE → CONTRATANTE - VALE 185) e os responsáveis já usados;
na restrição, escolher "Ana Lima · Fiscal de campo" preenche "FISCALIZAÇÃO - TRACTEBEL".
