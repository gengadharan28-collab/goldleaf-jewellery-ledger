const CACHE='goldleaf-shell-v2331';
const SHELL=['./','./wholesale-lot.js?v=2.12.8&layoutcards=1','./wholesale-lot.css?v=2.12.0&layoutcards=1','./qrcode.min.js?v=2.10.54','./qr-scanner.js?v=2.12.8&lazy=1','./app-v2.js?v=2.12.8&layoutcards=1','./admin-panel.js?v=2.11.19&cloudfix=3','./pdf-templates-v21281.js?v=2','./direct-print-helper.js?v=2.12.75&clearfont=1','./html2canvas.min.js?v=1.4.1','./erp-ui.js?v=2.11.19&sharedrate=1','./erp-theme.css?v=2.11.19&sharedrate=1','./mobile-erp-layout.css?v=2.10.95','./retail-sales.js?v=2.12.14&strictiso=1&return=5','./retail-purchases.js?v=2.11.15&deletefix=2','./retail-estimate-chit.js?v=2.12.40&historyview=1&return=5','./retail-crm-orders.js?v=2.12.29','./retail-groups-accounts.js?v=2.12.23','./retail-cost-structure.js?v=2.12.27','./retail-all-reports.js?v=2.12.34','./gl-datatable-drill.js?v=2.12.33','./retail-crm-orders.css?v=2.12.22','./retail-stock-verification.js?v=2.10.90','./retail-lot-entry.js?v=2.10.90','./retail-stock-verification.css?v=2.10.91','./retail-chit-reports.js?v=2.10.77','./retail-trade-reports.js?v=2.10.62','./retail-tag-reports.js?v=2.10.80','./retail-chit-reports.css?v=2.10.62','./retail-tag-reports.css?v=2.10.80','./retail-product-workflow.js?v=2.10.96','./retail-estimate-chit.css?v=2.10.56&autocut=2','./entry-compact.css?v=2.10.76','./retail-mobile-polish.css?v=2.12.31','./retail-sales.css?v=2.10.66','./manifest.webmanifest?v=2.10.54','./icon-192.png?v=2.10.54','./icon-512.png'];
self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE).then(cache=>Promise.allSettled(SHELL.map(path=>cache.add(path)))).then(()=>self.skipWaiting())
  );
});
self.addEventListener('activate',event=>{
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('goldleaf-shell-')&&key!==CACHE).map(key=>caches.delete(key)))),
      self.registration.navigationPreload?.disable().catch(()=>{})
    ]).then(()=>self.clients.claim())
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
    const network=(async()=>{
      const response=await fetch(event.request,{cache:'no-cache'});
      if(response.ok){
        const cache=await caches.open(CACHE);
        await cache.put('./',response.clone()).catch(()=>{});
      }
      return response;
    })();
    event.waitUntil(network.catch(()=>{}));
    event.respondWith((async()=>{
      const cached=await (await caches.open(CACHE)).match('./');
      if(!cached)return network;
      let timer;
      try{
        return await Promise.race([network.catch(()=>cached),new Promise(resolve=>{timer=setTimeout(()=>resolve(cached),1500)})]);
      }finally{clearTimeout(timer)}
    })());
    return;
  }
  const assetUrl=new URL(event.request.url);
  if(/\.(?:js|css)$/.test(assetUrl.pathname)){
    // Versioned assets are served from the app cache immediately. Refresh in the background.
    event.respondWith(caches.match(event.request).then(cached=>{
      const refresh=fetch(event.request,{cache:'no-cache'}).then(response=>{
        if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy))}
        return response;
      }).catch(()=>cached);
      return cached||refresh;
    }));
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








