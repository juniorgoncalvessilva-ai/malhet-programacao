# Spec 094/095 — Página principal com foco na leitura, cubo 3D e login "Na obra agora"

## Pedido
1. "O que é ERP? Coloque o BMM no lugar."
2. "Quero o texto nesse vazio branco; quero um cubo com mais contraste, enxergar mais as cores."
3. "Ao rolar, a página está muito fixa: mais transições e mais foco no que está sendo proposto; direcione os olhos do
   usuário para consumir o que ele precisa captar para comprar a ideia."
4. Login: "cubo maior e centralizado nessa metade; embaixo, mais exemplos de registros, dinâmicos, que despertem
   curiosidade e mostrem uma solução prática e lúdica."
5. "O cubo pode ficar se mexendo; deixe sensível ao mouse."

## O que muda
- **BMM** no lugar de ERP: "O cronograma diz o que deveria acontecer. O BMM diz o que foi medido." e a linha da tabela
  "BMM (boletim de medição) — o que foi medido e quanto vai ser pago / por que o custo mudou".
- **Abertura**: conteúdo num container de até 1680 px, título centralizado na vertical (no lugar do vazio), maior; "Role
  para lapidar"; o título recua quando a pedra fica pronta.
- **Cubo 3D** (`PedraCubica`): seis faces de pontos com luz por face e faces de trás translúcidas; gira devagar e inclina
  para o lado do mouse; pontos maiores e cores mais fortes (topo água #3E9C98, faces #284E4F e #0E2627); a poeira foge
  do cursor. "Reduzir movimento" = parado.
- **Leitura guiada** (`Landing.tsx`, um único ouvinte de rolagem):
  - barra fina de leitura sob o cabeçalho;
  - **A cena** presa na tela no computador: o registro avança linha a linha (linha atual em foco, as outras apagadas)
    até "O pleito se perde" e "Não virou registro." vira terracota; no celular rola e acende do mesmo jeito;
  - frases que **acendem palavra por palavra** (espaço, nome, para quem, manifesto), palavras-chave em verde/água;
  - pilares, golpes do malhete e públicos: **a linha no centro da tela em foco**, as outras recuam;
  - "Malhet malhete" gigante desliza na horizontal com a rolagem;
  - "O que foi decidido, fica." entra com o golpe do malhete (`m-selo`).
- **Login** (`TelaAuth`): cubo maior, no centro da metade da marca, girando e seguindo o mouse; "Na obra agora": sete
  episódios curtos (chuva na concretagem, desenho que mudou na véspera, parafuso no pipe rack, presença por crachá NFC,
  etilômetro antes do turno, fim do mês/BMM, guindaste) digitados linha a linha e selados com "SELADO · …".

## Verificação
tsc + build; navegador 1900 px, 1440 px e iPhone 14 (sem rolagem lateral), sem erros no console.
