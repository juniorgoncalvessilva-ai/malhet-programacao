# 059 — Cor da linha colorida da programação: #C5D9F1

## Pedido
"Em programação considere a cor linha colorida para #C5D9F1."

## Solução
- Atividades alternadas (zebra da spec 055) passam de D6DCE4 / azul-acinzentado para o azul-claro **#C5D9F1**:
  - tela da programação e Gantt: token `--m-zebra-programacao` em `src/css/malhet.css` (claro = #C5D9F1; escuro =
    C5D9F1 a 22% para manter o texto legível);
  - impressão (`ImpressaoProgramacao`): `bg-[#C5D9F1]`;
  - Excel do cliente: `ZEBRA = "FFC5D9F1"` em `planejamento/application/exportar_cliente.py` (teste `test_excel_zebra`).
- Local (FF0000) e área (173761) continuam como estão.
