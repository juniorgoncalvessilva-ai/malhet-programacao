# 010 · Equipes do Simova, aba Cronograma, salvar programação, SSMA pela segurança e Excel do cliente

## Equipes (cadastro do Simova)
- Importa a exportação do Simova: Código | Descrição | Encarregado | Funcionário | Equipamento | Ativo.
  Pessoas vêm como "crachá :: NOME" (várias coladas na mesma célula) → `equipes/domain/simova_equipe.py`.
- Casa pelo código Simova (ou nome); reimportar atualiza encarregado, funcionários, equipamentos e ativo e
  **mantém** turno, jornada, responsável e a função informada de cada pessoa (`sincronizar_membros`, por crachá).
- Novos campos: turno (Diurno/Noturno/Administrativo/Turno A-C), jornada (h/dia), responsável, código Simova.
- Composição efetiva (`equipes/infra/composicao.py`): mão de obra = funcionários contados pela função (quando
  informada), senão a composição digitada; equipamentos = composição digitada. Alimenta capacidade/gargalo (CPU).
- Seleção da equipe na programação mostra código · nome · encarregado · turno · jornada; o responsável vem da equipe.

## Cronograma
- `GET /cronograma/arvore`: atividades do XER vigente com o caminho da WBS, datas, duração, status (pt-BR), % físico
  e em quais programações já estão. Tela com árvore por nível, busca, filtro de status e "só no período".
- Selecionar tarefas → enviar para uma programação em rascunho: grupo/tipo, equipe, natureza; área sugerida pelo
  CWA do caminho; quantidade prevista no período por tarefa; opção do nome da tarefa como texto complementar.

## Programação
- Linha: `qtd_periodo` (quanto se prevê no período), natureza P/O/E, responsável.
- Edição em lote: a tela acumula as alterações (período e dias, previsto/realizado) e `PUT /programacoes/{id}/salvar`
  grava tudo; aviso ao sair com alteração pendente; "distribuir" reparte o período nos dias (sem domingo).
- Realizado acumulado das programações anteriores do mesmo tipo (cada dia conta uma vez) e restante = projeto − feito.

## SSMA (papel `seguranca`)
- Papel novo na obra: consulta tudo e só edita SSMA (`Depends(ssma)`: segurança, planejador, admin).
- Por linha: técnico de segurança responsável, RAC, PTS, ART, PTO, ATA; vale também com a programação emitida.
- Tela "SSMA da programação" com N/A rápido e repetição do técnico na área.

## Excel do cliente (`GET /programacoes/{id}/excel[?revisao=]`)
- Layout da aba "Programação Semanal - S32": G Item · H ID Cronograma · I Programada/Oportunidade/Emergencial ·
  J Atividade · K Tipo · L Local · M CWA · N–S SSMA · T Responsável · U Encarregado · V Und · W/X/Y Projeto/Realizado/
  Restante · Z Peso · AA Status · AB–AJ Recursos (oficiais, servente, equipamentos) · AK P/R · AL… dias · Total ·
  Aderência · análise de indicadores · ITEM PQ, PU, faturamento previsto/real (fórmulas).
- Faixa do local em vermelho, área "CWA x - descrição" em azul #173761, zoom 20%, A4 paisagem ajustado à largura.
- Mensal: as colunas de dia crescem e as seguintes deslocam junto.

## Evidência (10/11/2026)
- `pytest -q`: 34 passed (parser do Simova, reimportação sem duplicar, lote, realizado anterior, papel segurança,
  Excel semanal e mensal). Planilhas reais (nomes/crachás) usadas só localmente, fora do git.
- Navegador: Equipe.xlsx real → 21 equipes; EQUIPE.2 noturno 8,5 h com 4 pedreiros e 6 serventes (85 HH/dia);
  cronograma com 4.441 atividades em árvore; 2 tarefas enviadas para S32; período 48 → distribuir → salvar
  (10 alterações); usuário segurança salvou SSMA e não consegue editar linhas; Excel conferido célula a célula.
