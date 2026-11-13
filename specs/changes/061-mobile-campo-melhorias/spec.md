# 061 — Mobile: navegar no lançamento, aba Programação com detalhe, ocorrência por causa, área com busca e carimbo na foto

## Pedido (app de campo)
1. Lançar: seta para avançar/voltar entre as atividades do dia e arrastar na tela; Frente em destaque no topo da atividade.
2. Aba "Vigente" passa a se chamar **Programação**; tocar na atividade detalha o efetivo, o quantitativo e permite lançar ali.
3. Ao tocar na atividade, sugerir **Lançar produção** ou **Abrir ocorrência** (menos passos repetidos).
4. Ocorrência: várias causas; "o que aconteceu", ação e fotos **por causa** (um item/desvio separado por causa).
5. Nova restrição: ao tocar no campo da área abre a lista (dropdown) e dá para continuar pesquisando.
6. Restrição: data e hora na foto e o nome da frente de serviço escrito nela (como os apps de *timestamp camera*).

## Solução
- `campo/dia` devolve também `local` e `cwp` da linha.
- **Lançar** (`m/lancar`): barra "‹ Anterior · N de M · Próxima ›" e arrastar para o lado no cartão (60 px, horizontal);
  faixa no topo do cartão com a Frente (local · área, CWP) em destaque.
- **Programação** (`m/vigente`, rótulo da barra = "Programação"): tocar na atividade abre `DetalheAtividade`
  (`components/Mobile/DetalheAtividade.tsx`) — frente em destaque, botões **Lançar produção** (`/m/lancar?data=&linha=`)
  e **Ocorrência** (`/m/ocorrencias/nova?data=&linha=`), quantitativo (dia, período, meta, projeto, resta) e efetivo da
  equipe (encarregado, contagem por função, membros com a situação de mobilização; "presentes" = mobilizados).
- **Ocorrência** (`m/ocorrencias/nova`): causas em seleção múltipla; um cartão por causa com o que aconteceu, ação e
  fotos; ao registrar, um desvio por causa com as fotos dele. Aceita `?data=&linha=` e mostra a frente em destaque.
- **Nova restrição**: o campo da área abre a lista inteira (com o local) ao tocar e filtra por código, nome ou local,
  sem acento; "N de M áreas" e fechar.
- **Carimbo na foto** (`carimbarFoto` em `components/Mobile/Fotos.tsx`): data e hora em destaque (amarelo) + "Frente: …",
  "Restrição Nº …" e a obra numa faixa escura no rodapé; a hora é a de quando a foto foi tirada (`momentoDaFoto`). Usado
  nas fotos da restrição (nova e no detalhe). A miniatura mostra a hora e o aviso do que entra no carimbo.
