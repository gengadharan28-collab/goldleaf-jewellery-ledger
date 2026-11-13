const CACHE='goldleaf-shell-v2156';
const SHELL=['./','./qrcode.min.js?v=2.10.50','./html5-qrcode.min.js?v=2.10.50','./qr-scanner.js?v=2.10.50','./app-v2.js?v=2.10.50','./admin-panel.js?v=2.10.50','./pdf-templates.js?v=2.10.50','./erp-ui.js?v=2.10.50','./erp-theme.css?v=2.10.50','./mobile-erp-layout.css?v=2.10.50','./retail-sales.js?v=2.10.50','./retail-purchases.js?v=2.10.50','./retail-estimate-chit.js?v=2.10.50','./retail-product-workflow.js?v=2.10.50','./retail-estimate-chit.css?v=2.10.50','./retail-sales.css?v=2.10.50','./manifest.webmanifest?v=2.10.50','./icon-192.png?v=2.10.50','./icon-512.png'];
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
