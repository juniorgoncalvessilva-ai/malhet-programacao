# 060 — Excluir revisões da programação (só super admin)

## Pedido
"Crie somente para super admin a opção de excluir as revisões da programação."

## Regra
- Revisão = emissão (Rev. 0, 1, 2… — `programacao_emissao`). Só o **super admin** exclui; o admin da obra e os demais
  papéis recebem 403 ("só o super admin pode excluir revisões da programação").
- Excluir apaga a foto da emissão e o histórico dela nos indicadores (`programacao_fato` da revisão,
  `indicadores/application/registrar.py::ao_excluir_emissao`).
- Se for a **última** revisão: a anterior volta a ser a vigente nos indicadores, a numeração recua (`programacao.revisao`
  = maior restante + 1, ou 0) e a programação emitida volta a rascunho.
- Programação **concluída**: a última revisão emitida não sai (sustenta a conclusão) — abra uma revisão antes. As
  anteriores podem ser excluídas.
- Revisões do meio podem ser excluídas; a numeração das outras não muda.

## Implementação
- `DELETE /programacoes/{pid}/emissoes/{rev}` (`Depends(administrar)` + `usuario.superadmin`) →
  `planejamento/application/servico.py::excluir_emissao`.
- Tela da programação: painel "Revisões emitidas" (`components/Obra/RevisoesProgramacao.tsx`) só para o super admin,
  com Excluir e confirmação (`useConfirmar`) explicando o efeito.
- Teste: `tests/test_excluir_revisao.py` (meio, última, concluída e 403 para o admin da obra).
