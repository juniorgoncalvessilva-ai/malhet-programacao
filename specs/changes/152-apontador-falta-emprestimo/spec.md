# Spec 152 — Apontador: pesquisa nas equipes, falta e empréstimo entre equipes

## Pedido
1. Pesquisa na aba Equipes do apontador. 2. Incluir a falta dos funcionários ("pense a melhor forma"). 3. Controlar o empréstimo
de funcionários entre equipes para metrificar: o apontador seleciona o encarregado e lê/aponta a presença; se apontar alguém de
fora da equipe, escolhe tirar da outra equipe ou registrar o empréstimo com justificativa.

## O que muda
- **Equipes (celular)**: campo de pesquisa — equipe, encarregado, nome, matrícula ou função; abre a equipe onde a pessoa está e
  lista também quem está sem equipe.
- **Falta** (`presenca_falta`, `presenca/domain/apontamento.py::Falta`, `MOTIVOS_FALTA`): uma por pessoa e dia, com motivo
  (não compareceu, atestado, folga/compensação, férias, afastado, treinamento — justificadas — e outro, que pede a descrição) e
  observação. Presença lida no crachá/rosto é prova: não vira falta, e a leitura que chega depois apaga a falta; apontar presente
  também apaga; a presença à mão do apontador sai ao marcar a falta. "Falta p/ quem não veio" fecha a equipe no dia (só quem está
  sem presença, sem falta e sem empréstimo).
- **Empréstimo** (`presenca_emprestimo`, `Emprestimo`): a pessoa continua na equipe dela e o dia conta na que recebeu
  (`equipe_id` das leituras do dia = a que recebeu, também nas que sobem depois da fila offline); justificativa obrigatória
  (≥ 5 letras); devolver desfaz. O Planejamento é avisado no sino.
- **Fluxo**: em Presença, "Equipe que estou apontando" (lembrada no aparelho) vale para "Por equipe" e "Ler presença". Com a
  equipe escolhida: só ela aparece, com os recebidos ("Emprestado da X · justificativa") e "Apontar alguém de fora". Apontar ou
  ler alguém de outra equipe abre a escolha: **Registrar empréstimo** (com justificativa) ou **Trazer para a equipe** (sai da outra,
  pelo `Alocador`). Cada pessoa: Presente | Falta; cedida: "Emprestado hoje à Y" + Devolver.
- **Início do apontador**: Faltas hoje e Empréstimos hoje; "sem apontar" não conta quem tem falta.
- **Números (computador)**: Presença › aba "Faltas e empréstimos" (`GET /presenca/apontamentos?de&ate`, até 120 dias): faltas
  (justificadas, por motivo), taxa de falta (faltas ÷ pessoas das equipes × dias), empréstimos, quem cedeu/recebeu, listas com a
  justificativa e quem apontou — com a memória de cálculo.

## API
`/portal/apontador/falta` (motivo vazio tira), `/portal/apontador/faltas/restantes`, `/portal/apontador/emprestimo`
(`presente` já aponta a presença), `/portal/apontador/emprestimo/devolver`; `/portal/apontador/equipes` traz `falta`, `emprestimo`,
`equipe_id` por pessoa, `recebidos`/`faltas`/`cedidos` por equipe e `motivos_falta`.

## Fora (próximo passo)
A capacidade produtiva da programação com os presentes (`capacidade_com_presentes`) ainda conta a pessoa emprestada na equipe de
origem.

## Testes
`tests/test_apontador.py::test_falta_e_emprestimo_entre_equipes`; e2e no iPhone 13 (pesquisa, falta, fechar a equipe, empréstimo,
aba do computador).
