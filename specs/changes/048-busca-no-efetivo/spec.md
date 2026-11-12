# Spec 048 — Encarregado e funcionários da equipe buscados no efetivo

## Pedido
Pesquisar os encarregados das equipes num dropdown do efetivo, e os funcionários também.

## Entrega
- `components/Obra/BuscaEfetivo.tsx`: dropdown com busca (nome, matrícula, crachá ou função, sem acento), teclado
  (↑ ↓ Enter Esc), até 50 resultados, desmobilizados/desistências fora, situação diferente de mobilizado em destaque e
  aviso de em que equipe a pessoa já está.
- Equipes: "Encarregado (buscar no efetivo)" (encarregados primeiro) preenche crachá/matrícula e nome;
  "Incluir funcionário (buscar no efetivo)" inclui vários seguidos (fica aberto, não repete quem já está). A digitação
  manual (matrícula/nome) continua para quem não está no efetivo.
