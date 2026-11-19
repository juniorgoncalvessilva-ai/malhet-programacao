# 109 — Puxar do cronograma com atividades longas e "Loading chunk failed" depois do deploy

## Por quê
1. Plano de 90 dias › Puxar do cronograma devolvia 422 (4 tentativas no console). O cronograma tem atividades de longa
   duração (Administração Local 508 dias, Distribuição de Verbas 477, Manutenção do canteiro, LPS…) e a janela de um
   item do plano aceitava até 400 dias: qualquer período que cruzasse uma delas recusava o lote inteiro.
2. Relato E-BF4343 "Loading chunk 6910 failed" (tela de cadastro): página aberta antes do deploy pedindo um pedaço do
   build antigo, que não existe mais. Não é defeito — é versão nova no ar.

## O que muda
- `planos/domain/plano.py`: `MAX_DIAS_JANELA = 1100` para a janela do item (o período de busca continua `MAX_DIAS = 400`).
- `POST /planos/itens/do-cronograma`: cada atividade num savepoint; a que não passa volta em `recusadas`
  ("C-99: janela de até 1100 dias") e as outras entram. Erro do formulário (equipe/marco) continua 422 antes de gravar.
  A tela avisa as recusadas.
- `lib/erros/versaoNova.ts` (`ehVersaoVelha`, `recarregarParaVersaoNova`): chunk do build antigo → recarrega a página
  uma vez (no máximo a cada 60 s) em vez de relatar; usado em `FalhaTela`, `global-error.tsx` e `CapturaErros`. Se
  falhar de novo logo depois, aí sim vira relato.

## Aceite
- `tests/test_plano_atividades_longas.py`: atividade de 508 dias entra com as datas do P6; a de 4 anos é recusada
  sozinha; puxar de novo atualiza sem duplicar; equipe inválida = 422.
- e2e: com o chunk da tela de cadastro devolvendo 404, "Criar conta" recarrega uma vez, abre a tela e não envia relato.
