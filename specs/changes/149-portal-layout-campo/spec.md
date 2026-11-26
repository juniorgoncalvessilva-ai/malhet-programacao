# Spec 149 — Rotas do encarregado e do apontador no layout do app de campo

## Pedido
"Gosto bastante do layout por tipo de acesso (Início do `/m`); vamos replicar isso para as rotas específicas."

## Regra
- Depois de entrar, `/encarregado/...` e `/apontador/...` usam o layout do Início do app de campo (`PainelPortal`): data · obra e
  "Bom dia/Boa tarde/Boa noite, NOME" com a logo da empresa e as iniciais (abre o "Mais"); cartão da meta do dia na cor da empresa;
  dois números clicáveis; "O que fazer agora" (o item que pede ação vem destacado); atalhos; barra de baixo com o botão central em
  destaque e "Mais" (nome, perfil, matrícula, função, obra, todas as telas e Sair). As faixas de cima e de baixo na cor da empresa
  (spec 113) ficam só na abertura e no login.
- **Apontador**: meta = presença de hoje (presentes de N pessoas, barra e memória por equipe); números = equipamentos apontados e
  equipes ativas; o que fazer = apontar a presença (destacado se falta gente), apontar os equipamentos, registrar atividade, conferir a
  produção, criar equipe (abre o formulário). Barra: Início · Equipes · **Presença** · Equip. · Mais (Fotos, Produção, Projetos).
- **Encarregado**: meta = pessoas da sua equipe (memória por equipe) ou o pedido de equipe; números = equipes que lidera e registros de
  hoje; o que fazer = conferir a equipe (ou pedido recusado/aguardando), registrar atividade, projetos da frente. Barra: Início ·
  Equipe · **Fotos** · Projetos · Mais.
- As telas são as mesmas (presença, equipes, equipamentos, produção, fotos, projetos, a equipe do encarregado), agora uma por vez
  (`TelaDoApontador`, `useDadosApontador` — só busca na rota do apontador).
