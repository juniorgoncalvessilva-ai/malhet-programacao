# 103 — Juntar o cadastro do campo à pessoa do efetivo, lista completa do efetivo e rosto não cadastrado na presença

## Pedidos
1. "Ao digitar a matrícula e ela existir no efetivo, atrelar esse funcionário ao cadastro" (cartão "cadastro(s) feito(s) no
   campo para completar").
2. "Essa lista não está aparecendo todo mundo — revise conforme a listagem do efetivo" (planilha EFETIVO GERAL, 628 pessoas).
3. "Existem rostos cadastrados e a câmera não habilita por não identificar rostos; deixe habilitada, avise que o rosto não
   está cadastrado e oferte o cadastro na hora."

## 1. Juntar cadastros (`presenca/application/unificar.py`)
- `PUT /presenca/cadastros-pendentes/{cid}` com matrícula que já é de alguém do efetivo: 422 `campo=unificar` com o nome e a
  função dele; a tela confirma ("Juntar X a Y?") e reenvia com `unificar: true`.
- Unificar: toda tabela com FK para `colaborador` (presença, LGPD, assinaturas, etilômetro, ASO, treinamentos, mobilização,
  liderança…) passa a apontar para a pessoa do efetivo; a identificação (crachá/NFC/rosto) é mesclada — a do efetivo fica e
  herda o que não tem (rosto vai com o consentimento que o autorizou); membros de equipe pelo crachá; o provisório sai.
  Nome, função e situação ficam os do DP.

## 2. Lista do efetivo
- A planilha é lida inteira (577 da aba principal + 51 de terceiros; ficam de fora só o quadro de totais e linhas de vaga
  sem nome). A tela desenhava só 300 linhas (`LIMITE`): agora desenha em lotes de 200 ao rolar (todo mundo aparece),
  "mostrar todos os N", contagem "N de T pessoas do efetivo · X fora dos filtros — ver todo mundo"; marcar todos pega todos os filtrados.

## 3. Rosto na presença
- Causa: o celular só usava rostos com aceite LGPD de biometria no termo (`biometria !== false`); rosto cadastrado com o
  consentimento colhido no cadastro (termo ainda não respondido = `pendente`) ficava de fora → "Ninguém com rosto
  cadastrado". `rostoLiberado` (`lib/presenca/offline.ts`) segue a regra do servidor: aceitou biometria ou termo pendente;
  recusado/revogado não.
- A câmera abre mesmo sem rostos; rosto que não bate com ninguém por alguns quadros mostra "Rosto não cadastrado" e abre o
  `CadastroRosto` (busca a pessoa, consentimento obrigatório, "Cadastrar rosto e registrar presença"). Grava pela fila de
  vínculos (`POST /presenca/vincular` com `face` + `consentimento`, funciona sem internet) e registra a presença.

## Aceite
- `tests/test_cadastro_campo.py`: juntar (presença, NFC e QR na pessoa do efetivo, provisório some) e rosto cadastrado na
  hora (sem consentimento 422; base devolve o rosto com termo pendente).
- e2e: planilha do usuário importada no banco local (restaurado depois), contagem e rolagem; junção com a matrícula
  115819; aba Rosto abre a câmera sem rostos liberados.
