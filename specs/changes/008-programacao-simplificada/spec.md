# 008 — Programação semanal/mensal simplificada (frentes, catálogo com ID Simova, take-off, XER)

Contexto: o app ficou confuso. O centro passa a ser **produzir a programação semanal e mensal no formato da
Programacao_auxiliar_v5** (LOCAL → ÁREA → linhas P/R por dia), com rastreio até a PQ, e exportar para o Simova
com descrições simples. Skills: `model-modulo-api`, `db-migracao`, `integracao-simova`, `ui-malhet`.

## Decisões do usuário (10/11/2026)
- **Frentes em 2 níveis**: Local (`1`, `2`, `S2`, `3`…) → Área (CWA `004.00` + TAG na descrição). CWA repetido recebe
  **sufixo** (`020.01.1`, `020.01.2`). Tudo editável no app e a alteração vale para o app inteiro (referência por id).
- **ID único Simova numérico** `g.t` (grupo.tipo) e `g.t.n` quando há **texto complementar**:
  `2.3 Concreto 20 MPa` → `2.3.1 Concreto 20 MPa - (Fundo canaleta 2A)`. Complemento repetido reaproveita o ID.
- **Item de PQ** escolhido pelo programador na linha (uma linha de PQ por tipo de concreto); o item Simova com
  complemento fica preso a um item de PQ (aviso se tentarem usar com outro).
- **Semanal**: sexta de uma semana até sábado da seguinte (9 dias). **Mensal**: dia a dia.

## Negócio
- [ ] Frentes: Local/Área com id interno, código Simova editável (sufixo automático nos CWA repetidos), TAG normalizada
- [ ] Catálogo: Grupo (nº) → Tipo (nº, unidade, itens de PQ permitidos) → Item Simova (complemento, nº, item PQ)
- [ ] Programação: cabeçalho (SEMANAL/MENSAL, período), linhas (área, tipo, complemento→item Simova, item PQ,
      equipe/encarregado, unidade, quantidade), dias com Previsto e Realizado; emissão congelada (snapshot)
## Backend
- [ ] Importar lista de frentes colada (CODIGO⇥DESCRICAO) com sufixos
- [ ] Importar take-off: PQ CONTRATO (itens) + MC FRENTES (quantidade por TAG × item) como versão PQ
- [ ] Importar `.xer` direto (TASK, PROJWBS, TASKPRED) como versão CRONOGRAMA
- [ ] FT: linha da programação → FT (7 dias por linha; a semana de 9 dias vira 2 linhas)
- [ ] Exportar cadastros Simova: FRENTE (locais+áreas), OPER_GRUPO (grupos), OPER (tipos e itens com complemento)
## Frontend
- [ ] Menu novo: Programação · Frentes · Catálogo · Importações · (Administrar)
- [ ] Montar (uma tela) → Emitir → Imprimir no formato da obra (semanal e mensal) → FT
## Verificação
- [ ] Testes de domínio (IDs, sufixos, TAG, divisão da FT) e de fluxo HTTP; tsc + build; deploy
