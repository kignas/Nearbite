/* EatSwada — PWA cache worker.
   Legacy `sw.js` installed cache `eatswada-shell-v8` and PRECACHED a list of
   old `.html` pages. Real users still have that worker installed, so this one
   must:
     * on `activate`, delete EVERY cache it does not own — including
       `eatswada-shell-v8` — so the stale HTML shell cannot keep serving, and
     * NOT precache the old `.html` list (App Router URLs are clean).
   The Firebase messaging worker stays at its own path
   (`/firebase-messaging-sw.js`, scope ./fcm/) and is untouched. */
const CACHE = "eatswada-app-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Network-first for navigations so a deploy is picked up, falling back to a
   saved copy when offline. No precache list. */
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== self.location.origin) return;
  if (r.mode !== "navigate") return;
  const key = new URL(r.url);
  key.search = "";
  key.hash = "";
  e.respondWith(
    fetch(r)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(key.href, copy));
        return res;
      })
      .catch(() => caches.match(key.href))
  );
});
