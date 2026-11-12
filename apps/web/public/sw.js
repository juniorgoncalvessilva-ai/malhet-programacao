/* Service worker do app Malhet: só o necessário para o celular poder instalar o app.
   Não guarda páginas nem dados em cache (a obra muda o tempo todo e cada deploy precisa chegar na hora). */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => { /* rede normal */ });
