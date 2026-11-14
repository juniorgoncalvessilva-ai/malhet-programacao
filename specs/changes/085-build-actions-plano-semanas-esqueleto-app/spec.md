# 085 — Build no GitHub Actions, plano por semana e por WBS, skeleton, look-ahead para gestão à vista, app nativo

## 1. Imagens no GitHub Actions (fase 5 da spec 082)
A VPS (1 vCPU / 4 GB) travava o Coolify ao compilar o Next. Agora o workflow **Deploy no Coolify** tem o job `imagens`
(matriz api/web, `docker/build-push-action` com cache `gha`) que publica `ghcr.io/juniorgoncalvessilva-ai/malhet-{api,web}`
com as tags `latest` e o commit (`NEXT_PUBLIC_VERSAO` = commit); o deploy só roda depois. `docker-compose.coolify.imagens.yml`
= o mesmo compose com `image:` + `pull_policy: always` (`IMAGEM_TAG` fixa uma versão). Troca do recurso no Coolify pelo
workflow **Coolify** (`acao=usar-imagens` / `usar-build`, `coolify.py compose`). Passos manuais (visibilidade dos pacotes,
swap) em `docs/deploy-coolify.md`. Sem a troca, nada muda (o Coolify segue compilando).

## 2. Look-ahead para gestão à vista
Botão **Imprimir A0/A1/A2** (`ExportarQuadro`, reaproveita `gerarFolha` do organograma): folha A0/A1/A2/A3, paisagem
(padrão), PDF ou JPG, com logos, título, obra e data. Sai o quadro inteiro da janela (todas as semanas e raias) com a
legenda das equipes; os dias alargam para o quadro ficar na proporção da folha (√2) e ocupar a largura; tema claro.

## 3. Plano de 90 dias — Levar à programação por semana
Abre sozinho na programação em rascunho de hoje (semanal antes da mensal; sem ela, a em rascunho mais perto de hoje).
Atividades agrupadas por semana (segunda a domingo, nº ISO) dentro do período — cada uma na 1ª semana em que acontece —,
"só a semana corrente" ligado por padrão e **marcar a semana** (só o que pode ir: sem restrição pendente na semanal).

## 4. Plano de 90 dias — recolher pela estrutura
Cabeçalhos Local → Área → CWP da grade recolhem/abrem com um clique (▸/▾, com a contagem); botões Abrir tudo | Até a área |
Só locais.

## 5. Skeleton loading
`components/Obra/Esqueleto.tsx`: `Esqueleto` (barra), `Carregando` (bloco), `LinhasCarregando` (linhas de tabela),
`PaginaCarregando` e `CampoCarregando`. `loading.tsx` nas rotas da obra e do celular (aparece já no clique do menu);
`Tabela` com `vazio="Carregando…"` (`CARREGANDO`) desenha linhas-esqueleto; os textos "Carregando…" das telas viraram
esqueletos. Sem animação com `prefers-reduced-motion`.

## Book de fotos (pedido no meio)
Miniaturas menores por padrão (≈130 px, a grade enche a linha) com seletor Pequena | Média | Grande (lembrado no aparelho)
e legenda compacta.

## 6. App nativo (App Store / Google Play)
`apps/mobile` com **Capacitor 8.5.3** (Android + iOS por SPM): o casco abre `https://malhet.com/pt-BR/m`; plugin nativo
`NfcCracha` (Swift `NFCTagReaderSession` com leitura contínua por `restartPolling`; Java *reader mode*) — `ler`, `parar`,
`gravarUrl`, `disponivel`; mesmo formato do Web NFC (`serial` "04:a2:…" + `textos`). Na web, `lib/presenca/leitores.ts`
usa o plugin quando roda no app (`emAppNativo`, `temNfcNativo`) e o Web NFC fora dele; `LeitorNfc` volta ao botão quando a
janela do iOS fecha (60 s). iOS: entitlement de NFC, textos de uso (NFC, câmera, localização), `WKAppBoundDomains`
(service worker/offline no WKWebView). Android: permissões e NFC opcional. Workflow **App nativo** compila Android
(APK de teste como artefato) e iOS (simulador). Lojas, assinatura e revisão: `docs/app-nativo.md` (com a avaliação da
proposta React Native).

## Verificação
pytest, tsc e build; e2e: esqueleto visível na carga lenta (sem texto "Carregando…"), plano Só locais/Abrir tudo/recolher
área, Levar à programação com semanas e a corrente, marcar a semana, book com miniatura de ~137 px, PDF A1 e JPG A2 do
look-ahead gerados e conferidos.
