# 062 — Book de fotos por frente, atividade e data

## Pedido
"Um lugar para ver o book de fotos por frente e por atividade e data de execução, idem para ocorrências."

## Solução
- `GET /fotos/book?de&ate&tipo=atividade|ocorrencia|restricao&area_id` (`campo/application/book.py::montar_book`):
  - **atividade** (foto da linha no Lançar): frente (local · área), atividade (código · nome reduzido), CWP, equipe,
    data = dia de execução da foto;
  - **ocorrência** (desvio): data do desvio, causa, o que aconteceu, ação, frente pela área da atividade impactada
    (ou o texto da frente);
  - **restrição**: Nº e ação, área.
- Tela `/app/fotos` "Book de fotos" (menu Programar): abas Atividades | Ocorrências | Restrições, filtros (período,
  frente, busca), **agrupar por Frente, Atividade ou Data** (dois níveis), foto ampliada e **Imprimir book** com as logos
  da obra (`LogosObra`).
- Teste: `tests/test_book_fotos.py`.
