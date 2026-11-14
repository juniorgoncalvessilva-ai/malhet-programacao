import type { CapacitorConfig } from '@capacitor/cli';

/**
 * App de campo nativo (spec 085): o casco carrega o próprio Malhet publicado (server.url) — a aplicação continua uma só,
 * atualizada a cada deploy sem passar pelas lojas. O nativo só entra onde o navegador não chega: o NFC do iPhone (e do
 * Android dentro do app, onde a WebView não tem Web NFC), pelo plugin NfcCracha.
 */
const URL_APP = process.env.MALHET_URL ?? 'https://malhet.com';

const config: CapacitorConfig = {
  appId: 'br.com.malhet.campo',
  appName: 'Malhet Campo',
  webDir: 'www', // página de reserva (sem internet na 1ª abertura); o normal é server.url
  server: {
    url: `${URL_APP}/pt-BR/m`,
    cleartext: false,
    allowNavigation: [new URL(URL_APP).host],
    errorPath: 'index.html',
  },
  ios: {
    // service worker (offline do campo) dentro do WKWebView exige "App-Bound Domains" (WKAppBoundDomains no Info.plist)
    limitsNavigationsToAppBoundDomains: true,
    contentInset: 'never',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
