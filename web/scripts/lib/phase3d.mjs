// ============================================================================
// Phase 3d — shared stubs for the partner + support / info pages.
//
// Used by scripts/3d-pages-compare.mjs (T2) and scripts/3d-parity.mjs
// (T3 / T4 / T5 / T6 / T7).
//
// NO REAL BACKEND, EVER:
//   * the Firebase / Razorpay / map CDNs are aborted and a fake `window.firebase`
//     is injected before any page script;
//   * every non-GET request is stubbed; the recorder keeps method + URL +
//     headers + exact body and the harness FAILS on any unstubbed write (T4);
//   * fixtures use only fake names / phones / emails / addresses / tokens.
//
// Two API origins appear on these pages and BOTH are stubbed:
//   * https://api.eatswada.com/api            (config.js API_BASE_URL)
//   * https://eatswada.onrender.com/api/vendor-applications
//     (apply.html / application-status.html hardcode this, NOT CONFIG)
// ============================================================================

/* ── the fake Firebase (injected before any page script) ───────────────── */
export function fakeFirebaseSource(cfg) {
  return `
(function(){
  var CFG = ${JSON.stringify(cfg || {})};
  function userObj(u){
    if(!u) return null;
    return { uid: u.uid||'uid_fake', displayName: u.displayName||'', email: u.email||'', photoURL: u.photoURL||'',
      getIdToken: function(){ return Promise.resolve('FAKE_ID_TOKEN'); } };
  }
  var authObj = {
    GoogleAuthProvider: function(){ this.setCustomParameters=function(){}; },
    currentUser: userObj(CFG.currentUser),
    onAuthStateChanged: function(){ return function(){}; },
    getRedirectResult: function(){ return Promise.resolve({}); },
    signInWithPopup: function(){ return Promise.resolve({ user: userObj({}) }); },
    signInWithRedirect: function(){ return Promise.resolve(); },
    signOut: function(){ return Promise.resolve(); }
  };
  var messaging = { getToken: function(){ return Promise.resolve('FAKE_FCM_TOKEN'); }, onMessage: function(){} };
  var firebaseObj = { apps: [], initializeApp: function(c){ firebaseObj.apps.push({ options:c }); return firebaseObj.apps[0]; },
    auth: function(){ return authObj; }, messaging: function(){ return messaging; } };
  firebaseObj.auth.GoogleAuthProvider = authObj.GoogleAuthProvider;
  window.firebase = firebaseObj;
  try { navigator.serviceWorker.register = function(){ return Promise.resolve({ scope: './fcm/' }); }; } catch(e){}
})();
`;
}

/* ── stubs + recorder ─────────────────────────────────────────────────── */
function pickFixture(fixtures, rawUrl) {
  const u = new URL(rawUrl);
  const path = u.pathname.replace(/^\/api/, "");
  const exact = path + u.search;
  let body = fixtures[exact] !== undefined ? fixtures[exact] : fixtures[path];
  if (Array.isArray(body)) body = body.length > 1 ? body.shift() : body[0];
  return body;
}

/**
 * Install fixtures + write stubs on `page`. Returns
 * `{ counts, recorded, state }`.
 *   fixtures keys are API paths (`/ratings/me`, `/vendor-applications/mine`).
 *   opts.writes keys are `"<METHOD> <path>"`.
 */
