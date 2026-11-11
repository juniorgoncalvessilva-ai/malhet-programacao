# Spec 022 — Memória de cálculo: clicar no número mostra a conta e a origem de cada dado

## Objetivo
Todo número calculado mostrado no app abre, ao clicar, a **fórmula**, a **conta passo a passo** e as **fontes**
(documento/cadastro, versão, arquivo e o lugar exato — linha do relatório da CPU, item da PQ, TAG, campo, dia).

## Modelo comum
- `app/shared/memoria.py`: `Memoria(chave, titulo, valor, formula, passos[Passo], fontes[Fonte], notas)`;
  `Fonte(dado, valor, origem, local)`; `num()` em pt-BR; `pacote()` → `{"memorias": {chave: …}}`.
- Front: `components/Obra/Calculado.tsx` — `<Calculado rota chave>` (memória da API) ou `<Calculado memoria={() => …}>`
  (conta feita na própria tela). Janela por portal, com "outros cálculos deste item".

## Origem da CPU
- Importação guarda cada linha das composições com a linha do arquivo (`cpu_linha`) e a linha do serviço/cabeçalho
  (`cpu_servico.linha_arquivo`, `cpu_composicao.linha_arquivo`). Migração `0015_cpu_linha`.
- `cpu_obra.rastrear`: cada insumo HH/H com o caminho pelas auxiliares (quantidade e linha de uso); a soma por
  recurso é o coeficiente achatado. CPU importada antes desta versão mostra os coeficientes com o aviso para
  reimportar (sem a linha de cada insumo).

## Rotas
- `GET /programacoes/{id}/linhas/{lid}/memoria`: hh_un, governa, indice, capacidade, composicao_equipe,
  hh_dia:i, oficiais:i, total_hh_previsto/realizado, qtd_projeto (digitada ou take-off por TAG), realizado_anterior
  (programação e dia de cada valor), restante.
- `GET /programacoes/{id}/memoria`: HH previsto por dia e no período (soma das linhas).
- `GET /equipes/{id}/memoria`: composição por função (de onde veio a função de cada pessoa) e HH disponível/dia.
- `GET /cpu/item/memoria?item=&jornada=`: HH/un, governa e índice do item.

## Telas
Programação (composição/HH/un, governa, índice, capacidade e alerta de capacidade zero, equipe, qtd projeto, feito,
resta, HH do dia, HH total da linha, rodapé HH do dia e do período), Equipes (composição e HH/dia), Importações
(consulta da CPU: governa, índice, HH/un, h/un e un/dia por função), Cronograma (duração em dias, % físico e
duração dos agrupamentos), Catálogo/aba PQ (total = qtd × PU).

## Regra para os próximos
Número calculado novo nasce com memória (`Memoria` no backend ou `memoria=` na tela) e é mostrado com `<Calculado>`.
