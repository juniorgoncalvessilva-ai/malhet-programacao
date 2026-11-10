# Domínio e regras de cálculo

## Hierarquia Simova
`FRENTE` (local) → `OPER_GRUPO` (CONCRETO, FORMA…; unidade, materiais) → `OPER` (atividade padrão; chave **grupo + código**)
→ `FT_IMPORT_INTERMEDIARIA` (encarregado × OPER × frente × período; PE/HH por dia da semana).
`TAREFA` = itens AWP (CWA/CWP/IWP) e CPUs do Simova. `EFETIVO_FUNCAO` = funções (TIPO 5 = encarregado, 6 = direto, 3 = operador…).

Qualidade de dados conhecida (o importador avisa): OPER_GRUPO com códigos 28–33 repetidos; OPER `9.1`/`9.2` em dois
grupos; MATERIAL com códigos 12–19 repetidos (vale a última linha).

## Versões de referência
Cada carga cria `versao_referencia` (tipo, rótulo, data-base, arquivo). Só **uma vigente por tipo** (índice único
parcial). Itens (atividade_cronograma, item_pq, cpu_recurso, indice_especifico) pertencem à versão.
O **vínculo** guarda chaves estáveis (`id_crono`, `item_pq`, `composicao`, `indice_codigo`, OPER Simova) e é
resolvido contra as vigentes (`ResolvedorReferencias`), que também lista **pendências** (ex.: atividade sumiu do cronograma).
Cada item de programação grava `versoes` = ids vigentes no momento → rastreabilidade.

## Fórmulas (portadas de programacao_v5.py / Programacao_auxiliar_v5)
| Grandeza | Fórmula | Código |
| --- | --- | --- |
| Índice ORÇADO (un/dia) | jornada ÷ coef. do recurso que governa (da PQ/cronograma; senão maior coef. MOD) | `indice.indice_orcado` |
| Índice USADO | específico › AJUSTADO (manual › orçado × fator família) › ORÇADO | `indice.indice_usado` |
| fator índice | orçado ÷ usado | `indice.fator_indice` |
| h/un por função | coef. CPU × fator; com específico: oficial = J/índice, ajudante = ajud/oficial × J/índice | `indice.coeficientes_usados` |
| HH/un (MOD) | Σ h/un das funções MOD | `indice.hh_por_unidade_mod` |
| HH do dia | PE × HH/un (se o HH não for digitado) | `ItemProgramacao.com_hh_calculado` |
| HH disponível | Σ quantidade MOD × jornada da equipe | `capacidade.hh_disponivel` |
| Capacidade da equipe | jornada ÷ max(coef_f ÷ qtd_f); sem o recurso que governa = 0 | `gargalo.capacidade_da_equipe` |
| Equipe p/ prazo | ⌈restante ÷ (índice × dias de ref. até o fim)⌉ | `gargalo.equipe_para_prazo` |
| Calendário | SEMANAL = 9 dias (sexta de emissão → sábado; 2 primeiros com 0 h); MENSAL = mês; fator = horas ÷ jornada | `calendario.Calendario` |
| Sequência | serial por equipe; TI/II + lag; começa quem pode começar antes | `sequenciador.sequenciar` |

## Regras do item de programação
Período ≤ 7 dias (FT semanal) · dias dentro do período, sem repetição · PE/HH ≥ 0 e ao menos um preenchido ·
origem `cronograma` exige `id_crono`, `pq` exige `item_pq`, `padrao` = OPER sem vínculo ·
fluxo `rascunho → aprovado → exportado` (exportado não se exclui) ·
excesso de HH no dia bloqueia, salvo `permitir_excesso`.

## Macros VBA → aplicação (`docs/legado/Programacao_v5_macros.bas`)
| Macro | Na aplicação |
| --- | --- |
| ReorganizarTudo | ordenação LOCAL → ÁREA na listagem; descarte de linhas incompletas (spec 002) |
| SequenciarEquipes | `POST /api/programacao/sequenciar` |
| AtualizarProgramacao | recálculo automático + alertas (SEM QUANTIDADE / SEM ÍNDICE / EQUIPE SEM …) (spec 002) |
| EmitirSemanal/Mensal | emissão = foto imutável versionada da programação (spec 004) |
