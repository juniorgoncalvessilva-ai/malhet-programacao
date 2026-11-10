# PRD — Programação diária por capacidade, integrada ao Simova

## 1. Problema
A programação semanal/mensal da obra é montada numa planilha (Programacao_auxiliar_v5 + macros VBA) que cruza
cronograma P6, IWP, PQ, CPU e equipes. Ela não conversa com o Simova: a FT_IMPORT_INTERMEDIARIA é digitada à mão,
as OPERs padrão não têm vínculo com o cronograma/CPU e o encarregado sem programação não tem referência de
capacidade. Cada nova revisão do cronograma ou da CPU obriga a regerar a planilha inteira.

## 2. Público
Planejamento (monta e emite), encarregados (programam a própria equipe quando não há programação), engenharia de
produção (aprova e acompanha índices), administrador do Simova (importa a FT).

## 3. Solução
- Repositório de **versões de referência** (cronograma, PQ, CPU, índices, cadastros Simova) com uma **vigente** por tipo.
- **Vínculo** atividade do cronograma / item da PQ ↔ OPER do Simova (+ TAREFA/IWP, composição, índice específico).
- **Equipes** como frentes com composição por função; capacidade diária = HH disponível.
- **Programação** por item (encarregado × OPER × frente × dias) com HH = PE × índice da CPU vigente e bloqueio de excesso.
- **Integração Simova**: importar cadastros e FT; exportar FT no layout exato e OPERs criadas na aplicação.

## 4. Escopo
Dentro (v0.1): itens 3 acima; motor de cálculo portado (índices, calendário, gargalo, sequenciador).
Próximas specs: MONTAR completo (PRAZO/CAPACIDADE, predecessoras, distribuição por dia), EFETIVO × VALIDAÇÃO,
emissão (foto imutável) e realizado (retorno do Simova), físico-financeiro e indicadores.
Fora: edição do cronograma P6, orçamento/PQ (somente leitura), apontamento de campo (é do Simova).

## 5. Critérios de sucesso
- FT exportada importa no Simova sem ajuste manual.
- Trocar a versão vigente do cronograma não quebra vínculos (chaves estáveis) e aponta pendências.
- Nenhuma equipe programada acima da capacidade sem autorização explícita.
- Índices batem com a planilha auxiliar (ex.: C-23440 → 8,086 m/dia).

## 6. Regras de negócio
Ver `docs/dominio.md`.
