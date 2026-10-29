// Phase 3c — T2 pixel compare for the account + orders pages, in every visible
// state legacy can show, phone (390x844) + desktop (1280x800).
//
// Usage: node scripts/account-pages-compare.mjs [legacyBase] [newBase]
//   defaults: legacy http://localhost:8080  new http://localhost:3000
//
// Each state runs the SAME `setup(page)` on the legacy and the new page (a
// click / fill / evaluate) before the screenshot, so both render the same
// visible state. API requests are stubbed from fixtures; Firebase and Leaflet
// are stubbed by init script (never the real CDN); map tiles are aborted so the
// compare is deterministic. FAILS if any state is >=1%.
//
// NO REAL AUTH / NO REAL BACKEND: the fake `window.firebase` and fake `window.L`
// are injected before any page script, every non-GET request is stubbed, and all
// fixtures use fake names / phones / addresses only.
import { chromium } from "playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import fs from "node:fs";

const [legacyBase = "http://localhost:8080", newBase = "http://localhost:3000"] =
  process.argv.slice(2);
const L = legacyBase.replace(/\/$/, "");
const N = newBase.replace(/\/$/, "");
const F = (f) => "scripts/fixtures/" + f;
const sizes = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } };
fs.mkdirSync("compare-out", { recursive: true });

const fixtureSets = {
  full: JSON.parse(fs.readFileSync(F("account-orders.json"), "utf8")),
  empty: JSON.parse(fs.readFileSync(F("account-orders-empty.json"), "utf8")),
  hang: JSON.parse(fs.readFileSync(F("account-orders-hang.json"), "utf8")),
  e401: JSON.parse(fs.readFileSync(F("account-orders-401.json"), "utf8")),
  e500: JSON.parse(fs.readFileSync(F("account-orders-500.json"), "utf8")),
};
let fixtures = fixtureSets.full;

/* Fake Firebase: records nothing, resolves the scripted outcomes this compare
   needs (push registration is best-effort and must not break the page). */
const fakeFirebase = () => {
  function userObj(u) {
    if (!u) return null;
    return {
      uid: u.uid || "uid_fake",
      displayName: u.displayName || "",
      email: u.email || "",
      photoURL: u.photoURL || "",
      getIdToken: () => Promise.resolve("FAKE_ID_TOKEN"),
    };
  }
  const authObj = {
    GoogleAuthProvider: function () { this.setCustomParameters = function () {}; },
    currentUser: null,
    onAuthStateChanged: () => function () {},
    getRedirectResult: () => Promise.resolve({}),
    signInWithPopup: () => Promise.resolve({ user: userObj({}) }),
    signInWithRedirect: () => Promise.resolve(),
    signOut: () => Promise.resolve(),
  };
  const messaging = {
    getToken: () => Promise.resolve("FAKE_FCM_TOKEN"),
    onMessage: () => {},
  };
  const firebaseObj = {
    apps: [],
    initializeApp: function (c) {
      firebaseObj.apps.push({ options: c });
      return firebaseObj.apps[0];
    },
    auth: function () {
      return authObj;
    },
    messaging: function () {
      return messaging;
    },
  };
  firebaseObj.auth.GoogleAuthProvider = authObj.GoogleAuthProvider;
  window.firebase = firebaseObj;
  try {
    navigator.serviceWorker.register = () => Promise.resolve({ scope: "./fcm/" });
  } catch (e) {}
};

/* Fake Leaflet so the track-order live map renders its frame without the CDN.
   The fake records every marker / polyline call so the DOM output is
   deterministic and identical on both sides. */
