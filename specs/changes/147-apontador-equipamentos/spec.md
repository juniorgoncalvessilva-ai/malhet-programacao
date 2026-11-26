# Spec 147 — Rota do apontador e equipamentos da obra

## Pedido
"Hoje temos a rota dos encarregados; quero criar a rota do apontador. A diferença: o apontador tem a liberdade de criar
equipes, apontar as presenças do efetivo em todas as equipes e equipamentos, registrar as fotos das atividades feitas e
verificar a produção das atividades. Formato mobile, perfil de apontador, login com as premissas de rota dos encarregados; ao
acessar no celular ofereça a instalação do app, com a página inicial nesta tela de login da rota. Cadastre os equipamentos da
planilha anexa, como opção na lista para associação no efetivo, com controle de mobilização e desmobilização."

## 1. Equipamentos (`equipamentos/`)
- `equipamento` (obra, **chave** = TAG → placa → chassi, nome, tipo, placa, TAG, chassi, `operador_id` → efetivo, `operador_texto` da
  planilha, situação `mobilizado | desmobilizado | nao_mobilizado`, datas, `na_ultima_planilha`), `equipamento_movimento`
  (cadastro, mobilização, desmobilização, operador — data, texto, quem) e `equipamento_apontamento` (um por equipamento/dia:
  operando, à disposição, parado, manutenção; horas, equipe, motivo obrigatório para parado/manutenção).
- Planilha da obra (`domain/equipamento.py::ler`): cabeçalho pelos nomes (Nome do Equipamento | Operadores | Tipo | Placa | TAG |
  Chassi | Mobilizado | Data mobilização [| Data desmobilização]). Mobilizado SIM → mobilizado; NÃO com data → desmobilizado; NÃO sem
  data → ainda não mobilizado. Sem TAG/placa/chassi não entra (aviso); TAG repetida vale a primeira.
- Prévia (`POST /equipamentos/planilha/previa`) e importação (`POST /equipamentos/planilha`): reimportar atualiza, não duplica, não
  apaga; mudança de situação vira movimento "pela planilha".
- Operador (`casar_operador`): a planilha traz só o primeiro nome. Liga sozinho só quando **um único operador/motorista** ativo
  tem aquele nome (ou o nome completo é único); senão fica o texto e as sugestões, e a pessoa escolhe no efetivo
  (`PUT /equipamentos/{id}/operador`). Nunca troca o operador já escolhido.
- Mobilizar/desmobilizar com data (`POST …/mobilizar|desmobilizar`; não volta antes da última movimentação), histórico
  (`GET …/movimentos`), dia do equipamento (`PUT …/dia`; só mobilizado naquele dia, nada no futuro), excluir só sem dia apontado.
- Dias na obra com memória de cálculo. Efetivo mostra "opera TAG" ao lado do operador (`GET /equipamentos/por-operador`).
- Tela `/app/equipamentos` (Pessoas e equipes): indicadores, filtros por situação, operador por `BuscaEfetivo`, mobilizar/
  desmobilizar, histórico, novo equipamento e aba Importar planilha (conferir antes → importar).

## 2. Rota do apontador
- Perfil: `lider_acesso.perfil` (`lider | apontador`). Apontador = função APONTADOR/APROPRIADOR no efetivo ou cadastrado como
  apontador em Acesso dos líderes (`POST /lideres {perfil: "apontador"}`).
- Login igual ao do encarregado (matrícula + 123456 → cria a senha; Argon2; endereço `/apontador/<empresa>/<obra>` e
  `/apontador/<empresa>` pela mesma regra — `rota.endereco_apontador`), `POST /portal/entrar {perfil: "apontador"}`; o token leva o
  perfil. A rota do apontador só aceita apontador; a do encarregado não aceita quem é só apontador cadastrado.
- Rotas `/portal/apontador/*` (exigem o perfil): `equipes` (todas as equipes ativas + quem do efetivo ativo está sem equipe, com a
  presença do dia), `POST equipes` (cria na hora, nome no padrão da obra, encarregado + pessoas pelo `Alocador`; o Planejamento é
  avisado — `gestao.criar_equipe`, também usado ao aprovar pedido), `incluir` / `tirar`, `presenca` (leitura `manual` assinada
  "apontador matrícula"; idempotente; desmarcar só o que foi apontado — crachá/rosto é prova; até 7 dias para trás),
  `equipamentos` (mobilizados com o dia) e `PUT equipamentos/{id}`, `producao` (programação vigente — `programacao_vigente` — dia
  a dia, previsto × realizado e a semana com memória). Fotos: as rotas de registro de atividade do portal.
- Celular (`PortalLider perfil="apontador"` + `Apontador.tsx`): abas Presença · Equipes · Equip. · Fotos · Produção, dias (hoje e
  6 para trás), marca da empresa. Sessão e endereço guardados por perfil no aparelho (`usarPerfil`).
- Instalar o app: na tela de login da rota aparece "Instale o app do apontador" (`OfertaInstalar`); o manifesto é por rota
  (`/api/manifest?inicio=…`, `start_url` = o login daquela rota, nome "Apontador · Empresa", cor da empresa) — o app instalado abre
  direto nesse login.
- Acesso dos líderes: endereço do apontador (copiar/WhatsApp), cadastrar apontador, perfil na lista.

## Testes
`tests/test_equipamentos.py` (leitura, regras, prévia/importação/reimportação, operador, movimentos, dia, por obra; real com
`EQUIP_REAL`) e `tests/test_apontador.py` (perfil, login, equipes, presença, equipamentos, produção, fotos, cadastro).
A planilha do cliente não vai para o git.
