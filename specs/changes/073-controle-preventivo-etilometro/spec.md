# 073 — Controle preventivo: etilômetro (offline, foco em vazão)

## Pedido
Aba de controle preventivo com eventos de controle como o etilômetro. No celular/tablet, a enfermeira lê o crachá,
digita o resultado em mg/L, avança, o colaborador vê o resultado e assina com a biometria. Quem cai no teste faz a
contraprova depois de X minutos, com cronômetro por pessoa, e o app fica livre para os outros (dar vazão).
Configuração: faixas (até 0,04 sem penalidade; 0,05–0,33 gravíssima; ≥ 0,34 crime; recusa = gravíssima), tempo da
contraprova e aparelho (marca, modelo, calibração, validade). Início com fotos do aparelho e da calibração (carimbo de
data/hora), responsável escolhido da lista que assina com o crachá no início e no fim. Histórico como nos registros.
Tem de funcionar sem internet e sem risco de perder dados.

## Módulo `preventivos`
- Domínio `preventivos/domain/etilometro.py`: `CONFIG_PADRAO` (faixas da lei), `validar_config` (começa em 0, crescente),
  `classificar` (faixa pelo valor ou recusa), `pede_contraprova` (1º teste reprovado, não recusa), `conferir_aparelho`
  (calibração válida no dia), `validar_assinatura` (rosto, crachá NFC/QR/código, desenho na tela), `situacao_final`
  (vale o último teste, ou seja, a contraprova).
- Tabelas: `preventivo_config` (por obra), `etilometro_aparelho`, `preventivo_evento` (cópia do aparelho e das faixas do dia,
  responsável, assinaturas de início e fim, `id_local`), `preventivo_teste` (`id_local`, tentativa 1/2, valor, recusa,
  faixa, penalidade, leitura, assinatura). Fotos do evento em `foto_campo` (alvo `evento`, momento aparelho/calibração).
- Rotas `/preventivos/etilometro/`: `config` GET/PUT (SSMA), `aparelhos` CRUD (SSMA; usado em evento não sai, desativa),
  `eventos` POST multipart (tudo ou nada, idempotente), `testes` POST (idempotente; o servidor reclassifica pelas faixas do
  evento; contraprova só depois de reprovado; 1 teste por pessoa por evento; recusa pode ficar sem assinatura),
  `eventos/{id_local}/encerrar`, `eventos` GET (resumo) e `eventos/{id}` (ficha com testes, pessoas e fotos).
- Aplicar o teste: segurança ou encarregado+ (`aplicar`). `/presenca/base` passa a aceitar o papel segurança.

## Celular/tablet
- `/m/preventivos` (entrada) e `/m/preventivos/etilometro` (sessão guardada no aparelho, `lerSessao`/`salvarSessao`):
  Início (aparelho válido, fotos carimbadas, responsável da lista que assina com o crachá) → Fila (identificar por
  crachá NFC/código/QR, rosto ou lista; painel da contraprova com cronômetro que vibra/apita ao liberar) → Valor (mg/L,
  atalhos 0,00/0,01/0,02, recusa com confirmação) → Resultado em tela cheia (faixa, penalidade, aviso de contraprova) →
  assinatura do colaborador (`components/Preventivos/Assinar.tsx`: rosto comparado ao dele, crachá dele ou desenho) →
  próximo. Encerrar: responsável assina com o crachá; contraprovas não feitas ficam pendentes no histórico.
- Cada passo vira item da fila do aparelho (spec 072, tipo `etilometro`: abrir, teste, encerrar), sobe em ordem.
- Leitores extraídos da presença para `components/Mobile/Leitores.tsx`; base de pessoas offline em `lib/presenca/useBase.ts`.

## Web
`/app/preventivos`: abas Etilômetro — eventos (indicadores com memória, lista, ficha com aparelho, fotos, assinaturas e
testes, imprimir com logos) | Configuração (faixas, recusa, minutos da contraprova, aparelhos).

## Sessão sem internet
`AuthProvider.renovar`: resposta 5xx (servidor fora, deploy) é tratada como sem internet — não derruba a sessão do
aparelho. Observação: em rede muito instável, se a resposta da renovação se perder, o auth-kit detecta reuso e pede novo
login; os registros continuam na fila e sobem depois do login.

## Testes
`tests/test_preventivos.py` (faixas e configuração; evento do início ao fim com idempotência, contraprova, recusa,
aparelho vencido, fotos obrigatórias). e2e: evento inteiro com a API fora do ar → volta → sobe com número e ficha web.
