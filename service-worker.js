const CACHE='goldleaf-shell-v2145';
const SHELL=['./','./qrcode.min.js?v=2.10.40','./html5-qrcode.min.js?v=2.10.40','./qr-scanner.js?v=2.10.40','./app-v2.js?v=2.10.40','./admin-panel.js?v=2.10.40','./pdf-templates.js?v=2.10.40','./erp-ui.js?v=2.10.40','./erp-theme.css?v=2.10.40','./mobile-erp-layout.css?v=2.10.40','./retail-sales.js?v=2.10.40','./retail-purchases.js?v=2.10.29','./retail-estimate-chit.js?v=2.10.40','./retail-product-workflow.js?v=2.10.40','./retail-estimate-chit.css?v=2.10.40','./retail-sales.css?v=2.10.40','./manifest.webmanifest?v=2.10.40','./icon-192.png?v=2.10.40','./icon-512.png'];
self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE).then(cache=>cache.addAll(SHELL)).catch(()=>{}).then(()=>self.skipWaiting())
  );
});
self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('goldleaf-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())
  );
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put('./',copy))}return response}).catch(()=>caches.match('./')));
    return;
  }
  event.respondWith(
    fetch(event.request).then(response=>{
      if(response.ok){
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(event.request,copy));
      }
      return response;
    }).catch(()=>caches.match(event.request))
  );
});
