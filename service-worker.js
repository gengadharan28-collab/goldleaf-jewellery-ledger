const CACHE='goldleaf-shell-v2103';
const SHELL=['./','./app-v2.js?v=2.10.3','./admin-panel.js?v=2.10.3','./pdf-templates.js?v=2.10.3','./erp-ui.js?v=2.10.3','./erp-theme.css?v=2.6.0-r3','./retail-sales.js?v=2.10.3','./retail-purchases.js?v=2.10.3','./retail-estimate-chit.js?v=2.10.3','./retail-estimate-chit.css?v=2.10.3','./retail-sales.css?v=2.10.3','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).catch(()=>{})).then(()=>self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('goldleaf-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put('./',copy))}return response}).catch(()=>caches.match('./')));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
