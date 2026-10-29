// Phase 3b — T2 pixel compare for the auth + onboarding pages, in every
// visible state legacy can show, phone (390x844) + desktop (1280x800).
//
// Usage: node scripts/auth-pages-compare.mjs [legacyBase] [newBase]
//   defaults: legacy http://localhost:8080  new http://localhost:3000
//
// Each state runs the SAME `setup(page)` on the legacy and the new page (a
// click / fill / evaluate) before the screenshot, so both render the same
// visible state. API requests are stubbed from fixtures; Firebase and Leaflet
// are stubbed by init script (never the real CDN). FAILS if any state is >=1%.
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

const fixtures = JSON.parse(fs.readFileSync(F("auth-pages-fixtures.json"), "utf8"));

/* Fake Firebase: records nothing, resolves the scripted outcomes this compare
   needs (a current user for the "already signed in" states). */
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
  const listeners = [];
  const authObj = {
    GoogleAuthProvider: function () {
      this.setCustomParameters = function () {};
    },
    currentUser: null,
    onAuthStateChanged: (cb) => {
      listeners.push(cb);
      return function () {};
    },
    getRedirectResult: () => Promise.resolve({}),
    signInWithPopup: () => Promise.resolve({ user: userObj({}) }),
    signInWithRedirect: () => Promise.resolve(),
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
  };
  firebaseObj.auth.GoogleAuthProvider = authObj.GoogleAuthProvider;
  authObj.GoogleAuthProvider = authObj.GoogleAuthProvider;
  window.firebase = firebaseObj;
};

/* Fake Leaflet so location-onboarding renders its map frame without the CDN. */
const fakeLeaflet = () => {
  function Layer() {
    const o = {};
    o.addTo = () => o;
    o.remove = () => {};
    o.setLatLng = () => {};
    o.setRadius = () => {};
    return o;
  }
  function MapObj() {
    const center = { lat: 26.545, lng: 88.82 };
    const m = {};
    m.setView = (c) => {
      center.lat = c[0];
      center.lng = c[1];
      return m;
    };
    m.getCenter = () => ({ lat: center.lat, lng: center.lng });
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
    divIcon: (c) => c || {},
  };
};

/* The legacy OSM tile / Photon / Nominatim calls are stubbed to empty so both
   pages show the same "no results" state. */
async function stubRoutes(page) {
  await page.route("**/gstatic.com/firebasejs/**", (r) => r.abort());
  await page.route("**/api.maptiler.com/**", (r) => r.abort());
  await page.route("**/tile.openstreetmap.org/**", (r) => r.abort());
  await page.route("**/unpkg.com/leaflet@**", (r) => r.abort());
  await page.route("**/photon.komoot.io/**", (r) =>
    r.fulfill({
      status: 200,
      headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
      body: JSON.stringify({ features: [] }),
    })
  );
  await page.route("**/nominatim.openstreetmap.org/**", (r) =>
    r.fulfill({
      status: 200,
      headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
      body: "{}",
    })
  );
  await page.route("https://api.eatswada.com/**", (route) => {
    const u = new URL(route.request().url());
    const path = u.pathname.replace(/^\/api/, "");
    const body =
      fixtures[path + u.search] !== undefined ? fixtures[path + u.search] : fixtures[path];
    if (body === undefined)
      return route.fulfill({
        status: 404,
        headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
        body: JSON.stringify({ success: false }),
      });
    return route.fulfill({
      status: 200,
      headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  });
}

/* Every state: [name, legacyUrl, newUrl, seed, setup]. `setup` runs on both
   pages after load (null for the default state). */
const STATES = [
  ["login-default", `${L}/login.html`, `${N}/login`, {}, null],
  ["login-password", `${L}/login.html`, `${N}/login`, {}, (p) => p.click("#showPasswordLoginBtn")],
  ["login-error", `${L}/login.html`, `${N}/login`, {}, async (p) => {
    await p.click("#showPasswordLoginBtn");
    await p.fill("#loginIdentifierInput", "test@example.com");
    await p.fill("#loginPasswordInput", "wrongpass1");
    await p.click("#passwordLoginBtn");
  }],
  ["forgot-default", `${L}/forgot-password.html`, `${N}/forgot-password`, {}, null],
  ["forgot-otp", `${L}/forgot-password.html`, `${N}/forgot-password`, {}, async (p) => {
    await p.fill("#phone", "9876543210");
    await p.click("#sendBtn");
  }],
  ["reset-default", `${L}/reset-password.html`, `${N}/reset-password`, {}, null],
  ["complete-default", `${L}/complete-profile.html`, `${N}/complete-profile`, { nearbite_token: "FAKE_SESSION_TOKEN" }, null],
  /* The save button starts disabled; legacy's inline handler still runs when
     `completeProfile()` is called directly, so the error state is shown the
     same way on both sides. */
  ["complete-error", `${L}/complete-profile.html`, `${N}/complete-profile`, { nearbite_token: "FAKE_SESSION_TOKEN" }, (p) =>
    p.evaluate(() => {
      document.getElementById("name").value = "A";
      window.completeProfile();
    })],
  ["complete-ready", `${L}/complete-profile.html`, `${N}/complete-profile`, { nearbite_token: "FAKE_SESSION_TOKEN" }, async (p) => {
    await p.fill("#name", "Test User");
    await p.fill("#phone", "9876543210");
    await p.fill("#email", "test@example.com");
    await p.fill("#password", "password123");
    await p.evaluate(() => {
      const a = document.getElementById("age18");
      a.checked = true;
      a.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }],
  /* No geolocation permission in the context -> the GPS gate opens on both. */
  ["lo-default", `${L}/location-onboarding.html`, `${N}/location-onboarding`, {}, null],
  ["lo-preset", `${L}/location-onboarding.html?from=select&lat=26.545&lng=88.82&title=Preset%20Point&sub=Somewhere`, `${N}/location-onboarding?from=select&lat=26.545&lng=88.82&title=Preset%20Point&sub=Somewhere`, {}, null],
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
  const page = await ctx.newPage();
  await stubRoutes(page);
  await page.goto(url, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(700);
  if (setup) {
    await setup(page);
    await page.waitForTimeout(700);
  }
  await page.addStyleTag({
    content: "*{animation:none!important;transition:none!important;caret-color:transparent!important}",
  });
  const file = `compare-out/auth-${tag}.png`;
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
        out.data[i] = 255;
        out.data[i + 1] = 255;
        out.data[i + 2] = 255;
        out.data[i + 3] = 255;
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
for (const [name, legacyUrl, newUrl, seed, setup] of STATES) {
  const line = [];
  for (const [label, viewport] of Object.entries(sizes)) {
    const a = await shot(browser, legacyUrl, viewport, seed, setup, `${name}-${label}-legacy`);
    const b = await shot(browser, newUrl, viewport, seed, setup, `${name}-${label}-new`);
    const pct = diffPct(a, b);
    worst = Math.max(worst, pct);
    if (pct >= 1) failed++;
    line.push(`${label} ${pct.toFixed(2)}%`);
  }
  console.log(`${name.padEnd(20)} ${line.join("  /  ")}`);
}
await browser.close();
console.log(`\nworst ${worst.toFixed(2)}%  (states >=1%: ${failed})`);
process.exit(failed === 0 ? 0 : 1);
