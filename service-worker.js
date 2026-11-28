const CACHE = 'goldleaf-shell-v2425';
const CORE_SHELL = [
  './',
  './index.html',
  './erp-theme.css?v=2.14.0',
  './mobile-erp-layout.css?v=2.10.95',
  './supabase.min.js?v=2.119.2',
  './qrcode.min.js?v=2.10.54',
  './app-v2.js?v=2.12.12&delpay=1&sr=1',
  './admin-panel.js?v=2.14.0&cloudfix=5&loanaccess=5',
  './erp-ui.js?v=2.14.0&clean=4',
  './retail-sales.js?v=2.13.8&termsfilter=1&srfull=3',
  './retail-estimate-chit.js?v=2.13.8&chitfull=1&srfull=3',
  './retail-groups-accounts.js?v=2.13.7&compactroof=1&srfull=2',
  './retail-all-reports.js?v=2.13.6&reportsroof=2&srfull=1',
  './retail-jewel-loan.js?v=9&loanfix=3',
  './gl-update-center.js?v=2.14.1',
  './ng-engine/main.js?v=2424',
  './ng-engine/styles.css?v=2424'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE);
      await Promise.allSettled(
        CORE_SHELL.map(url =>
          fetch(url, { cache: 'no-cache' }).then(res => (res.ok ? cache.put(url, res) : null))
        )
      );
    } catch (_) {}
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await self.registration.navigationPreload?.disable().catch(() => {});
    await self.clients.claim();

    await caches.open(CACHE);
    const keys = await caches.keys();
    const previous = keys.filter(key => key.startsWith('goldleaf-shell-') && key !== CACHE);
    await Promise.all(previous.map(key => caches.delete(key)));
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
      client.postMessage({ type: 'SW_ACTIVATED', cache: CACHE });
    }
  })());
});

self.addEventListener('message', event => {
  if (event.data === 'skipWaiting' || event.data?.type === 'SKIP_WAITING' || event.data === 'applyUpdate') {
    self.skipWaiting();
  } else if (event.data?.type === 'CLEAR_CACHES') {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k.startsWith('goldleaf-shell-')).map(k => caches.delete(k)));
    })());
  } else if (event.data?.type === 'PREWARM_URLS' && Array.isArray(event.data.urls)) {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE);
      await Promise.allSettled(
        event.data.urls.map(async u => {
          const res = await fetch(u, { cache: 'no-cache' });
          if (res.ok) {
            if (u === './' || u === './index.html') {
              await cache.put('./', res.clone());
              await cache.put('./index.html', res);
            } else {
              await cache.put(u, res);
            }
          }
        })
      );
    })());
  }
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  const reqUrl = new URL(event.request.url);

  if (reqUrl.pathname.endsWith('/version.json') || reqUrl.pathname.endsWith('/service-worker.js') || reqUrl.searchParams.has('_prewarm')) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }

  if (event.request.mode === 'navigate') {
    const forceFresh = reqUrl.searchParams.has('gl_fresh') || reqUrl.searchParams.has('_upd');
    const revalidate = (async () => {
      const response = await fetch('./index.html', { cache: 'no-cache' });
      if (response.ok) {
        const cache = await caches.open(CACHE);
        await cache.put('./', response.clone()).catch(() => {});
        await cache.put('./index.html', response.clone()).catch(() => {});
      }
      return response;
    })();
    event.waitUntil(revalidate.catch(() => {}));

    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = (await cache.match('./')) || (await cache.match('./index.html')) || (await caches.match('./'));
      if (cached && !forceFresh) {
        // Instant App-Shell first (0ms network wait!) while revalidating in background
        return cached;
      }
      try {
        return await revalidate;
      } catch (_) {
        return cached || fetch(event.request);
      }
    })());
    return;
  }

  if (/\.(?:js|css)$/.test(reqUrl.pathname)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const refresh = fetch(event.request, { cache: 'no-cache' })
          .then(response => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then(cache => cache.put(event.request, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached || refresh;
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(
      cached =>
        cached ||
        fetch(event.request).then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
    )
  );
});
