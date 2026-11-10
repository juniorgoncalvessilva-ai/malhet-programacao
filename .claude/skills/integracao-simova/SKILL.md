---
name: integracao-simova
description: Ler ou gerar planilhas do Simova (OPER.xlsx, FRENTE.xlsx, FT_IMPORT_INTERMEDIARIA) e da planilha auxiliar de programação. Use ao mexer em importadores/exportadores ou em colunas desses arquivos.
---
- Layouts (cabeçalhos exatos) = contrato: `app/modules/integracao_simova/domain/layout.py`. Mudou coluna → teste em `tests/test_api_fluxo.py`.
- Normalize toda célula com `app/shared/simova.py` (`codigo`, `lista` com `;`, `flag` '1', `numero`, `data_br` dd/mm/aaaa).
- Simova repete códigos: deduplique com aviso no relatório (`_upsert`), nunca quebre a importação.
- FT: uma linha por encarregado × OPER × frente × período (≤ 7 dias); PE_/HH_<DIA> pelo `weekday` da data.
- Planilha auxiliar: ATIVIDADES/PQ/RECURSOS com cabeçalho na linha 1; ÍNDICES na linha 4; EQUIPES tipo na linha 2,
  recurso na linha 4, 40 equipes × 40 funções a partir de E5.
- Importações são idempotentes e não sobrescrevem vínculos criados na aplicação.
