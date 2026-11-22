# 127 — Home pelo Planejamento 360, take-off com tela própria e Conexões só do super admin

## Planejamento 360 (referência)
Curso/método do autor (Drive: "CURSO - PLANEJAMENTO 360º", aula de 28/09/2026): a primeira pergunta de todo contrato é **"onde está o
dinheiro?"**; o planejador integra campo, medição, contratos e custos; quatro pilares do contrato (escopo, prazo, custo, contrato) e
seis blocos — fundação/leitura do contrato → estruturação (EAP e take-off) → cronograma → campo (LPS, check-in/check-out) →
medição sem glosa → controle e governança (dados viram argumento de negociação). "O que não é registrado não gera faturamento";
WhatsApp não é evidência formal.

## Home (revisão)
- Sai "Um cérebro, vários apps" (VisualPlan, PlanningControl, ADC Digital, Painel de Indicadores): nomes de app que não existem no
  produto (spec 125 decidiu não separar por app) e "ADC Digital" não existe. Entra **"O ciclo inteiro, numa memória só"** com os seis
  passos do Planejamento 360 e o que o Malhet já faz em cada um: Contrato (PQ, composições, critério de medição) · Escopo (WBS e
  take-off do projeto) · Prazo (P6, plano de 90 dias, restrições) · Campo (programação, lançamento, presença, fotos) · Medição
  (avanço por critério, aderência em R$) · Governança (PPC, desvios com causa, 5W2H). O nome do curso não aparece na home.
- Compromissos sem promessa sem lastro: "Custo baixo" e "Conformidade com a LGPD" saem; entram "contrata só os módulos que usa,
  obra a obra" (spec 125), "LGPD no processo: aceite por finalidade, colhido no campo" (spec 074) e "funciona inteiro sem IA — e
  nada da obra vai para IA de terceiros" (spec 126). "Várias obras e empresas, cada uma com a sua marca" (specs 093/113/117).
- Frases ajustadas ao que existe: Responsabilidade (encarregado e responsável; lançamento e revisão guardam quem e quando),
  Resultado (o que não foi feito aparece na semana, com causa e em R$ — specs 027/104), Diretor (aderência em R$ toda semana),
  Cliente (quem fez, quando e a foto carimbada).

## Take-off fora de Documentos
- Tela própria `/app/takeoff` ("Take-off do projeto", grupo Projeto e escopo, `?doc=` filtra um documento); a aba saiu de
  Documentos e o detalhe do documento só leva ao take-off ("Abrir o take-off"). Mesma API (spec 124). `TELAS_WEB` e o módulo
  `documentos` incluem `/app/takeoff`. Menu volta a "Documentos (LDO e GRD)".
- **Conexões** (mapa do Zettelkasten) só aparece para o super admin por enquanto (fora de "Testar como perfil" também some).

## Fica para depois (sugestão vinda do Planejamento 360)
RDO formal: o Resumo do dia hoje vai pelo WhatsApp (distribuição); a prova é o registro no Malhet. Falta a **ciência do cliente com
prazo** ("sem resposta em 24–48 h, considera-se aprovado"), registrada no sistema.

## Verificação
`test_modulos_obra.py` (take-off no módulo documentos; grupos ≤ 6) e `test_menu_web.py` (menu × TELAS_WEB); e2e: `/app/takeoff`,
Documentos sem a aba take-off, Conexões só no super admin, seção nova da home no computador e no celular.