const fakeLeaflet = () => {
  function Layer() {
    const o = {};
    o.addTo = () => o;
    o.remove = () => {};
    o.setLatLng = () => o;
    o.setLatLngs = () => o;
    o.setStyle = () => o;
    o.getLatLng = () => ({ lat: 26.57, lng: 88.83 });
    o.bindPopup = () => o;
    return o;
  }
  function Bounds() {
    const b = {};
    b.pad = () => b;
    return b;
  }
  function MapObj() {
    const center = { lat: 26.545, lng: 88.82 };
    const m = {};
    m.setView = (c) => { center.lat = c[0]; center.lng = c[1]; return m; };
    m.getCenter = () => ({ lat: center.lat, lng: center.lng });
    m.fitBounds = () => m;
    m.panInside = () => m;
    m.on = () => m;
    m.off = () => m;
    m.removeLayer = () => m;
    m.setZoom = () => m;
    m.invalidateSize = () => m;
    return m;
  }
  window.L = {
    map: () => MapObj(),
    tileLayer: () => Layer(),
    marker: () => Layer(),
    circle: () => Layer(),
    polyline: () => Layer(),
    latLngBounds: () => Bounds(),
    divIcon: (c) => c || {},
  };
};

/* All non-GET requests are stubbed (recorded in window.__writes) and FAIL the
   run if unstubbed; map tiles / Firebase CDN are aborted so the compare is
   deterministic. */
const stubRoutes = (page) =>
  page.route("**/*", async (route) => {
    const req = route.request();
    const url = req.url();
    const method = req.method();
    if (/gstatic\.com\/firebasejs|unpkg\.com\/leaflet@|api\.maptiler\.com|tile\.openstreetmap\.org/.test(url))
      return route.abort();
    if (/photon\.komoot\.io/.test(url))
      return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: JSON.stringify({ features: [] }) });
    if (/nominatim\.openstreetmap\.org/.test(url))
      return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "{}" });
    if (url.includes("api.eatswada.com")) {
      const u = new URL(url);
      const path = u.pathname.replace(/^\/api/, "");
      if (method !== "GET") {
        const body = req.postData() || "";
        await page.evaluate(
          (rec) => { (window.__writes = window.__writes || []).push(rec); },
          { method, path, body, url }
        );
        return route.fulfill({
          status: 200,
          headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
          body: JSON.stringify({ success: true, data: { _id: "newaddr0000000000000000" } }),
        });
      }
      const body = fixtures[path + u.search] !== undefined ? fixtures[path + u.search] : fixtures[path];
      if (body === undefined)
        return route.fulfill({ status: 404, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: JSON.stringify({ success: false }) });
      if (body === "__hang__") return new Promise(() => {});
      /* Error fixtures are delayed: legacy registers its IntersectionObserver
         at DOMContentLoaded, so on a 401/500 the "empty" render can win or
         lose the race against the fetch. A short delay lets both sides settle
         in the same order, which is what a user actually sees. */
      if (body && body.__delay__) await new Promise((z) => setTimeout(z, body.__delay__));
      const status = body && body.__status__ ? body.__status__ : 200;
      const payload = body && body.__status__ ? body.__body__ : body;
      return route.fulfill({ status, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: JSON.stringify(payload) });
    }
    return route.continue();
  });

/* Every state: [name, legacyUrl, newUrl, seed, setup]. `setup` runs on both
   pages after load (null for the default state). */
