# 058 — Organograma para impressão: nomes sem rolagem, exportar A0–A3 e espessura das linhas

## Pedido
1. Lista de pessoas da função sem barra de rolagem (precisa imprimir).
2. Exportar para impressão em A0, A1, A2 e A3, em PDF ou JPG, com cabeçalho e as logos das empresas.
3. "Expandir tudo" com e sem os nomes (manter o atual, escolha por dropdown).
4. Configurar a espessura das linhas para impressão e apresentação.

## Solução (front, sem mudança na API)
- `.pessoas` sem `max-height`/rolagem: a caixa cresce; nomes não são mais cortados. Lista com mais de 15 nomes vira colunas
  dentro da caixa (até 4, a caixa alarga) e funções empilhadas são divididas em colunas de altura parecida
  (`dividirEmColunas`, ~10 caixas por coluna) — ramos longos como "Sem equipe" não viram uma tira.
- "Expandir tudo ▾": **Só as caixas** (comportamento anterior) ou **Com os nomes das pessoas** (abre todas as funções).
  "Recolher tudo" fecha também os nomes.
- "Linhas": Fina (1 px) · Média (2) · Grossa (3) · Extra (4), em variáveis CSS (`--linha`, `--borda`, `--linha-cor`) dos
  conectores e bordas; mais grossa = cor mais escura. Lembrada no navegador; vale para a tela e para a exportação.
- "Exportar impressão" (`components/Obra/ExportarOrganograma.tsx`): folha A0/A1/A2/A3, orientação automática/paisagem/
  retrato, PDF (jsPDF) ou JPG, conteúdo "como está na tela", "tudo aberto" ou "tudo aberto com nomes", título editável.
  A árvore é rasterizada sem o zoom (html-to-image), sem os controles de edição (`data-nao-imprimir`, caixas de seleção e o
  "−" dos ramos abertos) e sempre no tema claro, encaixada na área útil. Cabeçalho com as logos do contratante e da
  contratada (`useLogo`; sem logos, a do Malhet), título, obra, contratada, nº de pessoas, data de emissão e faixa na cor
  da obra; rodapé com a folha. Resolução: A0 150 dpi, A1 200, A2 250, A3 300 (limitada a ~32 Mpx por folha).

## Aceite
- Função com muitas pessoas mostra todos os nomes sem barra de rolagem.
- "Expandir tudo → Com os nomes" abre todas as listas; "Só as caixas" mantém o comportamento anterior.
- Exportar A3 em PDF e A1 em JPG baixa o arquivo com cabeçalho, logos e a árvore inteira.
