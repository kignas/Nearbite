const CACHE='eatswada-shell-v8';
const SHELL=['./','./index.html','./profile.html','./orders.html','./cart.html','./address.html','./address-new.html','./search.html','./category.html','./restaurant.html','./complete-profile.html','./location-onboarding.html','./config.js','./api.js','./navigation.js','./cart-bar.js','./favorites.js','./restaurant-card.js','./home.js','./safe-html.js','./seo.js','./style.css','./restaurant-card.css'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL).catch(()=>{})).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET' || new URL(r.url).origin!==self.location.origin) return;
  if(r.mode==='navigate'){
    // Keep ONE saved copy per page (ignore ?id=... etc.) so the cache does not
    // grow with every restaurant a customer opens.
    const key=new URL(r.url);key.search='';key.hash='';
    e.respondWith(fetch(r).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put(key.href,copy));return res}).catch(()=>caches.match(key.href).then(x=>x||caches.match('./index.html'))));
    return;
  }
  if(r.destination==='script'){
    e.respondWith(fetch(r).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put(r,copy));return res}).catch(()=>caches.match(r)));
    return;
  }
  if(['style','font'].includes(r.destination)){
    // Always prefer the network for CSS/fonts so device-specific stale caches
    // cannot keep an older responsive layout alive.
    e.respondWith(fetch(r).then(res=>{
      const copy=res.clone();
      caches.open(CACHE).then(c=>c.put(r,copy));
      return res;
    }).catch(()=>caches.match(r)));
  }
});
