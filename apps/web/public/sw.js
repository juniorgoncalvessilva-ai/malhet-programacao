/* Service worker do app Malhet (spec 063): instalar no celular e abrir o app de campo sem internet.
   - Páginas do campo (/pt-BR/m/...): rede primeiro (cada deploy chega na hora); sem rede, a última cópia guardada.
   - Arquivos do build (/_next/static, com hash) e modelos da leitura facial (/models): guardados na primeira vez.
   - A API (/backend) nunca passa pelo cache: os dados offline ficam no IndexedDB do próprio app.
   - Spec 072: com internet, o app pede para "aquecer" as telas do campo (mensagem `aquecer`): a página e os arquivos do
     build que ela usa ficam guardados, e a tela abre sem rede mesmo que a pessoa nunca a tenha aberto antes. */
const VERSAO = 'malhet-campo-v1';
const PAGINAS = `${VERSAO}-paginas`;
const ESTATICOS = `${VERSAO}-estaticos`;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (!k.startsWith(VERSAO)) await caches.delete(k);
  await self.clients.claim();
})()));

const ehCampo = (url) => /^\/[a-z]{2}(-[A-Z]{2})?\/m(\/|$)/.test(url.pathname);
const ehEstatico = (url) => url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/models/')
  || url.pathname.startsWith('/brand/') || url.pathname === '/manifest.webmanifest';

async function redePrimeiro(req) {
  const cache = await caches.open(PAGINAS);
  try {
    const res = await fetch(req);
    if (res.ok && res.type === 'basic') cache.put(req, res.clone());
    return res;
  } catch (e) {
    // página aberta direto (navegação): só uma cópia HTML; navegação interna do Next (RSC): a do mesmo endereço
    const html = req.mode === 'navigate';
    for (const r of await cache.matchAll(req, { ignoreSearch: html, ignoreVary: true })) {
      if (!html || (r.headers.get('content-type') || '').includes('text/html')) return r;
    }
    throw e;
  }
}

async function cachePrimeiro(req) {
  const cache = await caches.open(ESTATICOS);
  const guardada = await cache.match(req);
  if (guardada) return guardada;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/backend/')) return;
  if (ehEstatico(url)) { e.respondWith(cachePrimeiro(req)); return; }
  if (ehCampo(url)) e.respondWith(redePrimeiro(req));
});

async function aquecer(urls) {
  const pag = await caches.open(PAGINAS);
  const est = await caches.open(ESTATICOS);
  for (const u of urls) {
    try {
      const r = await fetch(u, { credentials: 'same-origin' });
      if (!r.ok || r.type !== 'basic') continue;
      const html = await r.clone().text();
      await pag.put(u, r);
      for (const m of html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)) {
        if (await est.match(m[1])) continue;
        const s = await fetch(m[1]);
        if (s.ok) await est.put(m[1], s);
      }
    } catch (e) { /* sem rede no meio: fica para a próxima */ }
  }
}

self.addEventListener('message', (e) => {
  if (e.data && e.data.tipo === 'aquecer' && Array.isArray(e.data.urls)) e.waitUntil(aquecer(e.data.urls.filter((u) => ehCampo(new URL(u, self.location.origin)))));
});

// toque no aviso de notificação (spec 076): abre o app de campo nas notificações
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const abertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const campo = abertas.find((c) => /\/m(\/|$)/.test(new URL(c.url).pathname));
    if (campo) { await campo.focus(); return campo.navigate('/pt-BR/m/notificacoes'); }
    return self.clients.openWindow('/pt-BR/m/notificacoes');
  })());
});
