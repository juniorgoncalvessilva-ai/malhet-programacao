# 132 — Enviar documentos por tipo, associação automática à LDO e área "A relacionar"

## Pedido (usuário, 22/11/2026)
"Em Documentos, precisamos de um local prático que possa fazer o upload dos documentos por tipo e associação dos mesmos à lista de
documentos; deve ser feita automática e, quando não possível, deve ter uma área para relacionamento do mesmo à lista e a outros
documentos."

## O que muda
- **Aba "Enviar e relacionar (N)"** em `/app/documentos` (planejador; N = arquivos pendentes), `EnviarDocumentos.tsx`. Substitui o
  antigo "Enviar revisão" da Lista; a ação rápida "enviar" das Pastas abre esta aba.
  - **Chegou documento?** — tipo em chips ("Pelo arquivo" ou um dos `TIPOS`), GRD em que chegou (opcional) e área de arrastar
    vários arquivos de uma vez (DWG, DXF, PDF, imagem). Cada arquivo sai com ✓ associado (documento, revisão e *como* casou) ou
    ⚠ a relacionar (o motivo).
  - **O que falta relacionar?** — um cartão por arquivo: Ver, Descartar (confirma), sugestões em chips; "Associar à LDO" (busca,
    documento, revisão) ou "Documento novo" (código, título, revisão, tipo); finalidade, relação e "Relacionar a outros documentos".
- **Casamento** (`domain/casamento.py::casar`): procura o código da LDO (do cliente ou da contratada, o mais longo, ≥ 6
  caracteres normalizados) no **carimbo** do desenho, depois no **nome do arquivo**, depois no **texto da 1ª página do PDF**. A
  revisão vem do carimbo, do nome (`_R4`, `rev B`, `REV-03` → 3) ou, se a LDO tem uma só revisão esperando arquivo, dela. Nunca
  chuta: código fora da LDO não vira documento sozinho — exceto o do carimbo do desenho com revisão (informação controlada).
  Não casou → motivo + até 5 sugestões por palavras em comum com o título.
- **Envio** (`application/envio.py::enviar`, `POST /documentos/enviar`): casou → `registrar_revisao` (a leitura do DWG é feita uma
  vez só: `servico.ler_arquivo` + `leitura=`). Não casou, faltou a revisão ou a revisão já está guardada → o arquivo vai ao acervo e
  a `documento_recebido` (pendente, com código/revisão/título lidos, motivo, sugestões, GRD).
- **Relacionar** (`associar`/`criar`/`descartar`, `GET /documentos/recebidos`, `…/{rid}/arquivo`, `POST …/{rid}/associar`,
  `POST …/{rid}/novo`, `DELETE …/{rid}`): associar registra a revisão no documento escolhido; documento novo entra na lista (código
  repetido = 422, use associar); os dois ligam a outros documentos (`vincular`, relação referencia/baseado_em/substitui) e apagam a
  cópia temporária do acervo (a revisão guardou a dela). Descartar apaga o arquivo. Tudo por obra.
- Limpeza do acervo não apaga o que está em uso por GRD (`grd.arquivo_id`) nem o que está a relacionar (`_em_uso`).
- Migração `0065_documento_recebido`.

## Verificação
`tests/test_envio_documentos.py`: nome com código + `_R2` associa; código sem revisão com única revisão pendente na LDO associa;
DXF com código no carimbo fora da LDO entra; mesma revisão de novo vai para relacionar ("já está guardada"); nome sem código →
sugestão certa; código fora da lista → "não está na lista"; associar com relacionamento; criar documento; código repetido 422;
descartar; isolamento por obra. E2E com a LDO real (400 documentos): três arquivos arrastados juntos — `1870AA-A-52640_R2.pdf`
associado pelo nome (rev. 2), `C-51890.dwg` associado pelo carimbo (1870AA-C-51890 rev. 4), "planta urbanizacao ampliacao
trecho.pdf" a relacionar com sugestões 52638…52637; associado pelo cartão à 1870AA-A-52638 rev. 0. Aba mostra "(1)" → zera.
