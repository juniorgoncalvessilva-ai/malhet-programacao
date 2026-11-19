# 117 — Endereço do encarregado por empresa e obra

## Problema
O endereço único `/encarregado` (spec 115) abre sempre com a cara do Malhet: a marca só aparece depois do login, porque é
a matrícula que diz a obra. Cada empresa quer a sua identidade já na abertura, e o link precisa separar empresa e obra.

## Decisão
- `/encarregado/<empresa>/<obra>` — endereço da obra; `/encarregado/<empresa>` — endereço da empresa (todas as obras dela).
- **Herança automática, nada a configurar**: `<empresa>` = nome da contratada na Marca da obra em minúsculas, sem acento,
  com hífen (`Construtora Ação & Cia.` → `construtora-acao-cia`); obra sem contratada fica sob `malhet`. `<obra>` = código
  da obra (único) no mesmo formato (`CT-001` → `ct-001`). `lideres/domain/rota.py`.
- `GET /portal/rota/{empresa}/{obra}` → obra, marca e endereço certo. A obra manda: se o nome da contratada mudou, o endereço
  antigo ainda abre e a barra passa para o novo. `GET /portal/rota/{empresa}` → a marca mais completa entre as obras da
  empresa (com logo, com cor, a mais recente), sem listar as obras (nada de nomes de obra antes do login).
- Login no endereço da obra entra direto nela; no da empresa só valem as obras dela (`entrar(..., empresa)`), e com mais de
  uma pede "Em qual obra você está?". Depois de entrar, a barra vai para o endereço da obra dele e o aparelho guarda; o
  endereço geral `/encarregado` e os links antigos `/equipe/<codigo>` passam sozinhos para ele.
- Aparelho com a sessão de outra obra abrindo o endereço desta: vale o endereço (pede o login desta).
- Endereço inexistente: "Endereço não encontrado" com o atalho para o endereço geral.
- Matrícula com `autocomplete="off"`: o navegador do computador não preenche com o e-mail salvo do Malhet.
- `GET /lideres` devolve `endereco` (obra) e `endereco_empresa`; a tela Acesso dos líderes mostra os dois.

## Testes
`tests/test_portal_lider.py::test_endereco_por_empresa_e_obra` (slug, rota da obra/empresa, empresa antiga, 404, login
restrito à empresa, entrar pela obra). E2E: abertura com a marca antes do login, primeiro acesso, endereço geral herdando o
da obra, endereço da empresa levando à obra, nome antigo corrigido, inexistente, tela do Planejamento.
