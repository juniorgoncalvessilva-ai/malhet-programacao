# 071 — Presença do dia: equipes agrupadas e aba Indicadores

## Pedido
1. Na Presença do dia não mostrar (por enquanto) as atividades programadas; otimizar espaço agrupando as equipes e
   melhorar o layout.
2. Criar uma aba de indicadores na Presença do dia.

## O que muda
- `GET /presenca/dia` traz `setor {id, nome, cor}` de cada equipe. A conta da capacidade com os presentes por linha da
  programação (spec 063) só roda com `?atividades=true` (a tela não pede mais; a conta continua disponível).
- Tela `/app/presenca` em abas **Equipes | Indicadores** (`components/Obra/Abas`).
  - **Equipes**: equipes agrupadas por setor (cor do setor; "Sem setor" por último), cartões compactos em grade
    (presentes/total, barra, HH com memória, funções, ausentes ≤ 3 por nome, nomes ao expandir), busca por equipe,
    encarregado, setor ou pessoa, filtros Todas / Com ausentes / Completas e "Mostrar nomes" para todas. Total do
    setor e "Nas equipes" com memória. Presentes sem equipe em lista no fim.
  - **Indicadores** (`components/Obra/PresencaIndicadores.tsx`): período (7/15/30/90 dias ou datas), taxa de presença,
    absenteísmo, média de presentes, HH disponível e dias apurados (com memória do backend), presença por dia,
    horário de chegada, presença por equipe (piores primeiro), meio de leitura e quem mais faltou.
- `GET /presenca/indicadores?de&ate` (padrão: últimos 30 dias; máx. 1 ano) com a conta em
  `presenca/domain/indicadores.py::calcular`.

## Regras
- Dia apurado = dia com pelo menos uma leitura válida na obra (fim de semana sem apontamento não vira falta).
- Presença = 1ª leitura válida da pessoa no dia (spec 069). Falta = pessoa da equipe sem leitura num dia apurado.
- Efetivo = composição **atual** das equipes (encarregado + membros ativos); a composição passada não é guardada.
- Taxa = presenças ÷ (efetivo × dias apurados); absenteísmo = 1 − taxa. HH = Σ presentes × jornada da equipe.
- Horário de chegada no fuso de Brasília (UTC−3).

## Teste
`tests/test_presenca.py::test_dia_por_setor_e_indicadores_do_periodo`.
