# Spec 025 — Capacidade pela equipe completa e pelo recurso que governa

## Regra (`programacao/domain/gargalo.py`, teste em `tests/test_motor_planilha.py`)
- Produção de cada função da equipe = **pessoas × jornada ÷ h/un** (`capacidade_por_funcao`). É a mesma conta de
  antes (jornada ÷ (h/un ÷ pessoas)), lida de forma direta.
- **Equipe completa** = a menor produção entre as funções que a equipe tem (gargalo) — `capacidade_da_equipe`.
- **Pelo recurso que governa** = pessoas que governam × jornada ÷ h/un (`capacidade_pelo_governa`); 0 sem quem governa.
- Cada programação escolhe a base (`programacao.base_capacidade` = equipe | governa; padrão equipe; migração
  `0019_base_capacidade`; `PUT /programacoes/{id}/base-capacidade`, planejador, não concluída). A base escolhida é a
  `capacidade_un_dia` (aviso "acima da capacidade"); a outra vem como referência (`capacidade_equipe`,
  `capacidade_governa`). Na base "governa", função de apoio que não acompanha vira aviso
  ("com 3 Servente a equipe faz 9,64/dia (abaixo dos 13,85 de quem governa)"), sem reduzir a capacidade.

## Tela
Seletor "Capacidade por" no topo da programação; cada linha mostra "equipe completa X/dia (gargalo F) · pelo governa
Y/dia" com a base usada em destaque; memória de cálculo da capacidade com pessoas × jornada ÷ h/un por função, as duas
capacidades e qual a programação usa.
