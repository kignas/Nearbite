const CACHE='eatswada-shell-v9';
const SHELL=['./','./index.html','./profile.html','./orders.html','./cart.html','./address.html','./address-new.html','./search.html','./category.html','./restaurant.html','./complete-profile.html','./location-onboarding.html','./config.js','./api.js','./navigation.js','./cart-bar.js','./favorites.js','./restaurant-card.js','./home.js','./safe-html.js','./seo.js','./style.css','./restaurant-card.css'];
const INDEX=new URL('./index.html',self.location.href).href;
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL).catch(()=>{})).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});

/* Speed model: serve the saved copy instantly, refresh it in the background
   (stale-while-revalidate). A versioned URL (?v=...) never changes, so it is
   served from cache with no network call at all. Only good (200) responses are
   saved, so a failed refresh can never replace a working copy. Pages keep ONE
   saved copy per path (query/hash ignored). Live data (the API, other origins,
   non-GET) is never touched here. */
function refresh(req,key){
  return fetch(req).then(res=>{
    if(res&&res.status===200){const copy=res.clone();return caches.open(CACHE).then(c=>c.put(key,copy)).then(()=>res)}
    return res;
  });
}
function swr(e,req,key){
  e.respondWith(caches.match(key).then(hit=>{
    if(hit){e.waitUntil(refresh(req,key).catch(()=>{}));return hit}
    return refresh(req,key).catch(()=>caches.match(key));
  }));
}
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET')return;
  const url=new URL(r.url);
  if(url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
  if(r.mode==='navigate'){
    const key=new URL(r.url);key.search='';key.hash='';
    e.respondWith(caches.match(key.href).then(hit=>{
      if(hit){e.waitUntil(refresh(r,key.href).catch(()=>{}));return hit}
      return refresh(r,key.href).catch(()=>caches.match(INDEX));
    }));
    return;
  }
  if(['script','style','font','image'].includes(r.destination)){
    if(url.searchParams.has('v')){
      e.respondWith(caches.match(r.url).then(hit=>hit||refresh(r,r.url).catch(()=>caches.match(r.url))));
      return;
    }
    swr(e,r,r.url);
  }
});
