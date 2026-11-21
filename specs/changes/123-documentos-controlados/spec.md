# 123 — Documentos controlados: LDO, revisões, GRD e projetos no campo (ISO 9001:2015, 7.5)

## Origem
Ideia trazida do repositório CorpMind (`juniorgoncalvessilva-ai/malhet`: Lista Mestre `doc_master`, GRD `doc_grds`/`doc_grd_items`,
tipos de documento, notas Zettelkasten `based_on/see/used_in` e graphify). O código não foi portado (lá é Supabase); aqui é um
módulo por obra no padrão do Malhet. Gate MVE: risco médio, estágio 3, confiança 87 ≥ 87 (verificação com DWG reais da obra).

## ISO 9001:2015 · 7.5 → Malhet
| Requisito | Onde |
|---|---|
| 7.5.2 identificação e descrição (título, data, autor, código) | LDO: código do cliente, código da contratada, título, tipo, disciplina, revisão, data; o carimbo do desenho preenche |
| 7.5.2 análise e aprovação antes do uso | finalidade da revisão: só "para construção / aprovado / liberado / como construído" vira vigente |
| 7.5.3 disponível onde e quando necessário | `/m/documentos`, "Projetos e procedimentos" no detalhe da atividade e aba Projetos no `/encarregado` (só a vigente) |
| 7.5.3 distribuição, acesso, recuperação | GRD recebida/emitida com itens e ciência; `documento_leitura` (quem abriu qual revisão, por onde) |
| 7.5.3 controle de alterações | histórico de revisões; revisão guardada não é sobrescrita; a anterior vira superada |
| 7.5.3 retenção e disposição; evitar obsoleto | superada continua consultável e marcada; o campo e o encarregado não abrem superada |
| 7.5.3 origem externa (normas, procedimentos) | tipos NOR, PRO, ESP, IT ligados a grupos de atividade e frentes |

## Comportamento
- **Revisão pelo arquivo** (`POST /documentos/revisoes`, vários de uma vez na tela): DWG → DXF pelo conversor separado
  (`apps/api/conversor/dwg2dxf.mjs`, GPL-3.0 — LibreDWG; a API só executa o programa; nada vai ao navegador) → ezdxf (MIT) lê o
  carimbo (bloco com atributos: código, contratada, revisão, finalidade, título, data, projeto), os textos (TAGs `TQ-1870AA-01`) e
  desenha a folha em PDF (vetorial) e PNG (~3500 px). DXF, PDF e imagem também entram. O formulário tem prioridade sobre o carimbo;
  sem nada, o código vem do nome do arquivo. Arquivos no acervo Zettelkasten (`05-documentos`) com as ligações no `.md`.
- **Vigente**: calculada, nunca gravada. Letras (emissões preliminares) antes dos números. Revisão "para comentários" não derruba a
  vigente. Cancelada na última = sem vigente. Nova vigente avisa (sino) planejamento e encarregados.
- **LDO**: planilha com CÓDIGO e TÍTULO (+ Nº contratada, REV., finalidade, tipo, disciplina, data, frente); reimportar atualiza sem
  duplicar; a revisão listada fica esperando o arquivo; o arquivo depois completa a mesma revisão. Excel da LDO com as logos.
- **Ligações Zettelkasten**: aplica-se a / referencia / baseado em / substitui → frente, WBS, grupo de atividade ou outro documento.
  TAG do desenho sugere a frente (`sugerido` até o Planejamento confirmar). "Citado por" mostra as ligações reversas. Mapa de
  conexões (`GET /documentos/grafo`) — o mesmo grafo que o graphify/Obsidian monta das notas do acervo.
- **GRD**: numeração `GRD-R|E-AAAA-NNNN`; recebida (as revisões que chegam apontam para ela) e emitida (vai a vigente de cada
  documento); ciência de quem recebeu; Excel com as logos.
- **Campo**: só documentos com vigente e ligação confirmada à frente, ao IWP/CWP (e nós acima) ou ao grupo da atividade.
  `VerRevisao`: folha com zoom (botões, dois dedos, duplo toque), PDF no leitor do aparelho, original para baixar.
- Fica para a próxima: visualizador interativo com camadas (cad-viewer, MIT, recebendo DXF).

## Verificação
- `tests/test_documentos.py` (domínio, carimbo, vigente/superada, LDO, GRD, campo, isolamento, encarregado); teste com DWG real só
  local (`DWG_REAL=…`, projeto do cliente fora do git) — passou com o 1870AA-C-51891.
- Imagem: Node 20 (de `node:20-slim`) dentro de `python:3.12-slim` (Debian 13) converteu o DWG real (teste local de contêiner).
- E2E: dois DWG reais enviados juntos → carimbo, rev. 4 vigente, ligação à frente, folha com zoom, GRD, LDO em Excel, celular e
  mapa de conexões.
