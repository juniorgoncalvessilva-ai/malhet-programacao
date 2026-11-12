# Spec 039 — Marca da obra (logos da contratada/contratante e cor do cliente)

## Pedido
Local para importar a logo da contratada e do contratante; todos os documentos levam as duas logos quando
importadas, e a do Malhet quando não houver. Cor do cliente por obra no lugar das cores do Malhet.

## Entrega
- Tabela `marca_obra` (obra_id PK, `cor` #RRGGBB, logos PNG/JPEG ≤ 2 MB em bytes). Migração `0027_marca_obra`.
- `app/shared/marca.py`: `Marca.logos` (contratante, contratada ou Malhet), `validar_cor`, `validar_logo`,
  `cor_excel`, `inserir_logos` (openpyxl + Pillow), `marca_da_obra`.
- API `/obra/marca`: `GET` (ler), `PUT /cor`, `POST|DELETE /logo/{qual}` (administrar), `GET /logo/{qual}`.
  `GET /obras/minhas` devolve `cor`.
- Documentos: Excel do cliente (programação), Pareto (Gráfico/Detalhamento) e Plano de Ação (Ações/PAINEL) recebem
  as logos e a cor da obra nos cabeçalhos; impressão da programação/vigente usa `<LogosObra>` e `bg-m-accent-strong`.
- Web: página `/app/marca` (Administrar → Marca da obra, só admin): prévia do cabeçalho, envio/troca/retirada das
  logos, seletor de cor (padrão = verde Malhet). `ObraProvider` injeta a cor da obra nos tokens `--m-accent*`.

## Teste
`tests/test_restricoes.py::test_marca_da_obra_logos_e_cor_nos_documentos`.
