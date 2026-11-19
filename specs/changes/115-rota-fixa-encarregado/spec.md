# 115 — Endereço fixo do encarregado (`/encarregado`)

## Problema
O link por obra (`/equipe/<codigo>`) era montado no servidor do Next, que buscava a marca na API pelo endereço interno.
Em produção essa busca falhava, a página recebia "nada" e mostrava "Este link não está mais ativo" — mesmo com link novo.
Além disso, link que muda (novo/desligar) confunde o campo.

## Decisão
- Um endereço só para todos: `malhet.com/pt-BR/encarregado`. Nada é buscado no servidor do Next; tudo no navegador.
- Entrar = matrícula (ou crachá) + senha. A obra sai da matrícula: procura em todas as obras quem lidera equipe, já tem acesso
  cadastrado ou tem função de liderança (`funcao_de_lider`). Matrícula em mais de uma obra → lista "Em qual obra você está?".
- Primeiro acesso no próprio endereço: senha inicial 123456 → "Crie a sua senha".
- O token do portal carrega a obra (`obra`); as rotas públicas `/portal/*` não têm mais código.
- A marca (cor, logo, nome) vem de `GET /portal/marca/{obra_id}` depois do login e fica lembrada no aparelho
  (`malhet.encarregado.obra`), então a próxima abertura já vem com a cara da empresa. Aparelho novo começa no verde Malhet.
- Links antigos `/equipe/<codigo>` redirecionam para `/encarregado?obra=<id>` (`GET /portal/link/{codigo}`); código
  desconhecido vai para `/encarregado`.
- Tela Acesso dos líderes: some "link novo" e "ligar/desligar"; fica o endereço fixo com copiar mensagem e WhatsApp.

## Rotas
`POST /portal/entrar {matricula, senha, obra_id?}` · `POST /portal/senha` · `GET /portal/equipes` · `GET /portal/buscar` ·
`POST /portal/incluir` · `POST /portal/transferir` · `POST|DELETE /portal/pedidos` · `GET /portal/marca/{obra_id}` (+ `/logo/{qual}`)
· `GET /portal/link/{codigo}`. Admin: `GET /lideres` → `{endereco: "/encarregado", lideres}`.

## Testes
`tests/test_portal_lider.py`: fluxo completo pelo endereço fixo, link antigo, matrícula em duas obras (escolher + `obra_id`).
E2E: primeira abertura sem marca, primeiro acesso cria a senha, marca aplicada e lembrada, link antigo → `?obra=1`.
