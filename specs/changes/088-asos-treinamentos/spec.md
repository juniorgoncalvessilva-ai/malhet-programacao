# Spec 088 — ASOs e treinamentos em Cadastros de SSMA

## Pedido
"Traga a página de controle de ASOs e treinamentos presentes no Planning Control, com abas extras de cadastros e
métricas; já temos a página Cadastros de SSMA, só precisamos melhorá-la."

## Modelo (`treinamentos/`, todas as tabelas com `obra_id`)
- `treinamento` (catálogo: nome, norma, validade em meses — 0 não vence —, carga horária, **impeditivo**, **todos**, ativo).
- `treinamento_funcao` (exigência por função do efetivo, pela chave da função do de-para).
- `colaborador_treinamento` (pessoa × treinamento: realizado em, válido até — padrão pela validade do catálogo —, quem ministrou).
- `aso` (tipo admissional/periódico/mudança de função/retorno/demissional, data do exame, válido até — padrão 12 meses —,
  resultado apto/apto com restrição/inapto, clínica). **Nunca diagnóstico/CID** (NR-7: só o resultado; LGPD art. 11, II, a).

## Regras (`domain/aptidao.py`)
- Válido / Vencendo (janela padrão 30 dias) / Vencido / Faltando. ASO vigente = o mais recente não demissional;
  inapto não libera. Exigido = "todos" + os da função. Impedida = ASO sem/inapto/vencido ou impeditivo faltando/vencido.
- Gateway publicado `AptidaoGateway` (usado pela mobilização e pela ficha).

## API (`/treinamentos`, escrita com `Depends(ssma)`)
catalogo (CRUD; com registros não exclui — desative), exigencias (GET/PUT por função), asos (CRUD), registros (turma:
um treinamento para várias pessoas; excluir), pessoa/{id} (ficha de segurança), matriz, indicadores (com memória).

## Tela `/app/ssma/cadastros` em abas
Métricas (conformidade, impedidos, ASOs e treinamentos válidos/vencendo/vencidos/faltando, por treinamento, vencimentos
em 60 dias) | ASOs | Treinamentos (catálogo + turmas + quem fez) | Exigência por função (grade função × treinamento) |
Matriz pessoa × treinamento (✔ ! ✖ —) | Técnicos, RAC, PTS, ART e ATA (cadastro de antes). Nome da pessoa abre a ficha.

## Testes
`tests/test_treinamentos.py` (validade, vigente, exigência, impeditivo, métricas, API e isolamento por obra) e e2e.
