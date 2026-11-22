# 129 — Pastas de documentos e Consolidado (rastreio por período)

## Fontes
- Estrutura do Malhet: acervo Zettelkasten por obra (`Malhet/obras/<obra>/05-documentos/…` + ficha `.md`), LDO, pacotes, revisões, GRD.
- Vídeo Growarq "organização de arquivos" (youtube Z9ehcwBKcpE): código do projeto em tudo; **pasta-modelo** ("0000 Nome do
  Projeto") que ninguém mexe e é copiada a cada projeto; pastas por fase espelhando o processo; nome de arquivo
  CÓDIGO_ETAPA_DISCIPLINA_REVISÃO; histórico por etapa.
- Inspiração "/dashboard/docs": atalhos de pastas com contagem, tabela NOME · TIPO · ITENS · ÚLTIMA ATUALIZAÇÃO · AÇÕES, pasta
  sugerida "não criada", armazenamento usado, ações rápidas (upload, novo documento, nova pasta).
- Complemento "/dashboard/document-consolidator": central de rastreio do que foi emitido por período (Mensal · Semanal ·
  Assinado · Pendente).
- MVE: risco médio (tabela nova + tela, reversível), estágio 3; skills `ui-malhet` (tela) e `model-modulo-api` (regras).

## Decisões
- **Pasta = regra, não lugar** (`documentos/domain/pastas.py`): tipo, disciplina (sigla ou nome) e pacote da LDO. O documento
  aparece em toda pasta cuja regra cumpre; nenhum arquivo é movido; nada se perde numa pasta errada. O que não cabe em pasta
  nenhuma fica em **"Sem pasta"**, com a pasta **sugerida** pelo tipo mais comum (o "Contratos — sugerida" do MD).
- **Pasta-modelo do Malhet** (imutável no código): 10 Contrato e listas (LDO) · 20 Projetos · 30 Especificações e memoriais ·
  40 Procedimentos e instruções · 50 Normas · 60 Documentos complementares. A obra recebe a cópia (`documento_pasta`, `do_modelo`)
  na primeira abertura e ajusta a dela; pasta nova ganha o próximo código (70, 80…); "Restaurar do modelo" devolve as apagadas.
- **Código em tudo**: arquivo baixado sai como `OBRA_CÓDIGO_Rrev_TE.ext` (`nome_padrao` / `nomeArquivo`); TE = letra do tipo de
  emissão (spec 128). A ficha `.md` do acervo continua guardando as ligações.
- **Consolidado** (`GET /documentos/consolidado?periodo=semana|mes&ref=&situacao=`): revisões (data em que o arquivo chegou ou,
  sem arquivo, a data de envio da LDO) e GRDs do período; **assinado** = comprovado (arquivo guardado / ciência registrada),
  **pendente** = sem arquivo / sem ciência; "Comprovado %" com memória.

## Telas (`/app/documentos`)
Abas Pastas (padrão) · Lista de documentos (LDO) · Consolidado · GRDs · Conexões (super admin) · Importar LDO.
- Pastas: cartões de atalho (ícone pelo tipo, código, itens, vigentes, última revisão), tabela das pastas com a regra em pílulas
  e a origem (Pasta-modelo / Criada na obra), linha "Sem pasta" com "Criar pasta", Nova pasta (tipos, disciplinas, pacotes),
  armazenamento (documentos × obra × limite), ações rápidas e "Como nomeamos os arquivos" com um exemplo real.
- Dentro da pasta: trilha, subpastas por pacote e por disciplina, documentos com a revisão que vale.
- Consolidado: Mensal/Semanal, ‹ período ›, Todos/Assinado/Pendente, indicadores e a lista com o rastro (arquivo/GRD/ciência, quem).

## Verificação
`tests/test_pastas_documentos.py` (regras, nome padrão, sugestão; pastas pela API com LDO, pasta nova por disciplina, Sem pasta,
restaurar, isolamento; consolidado mês/semana/assinado/pendente). E2E com a LDO real: 6 pastas do modelo, Projetos 400 (358
vigentes), pacote 16XXCC - OFICINA 229, consolidado de junho 64 pendentes, celular sem rolagem lateral.
