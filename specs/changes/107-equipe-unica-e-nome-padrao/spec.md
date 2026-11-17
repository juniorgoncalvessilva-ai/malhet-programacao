# 107 — Uma pessoa, uma equipe (com histórico) e nome padrão das equipes

## Por quê
1. Ao incluir numa equipe um funcionário que já estava em outra, ele ficava nas duas (pelo cadastro e pelo organograma).
   Só a tela do efetivo tirava da outra. E a troca não ia para o histórico com a equipe de origem/destino, então não dava
   para medir quantas alterações as equipes tiveram por período.
2. O nome das equipes segue o padrão da empresa ("EQUIPE.10_FORMA") digitado à mão: número repetido ou pulado,
   pontuação diferente ("EQUIPE_20_ARMAÇÃO").

## O que muda
### Uma equipe por funcionário
- `equipes/domain/alocacao.py`: `equipes_de_saida` — ao entrar numa equipe, a pessoa sai das outras em que é funcionária.
  **Líder fica**: encarregado (crachá), responsável ou supervisor (`responsavel_id`/`supervisor_id`) de qualquer equipe
  pode estar em mais de uma.
- `equipes/application/alocacao.py::Alocador` é o único caminho: cadastro da equipe (criar/editar, pela diferença de
  membros), organograma (`POST /equipes/{id}/membros`, `/membros/lote`, `DELETE …/membros/{cracha}`) e efetivo
  (`PUT /efetivo/equipe`, `POST /efetivo/equipes`). Mover explícito pelo organograma (`de_equipe_id`) tira da origem
  mesmo sendo líder.
- Histórico: cada troca = um `movimento_efetivo` tipo `EQUIPE` com `de_equipe_id`/`para_equipe_id` (novos; a migração
  liga os antigos pelo nome). Pessoa fora do efetivo muda igual, sem histórico.
- `GET /equipes/movimentacoes?inicio&fim` (`resumo_movimentos`): total, trocas, pessoas distintas, entradas/saídas por
  equipe (pelo id: renomear não perde a contagem) e por semana (segunda-feira), cada número com memória. Aba
  **Movimentações** em Equipes (`MovimentacoesEquipes.tsx`, 7/30/90 dias ou período).

### Nome padrão
- `equipe_config` (por obra): `modelo_nome` (padrão `EQUIPE.{n}_{disciplina}`) e `digitos`. `{n}` = maior número já usado
  no padrão + 1 (`proximo_numero`, pontuação tolerante: "EQUIPE_20" conta); `{disciplina}` digitada, em maiúsculas.
- `GET/PUT /equipes/config` (salvar = administrador), aba **Configuração** (`ConfigNomeEquipe.tsx`) com prévia e as
  equipes fora do padrão.
- Nova equipe (Equipes e "Criar equipe com selecionados" do Efetivo) pede só a **Disciplina** e mostra o nome; o servidor
  dá o número na hora de salvar (`disciplina_padrao`, `application/nome.py`). "digitar o nome" mantém o nome livre.

## Aceite
- `tests/test_equipe_unica.py` (regra do líder, padrão/número, resumo por equipe/semana, trocas pelo cadastro,
  organograma e efetivo, renomear sem perder a contagem, nome pelo efetivo).
- e2e: nova equipe "forma teste" → EQUIPE.24_FORMA TESTE com o 115532, que saiu da EQUIPE.10_FORMA; Movimentações mostra
  a troca e os totais com memória.
