# Spec 055 — Cores do modelo S27 (Excel, programação, impressão) e Gantt com classificação e agrupamento

## Pedido
Na Sequência (Gantt): classificação e agrupamento por frente para identificar a linha. No Excel do cliente: formatar
as linhas como o modelo anexo (Programação Semanal S27 rev.3). Na aba Programação: coloração por linha conforme o
modelo.

## Modelo (lido do anexo, que não vai para o git)
Faixa do local em vermelho (FF0000) na linha inteira; faixa da área/CWA em azul (173761), texto branco; atividades
(2 linhas P/R, colunas descritivas mescladas) alternando sem preenchimento e azul-acinzentado ("Azul-acinzentado,
Texto 2, 80% mais claro" = D6DCE4) nas colunas G..AJ; P/R e dias sem preenchimento; alternância contínua na planilha.

## Entrega
- Excel do cliente (`exportar_cliente.py`): faixa do local vermelha de G até a última coluna; atividades alternadas com
  `ZEBRA` D6DCE4 nas colunas G..AJ.
- Tela "Programação": local em vermelho, área em azul 173761, linhas alternadas (mesma cor, translúcida no tema
  escuro). Impressão/vigente: colunas descritivas alternadas em D6DCE4 (P amarelo e R como antes).
- Sequência (Gantt): "Classificar por" Id (sequência) | Início | Término | Duração | Encarregado | Frente e "Agrupar
  por" Nenhum | Frente | Encarregado — linha-resumo do grupo (duração, início, término e barra-resumo no Gantt,
  recolher/abrir), setas seguem a linha exibida; arrastar para reordenar só com Id e sem agrupamento; linhas zebradas.

## Teste
`tests/test_excel_zebra.py`; e2e com screenshots da programação, impressão e Gantt agrupado por frente.
