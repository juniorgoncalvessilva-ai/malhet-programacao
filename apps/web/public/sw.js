/* Service worker do app Malhet (spec 063): instalar no celular e abrir o app de campo sem internet.
   - Páginas do campo (/pt-BR/m/...): rede primeiro (cada deploy chega na hora); sem rede, a última cópia guardada.
   - Arquivos do build (/_next/static, com hash) e modelos da leitura facial (/models): guardados na primeira vez.
   - A API (/backend) nunca passa pelo cache: os dados offline ficam no IndexedDB do próprio app. */
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
