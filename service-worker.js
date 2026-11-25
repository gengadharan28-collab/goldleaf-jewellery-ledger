const CACHE='goldleaf-shell-v2336';
self.addEventListener('install',event=>{
  event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    await self.registration.navigationPreload?.disable().catch(()=>{});
    await self.clients.claim();

    await caches.open(CACHE);
    const keys=await caches.keys();
    const previous=keys.filter(key=>key.startsWith('goldleaf-shell-')&&key!==CACHE);
    await Promise.all(previous.slice(0,-1).map(key=>caches.delete(key)));
  })());
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
      const cached=await (await caches.open(CACHE)).match('./') || await caches.match('./');
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








