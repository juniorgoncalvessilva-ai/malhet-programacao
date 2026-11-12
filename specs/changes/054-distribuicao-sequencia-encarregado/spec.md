# Spec 054 — Distribuição sugerida, sequência (TI · II · TT · IT) e encarregado como nível da programação

## Pedido
1) Ao digitar um valor, oferecer a distribuição automática para os demais dias (só como opção) e, no último, sempre
preencher. 2) Sequência em ordem cronológica: arrastar e soltar as linhas e uma aba com as colunas TT, II, IT e TI.
3) Encarregado como nível da programação para ver o sequenciamento das atividades dele no período.

## Entrega
- Distribuição (tela "Programação", modo P): com o previsto do período, cada dia vazio (sem domingo) mostra em cinza a
  sugestão = o que falta ÷ dias vazios (a última leva o arredondamento); "distribuir o restante" aplica só nos vazios e
  "redistribuir tudo" refaz por igual. Quando sobra um único dia vazio, ele já recebe o que falta (dá para mudar).
- Sequência (`planejamento/domain/sequencia.py`): `programacao.sequenciada`, `programacao_linha.predecessoras`
  [{de, tipo TI|II|TT|IT, lag}] (migração `0033`); validação (linha existe, não depende de si, sem ciclo);
  conferência pela janela (1º e último dia com previsto) como no P6 (TI com lag 2 após término em 11/11 libera 14/11);
  ordem cronológica = topológica pelas ligações e, entre livres, o 1º dia. API: `PUT /programacoes/{pid}/sequencia`
  {ordem, predecessoras} (programação aberta), `POST /programacoes/{pid}/sequencia/previa` (sugere a ordem, não grava).
  A visão traz `seq`, `ordem`, `predecessoras`, `janela`, `alertas_sequencia`; com sequência salva, as linhas seguem a
  ordem manual (sem ela, a do P6).
- Aba "Sequência (TI · II · TT · IT)": linhas na ordem com arrastar e soltar (e ↑ ↓), início/fim, colunas TI/II/TT/IT
  (nº da predecessora na sequência, com defasagem: 3 · 3+2 · 3, 5), conferência na hora, "Ordenar cronologicamente" e
  "Salvar sequência".
- "Agrupar: Por frente | Por encarregado" na programação e na impressão (`agruparPorEncarregado`): Encarregado →
  frente · área → linhas na ordem da sequência.

## Teste
`tests/test_sequencia.py` (domínio e API); e2e: sugestão 6,25 × 8 dias para 50, ligação TI conferida, sequência salva,
agrupamento por encarregado.

## Ajuste — layout do MS Project
A aba virou "Sequência (Gantt)" no modelo do MS Project: tabela à esquerda (Id, Nome da tarefa, Duração, Início,
Término, Predecessoras, Encarregado) e Gantt à direita (barra do 1º ao último dia com previsto, dias com previsto em
destaque, fins de semana sombreados, setas das ligações; tarefa/ligação não respeitada em vermelho). Predecessoras numa
coluna só, na sintaxe do Project: "3" (término-início), "3TI+2 dias", "2II", "4TT", "5IT" (aceita FS/SS/FF/SF),
separadas por ";". Duração = dias com previsto (com memória de cálculo).
