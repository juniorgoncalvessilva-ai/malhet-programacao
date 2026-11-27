# Spec 151 — Pessoa da equipe achada no efetivo pelo número escrito de qualquer jeito

## Problema
Na edição da equipe, alguns funcionários (ex.: matrícula 099800) apareciam sem a função e com "escolha a função", enquanto
outro com a mesma função aparecia certo. Causa: o índice do efetivo usado pela equipe (`pessoas_por_cracha`,
`funcoes_por_cracha`) só olhava o **crachá exato** — quem tinha só a matrícula (sem crachá gravado) ou o número escrito de
outro jeito ("099800" × "99800" do Excel do DP, "115.013", "115013.0") ficava "fora do efetivo": sem função, sem de-para na
composição/capacidade, sem equipe na lista do efetivo e na presença. Pessoas que entram pelo organograma, pelo apontador ou
por "Trazer alguém" não passam pelo acerto do formulário e caíam nesse caso.

## O que muda
- `efetivo/infra/gateway.py`: `codigo_normal` (zero à esquerda, ponto, ".0", espaços; letras ficam) e `PorCodigo` — crachá
  exato e, sem ele, o crachá **ou a matrícula** normalizados, só quando o número é de uma pessoa (dois com o mesmo número: não
  chuta). `pessoas_por_cracha`/`funcoes_por_cracha` passam a cobrir quem só tem matrícula; equipes, composição efetiva,
  memória de cálculo e capacidade da programação usam o mesmo índice sem mudar de código.
- `LocalizadorEfetivo.achar` também acha pelo número normalizado (e grava o crachá de quem não tinha).
- Lista do efetivo (equipe de cada pessoa) e presença (equipe na base do celular e na presença do dia) casam pelo número normalizado.
- Tela da equipe: abaixo do nome, a função do efetivo; "sem de-para" com link para o De-para de funções; "sem função no efetivo"
  ou "fora do efetivo" quando for o caso. Escolher a função de quem não tem de-para pergunta se grava no de-para (vale para
  todos com aquela função) ou só nesta equipe ("Agora não"). `useConfirmar` aceita `cancelar` (texto do botão de voltar).

## Outros casos verificados (cópia local)
- 205 de 206 números das equipes já casavam; o que sobrou (999998) não está no efetivo.
- 214 pessoas têm função **sem de-para** (ex.: motorista de ônibus, zelador, operador de máquinas, engenheiro, técnico/engenheiro
  de segurança) — não é erro de busca: falta associar no De-para de funções (a tela de de-para sugere pela CPU).

## Testes
`tests/test_numero_normalizado.py` — matrícula "099800" sem crachá incluída pelo organograma (falhava antes), crachá com zero e
matrícula com ponto no formulário, `PorCodigo` sem chutar duplicados.
