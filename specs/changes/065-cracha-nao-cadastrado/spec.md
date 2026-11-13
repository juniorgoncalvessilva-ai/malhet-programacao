# 065 — Crachá não cadastrado: cadastro rápido no celular

## Pedido
Ao ler um crachá não cadastrado, ir direto para o cadastro rápido no celular: vincular a uma pessoa do efetivo; se ela não
estiver no efetivo, cadastrar de forma simplificada (nome + função de contratação do de-para de funções, já ligada ao
resto do sistema) e criar um alerta para quem cadastrou e para o DP/RH completarem o cadastro.

## Solução
- Presença (`/m/presenca`): leitura desconhecida (NFC ou código) abre na hora o cartão "Crachá não cadastrado":
  - **Pessoa do efetivo**: busca por nome/matrícula na base do celular → "É esta" liga o crachá (NFC ou código) à pessoa,
    registra a presença e grava o vínculo na fila do aparelho (sobe com a sincronização; funciona sem internet);
    `POST /presenca/vincular` (encarregado+), o mesmo crachá não serve para duas pessoas.
  - **Não está no efetivo**: nome completo + função da lista do de-para (`/presenca/base` traz `funcoes`) →
    `POST /presenca/pessoa-simplificada` cria a pessoa (empresa própria, chave provisória pelo nome, MOBILIZADO,
    `origem = campo`, `cadastro_pendente`, quem e quando cadastrou), liga o crachá e registra a presença (precisa de
    internet). A função vem do de-para, então a pessoa já entra na composição/CPU.
- Alerta: `GET /presenca/cadastros-pendentes` (e `?meus=true`). Celular (Início): "N cadastro(s) seu(s) para completar".
  Web (Efetivo e mobilização): quadro do DP/RH com a lista e "Completar" com a matrícula
  (`PUT /presenca/cadastros-pendentes/{id}`, planejamento/admin). A planilha do DP com a mesma pessoa (mesmo nome) ganha a
  matrícula, mantém o registro e tira o alerta sozinha.
- Migração 0036 (`colaborador.cadastro_pendente`, `cadastrado_por`, `cadastrado_em`). Testes: `tests/test_cadastro_campo.py`.
