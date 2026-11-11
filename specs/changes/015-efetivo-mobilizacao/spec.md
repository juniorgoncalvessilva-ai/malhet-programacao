# Spec 015 — Efetivo, mobilização, equipes a partir do efetivo, de-para de funções e organograma

## Objetivo
Controlar a mobilização do efetivo da obra a partir da planilha "EFETIVO GERAL" do DP (.xls/.xlsx), montar as equipes
com essas pessoas, exportar as equipes no layout de importação do Simova e ligar a função de cada pessoa à função
de mão de obra da composição (CPU) para que capacidade e gargalo usem o efetivo real.

## Regras
- **Chave = matrícula.** Primeira aba = efetivo próprio (chave = matrícula; crachá = matrícula). Demais abas =
  terceiros (chave `EMPRESA:matricula`). Sem matrícula → chave provisória `EMPRESA:NOME:<nome>`, promovida quando a
  matrícula aparecer. Reimportar semanalmente **nunca apaga**: quem saiu do arquivo fica com
  `no_ultimo_arquivo = false` e um movimento `FORA_DO_ARQUIVO`; equipes e crachás editados são preservados.
- **Situação** (`efetivo/domain/efetivo.py::situacao_da_linha`): MOBILIZADO, AGUARDANDO_CRACHA, EM_PROCESSO,
  PREVISTO (data na coluna STATUS), AFASTADO, DESMOBILIZADO (data de demissão), DESISTENCIA. STATUS vazio na aba
  própria = EM_PROCESSO; nas abas de terceiros = MOBILIZADO.
- **LGPD:** não gravamos CPF, PIS, endereço, telefone, nascimento nem nome da mãe — só o necessário para equipe.
- Movimentos registrados: ENTRADA, SITUACAO, FUNCAO, EQUIPE, FORA_DO_ARQUIVO.
- **Equipes:** criar equipe a partir da seleção (1º encarregado ou o indicado), mover/remover pessoas; exige crachá.
  Exportação `GET /equipes/simova.xlsx` no layout `CABECALHO_SIMOVA` (pessoas concatenadas sem separador, como o
  Simova exporta).
- **De-para** (`de_para_funcao`): função do efetivo → recurso de mão de obra da CPU vigente, ou `ignorar`
  (indiretos). Sugestão automática por igualdade/prefixo tolerante a plural. A composição efetiva da equipe usa a
  função do membro; se vazia, a função do de-para pelo crachá.
- **Organograma** (modelo do Malhet): Obra → setor (frente da equipe ou DP) → supervisor → equipe/encarregado →
  função → pessoas; ramos "Sem equipe" e "Em mobilização". Desmobilizados não aparecem.

## Entregas
- API: módulo `efetivo` (domain/application/infra/api), migração `0010_efetivo`, testes `tests/test_efetivo.py`.
- Web: `/app/efetivo`, `/app/efetivo/funcoes`, `/app/efetivo/organograma`, botão "Exportar para o Simova" em Equipes,
  grupo "Efetivo" no menu.
