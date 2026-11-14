# App de campo nativo (App Store e Google Play) — spec 085

## Arquitetura escolhida
**Capacitor** (não React Native): o app é um casco nativo que abre o próprio Malhet publicado (`https://malhet.com/pt-BR/m`)
numa WebView em tela cheia. A aplicação continua **uma só** — cada deploy chega ao app na hora, sem nova versão na loja.
O nativo entra só onde o navegador não chega:

| Recurso | Navegador | App (Capacitor) |
|---|---|---|
| NFC no iPhone | ❌ a Apple bloqueia em qualquer navegador | ✅ plugin `NfcCracha` (Core NFC) |
| NFC no Android | ✅ Chrome (Web NFC) | ✅ plugin `NfcCracha` (a WebView do app **não** tem Web NFC) |
| Câmera (QR, rosto, fotos), localização | ✅ | ✅ (permissões no Info.plist / AndroidManifest) |
| Offline do campo (service worker) | ✅ | ✅ iOS com *App-Bound Domains* (`WKAppBoundDomains` = malhet.com) |

Ponte: `apps/web/src/lib/presenca/leitores.ts` — `temNfc()`, `escutarNfc()` e `gravarCracha()` usam o plugin quando a tela
roda dentro do app (`window.Capacitor`), senão o Web NFC de antes. Nenhuma tela mudou de lugar.

Plugin `NfcCracha` (`ios/App/App/NfcCrachaPlugin.swift`, `android/.../NfcCrachaPlugin.java`):
- `ler({continuo})` → devolve, a cada crachá, `{serial: "04:a2:…", textos: [...]}` (o mesmo formato do Web NFC).
  No iPhone a janela do sistema fica aberta e lê um atrás do outro (`restartPolling`); o iOS fecha a janela em 60 s —
  aí volta `{fim: true}` e a tela pede um toque para continuar. No Android usa o *reader mode* (sem limite).
- `gravarUrl({url})` grava o link da Presença no crachá (agora também pelo iPhone).
- `parar()`, `disponivel()`.

## O que já está pronto (`apps/mobile`)
- Projeto Capacitor 8.5.3 com Android e iOS (Swift Package Manager, sem CocoaPods), `appId br.com.malhet.campo`,
  nome "Malhet Campo", página de reserva sem internet (`www/index.html`).
- iOS: entitlement de NFC (`TAG` + `NDEF`), textos de uso (NFC, câmera, localização), `WKAppBoundDomains`.
- Android: permissões de NFC, câmera, localização; NFC opcional (o app instala em celular sem NFC).
- Workflow **App nativo** (`.github/workflows/app-nativo.yml`): compila o Android (gera o APK de teste, baixe em
  Actions › App nativo › *Artifacts*) e o iOS para o simulador (confere o Swift) a cada mudança em `apps/mobile`.

## O que depende de você (contas e assinatura)
1. **Contas**: Apple Developer Program (US$ 99/ano, conta de empresa pede D-U-N-S) e Google Play Console (US$ 25, uma vez).
2. **iPhone**: num Mac com Xcode 16+: `cd apps/mobile && npm ci && npx cap sync ios && npx cap open ios` →
   *Signing & Capabilities*: escolha o time; confira a capacidade *Near Field Communication Tag Reading* (já no
   `App.entitlements`) → *Product › Archive* → *Distribute App › App Store Connect* → TestFlight → revisão.
   (Sem Mac: dá para assinar e enviar pelo GitHub Actions com o certificado e o perfil como secrets — posso montar.)
3. **Android**: gere a chave de upload (`keytool -genkey -v -keystore malhet-upload.jks -alias malhet -keyalg RSA
   -keysize 2048 -validity 10000`), guarde-a fora do git; `./gradlew bundleRelease` com a assinatura → envie o `.aab`
   na Play Console (teste interno → produção). (Também posso montar no Actions com a chave em secrets.)
4. **Ícones e splash**: troque `ios/App/App/Assets.xcassets` e `android/app/src/main/res/mipmap-*` pela marca
   (ou `npx @capacitor/assets generate` a partir de um PNG 1024×1024).

## Revisão das lojas — o que pesa
- **Apple 4.2 (funcionalidade mínima)**: app que só embrulha um site costuma ser recusado. Aqui há recurso nativo real
  (NFC do crachá, câmera, offline, localização) — descreva isso nas notas da revisão e mande uma conta de teste.
- **Privacidade**: declarar na App Store (*App Privacy*) e na Play (*Data safety*): fotos, localização, identificadores,
  e **dados biométricos** (descritor facial — só com aceite LGPD por finalidade; a foto do rosto não sai do servidor).
  Link da política de privacidade obrigatório nas duas lojas.
- **Contas**: as contas são criadas pelo administrador da obra (não há cadastro aberto no app); se um dia houver,
  a Apple exige excluir a conta pelo próprio app.

## Sobre a proposta com React Native
Concordo com a ideia central (casco nativo + WebView + ponte por mensagem) e com a dica final: **Capacitor** é o caminho
mais curto aqui. Ajustes em relação ao passo a passo sugerido:
1. **Android também precisa da ponte**: a WebView do app não tem Web NFC (só o Chrome tem) — sem o plugin, o NFC que hoje
   funciona no Android pararia dentro do app.
2. **Ler o número do crachá no iPhone** exige `NFCTagReaderSession` (ISO 14443/MIFARE); o `registerTagEvent` do
   `react-native-nfc-manager` lê só NDEF — crachá sem nada gravado não seria lido.
3. **O botão fica dentro da tela**, não por cima da WebView: a própria tela de Presença pede a leitura ao nativo e recebe
   cada crachá (callback contínuo) — mesma fila, mesmo offline, mesmo bipe.
4. **Offline no iPhone**: sem *App-Bound Domains* o service worker não roda no WKWebView e o campo perde o offline.
5. **iOS não lê em segundo plano**: cada sessão mostra a janela do sistema e dura até 60 s; por isso o modo contínuo.
