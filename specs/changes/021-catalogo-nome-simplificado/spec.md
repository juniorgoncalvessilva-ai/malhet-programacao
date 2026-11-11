# Spec 021 — Catálogo: grupo com um ou vários itens da PQ e nome simplificado do item

## Objetivo
1. Associar um grupo a **vários itens da PQ** (seleção em lote, como antes) **ou a um único item** (lista "Grupo" em
   cada linha da aba PQ: liga, troca de grupo ou desvincula).
2. Coluna **Nome simplificado** na aba PQ, digitada e salva na tela: é o texto do Simova para o tipo e para os itens
   complementares (`Nome simplificado - (complemento)`). Sem nome, vale a descrição da PQ.

## Modelo
- `pq_nome_simplificado` (referências): `obra_id`, `item` (código do item da PQ, único na obra), `nome` (≤ 120).
  Fica por código de item, então sobrevive a novas revisões da PQ. Migração `0014_nome_simplificado`.
- `ItemPqInfo.nome_simplificado` e `texto_simova` (gateway `pq_gateway`); `nomes_simplificados`,
  `salvar_nome_simplificado`.

## Regras
- `PUT /catalogo/nomes-simplificados` (planejador): só itens (folhas) da PQ vigente; vazio apaga. Atualiza o
  `tipo_atividade.descricao` do tipo ligado ao item → exportação OPER do Simova e programação usam o nome.
- `PUT /catalogo/itens-pq/{item}/grupo` `{grupo_id | null}`: cria o tipo no grupo (próximo número), move para outro
  grupo (novo número no destino) ou desvincula (mesmas regras do desvincular: tipo em programação não sai).
- Título da PQ não vira tipo nem recebe nome.
- `GET /pq/estrutura` traz `nome_simplificado` e `tipo.grupo_id`; o catálogo traz `descricao` (texto do Simova),
  `descricao_pq` e `nome_simplificado`.

## Tela (Catálogo de atividades)
Aba PQ: coluna "Nome simplificado (Simova)" editável + botão "Salvar nomes (n)"; coluna "Grupo (catálogo)" com lista
por linha (desvincular pede confirmação); lote "Vincular selecionados ao grupo" mantido. Árvore do catálogo mostra o
nome simplificado em destaque e a descrição da PQ embaixo.
