# 035 — App de campo (mobile): realizado da programação

Primeira parte da versão mobile (atualizar as páginas pelo celular, exceto importações), no visual do canvas
"Malhet · Mapa de navegação e jornadas" (Padrão mobile · Início do encarregado / Lançar o dia): Figtree, fundo
#F6F8F8, verde-petróleo #284E4F (tokens `m-*`, então o modo escuro acompanha), cartões de 20 px, alvos ≥ 44 px.

## Rotas (`src/app/[locale]/m/`, sem o menu lateral; mesma conta, obra e papel)
- `/m` Início: meta de hoje (atividades programadas e quantas já têm realizado), dias sem lançar, restrições abertas e
  "O que fazer agora" (Lançar o dia, dias anteriores, cada atividade do dia).
- `/m/lancar?data=&linha=`: uma atividade por vez (Atividade k de n), troca de dia, stepper − / valor / + (passo 1; 0,5
  quando o previsto do dia é < 5), % do programado e quanto falta; abaixo do previsto, chips das causas do Pareto (8 +
  "mais") e texto opcional → cria o desvio ligado à linha e ao dia. Rodapé "Pular" / "Salvar e próximo".
- `/m/pendencias`: dias anteriores da programação com previsto e sem realizado, por dia.
- Barra inferior: Início · Lançar · Pendências · Completo (app de mesa). Menu do app completo: "App de campo (celular)".

## API
`GET /campo/dia?data=` (`campo/api/router.py`): programação emitida/concluída que cobre o dia (semanal mais nova;
senão a mensal), linhas com previsto ou realizado no dia (+ capacidade do dia, totais do período, desvios do dia),
pendências dos dias anteriores e `editavel` (só emitida). **Encarregado vê só as linhas das equipes em que é o
encarregado** (crachá do acesso). Gravação pelas rotas de sempre: `PUT /programacoes/{pid}/linhas/{lid}/valores`
(realizado) e `POST /desvios`.

## Fica para as próximas partes
Foto da frente (anexo), restrições/ocorrências, SSMA, equipes e efetivo no celular.
