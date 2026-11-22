# 133 — Controle de projetos por ativo: projeto ↔ CWA na Conexões, na WBS e no plano

## Pedido (usuário, 22/11/2026)
"Segue controle de projetos por ativo, ele é responsável de ligar os projetos aos CWA's. Com ele é possível melhorar a aba
Conexão e WBS e demais sequências." (planilha da obra; fica fora do git)

## A planilha (domain/controle_ativo.py)
Cabeçalho achado pelos nomes: STATUS | Ativo | Projeto | Disciplina | OBS. Linha só com a 1ª coluna = grupo (CMD, OFICINA,
CANTEIRO VALE, RETIRADO DE ESCOPO ou EXTRA…). STATUS e Ativo vêm mesclados sobre os projetos (vazio = o de cima). Uma célula de
Ativo pode ter vários ("CWA 004.12 - ED-1800AA-06 - …" em linhas) → `ler_ref` separa CWA, TAG (inclusive ED-1670AA-FILT-LUB) e
descrição. Projeto: número do documento (".REV.A_APR" vira revisão citada); "SEM PROJETOS"/"EM ADEQUAÇÃO" = sem projeto. OBS
"Cancelado" tira o projeto do ativo; coluna sem nome depois de OBS entra na observação. STATUS em texto livre → `status_chave`:
ok, parcial ("Parc. Ok"), pendente, critico ("Pendência de informações críticas"), sem_projeto, revisao, outro. `LIBERA` = ok/parcial.

## O que muda
- **Casamento ativo → frente** (`casar_ativo`): TAG única (desempata pelo CWA) ou CWA único confirmam; CWA com várias áreas
  desempata pelo nome; só o nome sugere (`casar_local`). Nada casou → "sem frente".
- **Importar** (`application/controle_ativo.py`, `POST /documentos/ativos/previa` e `POST /documentos/ativos`): substitui o controle
  da obra (`controle_ativo` com `refs` JSONB por ativo + `controle_ativo_projeto`) e liga cada projeto da LDO à frente (aplica_a →
  área): confirmada pela TAG/CWA (confirma a sugestão antiga da LDO), sugerida pelo nome. Cancelado não liga e tira a sugestão
  antiga daquele par. Fora da LDO só é listado (nunca cria documento) — com a dica "na LDO como …?" quando o mesmo número existe
  com outra letra na mesma área (`_parecidos`, ex.: 1600AA-A-51274 × 1600AA-C-51274), sem ligar.
- **Relacionar à mão** (`PUT /documentos/ativos/{cid}/frente` com `indice`, `area_id`): ativo sem frente ou sugerido → confirmado,
  e os projetos dele passam a valer para a frente.
- **Situação por frente** (`GET /documentos/ativos/situacao`, `situacao_por_frente`): o pior status dos ativos da frente,
  projetos (não cancelados) e quantos com revisão vigente, com memória (cada projeto com a linha da planilha).
- **Conexões** (super admin, como na spec 127): "Projetos por ativo" (padrão) | "Mapa das ligações" (`ProjetosPorAtivo`):
  importar com prévia, indicadores (ativos, vigentes/projetos, sem vigente, fora da LDO, ativos sem frente, desenhos da LDO sem
  ativo), filtros por status / sem frente / a cobrar, busca, grupo → ativo → projetos (abre o documento), confirmar/relacionar.
- **WBS**: a linha da Área mostra a situação dos projetos (`PilulaProjetos`, `useSituacaoProjetos`) com "vigentes/total" em
  `<Calculado>`. **Plano 90 dias**: a mesma pílula no cabeçalho da área; no item cuja frente não libera, aviso "Projeto da frente"
  e "Preencher restrição de projeto" (6M Método, impeditiva) para mandar ao 6WLA. O campo já usa as ligações confirmadas.
- Migração `0066_controle_ativo`.

## Verificação
`tests/test_controle_ativo.py`: leitura (status, CWA/TAG, revisão no código, mesclas, grupos, coluna sem nome); prévia não grava;
TAG/CWA confirmam (inclusive a sugestão da LDO), nome sugere, cancelado remove a sugestão, fora da LDO com dica sem ligar;
situação por frente (pior status, vigentes/total, memória com linha); relacionar à mão; reimportar não duplica; por obra.
Arquivo real (ATIVO_REAL): 71 ativos, 497 projetos. E2E com a LDO e a lista de CWAs reais: 199 ligações novas e 72 confirmadas;
320/466 projetos vigentes, 136 fora da LDO (vários com outra letra de disciplina na LDO), 17 referências sem frente; ativo
"Piso de concreto … PP 1ª etapa" relacionado à 012.11; WBS com 41 áreas marcadas e a memória 40/41 da 004.00.
