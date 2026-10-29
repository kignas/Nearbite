// Shared C9 (cart place-order + idempotency + Razorpay) probes — Phase 2o.
//
// Used by BOTH scripts/cart-c9-parity.mjs and scripts/cart-money-parity.mjs so
// the C9 logic lives in one place (same pattern as lib/cart-c8.mjs).
//
// HERMETIC: every non-GET request is intercepted (page.route) and answered from
// a stub; the recorder keeps method + URL + headers + exact body and the harness
// FAILS if any write is not stubbed. The real backend is never reached and the
// real Razorpay SDK is never loaded (its CDN is aborted and a fake
// window.Razorpay is installed before any page script runs).
//
// Legacy writes this harness must see stubbed:
//   POST /orders                       (cart-page.js L1814)
//   POST /payments/verify              (payment-verify.js L111, via the Razorpay handler)
//   GET  /payments/:id/status          (payment-verify.js — a GET, counted not stubbed)
import fs from "node:fs";

export function resolve(p) {
  for (const c of [p, p.replace(/^web\//, ""), "web/" + p]) if (fs.existsSync(c)) return c;
  return p;
}
export function loadFixture(name) {
  return JSON.parse(fs.readFileSync(resolve("scripts/fixtures/" + name), "utf8"));
}

const RID = "6ac8f95828669b5f4e30f0ba";
export const CART = {
  "Masala Dosa": {
    name: "Masala Dosa", price: 80, originalPrice: 100, quantity: 2, resId: RID,
    restaurantName: "Foodie Dosa Restaurant", isVeg: true, image: "",
  },
};
export const ADDRESS = {
  _id: "aaaaaaaaaaaaaaaaaaaaaaaa", tag: "Home", house: "1", area: "Main Rd",
  city: "Maynaguri", pincode: "735224",
  location: { type: "Point", coordinates: [88.82, 26.56] },
  receiverName: "Probe", receiverPhone: "9999999999",
};
const EXTRAS = { restaurantNote: "", restaurantNotes: {}, deliveryInstructions: "", tipAmount: 0 };

/* Base seed: cart + address + token + extras, so placeOrder gets past every
   guard and reaches POST /orders. */
export const SEED = {
  nearbite_cart: JSON.stringify(CART),
  nearbite_address: JSON.stringify(ADDRESS),
  nearbite_selected_address_id: ADDRESS._id,
  nearbite_token: "test.token.value",
  nearbite_cart_extras: JSON.stringify(EXTRAS),
};
export const SEED_GUEST = {
  nearbite_cart: JSON.stringify(CART),
  nearbite_cart_extras: JSON.stringify(EXTRAS),
};

/* The fake Razorpay SDK, installed before any page script. Records every
   instance, its options and its handlers so a test can drive them. */
const RAZORPAY_STUB = () => {
  window.__rzp = [];
  window.Razorpay = function Razorpay(opts) {
    this.opts = opts;
    this._handlers = {};
    window.__rzp.push(this);
  };
  window.Razorpay.prototype.on = function (ev, cb) {
    this._handlers[ev] = cb;
  };
  window.Razorpay.prototype.open = function () {
    this._opened = true;
  };
  window.__rzpSanitized = () =>
    window.__rzp.map((r) => ({
      timeout: r.opts.timeout,
      key: r.opts.key,
      amount: r.opts.amount,
      currency: r.opts.currency,
      name: r.opts.name,
      description: r.opts.description,
      order_id: r.opts.order_id,
      themeColor: (r.opts.theme && r.opts.theme.color) || null,
      prefill: r.opts.prefill ?? null,
      hasDismiss: typeof (r.opts.modal || {}).ondismiss === "function",
      opened: !!r._opened,
    }));
  window.__rzpDismiss = (idx) => {
    const r = window.__rzp[idx || 0];
    if (r && r.opts.modal && r.opts.modal.ondismiss) return r.opts.modal.ondismiss();
  };
  window.__rzpFire = (idx, ev, arg) => {
    const r = window.__rzp[idx || 0];
    if (r && r._handlers[ev]) return r._handlers[ev](arg);
  };
  window.__rzpHandler = (idx, arg) => {
    const r = window.__rzp[idx || 0];
    return r ? r.opts.handler(arg) : null;
  };
};

/* Install fixtures + write stubs + the fake Razorpay. Returns the recorder.
   `writes` maps "METHOD /path" to a stub (or an array of stubs consumed in
   order). A stub of "__networkerror__" aborts the request; "__hang__" never
   answers; `{__status, body}` answers that HTTP status. */
export async function installStubs(page, fixtures, opts = {}) {
  const counts = {};
  const writes = opts.writes || {};
  const recorded = [];
  const state = { unstubbed: null };
  const netErr = new Set(opts.networkErrorPaths || []);
  const allNonGet = opts.stubAllNonGet || null;

  await page.route("**/checkout.razorpay.com/**", (route) => route.abort());
  await page.route("https://api.eatswada.com/**", (route) => {
    const req = route.request();
    const method = req.method();
    const path = new URL(req.url()).pathname.replace(/^\/api/, "");
    if (method === "GET") {
      counts[path] = (counts[path] || 0) + 1;
      if (netErr.has(path)) return route.abort("failed");
      let body = fixtures[path];
      if (Array.isArray(body)) body = body.length > 1 ? body.shift() : body[0];
      if (body === undefined)
        return route.fulfill({
          status: 404,
          headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
          body: JSON.stringify({ success: false, message: "Not found in fixtures" }),
        });
      if (body === "__hang__") return;
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
    // Non-GET: record and stub. FAIL loudly on an unstubbed write.
    recorded.push({ method, path, headers: req.headers(), body: req.postData() });
    const key = method + " " + path;
    let stub = writes[key] !== undefined ? writes[key] : allNonGet;
    if (stub === undefined || stub === null) {
      state.unstubbed = key;
      return route.fulfill({
        status: 500,
        headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
        body: JSON.stringify({ success: false, message: "UNSTUBBED WRITE: " + key }),
      });
    }
    if (Array.isArray(stub)) stub = stub.length > 1 ? stub.shift() : stub[0];
    if (stub === "__hang__") return;
    if (stub === "__networkerror__") return route.abort("failed");
    if (stub && stub.__status && stub.__status !== 200)
      return route.fulfill({
        status: stub.__status,
        headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
        body: JSON.stringify(stub.body ?? {}),
      });
    return route.fulfill({
      status: 200,
      headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
      body: JSON.stringify(stub ?? {}),
    });
  });

  return { counts, recorded, state };
}

/* Open a cart page with a seed + fixtures + write stubs. Returns ctx/page. */
export async function openCart(browser, url, {
  fixtures, seed = SEED, writes = {}, stubAllNonGet = null,
  networkErrorPaths = [], viewport = { width: 390, height: 844 },
  settle = 1500, waitUntil = "networkidle", noRazorpay = false,
} = {}) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript((entries) => {
    window.__EW_CART_TEST_HOOKS = true;
    try {
      for (const [k, v] of Object.entries(entries))
        window.localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
    } catch (e) {}
  }, seed);
  /* A "no Razorpay" scenario simulates the SDK never loading (its CDN is
     aborted by installStubs), which is how the legacy COD `advance-pending`
     branch is reached: `!!window.Razorpay` is false. */
  if (!noRazorpay) await ctx.addInitScript(RAZORPAY_STUB);
  const page = await ctx.newPage();
  const rec = await installStubs(page, fixtures, { writes, stubAllNonGet, networkErrorPaths });
  await page.goto(url, { waitUntil, timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(settle);
  return { ctx, page, ...rec };
}

/* A normalised snapshot of the C9-observable state after a placeOrder attempt.
   Host-independent: `finalPath` strips the origin so legacy .html and the clean
   URL compare on path+search only. */
export const C9_SNAP = () => {
  const t = (id) => {
    const el = document.getElementById(id);
    return el ? (el.textContent || "").trim() : null;
  };
  const hash = (s) => {
    const norm = String(s).replace(/<!--[\s\S]*?-->/g, "").replace(/>\s+</g, "><").trim();
    let h = 0;
    for (let i = 0; i < norm.length; i++) h = (Math.imul(31, h) + norm.charCodeAt(i)) | 0;
    return (h >>> 0).toString(16);
  };
  const btn = document.getElementById("btn-checkout");
  const toast = document.getElementById("addr-toast");
  const url = new URL(location.href);
  const ck = localStorage.getItem("nearbite_checkout_key");
  /* `nearbite_checkout_key` is a random UUID by design (crypto.randomUUID) and
     can never be equal across two page loads. It is compared by PRESENCE +
     shape, and its deterministic fingerprint `nearbite_checkout_fp` is compared
     EXACTLY (that is the value that must match legacy). */
  const inFlight = (() => {
    try {
      if (window.__ewCart && window.__ewCart.getOrderInFlight) return window.__ewCart.getOrderInFlight();
    } catch (e) {}
    try {
      /* Legacy: `ctOrderInFlight` is a top-level `let` (a global lexical
         binding, reachable by bare name but not a window property). */
      return eval("typeof ctOrderInFlight !== 'undefined' ? ctOrderInFlight : null");
    } catch (e) {
      return null;
    }
  })();
  return {
    path: url.pathname,
    search: url.search,
    ctaLabel: t("checkout-label"),
    ctaClass: btn ? btn.className : null,
    ctaDisabled: btn ? btn.disabled : null,
    ctaAria: btn ? btn.getAttribute("aria-disabled") : null,
    ctaPointerEvents: btn ? btn.style.pointerEvents : null,
    ctaInnerHash: btn ? hash(btn.innerHTML) : null,
    toastHidden: toast ? !toast.classList.contains("show") : null,
    toastText: t("addr-toast-text"),
    toastError: toast ? toast.classList.contains("is-error") : null,
    ls: {
      cart: localStorage.getItem("nearbite_cart"),
      extras: localStorage.getItem("nearbite_cart_extras"),
      ckPresent: ck !== null,
      ckIsUuid: !!ck && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ck),
      ckFp: localStorage.getItem("nearbite_checkout_fp"),
      ckFpTsPresent: localStorage.getItem("nearbite_checkout_fp_ts") !== null,
      ctx: localStorage.getItem("nearbite_payment_context"),
      beforeAuth: localStorage.getItem("nearbite_cart_before_auth"),
      afterLogin: localStorage.getItem("nearbite_after_login"),
      paymentMethod: localStorage.getItem("nearbite_payment_method"),
    },
    rzp: window.__rzpSanitized ? window.__rzpSanitized() : null,
    orderInFlight: inFlight,
  };
};

/* Normalise a recorded write so legacy and new can be deep-compared: drop the
   volatile origin/referer/UA headers (they differ by host/port by construction)
   and keep the security-relevant ones (authorization, idempotency-key,
   content-type) plus the exact body. The idempotency-key is compared by
   PRESENCE + equality with the stored key, not by value (it is a random UUID). */
export function normWrite(w, ckValue) {
  const h = w.headers || {};
  return {
    method: w.method,
    path: w.path,
    authorization: h["authorization"] ?? null,
    contentType: h["content-type"] ?? null,
    hasIdempotencyKey: h["idempotency-key"] !== undefined,
    idempotencyKeyMatchesStored: h["idempotency-key"] === ckValue,
    body: w.body ? JSON.parse(w.body) : null,
  };
}

/* ══════════════════════════════════════════════════════════════════════
   SHARED C9 PROBE RUNNER — used by BOTH cart-c9-parity.mjs and
   cart-money-parity.mjs so the two harnesses stay in lockstep.
   ══════════════════════════════════════════════════════════════════════ */
const ORDER_UPI = {
  success: true,
  data: { _id: "ord123456789012345678901", orderNumber: "EW-1", total: 190 },
  payment: { orderId: "rzp_order_1", keyId: "rzp_test_key", amount: 19000, currency: "INR" },
};
const ORDER_COD = {
  success: true,
  data: { _id: "ord123456789012345678902", orderNumber: "EW-2", total: 190, paymentMethod: "cod" },
};
const ORDER_COD_ADVANCE = {
  success: true,
  data: {
    _id: "ord123456789012345678903", orderNumber: "EW-3", total: 900,
    partialCodAdvanceAmount: 200, codRemainingAmount: 700, advanceStatus: "pending",
  },
  payment: { orderId: "rzp_order_adv", keyId: "rzp_test_key", amount: 20000, currency: "INR" },
};
const VERIFY_PAID = { success: true, data: { paymentStatus: "paid", _id: "ord123456789012345678901" } };
const VERIFY_FAILED = { success: false, data: { paymentStatus: "failed" }, message: "Signature mismatch" };
const STATUS_PENDING = { success: true, data: { paymentStatus: "pending" } };

async function interceptResultNav(page) {
  await page.route("**/*", (route) => {
    const req = route.request();
    if (req.resourceType() !== "document") return route.fallback();
    const p = new URL(req.url()).pathname;
    if (/^\/(payment-(success|failed|pending)|login|address)(\.html)?$/.test(p))
      return route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><html><head><title>landed</title></head><body>landed</body></html>",
      });
    return route.fallback();
  });
}

async function driveScenario(browser, url, scenario, GETFIX) {
  const seed = { ...(scenario.seed || SEED) };
  if (scenario.paymentMethod) seed.nearbite_payment_method = scenario.paymentMethod;
  const writes = { ...(scenario.writes || {}) };
  if (scenario.orderStub !== undefined) writes["POST /orders"] = scenario.orderStub;
  if (scenario.verifyStub !== undefined) writes["POST /payments/verify"] = scenario.verifyStub;
  const fixtures = { ...(scenario.fixtures || GETFIX) };
  if (scenario.statusStub !== undefined)
    fixtures["/payments/ord123456789012345678901/status"] = scenario.statusStub;

  const { ctx, page, recorded, state } = await openCart(browser, url, {
    fixtures, seed, writes,
    stubAllNonGet: scenario.stubAllNonGet,
    networkErrorPaths: scenario.networkErrorPaths,
    noRazorpay: scenario.noRazorpay,
    settle: 1400,
  });
  await interceptResultNav(page);
  const startUrl = page.url();
  const act = scenario.act || "placeOrder";
  try {
    await page.evaluate(async (which) => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      if (which === "placeOrder") await window.placeOrder();
      else if (which === "doublePlaceOrder") { window.placeOrder(); await window.placeOrder(); }
      else if (which === "razorpayDismiss") { await window.placeOrder(); await wait(60); window.__rzpDismiss && window.__rzpDismiss(0); }
      else if (which === "razorpayPaid") {
        await window.placeOrder(); await wait(60);
        if (window.__rzpHandler)
          await window.__rzpHandler(0, { razorpay_payment_id: "pay_1", razorpay_order_id: "rzp_order_1", razorpay_signature: "sig_1" });
      } else if (which === "razorpayFailed") {
        await window.placeOrder(); await wait(60);
        window.__rzpFire && window.__rzpFire(0, "payment.failed", { error: { description: "Card declined" } });
      }
    }, act);
  } catch (e) { /* navigation may destroy the context mid-evaluate */ }
  await page.waitForTimeout(scenario.settle ?? 1600);
  const finalUrl = page.url();
  const snap = await page.evaluate(C9_SNAP).catch(() => null);
  const ck = await page.evaluate(() => localStorage.getItem("nearbite_checkout_key")).catch(() => null);
  const norm = recorded.map((w) => normWrite(w, ck));
  await ctx.close();
  return { navigated: finalUrl !== startUrl, snap, norm, unstubbed: state.unstubbed, writes: recorded.map((w) => w.method + " " + w.path) };
}

function maskCtx(snap) {
  const s = JSON.parse(JSON.stringify(snap));
  if (s && s.ls && s.ls.ctx) {
    try { const o = JSON.parse(s.ls.ctx); o.savedAt = "<ts>"; s.ls.ctx = JSON.stringify(o); } catch (e) {}
  }
  return s;
}
function normPath(snap) {
  const s = JSON.parse(JSON.stringify(snap));
  s.path = (s.path || "").replace(/\.html$/, "");
  return s;
}

export async function runC9Probes(browser, urls, check, note) {
  const GETFIX = loadFixture("cart-c7-normal.json");

  console.log("### Part A — placeOrder verdict matrix (redirect + storage + writes)\n");
  const SCENARIOS = [
    { label: "UPI order created -> Razorpay opens (no nav)", orderStub: ORDER_UPI, paymentMethod: "upi" },
    { label: "UPI verify paid -> success", orderStub: ORDER_UPI, paymentMethod: "upi", act: "razorpayPaid", verifyStub: VERIFY_PAID },
    { label: "UPI verify failed -> failed", orderStub: ORDER_UPI, paymentMethod: "upi", act: "razorpayPaid", verifyStub: { __status: 400, body: VERIFY_FAILED } },
    { label: "UPI verify unconfirmed -> pending (status timeout)", orderStub: ORDER_UPI, paymentMethod: "upi", act: "razorpayPaid", verifyStub: { __status: 400, body: { success: false, message: "no" } }, statusStub: STATUS_PENDING, settle: 24000 },
    { label: "Razorpay dismissed -> button restored, cart kept", orderStub: ORDER_UPI, paymentMethod: "upi", act: "razorpayDismiss" },
    { label: "Razorpay payment.failed -> failed", orderStub: ORDER_UPI, paymentMethod: "upi", act: "razorpayFailed" },
    { label: "COD accepted -> success", orderStub: ORDER_COD, paymentMethod: "cod" },
    { label: "COD advance-open -> advance Razorpay opens", orderStub: ORDER_COD_ADVANCE, paymentMethod: "cod" },
    { label: "COD advance-pending (no Razorpay) -> pending", orderStub: ORDER_COD_ADVANCE, paymentMethod: "cod", noRazorpay: true },
    { label: "POST /orders network error -> error toast, button restored", orderStub: "__networkerror__", paymentMethod: "upi" },
    { label: "POST /orders 503 maintenance -> blocked", orderStub: { __status: 503, body: { success: false, message: "Under maintenance" } }, paymentMethod: "upi" },
    { label: "UPI missing payment.orderId -> unavailable error", orderStub: { success: true, data: { _id: "ord123456789012345678909", orderNumber: "EW-9", total: 190 } }, paymentMethod: "upi" },
  ];
  for (const sc of SCENARIOS) {
    console.log(`-- ${sc.label}`);
    const L = await driveScenario(browser, urls.legacyUrl, sc, GETFIX);
    const N = await driveScenario(browser, urls.newUrl, sc, GETFIX);
    check(`${sc.label}: final path`, normPath(L.snap).path, normPath(N.snap).path);
    check(`${sc.label}: final search`, L.snap.search, N.snap.search);
    check(`${sc.label}: navigated?`, L.navigated, N.navigated);
    check(`${sc.label}: storage (cart/extras/ck/fp/ctx/…)`, maskCtx(L.snap).ls, maskCtx(N.snap).ls);
    check(`${sc.label}: CTA label`, L.snap.ctaLabel, N.snap.ctaLabel);
    check(`${sc.label}: CTA class`, L.snap.ctaClass, N.snap.ctaClass);
    check(`${sc.label}: CTA disabled`, L.snap.ctaDisabled, N.snap.ctaDisabled);
    check(`${sc.label}: CTA aria-disabled`, L.snap.ctaAria, N.snap.ctaAria);
    check(`${sc.label}: CTA innerHTML hash`, L.snap.ctaInnerHash, N.snap.ctaInnerHash);
    check(`${sc.label}: CTA pointer-events`, L.snap.ctaPointerEvents, N.snap.ctaPointerEvents);
    check(`${sc.label}: toast hidden`, L.snap.toastHidden, N.snap.toastHidden);
    check(`${sc.label}: toast text`, L.snap.toastText, N.snap.toastText);
    check(`${sc.label}: toast error class`, L.snap.toastError, N.snap.toastError);
    check(`${sc.label}: Razorpay options`, L.snap.rzp, N.snap.rzp);
    check(`${sc.label}: orderInFlight`, L.snap.orderInFlight, N.snap.orderInFlight);
    check(`${sc.label}: recorded writes (method/path/headers/body)`, L.norm, N.norm);
    check(`${sc.label}: no unstubbed write`, L.unstubbed, N.unstubbed);
    note(`writes: ${JSON.stringify(L.writes)}`);
    console.log("");
  }

  console.log("### Part B — placeOrder guards (no POST /orders)\n");
  const GUARDS = [
    { label: "guest (no token) -> login.html, cart preserved", seed: SEED_GUEST, orderStub: ORDER_UPI },
    { label: "no address -> address.html", seed: (() => { const s = { ...SEED }; delete s.nearbite_address; delete s.nearbite_selected_address_id; return s; })(), orderStub: ORDER_UPI },
  ];
  for (const sc of GUARDS) {
    console.log(`-- ${sc.label}`);
    const L = await driveScenario(browser, urls.legacyUrl, sc, GETFIX);
    const N = await driveScenario(browser, urls.newUrl, sc, GETFIX);
    check(`${sc.label}: final path`, normPath(L.snap).path, normPath(N.snap).path);
    check(`${sc.label}: navigated?`, L.navigated, N.navigated);
    check(`${sc.label}: storage (cart/beforeAuth/afterLogin)`, L.snap.ls, N.snap.ls);
    check(`${sc.label}: recorded writes (none)`, L.norm, N.norm);
    check(`${sc.label}: no unstubbed write`, L.unstubbed, N.unstubbed);
    console.log("");
  }

  console.log("### Part C — exact POST /orders body + headers (deep-equal)\n");
  {
    const sc = { orderStub: ORDER_UPI, paymentMethod: "upi" };
    const L = await driveScenario(browser, urls.legacyUrl, sc, GETFIX);
    const N = await driveScenario(browser, urls.newUrl, sc, GETFIX);
    const lOrder = L.norm.find((w) => w.path === "/orders");
    const nOrder = N.norm.find((w) => w.path === "/orders");
    check("POST /orders body deep-equal", lOrder?.body, nOrder?.body);
    check("POST /orders method", lOrder?.method, nOrder?.method);
    check("POST /orders authorization header", lOrder?.authorization, nOrder?.authorization);
    check("POST /orders content-type header", lOrder?.contentType, nOrder?.contentType);
    check("POST /orders has Idempotency-Key", lOrder?.hasIdempotencyKey, nOrder?.hasIdempotencyKey);
    check("POST /orders Idempotency-Key == stored key", lOrder?.idempotencyKeyMatchesStored, nOrder?.idempotencyKeyMatchesStored);
    console.log("");
  }

  console.log("### Part D — direct C9 function parity (page.evaluate)\n");
  const C9_FN_PROBE = () => {
    const out = {};
    const mk = (id, num) => ({ _id: id, orderNumber: num, total: 190 });
    try {
      out.ctxBase = {
        plain: window.ctPaymentContextBase(mk("o1", "EW-1"), "o1"),
        withExtra: window.ctPaymentContextBase(mk("o1", "EW-1"), "o1", { method: "COD", serverTotal: 190 }),
        nullOrder: window.ctPaymentContextBase(null, null),
        multipleTrue: window.ctPaymentContextBase({ multiple: true, data: mk("o2", "EW-2") }, "o2"),
      };
    } catch (e) { out.ctxBase = "ERR:" + String(e).split("\n")[0]; }
    try {
      out.displayAmounts = {
        plain: window.ctPaymentDisplayAmounts({ data: { total: 250 } }, null),
        partial: window.ctPaymentDisplayAmounts({ data: { total: 900, partialCodAdvanceAmount: 200, codRemainingAmount: 700, advanceStatus: "pending" } }, null),
        confirmed: window.ctPaymentDisplayAmounts({ data: { total: 250 } }, { total: 300 }),
        empty: window.ctPaymentDisplayAmounts(null, null),
      };
    } catch (e) { out.displayAmounts = "ERR:" + String(e).split("\n")[0]; }
    try {
      const st = window.ctPaymentStatusIsTerminal;
      out.terminal = {
        null: st(null), paid: st({ paymentStatus: "paid" }), failed: st({ paymentStatus: "failed" }),
        refunded: st({ paymentStatus: "refunded" }), pending: st({ paymentStatus: "pending" }),
        created: st({ paymentStatus: "created" }), codPending: st({ paymentStatus: "cod_pending" }),
        empty: st({}), upperPaid: st({ paymentStatus: "PAID" }),
      };
    } catch (e) { out.terminal = "ERR:" + String(e).split("\n")[0]; }
    try {
      localStorage.removeItem("nearbite_payment_context");
      window.ctSavePaymentContext({ orderId: "o9", method: "COD" });
      const raw = JSON.parse(localStorage.getItem("nearbite_payment_context"));
      out.saveContext = { orderId: raw.orderId, method: raw.method, hasSavedAt: typeof raw.savedAt === "number" };
    } catch (e) { out.saveContext = "ERR:" + String(e).split("\n")[0]; }
    try {
      const btn = document.getElementById("btn-checkout");
      window.shakeCheckout();
      out.shake = { hasShake: btn.classList.contains("ct-shake") };
    } catch (e) { out.shake = "ERR:" + String(e).split("\n")[0]; }
    out.types = {
      placeOrder: typeof window.placeOrder, shakeCheckout: typeof window.shakeCheckout,
      ctOpenRazorpay: typeof window.ctOpenRazorpay, ctGoPaymentResult: typeof window.ctGoPaymentResult,
      ctRestoreCheckoutButton: typeof window.ctRestoreCheckoutButton, ctFinishCodOrder: typeof window.ctFinishCodOrder,
      ctFinishSuccessfulPayment: typeof window.ctFinishSuccessfulPayment, ctHandleFailedPayment: typeof window.ctHandleFailedPayment,
      ctHandlePendingPayment: typeof window.ctHandlePendingPayment, ctReadPaymentStatus: typeof window.ctReadPaymentStatus,
      ctWaitForPaymentStatus: typeof window.ctWaitForPaymentStatus,
    };
    return out;
  };
  {
    const L = await openCart(browser, urls.legacyUrl, { fixtures: GETFIX });
    const N = await openCart(browser, urls.newUrl, { fixtures: GETFIX });
    const a = await L.page.evaluate(C9_FN_PROBE);
    const b = await N.page.evaluate(C9_FN_PROBE);
    for (const k of Object.keys(a)) check(`fn ${k}`, a[k], b[k]);
    await L.ctx.close();
    await N.ctx.close();
    console.log("");
  }

  console.log("### Part E — boot-once GET counts per endpoint\n");
  {
    const L = await openCart(browser, urls.legacyUrl, { fixtures: GETFIX, settle: 1800 });
    const N = await openCart(browser, urls.newUrl, { fixtures: GETFIX, settle: 1800 });
    note(`legacy: ${JSON.stringify(L.counts)}`);
    note(`new:    ${JSON.stringify(N.counts)}`);
    const eps = new Set([...Object.keys(L.counts), ...Object.keys(N.counts)]);
    let noMore = true;
    for (const e of eps) if ((N.counts[e] || 0) > (L.counts[e] || 0)) noMore = false;
    check("boot: new issues no more GETs than legacy per endpoint", noMore, true);
    await L.ctx.close();
    await N.ctx.close();
    console.log("");
  }

  console.log("### Part F — re-entrancy (double placeOrder)\n");
  {
    const sc = { orderStub: ORDER_UPI, paymentMethod: "upi", act: "doublePlaceOrder" };
    const L = await driveScenario(browser, urls.legacyUrl, sc, GETFIX);
    const N = await driveScenario(browser, urls.newUrl, sc, GETFIX);
    check("double placeOrder: POST /orders count", L.norm.filter((w) => w.path === "/orders").length, N.norm.filter((w) => w.path === "/orders").length);
    check("double placeOrder: Razorpay instance count", L.snap.rzp?.length, N.snap.rzp?.length);
    console.log("");
  }
}
