# 070 — Book de fotos com as auditorias e as evidências das ações 5W2H

## Problema
O book (spec 062) só juntava fotos de atividades, ocorrências e restrições; as fotos das auditorias (antes/depois) e as
evidências de conclusão das ações 5W2H (spec 064) não apareciam.

## Solução
- `GET /fotos/book?tipo=auditoria|acao` (e sem tipo, todas): auditoria → frente do registro, data da inspeção,
  "Tipo Nº · ANTES/DEPOIS · não conformidade", tipo de registro, encarregado, medida corretiva (rascunho não entra);
  ação → frente, data da conclusão, "Ação A-n · evidência · o quê", origem (ex.: "Inspeção Nº 1"), quem e o que foi feito.
- Tela `/app/fotos`: abas **Auditorias** e **Ações 5W2H**, selo ANTES/DEPOIS na legenda; agrupar por frente junta por
  tipo · tipo de registro.
- Teste: `tests/test_book_fotos.py::test_book_com_auditorias_e_acoes`.
