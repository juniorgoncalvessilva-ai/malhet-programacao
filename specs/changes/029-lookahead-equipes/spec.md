# 029 — Look-ahead das equipes (andar da equipe no tempo e pelas frentes)

Inspirado no mural do Look-ahead do Visual Plan (repositório malhet): raias × dias, cartões coloridos.

## Regras (`lookahead/domain/blocos.py`)
- Cada dia com previsto ou realizado > 0 de uma linha de programação vira um dia da equipe naquela atividade/área.
- Dias seguidos da mesma equipe, atividade e área formam um cartão; fim de semana vazio no meio não quebra.
- Mesmo dia em duas programações (a semanal começa na sexta anterior): vale a de início mais recente.
- Cartões que se sobrepõem no tempo dentro da mesma raia vão para faixas diferentes (`faixas`).
- Cor = disciplina da equipe → setor → paleta fixa pela equipe (nunca pela posição na tela).
- Restrições: o cartão conta as pendentes da própria linha ou da área (sem linha) com prazo até o fim do cartão.

## API / tela
`GET /lookahead?de&ate` (padrão: segunda desta semana + 6 semanas; máx. 120 dias) → dias, equipes (cor, origem da
cor, faixas), áreas, blocos. Tela `/app/lookahead`: Por equipe × Por frente, 2/4/6 semanas, legenda, detalhe do
cartão com P/R por dia, "+ Restrição para este cartão" e link para a programação.
