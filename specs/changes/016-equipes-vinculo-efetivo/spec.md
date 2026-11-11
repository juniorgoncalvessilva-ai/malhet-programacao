# Spec 016 — Equipes ligadas ao efetivo pelo número antes do nome

## Problema
Equipes digitadas, da planilha auxiliar ou do Simova trazem a pessoa como "115532 :: JOSE…", "115532 - José" ou só o
nome, com o crachá vazio ("sem crachá"). Sem o vínculo, a equipe não mostra nome/função do efetivo e a capacidade não
usa o de-para de funções.

## Regra
- `equipes/domain/simova_equipe.py::separar_cracha` separa número e nome: "115532 :: NOME", "115532 - Nome",
  "115.532 Nome", "Nome (115532)", "Nome - 115532".
- `efetivo/infra/gateway.py::LocalizadorEfetivo` acha a pessoa pelo número: crachá → matrícula do efetivo próprio →
  matrícula de terceiro (só se única). Achada pela matrícula e sem crachá, passa a ter esse crachá.
- `equipes/application/vincular_efetivo.py`: encarregado e funcionários recebem crachá e nome do efetivo; a função
  digitada no membro (CPU) é preservada, senão vale o de-para. Duplicados (mesmo número) ficam uma vez.
- Roda ao salvar equipe, ao importar equipes (Simova e planilha auxiliar), ao importar o efetivo e no botão
  "Vincular ao efetivo" (`POST /equipes/vincular-efetivo`), que lista matrículas não encontradas e pessoas sem número.
- Pessoa sem número fica com crachá provisório `?nome` e não vai para o arquivo do Simova.
- Listagem de equipes traz `encarregado_efetivo`, `membros[].efetivo` (matrícula, nome, função, função da CPU,
  situação) e `fora_do_efetivo`.

## Testes
`tests/test_efetivo.py::test_separar_numero_antes_do_nome` e `test_equipe_digitada_com_numero_no_nome_liga_ao_efetivo`.
