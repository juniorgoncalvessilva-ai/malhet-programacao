# Spec 146 — Programação semanal do cliente: importar para conferir, ligar e levar

## Pedido
"Importar a programação semanal vigente [do cliente] sem poluir a existente: importar em ambiente separado para verificar,
lincar com itens igual a nossa já faz (WBS, cronograma, CPU, PQ) e depois importar para a programação vigente."
Decisões do usuário: (1) o destino é **perguntado a cada vez** antes de levar (somar à programação da semana ou criar uma
nova); (2) **trazer o realizado** (linhas R).

## Leitura (`programacao_cliente/domain/planilha.py`)
- Aba "Programação…" (a visível; com várias, a da semana mais recente; dá para escolher). Arquivo aberto em modo só-leitura.
- Cabeçalho achado pelo nome (layout da obra = o mesmo do Excel exportado pelo Malhet): Item, ID Cronograma, P/O/E, Atividade
  Detalhada, Tipo, Local, CWA, SSMA (técnico, RAC, PTS, ART, PTO, ATA), Responsável, Encarregado, Und., Projeto, Realizado,
  Restante, Oficiais/Servente/equipamentos, (P)rev./(R)eal, um dia por coluna, ITEM PQ, PU.
- Atividade = linha P + linha R logo abaixo. Títulos: com número no Item = grupo ("CWA 020.01 - YY-1600AA-06 - …" → CWA e TAG),
  "CWP …" = CWP, sem número = seção. "9.1.1 - texto" separa o código do Catálogo. Vários itens de SSMA por " / ";
  encarregados por "/". Contas da planilha (peso, faturamento, aderência) não são lidas.

## Conferência (`application/conferencia.py`, tabelas `programacao_cliente_importacao|_linha|_decisao`)
- A planilha vai ao acervo (tipo `programacao`) e cada atividade vira uma linha de conferência. **Nenhuma programação muda.**
- Vínculos (`domain/vinculo.py`, `infra/gateway.py`): frente pelo código/CWA/TAG (nome só sugere); cronograma pelo ID vigente;
  item da PQ da planilha (unidade incompatível → sugerido), código do Catálogo, ou sugestão pela descrição (palavras em comum +
  unidade compatível, nunca confirma); tipo pelo item (fora do Catálogo → escolher o grupo; o tipo é criado ao levar); IWP pela
  frente + item (+ CWP); equipe pelo nome do encarregado (dois nomes → confirme). CPU: HH/un, governa e capacidade
  (oficiais × índice) com memória.
- Situação da linha: pronta | a confirmar | sem vínculo | não vai | levada; placar com memória.
- Quem confere troca frente/item/grupo/equipe/IWP/cronograma, confirma sugestões (linha ou todas), aplica o grupo em lote ou
  marca "não levar". **A decisão fica lembrada** pela chave (descrição sem parênteses + frente + unidade; o item também só pela
  descrição): na semana seguinte a mesma atividade entra ligada ("lembrada"); linhas iguais na mesma planilha recebem junto.

## Levar (`application/levar.py`)
- `GET …/destinos`: programações que cruzam o período + a semanal nova; o usuário escolhe sempre.
- `GET …/comparar/{pid}`: nova | já existe (mesmo IWP, ou frente + item, e equipe) | quantidade diferente | só no Malhet.
- `POST …/levar {destino, programacao_id, trazer_realizado=true, atualizar_existentes, reabrir}`: só linhas prontas; emitida pede
  reabrir (a revisão emitida não muda); concluída não recebe. Cria a linha pela regra da programação (IWP, área, tipo, equipe,
  complemento = CWP), previsto por dia, SSMA que está no cadastro (o resto vira aviso), observação com a origem (arquivo, aba,
  linha). Realizado: só nos dias sem realizado do campo (nunca em dobro) e não passa do total do projeto (fica de fora com aviso).
  Já existente: não duplica; com "atualizar", o previsto da planilha substitui.

## Tela
`/app/programacoes/cliente` (botão "Planilha do cliente" em Programações): enviar → prévia (aba, período, atividades) →
importar; conferência agrupada como a planilha (seção › grupo › CWP), pílulas por vínculo, filtros por situação, editor por
linha, ações em lote e o diálogo "Para onde levar?".

## Testes
`tests/test_programacao_cliente.py` (planilha montada no layout, sem dado real). e2e com a S34 numa cópia local do banco.