export async function install3dStubs(page, fixtures, opts) {
  const counts = {};
  const writes = (opts && opts.writes) || {};
  const recorded = [];
  const state = { unstubbed: null };

  // Never touch the real Firebase / Razorpay / map / icon CDNs in tests.
  await page.route("**/gstatic.com/firebasejs/**", (r) => r.abort());
  await page.route("**/checkout.razorpay.com/**", (r) => r.abort());
  await page.route("**/api.maptiler.com/**", (r) => r.abort());
  await page.route("**/tile.openstreetmap.org/**", (r) => r.abort());
  await page.route("**/unpkg.com/leaflet@**", (r) => r.abort());
  await page.route("**/cdn.jsdelivr.net/npm/darkreader@**", (r) => r.abort());

  const handler = async (route) => {
    const req = route.request();
    const method = req.method();
    const u = new URL(req.url());
    const path = u.pathname.replace(/^\/api/, "");
    if (method === "GET") {
      counts[path] = (counts[path] || 0) + 1;
      const body = pickFixture(fixtures, req.url());
      if (body === undefined)
        return route.fulfill({
          status: 404,
          headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
          body: JSON.stringify({ success: false, message: "Not found in fixtures" }),
        });
      if (body === "__hang__") return;
      if (body && body.__delay__) await new Promise((z) => setTimeout(z, body.__delay__));
      if (body && body.__status__ && body.__status__ !== 200)
        return route.fulfill({
          status: body.__status__,
          headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
          body: JSON.stringify(body.__body__ ?? {}),
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
    if (s && s.__status__ && s.__status__ !== 200)
      return route.fulfill({
        status: s.__status__,
        headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
        body: JSON.stringify(s.__body__ ?? {}),
      });
    return route.fulfill({
      status: 200,
      headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
      body: JSON.stringify(s ?? {}),
    });
  };

  await page.route("https://api.eatswada.com/**", handler);
  await page.route("https://eatswada.onrender.com/**", handler);

  return { counts, recorded, state };
}

/* ── DOM / state signature ────────────────────────────────────────────── */
const STORAGE_KEYS = [
  "nearbite_token",
  "token",
  "nearbite_user",
  "nearbite_after_login",
  "eatswada_vendor_application_draft_v1",
  "eatswada_customer_application_id",
  "eatswada_customer_application_status_token",
  "ew_support_demo",
];

export async function signature3d(page, ids) {
  return await page.evaluate(
    ({ keys, ids }) => {
      const visible = (el) => {
        for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
          const cs = getComputedStyle(n);
          if (n.hidden || cs.display === "none" || cs.visibility === "hidden") return false;
        }
        return true;
      };
      const txt = (id) => {
        const el = document.getElementById(id);
        if (!el || !visible(el)) return null;
        /* innerText (not textContent): JSX drops whitespace-only text nodes
           between block elements, so textContent would differ from the raw
           legacy HTML even though the rendered page is identical. */
        const raw = el.innerText !== undefined && el.innerText !== "" ? el.innerText : el.textContent || "";
        return (raw || "").replace(/\s+/g, " ").trim();
      };
      const itxt = (id) => {
        const el = document.getElementById(id);
        if (!el) return null;
        const raw = el.innerText !== undefined && el.innerText !== "" ? el.innerText : el.textContent || "";
        return (raw || "").replace(/\s+/g, " ").trim();
      };
      const val = (id) => {
        const el = document.getElementById(id);
        if (!el) return null;
        return el.value === undefined ? null : el.value;
      };
      const out = {
        url: location.pathname + location.search,
        title: document.title,
        bodyClass: document.body.className,
        ids: {},
        values: {},
        local: {},
        session: {},
      };
      for (const id of ids || []) out.ids[id] = txt(id);
      for (const id of ["ownerName", "phone", "email", "restaurantName", "cuisine", "address", "description", "fssai", "longitude", "latitude", "comment", "correctionMessage", "grievanceMessage", "nomineeName", "nomineeEmail", "nomineePhone", "nomineeRelationship", "deletePhrase", "deleteConfirm"])
        out.values[id] = val(id);
      out.values.hours = Array.from(document.querySelectorAll("#hours [data-closes]")).map((x) => x.value).join(",");
      out.values.closed = Array.from(document.querySelectorAll("#hours [data-closed]")).map((x) => (x.checked ? "1" : "0")).join("");
      out.classes = {
        choices: Array.from(document.querySelectorAll("#businessTypeChoices .choice, #deliveryChoices .choice")).map(
          (b) => b.dataset.value + ":" + (b.classList.contains("selected") ? "1" : "0")
        ),
        stars: Array.from(document.querySelectorAll(".star")).map((b) => (b.classList.contains("active") ? "1" : "0")).join(""),
      };
      out.hidden = {
        panels: Array.from(document.querySelectorAll(".panel[data-panel]")).map((p) => (p.hidden ? "h" : "v")).join(""),
        backBtn: document.getElementById("backBtn") ? document.getElementById("backBtn").hidden : null,
        nextBtn: document.getElementById("nextBtn") ? document.getElementById("nextBtn").hidden : null,
        submitBtn: document.getElementById("submitBtn") ? document.getElementById("submitBtn").hidden : null,
        result: document.getElementById("result") ? document.getElementById("result").className : null,
        message: document.getElementById("message") ? document.getElementById("message").className : null,
        invalid: Array.from(document.querySelectorAll(".invalid")).map((e) => e.id).join(","),
      };
      out.disabled = {
        submit: document.getElementById("submit") ? !!document.getElementById("submit").disabled : null,
        next: document.getElementById("nextBtn") ? !!document.getElementById("nextBtn").disabled : null,
        submitBtn: document.getElementById("submitBtn") ? !!document.getElementById("submitBtn").disabled : null,
        exportBtn: document.getElementById("exportBtn") ? !!document.getElementById("exportBtn").disabled : null,
        saveNomineeBtn: document.getElementById("saveNomineeBtn") ? !!document.getElementById("saveNomineeBtn").disabled : null,
        deleteBtn: document.getElementById("deleteBtn") ? !!document.getElementById("deleteBtn").disabled : null,
      };
      out.step = itxt("stepLabel");
      out.review = itxt("review");
      out.remaining = itxt("remaining");
      out.requestHistory = itxt("requestHistory");
      out.statusPill = itxt("statusPill");
      out.details = itxt("details");
      out.view = (itxt("view") || "").slice(0, 600) || null;
      out.contactGrid = itxt("contactGrid");
      out.orderHelpCard = itxt("orderHelpCard");
      out.out = (itxt("out") || "").slice(0, 400) || null;
      out.toast = itxt("toast");
      for (const k of keys) {
        const lv = localStorage.getItem(k);
        const sv = sessionStorage.getItem(k);
        if (lv !== null) out.local[k] = lv;
        if (sv !== null) out.session[k] = sv;
      }
      return out;
    },
    { keys: STORAGE_KEYS, ids: ids || [] }
  );
}

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
