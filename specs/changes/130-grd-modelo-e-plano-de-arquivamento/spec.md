# 130 — GRD no modelo do contrato, plano de arquivamento e carimbos de controle

## Modelos de referência (enviados pelo usuário, fora do git)
- **GRD-MIL-0272.xlsx** — Guia de Remessa: FOLHA x de y · DATA · PARA / DE / GRDT Nº · ATENÇÃO / EMITENTE / REFERÊNCIA com
  ÁREA/CARGO · itens Item · Nº Documento · Título · Rev. · Nº folha · Status · Finalidade · Tipo · Formato · Nº vias · Observações ·
  legendas (STATUS A–H + OB obsoleto; FINALIDADE 1 informação · 2 análise/liberação · 3 aplicação/construção · 4 arquivo ·
  5 cancelar · 6 as built/redline · 7 compra; TIPO DE VIA OR/CC/CO/CH/AD/OT; FORMATO A0–A4, carta, ofício) · REMETENTE /
  RECEBIDO com data, carimbo e assinatura.
- **PR-17321-002 Plano de Arquivamento** (.doc, aberto sem senha): documento × registro (registro = evidência); código
  TIPO-OPERAÇÃO-SÉRIE-REV; responsável, local e meio; retenção (na obra durante a execução, depois no Data-Book pelo prazo do
  contrato); GRD em toda distribuição externa; cópia controlada carimbada; obsoleto identificado "DOCUMENTO OBSOLETO".

## O que muda
- **GRD** (`documentos/domain/grd.py`, `grd` + `grd_item`): campos atenção/emitente com área-cargo, referência e o arquivo da GRD
  como chegou (`grd.arquivo_id`); itens com folhas, status (letra do TE), finalidade da remessa (1–7), tipo de via, formato e nº de
  vias. GRD emitida: status e finalidade saem da revisão (para construção → E e 3), via padrão CC, 1 via.
- **Importar GRD recebida** (`POST /documentos/grds/importar`): lê o Excel pela posição dos rótulos (valor na linha de baixo),
  cria a GRD (o número de quem mandou fica como origem, não entra duas vezes), registra documento e revisão listada apontando para
  a GRD (tipo pelo código: IT, PO/PR → procedimento, NR/NBR → norma…), guarda a planilha no acervo (`GET …/grds/{id}/arquivo`).
- **Excel da GRD no modelo** (`planilhas.grd_xlsx`): cabeçalho, colunas e legendas do modelo, observações e os blocos de
  remetente/recebido (ciência registrada preenche o recebido).
- **Plano de arquivamento** (pastas da spec 129): cada pasta ganha natureza (documento/registro), responsável, meio, local e
  retenção (padrão do modelo; 60 Complementares = registro); `GET /documentos/plano-arquivamento.xlsx` com uma linha por pasta e
  as regras de controle (GRD, LDO/carimbo, cópia controlada/obsoleto, leituras, acervo, nome padrão).
- **Carimbos na tela** (`VerRevisao carimbo`): vigente = "CÓPIA CONTROLADA"; superada/cancelada = "DOCUMENTO OBSOLETO"; o campo só
  vê vigente (sempre "cópia controlada").

## Verificação
`tests/test_grd_modelo.py` (leitura do layout, regras de via/formato/finalidade, importar GRD recebida com revisões e arquivo, não
duplica, Excel com os rótulos e legendas, GRD emitida com status/finalidade/via, plano de arquivamento com natureza/retenção e as
regras) + GRD real com `GRD_REAL`. E2E: GRD-MIL-0272 importada pela tela (10 documentos na pasta Procedimentos), Excel no modelo e
plano baixados, carimbo "Cópia controlada" na folha vigente.
