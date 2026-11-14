# 083 — Critério de avanço na estrutura da PQ (vínculo pelo código CMS)

## Pedido
Na tela de Critério de avanço, puxar da PQ as colunas ITEM | DESCRIÇÃO DAS ATIVIDADES | UNID. e ao lado as do critério:
CRITÉRIO DE MEDIÇÃO | Descrição | Etapas | Soma | Itens | Na WBS.

## Achado que muda a regra (spec 079)
O número do item na planilha de critérios é a numeração do **catálogo de critérios** (8.1 MOBILIZAÇÃO…), não a da PQ
da obra (8.1.1.1.1 Montagem de cabo…). Casar pelo prefixo do item ligava o critério errado. O que liga os dois é o
**código CMS** que a PQ traz em cada item (`item_pq.criterio`).

## Regra do vínculo (`criterios/domain/criterio.py::resolver_criterio`)
1. **Vínculo escolhido na linha** (`criterio_item_pq`, migração 0046) — vence tudo.
2. **Código CMS exato** (`cms_chave`: "CMS C.05.05.001" = "CMS.C05.05.001"). Dois critérios com o mesmo código: usa o
   primeiro e a linha avisa "N com este código" para escolher.
3. **Critério cadastrado à mão para o item** (origem manual: o item é da PQ) ou para um item acima.
4. **Grupo do código CMS**: C.45.12.001 → C.45.12.000 → C.45.00.000.
Critério da planilha **não** casa pelo número do item. Sem nada disso: "sem critério", com **sugestão pela descrição**
(`sugerir_por_descricao`: ≥ 2 palavras e 60% das palavras do critério, na descrição do item ou nos títulos acima) —
nunca vínculo automático; "usar" na linha ou "Aceitar N sugestões".

`criterio_para_item` (usado pelo botão "critério" da WBS) segue a mesma regra. O teste da spec 079 passou a usar o
grupo do código CMS do item (o código antigo do teste não tinha relação com o item).

## Tela (`/app/criterios`)
- Aba **Pela PQ**: a PQ vigente na ordem dela; títulos por nível (fundo mais forte no capítulo) e, em cada item, o código
  CMS da PQ, o critério que vale (→ código do critério quando é pelo grupo), como casou, etapas, soma (com memória),
  itens que usam o critério e etapas já na WBS. Filtros: todos | sem critério | com critério | não fecham 100%; busca.
  Clicar no item abre logo abaixo o editor do critério (avisa quando o critério vale para vários itens) e a troca do
  critério daquele item; item sem critério: vincular (lista), usar sugestão ou criar (já com código, item e descrição).
- Aba **Catálogo de critérios**: a lista de antes.
- API: `GET /criterios/pq`, `PUT /criterios/pq/{item}/vinculo` (`criterio_id` vazio = volta ao automático); "Itens"
  do critério e "Itens da PQ com critério" contam pela regra nova.

## Testes
`tests/test_criterios.py`: domínio do CMS e da ordem do vínculo, tela pela PQ e vínculo na linha, sugestão pela descrição.
