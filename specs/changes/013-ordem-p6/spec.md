# 013 · A aplicação respeita a estrutura do Primavera

## Por quê
No cronograma a O.S. 1 vem antes da O.S. 2 pela estrutura da WBS do P6; a aplicação seguia a ordem em que as
atividades apareciam no .xer e numerava a WBS por conta própria (e quebrava nomes de WBS que têm " / ").

## O que muda
- Importação do .xer (`importar_xer.estrutura_wbs`): cada nó da WBS leva nome, código (`wbs_short_name`) e chave de
  ordem (`seq_num` acumulado nível a nível, empate pelo código). Atividades ordenadas pela WBS e, dentro dela, pelo
  Activity ID em ordem natural (C-9 antes de C-10) → `ordem_p6`.
- `atividade_cronograma.wbs_niveis` (JSONB: [{nome, codigo, ordem}]) e `ordem_p6`. O caminho não é mais quebrado em
  " / " (nome de WBS com barra continua um nível só).
- Cronograma: ordem padrão = P6; código da WBS = o do P6 (5, 5.1, 5.1.11…); ordenar por outra coluna continua
  possível e "ordem do P6" volta à estrutura. Cronograma importado antes avisa para reimportar.
- Busca de atividades do cronograma (formulário da linha) e linhas de cada área da programação (montar, impressão,
  Excel, FT) seguem a ordem do P6; linhas sem atividade do cronograma vão para o fim, na ordem de inclusão.

## Evidência (11/11/2026)
- `pytest -q`: 42 passed (`test_ordem_p6.py`: seq_num manda mesmo com a O.S. 2 antes no arquivo, códigos do P6,
  nome com " / ", ID natural, busca e linhas da programação na ordem do P6; XER real: O.S. 1 (5) antes da O.S. 2 (7)).
- Navegador com o XER real: 5 O.S. 1 → 5.1 Mobilização / Marcos / … → 5.1.1, 5.1.11, 5.1.2, 5.1.10… (seq do P6).
