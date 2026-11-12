# 028 — Grupos em massa (OPER_GRUPO), unidades de medida do Simova e excluir item do grupo

## Grupos em massa
- `POST /catalogo/grupos/lote {texto}`: linhas `CODIGO · DESCRICAO · UNIDADE_MEDIDA` coladas do Excel (tab, `;` ou
  `|`; cabeçalho ignorado). Código = número do grupo: existente → atualiza descrição e unidade; novo → cria.
  Unidade fora da tabela da obra recusa o lote inteiro.
- `grupo_atividade.unidade` (código, ex.: 007) — editável no formulário do grupo.

## Unidades de medida
- Reaproveita a tabela `unidade_medida` (espelho dos cadastros do Simova), por obra; nasce com as 19 do Simova
  (001 un … 019 dm³). `GET /catalogo/unidades`, `POST /catalogo/unidades/lote` (CODIGO · DESCRICAO).
- A unidade do tipo vem do item da PQ e é casada pelo texto (`catalogo/domain/unidades.py::codigo_unidade`:
  ignora caixa, acento, expoente e sinônimos como m3, und, verba). `TipoOut.unidade_simova` mostra o código.
- Cadastros para o Simova: aba nova `UNIDADE_MEDIDA`; `OPER_GRUPO.UNIDADE_MEDIDA` = unidade do grupo;
  `OPER.UNIDADE_MEDIDA` = código da unidade do item da PQ (sem casamento, a do grupo).

## Excluir item do grupo
- `DELETE /catalogo/tipos/{id}`: se o item está em programação, a mensagem diz em quais (exclua as linhas ou
  inative). Fora disso sai junto com os itens complementares e os IWPs da WBS que apontam para ele (antes dava erro
  de chave estrangeira).
- `DELETE /catalogo/itens/{id}`: item complementar sem uso em programação.

## Testes
`tests/test_catalogo_lote.py`, `tests/test_wbs.py` (excluir com IWP e com programação).
