const CACHE='goldleaf-shell-v2213';
const SHELL=['./','./qrcode.min.js?v=2.10.54','./html5-qrcode.min.js?v=2.10.54','./qr-scanner.js?v=2.10.54','./app-v2.js?v=2.10.87','./admin-panel.js?v=2.10.95','./pdf-templates.js?v=2.10.86','./erp-ui.js?v=2.10.72','./erp-theme.css?v=2.10.65','./mobile-erp-layout.css?v=2.10.95','./retail-sales.js?v=2.11.2','./retail-purchases.js?v=2.10.75','./retail-estimate-chit.js?v=2.11.5','./retail-stock-verification.js?v=2.10.90','./retail-lot-entry.js?v=2.10.90','./retail-stock-verification.css?v=2.10.91','./retail-chit-reports.js?v=2.10.77','./retail-trade-reports.js?v=2.10.62','./retail-tag-reports.js?v=2.10.80','./retail-chit-reports.css?v=2.10.62','./retail-tag-reports.css?v=2.10.80','./retail-product-workflow.js?v=2.10.96','./retail-estimate-chit.css?v=2.10.55','./entry-compact.css?v=2.10.76','./retail-mobile-polish.css?v=2.11.5','./retail-sales.css?v=2.10.66','./manifest.webmanifest?v=2.10.54','./icon-192.png?v=2.10.54','./icon-512.png'];
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
    caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
      if(response.ok){
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(event.request,copy));
      }
      return response;
    }))
  );
});







