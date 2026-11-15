# 086 — Cadastrar o etilômetro no celular

## Problema
Na tela "Iniciar etilômetro" do celular, sem aparelho cadastrado o botão fica em "Escolha o aparelho" e não libera
(mesmo com local e responsável escolhidos): o aparelho só podia ser cadastrado na web (Controle preventivo).

## Solução
- "+ Cadastrar aparelho" na própria tela (já aberto quando a obra não tem nenhum): marca, modelo, nº de série
  (opcional), calibrado em e validade → `POST /preventivos/etilometro/aparelhos` (mesma regra de papel: segurança,
  planejamento ou admin — `Depends(ssma)`). O aparelho criado já fica escolhido e o fluxo segue para as fotos.
- Sem internet o cadastro avisa que precisa de conexão (o resto do etilômetro continua offline).
- Mensagens: sem aparelho e sem permissão → "peça à segurança"; o botão diz "Cadastre o aparelho" quando não há nenhum.

## Verificação
tsc + build; e2e no Pixel 7: cadastrar → aparelho escolhido → fotos liberadas → botão pede "Foto do aparelho".
