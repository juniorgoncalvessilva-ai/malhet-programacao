# Spec 148 — Qualquer função pode ser apontador

## Pedido
"Não limite o acesso dos apontadores à função apontador. Quero poder utilizar a função que eu quiser para ser apontador."

## Regra
- `lider_config` por obra (`funcoes_apontador`, JSONB): as funções do efetivo que entram pela rota do apontador. Sem escolha
  (None) vale o padrão da spec 147 (APONTADOR/APROPRIADOR).
- Comparação sem acento, maiúsculas e espaços únicos (`chave_funcao`): "Técnico  de planejamento" = "TECNICO DE PLANEJAMENTO".
- `pode_apontar` = cadastrado como apontador (qualquer função) **ou** função na lista da obra. Tirar a função da lista tira o acesso
  na próxima entrada; o cadastrado individual continua.
- `GET /lideres/apontador/funcoes` (escolhidas + funções do efetivo ativo com quantas pessoas) e `PUT` (`funcoes: null` volta ao padrão).
- Tela Acesso dos líderes › "Onde o apontador entra?": "Funções que entram como apontador" (todas as funções do efetivo), Salvar e
  "voltar ao padrão".

## Testes
`tests/test_apontador.py::test_funcoes_que_entram_como_apontador`.
