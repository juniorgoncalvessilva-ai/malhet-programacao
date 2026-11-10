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
- [x] Frentes: Local/Área com id interno, código Simova editável (sufixo automático nos CWA repetidos), TAG normalizada
- [x] Catálogo: Grupo (nº) → Tipo (nº, unidade, itens de PQ permitidos) → Item Simova (complemento, nº, item PQ)
- [x] Programação: cabeçalho (SEMANAL/MENSAL, período), linhas (área, tipo, complemento→item Simova, item PQ,
      equipe/encarregado, unidade, quantidade), dias com Previsto e Realizado; emissão congelada (snapshot)
## Backend
- [x] Importar lista de frentes colada (CODIGO⇥DESCRICAO) com sufixos
- [x] Importar take-off: PQ CONTRATO (itens) + MC FRENTES (quantidade por TAG × item) como versão PQ
- [x] Importar `.xer` direto (TASK, PROJWBS, TASKPRED) como versão CRONOGRAMA
- [x] FT: linha da programação → FT (7 dias por linha; a semana de 9 dias vira 2 linhas)
- [x] Exportar cadastros Simova: FRENTE (locais+áreas), OPER_GRUPO (grupos), OPER (tipos e itens com complemento)
## Frontend
- [x] Menu novo: Programação · Frentes · Catálogo · Importações · (Administrar)
- [x] Montar (uma tela) → Emitir → Imprimir no formato da obra (semanal e mensal) → FT
## Verificação
- [x] Testes de domínio (IDs, sufixos, TAG, divisão da FT) e de fluxo HTTP; tsc + build; deploy

## Evidência (10/11/2026)
- `pytest -q`: 25 passed (inclui `test_programacao_simplificada.py`: sufixos, TAG, IDs g.t.n, janelas da FT, fluxo HTTP, XER real).
- `tsc --noEmit` limpo; `next build` ok.
- Navegador (Playwright, API + web locais, XER S31 e take-off reais): colar frentes → 2 locais/4 áreas com 020.01.1/020.01.2;
  editar a descrição da área reflete na programação aberta; catálogo 1 Concreto → 1.1 Concreto 20 MPa → 1.1.1 (Fundo canaleta 2A);
  semanal S32 06/11–14/11 com P digitado (8+12+20 = 40); Emitir trava o previsto (rev. 0); Imprimir mostra a revisão emitida;
  FT baixa (linha sem crachá fica pendente e não entra); cadastros Simova com FRENTE/OPER_GRUPO/OPER.
- Item de PQ real (1.8.3.1.2) traz PU e R$ previsto; mesmo complemento apontando para outro item de PQ gera aviso.