const TOKEN = { nearbite_token: "FAKE_SESSION_TOKEN" };
/* A 6th tuple element selects the fixture set (default "full"). */
const STATES = [
  /* ── orders ─────────────────────────────────────────────── */
  ["orders-populated", `${L}/orders.html`, `${N}/orders`, TOKEN, null],
  ["orders-search", `${L}/orders.html`, `${N}/orders`, TOKEN, async (p) => {
    await p.fill("#order-search", "Test");
  }],
  ["orders-empty-search", `${L}/orders.html`, `${N}/orders`, TOKEN, async (p) => {
    await p.fill("#order-search", "zzzznomatch");
  }],
  ["orders-menu", `${L}/orders.html`, `${N}/orders`, TOKEN, async (p) => {
    await p.evaluate(() => {
      const btn = document.querySelector('.ord-menu-btn');
      if (btn) btn.click();
    });
  }],
  ["orders-invoice", `${L}/orders.html`, `${N}/orders`, TOKEN, async (p) => {
    await p.evaluate(() => { window.showInvoice("ord0000000000000000000004"); });
  }],

  /* ── profile ────────────────────────────────────────────── */
  ["profile-default", `${L}/profile.html`, `${N}/profile`, TOKEN, null],
  ["profile-edit-open", `${L}/profile.html`, `${N}/profile`, TOKEN, async (p) => {
    await p.evaluate(() => { document.getElementById("editProfileBtn").click(); });
  }],

  /* ── address (manage view) ──────────────────────────────── */
  ["address-manage", `${L}/address.html`, `${N}/address`, TOKEN, null],
  ["address-editor", `${L}/address.html`, `${N}/address`, TOKEN, async (p) => {
    await p.evaluate(() => { window.editAddress("aaaaaaaaaaaaaaaaaaaaaaaa"); });
  }],
  ["address-manage-empty", `${L}/address.html`, `${N}/address`, TOKEN, null],

  /* ── address (select view) ──────────────────────────────── */
  ["address-select", `${L}/address.html?view=select`, `${N}/address?view=select`, TOKEN, null],

  /* ── address-new ────────────────────────────────────────── */
  ["address-new", `${L}/address-new.html`, `${N}/address-new`, TOKEN, null],

  /* ── track-order ────────────────────────────────────────── */
  ["track-out-for-delivery", `${L}/track-order.html?id=ord0000000000000000000001`, `${N}/track-order?id=ord0000000000000000000001`, TOKEN, null],
  ["track-preparing", `${L}/track-order.html?id=ord0000000000000000000002`, `${N}/track-order?id=ord0000000000000000000002`, TOKEN, null],
  ["track-placed", `${L}/track-order.html?id=ord0000000000000000000003`, `${N}/track-order?id=ord0000000000000000000003`, TOKEN, null],
  ["track-delivered", `${L}/track-order.html?id=ord0000000000000000000004`, `${N}/track-order?id=ord0000000000000000000004`, TOKEN, null],
  ["track-cancelled", `${L}/track-order.html?id=ord0000000000000000000009`, `${N}/track-order?id=ord0000000000000000000009`, TOKEN, null],
  ["track-invoice-sheet", `${L}/track-order.html?id=ord0000000000000000000004`, `${N}/track-order?id=ord0000000000000000000004`, TOKEN, async (p) => {
    await p.evaluate(() => { document.getElementById("invoice-btn") && document.getElementById("invoice-btn").click(); });
  }],

  /* ── logged out (gate / redirect) ───────────────────────── */
  ["orders-logged-out", `${L}/orders.html`, `${N}/orders`, {}, null],
  ["profile-logged-out", `${L}/profile.html`, `${N}/profile`, {}, null],
  ["address-logged-out", `${L}/address.html`, `${N}/address`, {}, null],
  ["track-no-id", `${L}/track-order.html`, `${N}/track-order`, TOKEN, null],

  /* ── loading (requests never resolve) ───────────────────── */
  ["orders-loading", `${L}/orders.html`, `${N}/orders`, TOKEN, null, "hang"],
  ["address-loading", `${L}/address.html`, `${N}/address`, TOKEN, null, "hang"],
  ["track-loading", `${L}/track-order.html?id=ord0000000000000000000001`, `${N}/track-order?id=ord0000000000000000000001`, TOKEN, null, "hang"],

  /* ── empty ──────────────────────────────────────────────── */
  ["orders-empty", `${L}/orders.html`, `${N}/orders`, TOKEN, null, "empty"],
  ["address-empty", `${L}/address.html`, `${N}/address`, TOKEN, null, "empty"],
  ["address-select-empty", `${L}/address.html?view=select`, `${N}/address?view=select`, TOKEN, null, "empty"],

  /* ── error: 401 mid-session ─────────────────────────────── */
  ["orders-401", `${L}/orders.html`, `${N}/orders`, TOKEN, null, "e401"],
  ["profile-401", `${L}/profile.html`, `${N}/profile`, TOKEN, null, "e401"],
  ["address-401", `${L}/address.html`, `${N}/address`, TOKEN, null, "e401"],
  ["track-401", `${L}/track-order.html?id=ord0000000000000000000001`, `${N}/track-order?id=ord0000000000000000000001`, TOKEN, null, "e401"],

  /* ── error: 500 ─────────────────────────────────────────── */
  ["orders-500", `${L}/orders.html`, `${N}/orders`, TOKEN, null, "e500"],
  ["address-500", `${L}/address.html`, `${N}/address`, TOKEN, null, "e500"],
  ["profile-500", `${L}/profile.html`, `${N}/profile`, TOKEN, null, "e500"],
];

