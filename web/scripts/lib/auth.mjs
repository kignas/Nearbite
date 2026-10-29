// ============================================================================
// Auth parity probes — Phase 3b (login / forgot-password / reset-password /
// complete-profile / location-onboarding).
//
// Used by scripts/auth-parity.mjs.
//
// Hermetic, NO REAL AUTH:
//   * the Firebase CDN scripts are aborted and a FAKE `window.firebase` is
//     installed with page.addInitScript BEFORE any page script runs. It records
//     every SDK call (method + args) and returns scripted results (success,
//     wrong password, popup closed, popup blocked, network error,
//     user-not-found, too-many-requests, expired reset code, new Google user,
//     existing Google user).
//   * EVERY non-GET request is intercepted with page.route; the recorder keeps
//     method, URL, headers and the exact body, and the harness FAILS if any
//     write is not stubbed.
//   * only fake emails / phones / tokens appear in fixtures.
// ============================================================================
import fs from "node:fs";

function resolve(p) {
  for (const c of [p, p.replace(/^web\//, ""), "web/" + p]) if (fs.existsSync(c)) return c;
  return p;
}
export function loadFixture(name) {
  return JSON.parse(fs.readFileSync(resolve("scripts/fixtures/" + name), "utf8"));
}

/* ── the fake Firebase (injected before any page script) ───────────────── */
export function fakeFirebaseSource(cfg) {
  return `
(function(){
  var CFG = ${JSON.stringify(cfg || {})};
  var calls = [];
  window.__fb = { calls: calls, cfg: CFG };
  function rec(m, a){ try{ calls.push({ method: m, args: a===undefined?[]:a }); }catch(e){} }

  function userObj(u){
    if(!u) return null;
    return {
      uid: u.uid || 'uid_fake',
      displayName: u.displayName || '',
      email: u.email || '',
      photoURL: u.photoURL || '',
      getIdToken: function(){ rec('getIdToken', []); if(CFG.getIdTokenError) return Promise.reject(new Error('token failed')); return Promise.resolve(u.idToken || 'FAKE_ID_TOKEN'); }
    };
  }

  function GoogleAuthProvider(){ this.params={}; rec('new GoogleAuthProvider', []); }
  GoogleAuthProvider.prototype.setCustomParameters = function(p){ rec('setCustomParameters', [p]); this.params=p; };

  var listeners = [];
  function fireAuthState(u){
    listeners.slice().forEach(function(l){ try{ l(userObj(u)); }catch(e){} });
  }

  var authObj = {
    GoogleAuthProvider: GoogleAuthProvider,
    currentUser: userObj(CFG.currentUser),
    onAuthStateChanged: function(cb){
      rec('onAuthStateChanged', []);
      listeners.push(cb);
      if(CFG.authState !== undefined){
        var u = CFG.authState;
        setTimeout(function(){ try{ cb(userObj(u)); }catch(e){} }, 0);
      }
      return function(){ rec('onAuthStateChanged.unsubscribe', []); var i=listeners.indexOf(cb); if(i>=0) listeners.splice(i,1); };
    },
    getRedirectResult: function(){
      rec('getRedirectResult', []);
      if(CFG.redirectError) return Promise.reject(CFG.redirectError);
      return Promise.resolve(CFG.redirectResult ? { user: userObj(CFG.redirectResult) } : {});
    },
    signInWithPopup: function(){
      rec('signInWithPopup', []);
      if(CFG.popupError) return Promise.reject(CFG.popupError);
      return Promise.resolve({ user: userObj(CFG.popupUser || {}) });
    },
    signInWithRedirect: function(){
      rec('signInWithRedirect', []);
      if(CFG.redirectSignInError) return Promise.reject(CFG.redirectSignInError);
      return Promise.resolve();
    }
  };

  var firebaseObj = {
    apps: [],
    initializeApp: function(c){ rec('initializeApp', [c && c.projectId]); firebaseObj.apps.push({ options: c }); return firebaseObj.apps[0]; },
    auth: function(){ rec('auth', []); return authObj; }
  };
  /* legacy calls new firebase.auth.GoogleAuthProvider() — the property hangs
     off the auth FUNCTION, so it must be attached to both. */
  firebaseObj.auth.GoogleAuthProvider = GoogleAuthProvider;
  authObj.GoogleAuthProvider = GoogleAuthProvider;
  window.firebase = firebaseObj;
  window.__fbFireAuthState = fireAuthState;
})();
`;
}

/* ── fake Leaflet (tests never touch the unpkg CDN) ───────────────────── */
export function fakeLeafletSource() {
  return `
(function(){
  function Layer(){ var o={}; o.addTo=function(){ return o; }; o.remove=function(){}; o.setLatLng=function(){}; o.setRadius=function(){}; o.bindPopup=function(){ return o; }; return o; }
  function MapObj(){
    var handlers={}; var center={lat:0,lng:0}; var zoom=0;
    var m={};
    m.setView=function(c,z){ center={lat:c[0],lng:c[1]}; zoom=z; return m; };
    m.getCenter=function(){ return {lat:center.lat,lng:center.lng}; };
    m.getZoom=function(){ return zoom; };
    m.on=function(ev,cb){ (handlers[ev]=handlers[ev]||[]).push(cb); return m; };
    m.off=function(){ return m; };
    m.removeLayer=function(){ return m; };
    m.remove=function(){};
    m.setZoom=function(){ return m; };
    m.invalidateSize=function(){ return m; };
    m.flyTo=function(c,z){ center={lat:c[0],lng:c[1]}; zoom=z||zoom; return m; };
    return m;
  }
  window.L = {
    map: function(){ return MapObj(); },
    tileLayer: function(){ return Layer(); },
    marker: function(){ return Layer(); },
    circle: function(){ return Layer(); },
    polygon: function(){ return Layer(); },
    divIcon: function(cfg){ return cfg || {}; },
    latLng: function(a,b){ return Array.isArray(a)?{lat:a[0],lng:a[1]}:{lat:a.lat,lng:a.lng}; }
  };
  window.__leafletCalls = [];
})();
`;
}

/* ── stubs + recorder ─────────────────────────────────────────────────── */
function fixtureFor(fixtures, rawUrl) {
  const u = new URL(rawUrl);
  const path = u.pathname.replace(/^\/api/, "");
  const exact = path + u.search;
  let body = fixtures[exact] !== undefined ? fixtures[exact] : fixtures[path];
  if (Array.isArray(body)) body = body.length > 1 ? body.shift() : body[0];
  return body;
}

/* Install fixtures + write stubs. Returns the recorder. */
async function installStubs(page, fixtures, opts) {
  const counts = {};
  const writes = opts.writes || {};
  const recorded = [];
  const state = { unstubbed: null };

  // Never touch the real Firebase / Razorpay / map CDNs in tests.
  await page.route("**/gstatic.com/firebasejs/**", (r) => r.abort());
  await page.route("**/checkout.razorpay.com/**", (r) => r.abort());
  await page.route("**/api.maptiler.com/**", (r) => r.abort());
  await page.route("**/tile.openstreetmap.org/**", (r) => r.abort());
  await page.route("**/unpkg.com/leaflet@**", (r) => r.abort());

  // Photon + Nominatim stubs (location-onboarding).
  await page.route("**/photon.komoot.io/**", (r) => {
    const u = new URL(r.request().url());
    counts["photon" + (u.searchParams.get("bbox") ? "?bbox" : "")] =
      (counts["photon" + (u.searchParams.get("bbox") ? "?bbox" : "")] || 0) + 1;
    const key = u.searchParams.get("bbox") ? "photon-local" : "photon-national";
    const body = fixtures[key] !== undefined ? fixtures[key] : { features: [] };
    return r.fulfill({
      status: 200,
      headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  });
  await page.route("**/nominatim.openstreetmap.org/**", (r) => {
    counts["nominatim"] = (counts["nominatim"] || 0) + 1;
    const body = fixtures["nominatim"] !== undefined ? fixtures["nominatim"] : {};
    return r.fulfill({
      status: 200,
      headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  });

  await page.route("https://api.eatswada.com/**", async (route) => {
    const req = route.request();
    const method = req.method();
    const path = new URL(req.url()).pathname.replace(/^\/api/, "");
    if (method === "GET") {
      counts[path] = (counts[path] || 0) + 1;
      const body = fixtureFor(fixtures, req.url());
      if (body === undefined)
        return route.fulfill({
          status: 404,
          headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
          body: JSON.stringify({ success: false, message: "Not found in fixtures" }),
        });
      if (body === "__hang__") return;
      /* Optional per-fixture delay. The orders page registers its
         IntersectionObserver at DOMContentLoaded, so on an instant 401/500 the
         "empty" render and the "Please log in" render race each other — in
         legacy AND in the port. A delay lets both sides settle deterministically
         in the same order, which is what a user actually sees. */
      if (body && body.__delay) await new Promise((z) => setTimeout(z, body.__delay));
      if (body && body.__status && body.__status !== 200)
        return route.fulfill({
          status: body.__status,
          headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
          body: JSON.stringify(body.body ?? {}),
        });
      return route.fulfill({
        status: 200,
        headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    }
    recorded.push({
      method,
      path,
      url: req.url(),
      headers: req.headers(),
      body: req.postData(),
    });
    const key = method + " " + path;
    const stub = writes[key];
    if (stub === undefined || stub === null) {
      state.unstubbed = key;
      return route.fulfill({
        status: 500,
        headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
        body: JSON.stringify({ success: false, message: "UNSTUBBED WRITE: " + key }),
      });
    }
    const s = Array.isArray(stub) ? (stub.length > 1 ? stub.shift() : stub[0]) : stub;
    if (s === "__hang__") return;
    if (s === "__networkerror__") return route.abort("failed");
    if (s && s.__status && s.__status !== 200)
      return route.fulfill({
        status: s.__status,
        headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
        body: JSON.stringify(s.body ?? {}),
      });
    return route.fulfill({
      status: 200,
      headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
      body: JSON.stringify(s ?? {}),
    });
  });

  return { counts, recorded, state };
}

/* ── DOM / state signature ────────────────────────────────────────────── */
const STORAGE_KEYS = [
  "nearbite_token",
  "token",
  "nearbite_user",
  "nearbite_after_login",
  "nearbite_google_pending_token",
  "nearbite_google_pending_profile",
  "eatswada_google_redirect_pending",
  "eatswada_theme_intro_pending",
  "eatswada_new_user_location_pending",
  "nearbite_onboarding_location",
  "eatswada_device_location",
  "nearbite_onboarding_geocode",
  "nearbite_location_permission_seen",
  "eatswada_recent_locations",
  "nearbite_selected_address_id",
  "nearbite_address",
];

export async function signature(page, extra) {
  return await page.evaluate(
    ({ keys, extra }) => {
      const out = {
        url: location.pathname + location.search,
        htmlClass: document.documentElement.className,
        active: (document.activeElement && (document.activeElement.id || document.activeElement.tagName)) || null,
        steps: Array.from(document.querySelectorAll(".step-container")).map((el) => ({
          id: el.id,
          active: el.classList.contains("active"),
        })),
        banners: [],
        buttons: {},
        local: {},
        session: {},
      };
      document.querySelectorAll(".banner-error, .error, #error").forEach((el) => {
        const shown =
          el.classList.contains("show") ||
          (el.id === "error" && el.classList.contains("show"));
        if (shown) out.banners.push((el.textContent || "").trim());
      });
      ["googleSignInBtn", "passwordLoginBtn", "forgotSendBtn", "verifyResetOtpBtn", "resetPasswordBtn", "resendResetOtpBtn", "saveBtn", "sendBtn", "verifyBtn", "resetBtn", "confirm", "lg-primary"].forEach((id) => {
        const b = document.getElementById(id);
        if (b) out.buttons[id] = { disabled: !!b.disabled, text: (b.textContent || "").trim() };
      });
      for (const k of keys) {
        const lv = localStorage.getItem(k);
        const sv = sessionStorage.getItem(k);
        if (lv !== null) out.local[k] = lv;
        if (sv !== null) out.session[k] = sv;
      }
      if (extra) {
        out.extra = {};
        for (const [id, attr] of Object.entries(extra)) {
          const el = document.getElementById(id);
          out.extra[id] = el ? { text: (el.textContent || "").trim(), value: el.value, display: getComputedStyle(el).display } : null;
        }
      }
      return out;
    },
    { keys: STORAGE_KEYS, extra: extra || null }
  );
}

/* Normalise a URL for comparison: the `.html` → clean-URL contract means the
   same logical destination is `…/index.html` in legacy and `/` in the port. */
export function normUrl(raw) {
  if (!raw) return raw;
  let u;
  try {
    u = new URL(raw, "http://x");
  } catch (e) {
    return raw;
  }
  let p = u.pathname;
  if (p.endsWith("/index.html")) p = p.slice(0, -"index.html".length);
  else if (p.endsWith(".html")) p = p.slice(0, -".html".length);
  return p + u.search;
}

export { installStubs };
