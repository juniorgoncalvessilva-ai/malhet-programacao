# 124 — Take-off pelo projeto: quantidades lidas do desenho, conferidas, até o IWP

## Origem
O usuário pediu o take-off do repositório CorpMind (`juniorgoncalvessilva-ai/malhet`) para "levantar quantidades através da leitura
dos projetos". Lá o take-off lê **planilhas** (prévia de take-off, dicionário de avanço, cabos, RAO); DWG/DXF fica só como
"referência" (`import_cad_reference`, `processing_mode: reference_only`), sem extrair nada. O Malhet já lê a planilha de take-off
(PQ + aba MC por TAG, spec 008). O que faltava — e é o que esta spec faz — é tirar a quantidade **do próprio desenho**, que já entra
pela spec 123 (DWG → DXF). Do CorpMind vem a ideia de linhagem (item ↔ documento ↔ WBS) e de conferir uma fonte com a outra.

## O que se lê (sem IA, sem adivinhar)
Verificado nos DWG reais da obra (1870AA-C-51890 e 51891, AutoCAD 2018):
- **Quadros** — o AutoCAD guarda cada célula como um TEXT solto; o quadro é montado pela posição: título conhecido → primeira linha
  com 2+ textos não numéricos = cabeçalho (colunas pelo centro de cada texto, alinhamento do TEXT/MTEXT resolvido) → linhas até um
  espaço maior que o normal, outro título ou TOTAL.
  - **RESUMO AÇO** (aço, Ø, TOT., MASSA): uma quantidade em kg por aço e diâmetro, conferida pela massa linear da NBR 7480
    (344 m × 0,245 = 84,28 ≈ 84 kg), pela soma das posições da TABELA DE FERROS (227 + 74 + 43 = 344 m) e pelo TOTAL (379 kg).
    No 51890 tudo bate; no 51891, 2.334 kg de Ø12,5.
  - **TABELA DE FERROS** sozinha: massa = Σ comprimento × massa linear; cada posição conferida (Q × UNIT = TOT).
  - **LISTA/QUADRO DE MATERIAIS**: descrição, quantidade e unidade por linha.
- **Anotações** com número e unidade ("147,20m²+10% = 161,92" vale 161,92 m²; "869,51kg"), com o rótulo escrito logo acima.
- **Medições do desenho**: comprimento e área fechada por camada, contagem de blocos — na unidade do desenho (o cabeçalho dos DWG
  reais diz metro e a geometria está em outra escala), então o planejador informa o **fator** ao aceitar.

Toda quantidade nasce com memória (fórmula, passos, fontes com o lugar no desenho: quadro, linha, camada, x/y). Quadro que não bate
vira "Não bate" com o motivo.

## Decisão e destino
- `takeoff_projeto` (por revisão, `obra_id`): chave estável ("aço CA50 Ø8") → a revisão nova mostra **Δ** e herda item, frente e
  fator, mas volta a "a conferir" (aceitar de novo); descartado continua descartado. Ler de novo a mesma revisão não duplica.
- Item da PQ **sugerido** pela descrição e unidade (aço → "Armadura em aço CA-50…" na PQ real) — nunca vincula sozinho (regra da
  spec 083). Quadro/anotação só vai para item na mesma unidade (kg ↔ t converte); frente vem da ligação do documento (TAG, spec 123).
- **Comparação** por item × frente: projeto (aceitas das revisões **vigentes**) × take-off da planilha (TAG da frente, aba MC) ×
  quantidade do IWP, com a diferença em % e memória de cada número.
- **Usar no IWP**: o total do projeto vira a quantidade do IWP (gateway da WBS), com a origem anotada na observação
  ("take-off do projeto: 1870AA-C-51890 rev. 4"). Sem IWP ou com mais de um, a tela diz o que fazer.

## Telas
- `/app/documentos` → aba **Take-off do projeto** (todas as quantidades + "O projeto bate com o take-off da planilha?").
- Detalhe do documento → seção **Quantidades do projeto** (só a revisão vigente; "todas as revisões"; "ler de novo").

## IA (fica para as próximas specs — avaliação pedida pelo usuário)
Licenças conferidas nos repositórios em 21/11/2026:

| Projeto | Licença | Encaixe no Malhet |
|---|---|---|
| Presenton | Apache-2.0 | apresentações por pedido em texto mantendo a identidade; o Malhet já gera o .pptx no modelo da obra (spec 104) — dá para usar o gerador de conteúdo dele por trás do nosso modelo |
| Jan | Apache-2.0 | é app de computador (chat local), não servidor; serve como "modelo local sem internet" para quem não pode mandar dado para fora, via a API compatível com OpenAI que ele expõe |
| AnythingLLM | MIT | chat com PDFs/contratos com RAG; leve, roda como serviço separado |
| RAGFlow | Apache-2.0 | melhor leitura de documentos com citação da fonte; pesado (Elasticsearch/Infinity, ~16 GB RAM) — não cabe na KVM1 |
| Dify | Apache-2.0 **modificada** | proíbe operar multi-inquilino sem licença comercial e tirar a logo do console — o Malhet é por obra/empresa, então não usar como base |

Caminho recomendado: uma porta "Assistente" na API (provedor configurável: Claude pela API ou modelo local via Jan/Ollama), com as
ferramentas sendo as **funções do próprio Malhet** (ler WBS, programação, documentos, take-off, CPU) e a busca nos documentos em
pgvector no Postgres que já temos. O take-off desta spec é a base determinística que a IA depois explica e completa (quadros fora do
padrão, notas de projeto), sempre como sugestão com a fonte. Dado de contrato/projeto que vai para modelo externo precisa de aviso
na política de privacidade e opção local.

## Verificação
- `tests/test_takeoff_projeto.py`: recorte real da TABELA DE FERROS/RESUMO AÇO do 51890 (posições do arquivo), quadro que não bate,
  só tabela de ferros, lista de materiais, números/sugestão/unidade/ordem, fluxo pela API (desenho → aceitar → comparar → IWP →
  revisão nova com Δ → ler de novo sem duplicar) e isolamento por obra; DWG real com `DWG_REAL` (passou com 51890 e 51891).
- E2E com os dois DWG reais e a PQ real: sugestão do item 1.8.2.1.2, quatro diâmetros aceitos = 379 kg, memória abrindo a conta.