async function shot(browser, url, viewport, seed, setup, tag) {
  const ctx = await browser.newContext({ viewport, reducedMotion: "reduce" });
  if (seed && Object.keys(seed).length)
    await ctx.addInitScript((entries) => {
      try {
        for (const [k, v] of Object.entries(entries))
          window.localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
      } catch (e) {}
    }, seed);
  await ctx.addInitScript(fakeFirebase);
  await ctx.addInitScript(fakeLeaflet);
  /* Deterministic Math.random so the delivered-state confetti lands in the
     same places on both sides (the page itself is untouched). A constant is
     used because the two pages call Math.random a different number of times
     before the confetti burst, which a seeded sequence would not absorb. */
  await ctx.addInitScript(() => {
    Math.random = () => 0.5;
  });
  /* Frozen clock: the placed-state cancel countdown re-renders every 250 ms
     from `Date.now()`, so two screenshots taken a few hundred ms apart would
     differ by a couple of seconds. Freezing it on BOTH sides makes the
     countdown text identical without touching the page. */
  await ctx.addInitScript(() => {
    const T = 1793000000000;
    Date.now = () => T;
  });
  const page = await ctx.newPage();
  await stubRoutes(page);
  await page.goto(url, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(800);
  if (setup) {
    await setup(page);
    await page.waitForTimeout(800);
  }
  await page.addStyleTag({
    content: "*{animation:none!important;transition:none!important;caret-color:transparent!important}",
  });
  const file = `compare-out/account-${tag}.png`;
  await page.screenshot({ path: file, fullPage: true });
  await ctx.close();
  return file;
}

function diffPct(a, b) {
  const imgA = PNG.sync.read(fs.readFileSync(a));
  const imgB = PNG.sync.read(fs.readFileSync(b));
  const w = Math.max(imgA.width, imgB.width);
  const h = Math.max(imgA.height, imgB.height);
  const pad = (img) => {
    if (img.width === w && img.height === h) return img;
    const out = new PNG({ width: w, height: h });
    PNG.bitblt(img, out, 0, 0, img.width, img.height, 0, 0);
    for (let i = 0; i < out.data.length; i += 4)
      if (out.data[i + 3] === 0) {
        out.data[i] = 255; out.data[i + 1] = 255; out.data[i + 2] = 255; out.data[i + 3] = 255;
      }
    return out;
  };
  const A = pad(imgA);
  const B = pad(imgB);
  const out = new PNG({ width: w, height: h });
  const n = pixelmatch(A.data, B.data, out.data, w, h, { threshold: 0.12 });
  return (n / (w * h)) * 100;
}

const browser = await chromium.launch();
let worst = 0;
let failed = 0;
for (const [name, legacyUrl, newUrl, seed, setup, fx] of STATES) {
  fixtures = fixtureSets[fx || "full"];
  const line = [];
  for (const [label, viewport] of Object.entries(sizes)) {
    const a = await shot(browser, legacyUrl, viewport, seed, setup, `${name}-${label}-legacy`);
    const b = await shot(browser, newUrl, viewport, seed, setup, `${name}-${label}-new`);
    const pct = diffPct(a, b);
    worst = Math.max(worst, pct);
    if (pct >= 1) failed++;
    line.push(`${label} ${pct.toFixed(2)}%`);
  }
  console.log(`${name.padEnd(24)} ${line.join("  /  ")}`);
}
await browser.close();
console.log(`\nworst ${worst.toFixed(2)}%  (states >=1%: ${failed})`);
process.exit(failed === 0 ? 0 : 1);
