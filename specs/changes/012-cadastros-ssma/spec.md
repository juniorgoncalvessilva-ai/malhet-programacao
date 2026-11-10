# 012 · Cadastros de SSMA e PTO com listas suspensas

## Por quê
Os itens de SSMA eram digitados livremente em cada linha. A obra quer um cadastro para escolher de lista, e o
PTO (Plano de Trabalho de Obra) é responsabilidade do Planejamento, não da segurança.

## O que muda
- Módulo `ssma`: `cadastro_ssma` (obra, tipo, código/nome, descrição, validade, ativo). Tipos: TECNICO, RAC, PTS,
  ART, ATA (segurança) e PTO (planejamento). `N/A` vale em toda lista sem cadastrar.
- `GET/POST/PUT/DELETE /api/ssma/cadastros`: segurança/planejador/admin editam os de SSMA; só planejador/admin o PTO
  (403 para os outros). Renomear propaga para as programações em rascunho; item em uso não é excluído (inativar).
- Tela **SSMA da programação**: técnico, RAC, PTS, ART e ATA em listas suspensas do cadastro (validade vencida ou
  perto de vencer aparece na opção); PTO só para consulta. A API recusa valor fora do cadastro (o valor que a linha
  já tinha continua aceito).
- PTO migrou para o Planejamento: menu "PTO (planejamento)" para cadastrar e lista suspensa no formulário da linha
  (montar). Só o planejador muda o PTO da linha.
- Menu: "Cadastros de SSMA" (segurança) e "PTO (planejamento)"; o item ativo do menu é o de caminho mais específico.

## Evidência (10/11/2026)
- `pytest -q`: 39 passed (cadastro por papel, duplicado, N/A, valor fora do cadastro, PTO só pelo planejamento,
  renomear propaga, item em uso não exclui, domínio).
- Navegador: segurança cadastrou 2 técnicos, ART com validade, RAC e ATA; não vê PTO; listas na SSMA trazem os
  cadastros e salvaram; planejador cadastrou PTO-001 e escolheu na linha.
