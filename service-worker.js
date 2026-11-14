const CACHE='goldleaf-shell-v2162';
const SHELL=['./','./qrcode.min.js?v=2.10.54','./html5-qrcode.min.js?v=2.10.54','./qr-scanner.js?v=2.10.54','./app-v2.js?v=2.10.54','./admin-panel.js?v=2.10.55','./pdf-templates.js?v=2.10.54','./erp-ui.js?v=2.10.54','./erp-theme.css?v=2.10.54','./mobile-erp-layout.css?v=2.10.54','./retail-sales.js?v=2.10.54','./retail-purchases.js?v=2.10.54','./retail-estimate-chit.js?v=2.10.55','./retail-chit-reports.js?v=2.10.56','./retail-chit-reports.css?v=2.10.56','./retail-product-workflow.js?v=2.10.54','./retail-estimate-chit.css?v=2.10.55','./retail-sales.css?v=2.10.54','./manifest.webmanifest?v=2.10.54','./icon-192.png?v=2.10.54','./icon-512.png'];
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
self.addEventListener('message',event=>{
  if(event.data==='skipWaiting'||event.data?.type==='SKIP_WAITING'||event.data==='applyUpdate'){
    self.skipWaiting();
  }
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
