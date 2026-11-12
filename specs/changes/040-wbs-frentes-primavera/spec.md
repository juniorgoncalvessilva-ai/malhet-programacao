# Spec 040 — WBS de execução nasce das Frentes e faz ida e volta com o Primavera

## Pedido
A WBS precisa atualizar quando uma área for criada nas Frentes. O que a WBS acrescenta tem de entrar na estrutura do
cronograma para importar no Primavera sem perder a estrutura atual; e o inverso: importar um cronograma novo não pode
perder o que foi criado aqui. A chave é o código WBS.

## Entrega
- Frentes → WBS: criar, reativar ou importar área cria o nó de área na WBS (`wbs/application/p6.py::garantir_areas`);
  excluir área vazia na WBS leva o nó junto; com CWPs abaixo, não exclui (desativar). A migração `0028` carimba as
  áreas ativas que ainda não estavam na WBS. O Local é só agrupamento das áreas (não é nível da WBS).
- `wbs_no.codigo_p6`: código WBS no P6 (wbs_short_name de cada nível unido por ponto, sem o projeto: `5.4.3.4`).
  A sincronização com o cronograma carimba área e CWP (CWP "Geral" = código da área).
- Levar ao Primavera: `POST /wbs/exportar-p6` recebe o .xer atual e devolve o mesmo .xer (bytes do P6 intactos) com:
  área nova → nível `CWA 004.07 - Ativo - Descrição` abaixo do nível "CWA 004 …" (ou da faixa "CWA 011 a CWA 020"),
  senão no ramo "CWP - …"; CWP manual → nível abaixo da área; IWP manual → atividade `EXE-00000` (nome = descrição
  do item da PQ, não iniciada, sem datas reais) no nível do CWP. O Grupo não vira nível no P6. Códigos curtos = próximo
  número livre entre os irmãos. Resumo no cabeçalho `X-Resumo`. `wbs/domain/xer.py` (Xer, EstruturaP6, nome_area).
- Volta: a importação do cronograma casa área pelo CWA, CWP pelo `codigo_p6` (antes da âncora por nome) e IWP pelo
  Activity ID; nada duplica e o que é manual continua manual. Exportar de novo não acrescenta nada.
- Web: WBS → "Levar ao Primavera (.xer)" + painel com o resumo; código WBS do P6 em cada nó.

## Teste
`tests/test_wbs_p6.py` (estrutura, faixa de CWA, bytes preservados, ida e volta sem duplicar, 2ª exportação vazia);
`test_wbs.py`/`test_wbs_cronograma.py` ajustados: a área das Frentes já está na WBS.
