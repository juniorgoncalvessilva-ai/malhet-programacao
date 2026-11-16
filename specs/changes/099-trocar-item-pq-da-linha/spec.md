# 099 — Trocar o item da PQ da linha, inclusive depois de emitida

## Pedido
"Opção de alterar os itens de PQ atrelados aos itens da programação: o usuário pode errar o item da PQ e precisaremos
corrigir isso após a emissão — editar e alterar o item de PQ, saindo na nova revisão da programação."

## Como funciona
- Botão **trocar** ao lado do item da PQ de cada linha (`TrocarItemPq.tsx`), para planejador/admin, com a programação em
  rascunho **ou emitida**. Concluída: só depois de **Revisar** (com motivo), como qualquer mudança.
- `PUT /programacoes/{pid}/linhas/{lid}/item-pq` `{item_pq, tambem_na_wbs}` → `planejamento/application/item_pq_linha.py`:
  - item precisa estar na PQ vigente e ser folha; igual ao atual = erro;
  - a linha mede no tipo do Catálogo: vai para o tipo do item novo; se o item ainda não está no Catálogo, entra como
    tipo novo no mesmo grupo da atividade atual (`tipo_criado`);
  - o complemento (texto/código Simova) é refeito no tipo novo (`obter_ou_criar_item`);
  - com IWP da WBS e "corrigir também na WBS": o IWP passa ao item novo, e as linhas dele nas outras programações
    abertas também; se o item for de outro grupo (ou já houver IWP dele no grupo), a WBS não muda e vem o aviso;
  - linha de etapa do critério: aviso para conferir o critério do item novo.
- A revisão emitida **não muda** (a foto é a do documento impresso). A resposta traz `precisa_nova_revisao` e o painel
  oferece **Emitir rev. N agora** (reabre e emite) ou **Depois** (para corrigir mais linhas antes).

## Aceite
- `tests/test_item_pq_revisoes.py::test_trocar_item_pq_depois_de_emitida`: rev. 0 guarda o item antigo, rev. 1 sai com o
  novo; tipo criado no grupo; erros de item inexistente/título/igual; concluída só após Revisar.
