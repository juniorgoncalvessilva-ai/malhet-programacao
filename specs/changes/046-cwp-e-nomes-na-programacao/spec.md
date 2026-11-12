# Spec 046 — Nível CWP na programação e nomes reduzidos + complemento

## Pedido
Incluir na programação o nível de CWP, para identificar melhor a atividade, e dar a opção de usar os nomes reduzidos
mais complemento em vez dos descritivos da PQ — num botão, com "Reduzido + complemento" ativo.

## Entrega
- `servico.visao`: cada linha traz `cwp` ({id, codigo, texto} do CWP da WBS de execução, pelo IWP; linha sem IWP usa o
  texto complementar), `descricao_reduzida` (nome simplificado do item da PQ + complemento) e `descricao_completa`
  (descritivo da PQ + complemento). `cwps_dos_iwps` e `completar_foto` (emissões antigas ganham o CWP pela WBS atual).
- Excel do cliente: `?nomes=reduzido` (padrão) ou `?nomes=pq`.
- Web: `src/lib/programacao/nomes.tsx` — `BotaoNomes` ("Reduzido + complemento" | "Descritivo da PQ", lembrado no
  navegador e igual em todas as telas), `nomeLinha`, `porCwp` (linhas da área agrupadas por CWP). Montar programação e
  impressão/vigente: Local → Área → **CWP** → linhas; SSMA e app do celular usam o mesmo nome.

## Teste
`tests/test_cwp_nomes.py`.
