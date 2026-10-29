// Shared C10 (payment result pages) parity probes — Phase 2n.
//
// Used by scripts/payment-pages-parity.mjs. Covers
// payment-success.html / payment-failed.html / payment-pending.html.
//
// Hermetic: EVERY non-GET request is intercepted (page.route) and answered
// from a stub; the harness records method + URL + headers + exact body and
// FAILS if any write is not stubbed. The real backend is never reached and
// the real Razorpay SDK is never loaded (its CDN is aborted and a fake
// window.Razorpay is installed before any page script runs).
//
// Legacy writes this harness must see stubbed:
//   POST /payments/retry   (payment-failed.html L86)
//   POST /payments/verify  (payment-failed.html L109 / payment-verify.js L111)
//
// Comparisons that would land on a page that is NOT ported yet
// (orders.html / track-order.html / cart.html / login.html / payment-failed)
// are asserted on the redirect TARGET only, never on the destination DOM.
import fs from "node:fs";

function resolve(p) {
  for (const c of [p, p.replace(/^web\//, ""), "web/" + p]) if (fs.existsSync(c)) return c;
  return p;
}
export function loadFixture(name) {
  return JSON.parse(fs.readFileSync(resolve("scripts/fixtures/" + name), "utf8"));
}

function fixtureFor(fixtures, rawUrl) {
  const u = new URL(rawUrl);
  const path = u.pathname.replace(/^\/api/, "");
  const exact = path + u.search;
  let body = fixtures[exact] !== undefined ? fixtures[exact] : fixtures[path];
  if (Array.isArray(body)) body = body.length > 1 ? body.shift() : body[0];
  return body;
}

/* Install fixtures + write stubs + the fake Razorpay. Returns the recorder. */
async function installStubs(page, fixtures, opts = {}) {
  const counts = {};
  const writes = opts.writes || {};
  const recorded = [];
  const state = { unstubbed: null };
  const netErr = new Set(opts.networkErrorPaths || []);
  const allNonGet = opts.stubAllNonGet || null; // fallback stub for any write

  await page.route("**/checkout.razorpay.com/**", (route) => route.abort());
  await page.route("https://api.eatswada.com/**", (route) => {
    const req = route.request();
    const method = req.method();
    const path = new URL(req.url()).pathname.replace(/^\/api/, "");
    if (method === "GET") {
      counts[path] = (counts[path] || 0) + 1;
      if (netErr.has(path)) return route.abort("failed");
      const body = fixtureFor(fixtures, req.url());
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
    const stub = writes[key] !== undefined ? writes[key] : allNonGet;
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
      key: r.opts.key,
      amount: r.opts.amount,
      currency: r.opts.currency,
      name: r.opts.name,
      description: r.opts.description,
      order_id: r.opts.order_id,
      themeColor: (r.opts.theme && r.opts.theme.color || "").toLowerCase(),
      prefill: r.opts.prefill ?? null,
      opened: !!r._opened,
    }));
  window.__rzpFire = (idx, ev, arg) => {
    const r = window.__rzp[idx || 0];
    if (r && r._handlers[ev]) return r._handlers[ev](arg);
  };
  window.__rzpHandler = (idx, arg) => {
    const r = window.__rzp[idx || 0];
    return r ? r.opts.handler(arg) : null;
  };
};

/* ── DOM snapshot: the C10-owned surface (ids identical in both pages) ── */
const SNAP = () => {
  const norm = (s) =>
    String(s)
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/>\s+</g, "><")
      .trim();
  const hash = (s) => {
    const n = norm(s);
    let h = 0;
    for (let i = 0; i < n.length; i++) h = (Math.imul(31, h) + n.charCodeAt(i)) | 0;
    return (h >>> 0).toString(16);
  };
  const t = (id) => {
    const el = document.getElementById(id);
    return el ? (el.textContent || "").trim() : null;
  };
  const hidden = (id) => {
    const el = document.getElementById(id);
    return el ? el.hasAttribute("hidden") : null;
  };
  const btn = (id) => {
    const el = document.getElementById(id);
    if (!el) return null;
    return {
      text: (el.textContent || "").trim(),
      disabled: !!el.disabled,
      cls: el.className,
      opacity: el.style.opacity || "",
    };
  };
  const main = document.querySelector("main.ew-result");
  const btnIds = Array.from(document.querySelectorAll("main.ew-result button")).map((b) => b.id);
  return {
    mainClass: main ? main.className : null,
    mainHtmlHash: main ? hash(main.innerHTML) : null,
    h1: (document.querySelector("h1") || {}).textContent?.trim() ?? null,
    copy: (document.querySelector("p.ew-copy") || {}).textContent?.trim() ?? null,
    orderHidden: hidden("ew-order"),
    orderNumber: t("ew-order-number"),
    advanceHidden: hidden("ew-advance-row"),
    advanceAmount: t("ew-advance-amount"),
    cashdueHidden: hidden("ew-cashdue-row"),
    cashdueAmount: t("ew-cashdue-amount"),
    orderMeta: t("ew-order-meta"),
    errorText: t("ew-error"),
    errorHidden: hidden("ew-error"),
    buttons: btnIds.map((id) => [id, btn(id)]),
    ls: {
      cart: localStorage.getItem("nearbite_cart"),
      ctx: localStorage.getItem("nearbite_payment_context"),
      ck: localStorage.getItem("nearbite_checkout_key"),
      ckFp: localStorage.getItem("nearbite_checkout_fp"),
      ckFpTs: localStorage.getItem("nearbite_checkout_fp_ts"),
      token: localStorage.getItem("nearbite_token"),
      token2: localStorage.getItem("token"),
    },
  };
};

async function openPage(browser, url, opts = {}) {
  const { fixtures = {}, seed = null, settle = 1200, clock = false } = opts;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(RAZORPAY_STUB);
  if (seed) {
    await ctx.addInitScript((entries) => {
      try {
        for (const [k, v] of Object.entries(entries))
          window.localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
      } catch (e) {}
    }, seed);
  }
  const page = await ctx.newPage();
  if (clock) await page.clock.install();
  const navs = [];
  page.on("framenavigated", (f) => {
    if (f === page.mainFrame()) navs.push(f.url());
  });
  const rec = await installStubs(page, fixtures, opts);
  const hasHang =
    JSON.stringify(fixtures).includes('"__hang__"') ||
    JSON.stringify(opts.writes || {}).includes('"__hang__"');
  await page
    .goto(url, { waitUntil: hasHang ? "domcontentloaded" : "networkidle", timeout: 45000 })
    .catch(() => {});
  if (!clock) await page.waitForTimeout(settle);
  return { ctx, page, navs, initialUrl: url, ...rec };
}


/* Legacy keeps `.html` in its `location.href` targets (cleanUrls is a server
   concern), so `/payment-pending.html` and `/payment-pending` are the same
   page. Normalise for comparison only; the runtime still emits `.html`. */
function normPath(p) {
  return String(p).replace(/\.html(?=$|\?)/, "");
}

/* The page's OWN redirect: the first main-frame navigation whose normalised
   pathname differs from the page's own route. Downstream hops are deliberately
   NOT followed — the destinations (orders / track-order / cart / login /
   payment-pending) are not ported yet, so their further redirects (e.g.
   track-order → login when there is no token) are not this page's behaviour. */
function redirectTarget(navs, initialUrl) {
  const init = normPath(new URL(initialUrl).pathname);
  for (const u of navs) {
    const x = new URL(u);
    if (normPath(x.pathname) !== init) return normPath(x.pathname + x.search);
  }
  return null;
}
/* One comparable outcome: whether the page left its own route, its own
   (normalised) redirect target, and the DOM snapshot — taken only while still
   on the page, because the destinations are not ported and their DOM is not
   ours to compare. */
function outcome(navs, initialUrl, snap) {
  const t = redirectTarget(navs, initialUrl);
  return { left: t !== null, target: t, snap: t !== null ? null : snap };
}

function normalizeWrites(recorded) {
  return recorded.map((w) => ({
    method: w.method,
    path: w.path,
    authorization: w.headers.authorization ? "Bearer <token>" : null,
    contentType: w.headers["content-type"] || null,
    idempotencyKey: w.headers["idempotency-key"] || null,
    body: w.body,
  }));
}

/* The write-only view: method + path + body (used for legacy↔new deep-equal,
   so extra /status GETs on the destination page are irrelevant). */
function writeView(recorded) {
  return normalizeWrites(recorded).map((w) => ({
    method: w.method,
    path: w.path,
    body: w.body,
  }));
}

export async function runPaymentParity(browser, urls, check, note) {
  const fixtures = loadFixture("payment-pages-fixtures.json");
  const seeds = loadFixture("payment-pages-seeds.json");
  const W = fixtures.WRITES;

  /* ════════════════════════════════════════════════════════════════════
     PART 1 — payment-success.html verdict matrix
     ════════════════════════════════════════════════════════════════════ */
  console.log("### Part 1 — payment-success verdict matrix\n");
  const SUCCESS_CASES = [
    { label: "no context", seed: null, query: "" },
    { label: "ctx orderId single", seed: seeds.successSingle, query: "" },
    { label: "ctx orderId multiple", seed: seeds.successMultiple, query: "" },
    { label: "ctx orderNumber only (no orderId)", seed: seeds.successNumberOnly, query: "" },
    { label: "ctx partial-COD advance + cash due", seed: seeds.successPartialCod, query: "" },
    { label: "?orderId only (no ctx)", seed: null, query: "?orderId=66f0000000000000000000a1" },
    { label: "?orderId&method=COD (no ctx)", seed: null, query: "?orderId=66f0000000000000000000a1&method=COD" },
    { label: "ctx method=COD", seed: seeds.successCod, query: "" },
  ];
  for (const c of SUCCESS_CASES) {
    console.log(`-- success: ${c.label}`);
    const run = async (url) => {
      const o = await openPage(browser, url + c.query, { fixtures, seed: c.seed, settle: 900 });
      const snap = await o.page.evaluate(SNAP);
      const oc = outcome(o.navs, o.initialUrl, snap);
      const out = { oc, writes: normalizeWrites(o.recorded), unstubbed: o.state.unstubbed };
      await o.ctx.close();
      return out;
    };
    const a = await run(urls.legacySuccess);
    const b = await run(urls.newSuccess);
    check(`success/${c.label}: outcome (left/target/DOM)`, a.oc, b.oc);
    check(`success/${c.label}: no writes at boot`, a.writes, b.writes);
    check(`success/${c.label}: no unstubbed write`, a.unstubbed, b.unstubbed);
    console.log("");
  }

  /* 3.6 s redirect via the fake clock (Continue button and the timer). */
  console.log("-- success: Continue button + 3.6 s timer (fake clock)");
  for (const [label, seed, click] of [
    ["timer fires (single)", seeds.successSingle, false],
    ["timer fires (multiple)", seeds.successMultiple, false],
    ["timer no orderId stays put", seeds.successNumberOnly, false],
    ["Continue button", seeds.successSingle, true],
  ]) {
    const run = async (url) => {
      const o = await openPage(browser, url, { fixtures, seed, clock: true });
      await o.page.clock.runFor(200);
      if (click) await o.page.click("#ew-continue").catch(() => {});
      await o.page.clock.runFor(4000);
      await o.page.waitForTimeout(400);
      const snap = await o.page.evaluate(SNAP);
      await o.ctx.close();
      return { target: redirectTarget(o.navs, o.initialUrl), ctx: snap.ls.ctx };
    };
    const a = await run(urls.legacySuccess);
    const b = await run(urls.newSuccess);
    check(`success/${label}: redirect target`, a.target, b.target);
    check(`success/${label}: context removed after nav`, a.ctx, b.ctx);
  }
  console.log("");

  /* ════════════════════════════════════════════════════════════════════
     PART 2 — payment-failed.html verdict matrix
     ════════════════════════════════════════════════════════════════════ */
  console.log("### Part 2 — payment-failed verdict matrix\n");
  const FAILED_CASES = [
    { label: "no context", seed: null, writes: {} },
    { label: "ctx + no token", seed: seeds.failedNoToken, writes: {} },
    { label: "retry alreadyPaid", seed: seeds.failedToken, writes: { "POST /payments/retry": W.retryAlreadyPaid } },
    { label: "retry success + Razorpay", seed: seeds.failedToken, writes: { "POST /payments/retry": W.retrySuccess } },
    { label: "retry not-ok no payment", seed: seeds.failedToken, writes: { "POST /payments/retry": W.retryNoPayment } },
    { label: "retry 500", seed: seeds.failedToken, writes: { "POST /payments/retry": W.retry500 } },
    { label: "retry 400 definitive fail", seed: seeds.failedToken, writes: { "POST /payments/retry": W.retryDefiniteFail } },
  ];
  for (const c of FAILED_CASES) {
    console.log(`-- failed: ${c.label}`);
    const run = async (url) => {
      const o = await openPage(browser, url, { fixtures, seed: c.seed, writes: c.writes, settle: 900 });
      const snap = await o.page.evaluate(SNAP);
      const rzp = await o.page.evaluate(() => window.__rzpSanitized());
      const oc = outcome(o.navs, o.initialUrl, snap);
      await o.page.click("#ew-cart").catch(() => {});
      await o.page.waitForTimeout(300);
      const out = {
        oc,
        rzp,
        cartTarget: redirectTarget(o.navs, o.initialUrl),
        writes: normalizeWrites(o.recorded),
        unstubbed: o.state.unstubbed,
      };
      await o.ctx.close();
      return out;
    };
    const a = await run(urls.legacyFailed);
    const b = await run(urls.newFailed);
    check(`failed/${c.label}: outcome (left/target/DOM)`, a.oc, b.oc);
    check(`failed/${c.label}: Return-to-cart target`, a.cartTarget, b.cartTarget);
    check(`failed/${c.label}: no unstubbed write`, a.unstubbed, b.unstubbed);
    console.log("");
  }

  /* Retry button drives the write + Razorpay path. */
  console.log("-- failed: retry button -> POST /payments/retry (exact write)");
  for (const [label, seed, writes] of [
    ["alreadyPaid", seeds.failedToken, { "POST /payments/retry": W.retryAlreadyPaid }],
    ["success", seeds.failedToken, { "POST /payments/retry": W.retrySuccess }],
    ["no-payment -> pending", seeds.failedToken, { "POST /payments/retry": W.retryNoPayment }],
    ["500 -> pending", seeds.failedToken, { "POST /payments/retry": W.retry500 }],
    ["400 fail -> error", seeds.failedToken, { "POST /payments/retry": W.retryDefiniteFail }],
    ["no token -> login", seeds.failedNoToken, {}],
    ["no ctx -> cart", null, {}],
  ]) {
    const run = async (url) => {
      const o = await openPage(browser, url, { fixtures, seed, writes, clock: true });
      await o.page.click("#ew-retry").catch(() => {});
      await o.page.clock.runFor(500);
      await o.page.waitForTimeout(500);
      await o.page.clock.runFor(3000);
      await o.page.waitForTimeout(400);
      const snap = await o.page.evaluate(SNAP);
      const rzp = await o.page.evaluate(() => window.__rzpSanitized());
      const oc = outcome(o.navs, o.initialUrl, snap);
      const out = {
        oc,
        rzp,
        writes: writeView(o.recorded),
        unstubbed: o.state.unstubbed,
      };
      await o.ctx.close();
      return out;
    };
    const a = await run(urls.legacyFailed);
    const b = await run(urls.newFailed);
    check(`failed-retry/${label}: exact write body+path`, a.writes, b.writes);
    check(`failed-retry/${label}: Razorpay options`, a.rzp, b.rzp);
    check(`failed-retry/${label}: outcome (left/target/DOM)`, a.oc, b.oc);
    check(`failed-retry/${label}: no unstubbed write`, a.unstubbed, b.unstubbed);
    console.log("");
  }

  /* Razorpay handler -> verify verdict matrix. Legacy NEVER POSTs /verify here
     (the unbound native `fetch` throws "Illegal invocation" at the fetchImpl
     call site), so both pages must send the SAME writes: just the retry POST. */
  console.log("-- failed: Razorpay handler -> verify verdicts (fetchImpl quirk)");
  for (const [label, verify, statusFixture] of [
    ["verify paid -> (quirk) pending", W.verifyPaid, W.statusPending],
    ["verify failed -> (quirk) pending", W.verifyFailed, W.statusPending],
    ["verify 500 + status paid -> success", W.verify500ThenPaid, W.statusPaid],
    ["verify 401 + status pending -> pending", W.verify401ThenPending, W.statusPending],
    ["verify net error + status pending -> pending", W.verifyNetworkThenPending, W.statusPending],
  ]) {
    const run = async (url) => {
      const o = await openPage(browser, url, {
        fixtures: { ...fixtures, "/payments/66f0000000000000000000a1/status": statusFixture },
        seed: seeds.failedToken,
        writes: { "POST /payments/retry": W.retrySuccess, "POST /payments/verify": verify },
        clock: true,
      });
      await o.page.click("#ew-retry").catch(() => {});
      await o.page.clock.runFor(300);
      await o.page.waitForTimeout(400);
      await o.page
        .evaluate(() =>
          window.__rzpHandler(0, {
            razorpay_payment_id: "pay_TEST123",
            razorpay_order_id: "order_TEST123",
            razorpay_signature: "sig_TEST123",
          })
        )
        .catch(() => {});
      await o.page.waitForTimeout(600);
      await o.page.clock.runFor(26000);
      await o.page.waitForTimeout(500);
      const snap = await o.page.evaluate(SNAP);
      const oc = outcome(o.navs, o.initialUrl, snap);
      const out = {
        oc,
        writes: writeView(o.recorded),
        unstubbed: o.state.unstubbed,
      };
      await o.ctx.close();
      return out;
    };
    const a = await run(urls.legacyFailed);
    const b = await run(urls.newFailed);
    check(`failed-verify/${label}: exact writes`, a.writes, b.writes);
    check(`failed-verify/${label}: outcome (left/target/DOM)`, a.oc, b.oc);
    check(`failed-verify/${label}: no unstubbed write`, a.unstubbed, b.unstubbed);
    console.log("");
  }

  /* ════════════════════════════════════════════════════════════════════
     PART 3 — payment-pending.html verdict matrix
     ════════════════════════════════════════════════════════════════════ */
  console.log("### Part 3 — payment-pending verdict matrix\n");
  const STATUS = "/payments/66f0000000000000000000a1/status";
  const PENDING_CASES = [
    { label: "no context", seed: null, fx: {} },
    { label: "ctx + no token", seed: seeds.pendingNoToken, fx: {} },
    { label: "status pending (stays)", seed: seeds.pendingToken, fx: { [STATUS]: W.statusPending } },
    { label: "status paid (first poll)", seed: seeds.pendingToken, fx: { [STATUS]: W.statusPaid } },
    { label: "status failed", seed: seeds.pendingToken, fx: { [STATUS]: W.statusFailed } },
    { label: "status 500 (stays)", seed: seeds.pendingToken, fx: { [STATUS]: W.status500 } },
    { label: "status network error (stays)", seed: seeds.pendingToken, fx: {}, netErr: [STATUS] },
    { label: "ctx multiple + paid", seed: seeds.pendingMultiple, fx: { [STATUS]: W.statusPaid } },
  ];
  for (const c of PENDING_CASES) {
    console.log(`-- pending: ${c.label}`);
    const run = async (url) => {
      const o = await openPage(browser, url, {
        fixtures: { ...fixtures, ...c.fx },
        seed: c.seed,
        networkErrorPaths: c.netErr,
        settle: 1600,
      });
      const snap = await o.page.evaluate(SNAP);
      const oc = outcome(o.navs, o.initialUrl, snap);
      const out = {
        oc,
        count: o.counts[STATUS] || 0,
        writes: normalizeWrites(o.recorded),
        unstubbed: o.state.unstubbed,
      };
      await o.ctx.close();
      return out;
    };
    const a = await run(urls.legacyPending);
    const b = await run(urls.newPending);
    check(`pending/${c.label}: outcome (left/target/DOM)`, a.oc, b.oc);
    check(`pending/${c.label}: boot status count`, a.count, b.count);
    check(`pending/${c.label}: no writes`, a.writes, b.writes);
    check(`pending/${c.label}: no unstubbed write`, a.unstubbed, b.unstubbed);
    console.log("");
  }

  /* 30 s poll window: still pending after the interval stops. */
  console.log("-- pending: 30 s poll window stops (fake clock)");
  {
    const run = async (url) => {
      const o = await openPage(browser, url, {
        fixtures: { ...fixtures, [STATUS]: W.statusPending },
        seed: seeds.pendingToken,
        clock: true,
      });
      await o.page.clock.runFor(200);
      await o.page.waitForTimeout(300);
      const before = o.counts[STATUS] || 0;
      await o.page.clock.runFor(31000);
      await o.page.waitForTimeout(600);
      const mid = o.counts[STATUS] || 0;
      await o.page.clock.runFor(31000);
      await o.page.waitForTimeout(600);
      const after = o.counts[STATUS] || 0;
      const snap = await o.page.evaluate(SNAP);
      await o.ctx.close();
      return { before, mid, after, target: redirectTarget(o.navs, o.initialUrl), snap };
    };
    const a = await run(urls.legacyPending);
    const b = await run(urls.newPending);
    check("pending/timer: still no redirect", a.target, b.target);
    check("pending/timer: stops after 30 s", a.mid, a.after);
    check("pending/timer: new stops too", b.mid, b.after);
    check("pending/timer: DOM unchanged", a.snap, b.snap);
    note(`pending/timer: legacy ${a.before}->${a.mid}->${a.after}, new ${b.before}->${b.mid}->${b.after}`);
  }

  /* View My Orders / Check again navigation targets. */
  console.log("-- pending: View My Orders + Check again targets");
  for (const [label, seed] of [
    ["orders ctx single", seeds.pendingToken],
    ["orders ctx multiple", seeds.pendingMultiple],
    ["orders no ctx", null],
  ]) {
    const run = async (url) => {
      const o = await openPage(browser, url, {
        fixtures: { ...fixtures, [STATUS]: W.statusPending },
        seed,
        settle: 900,
      });
      await o.page.click("#ew-orders").catch(() => {});
      await o.page.waitForTimeout(400);
      const target = redirectTarget(o.navs, o.initialUrl);
      await o.ctx.close();
      return target;
    };
    const a = await run(urls.legacyPending);
    const b = await run(urls.newPending);
    check(`pending/orders-nav/${label}`, a, b);
  }
  console.log("");

  /* ════════════════════════════════════════════════════════════════════
     PART 4 — boot-once counts + no-write guard
     ════════════════════════════════════════════════════════════════════ */
  console.log("### Part 4 — boot-once counts\n");
  for (const [label, lkey, nkey, seed] of [
    ["payment-success", "legacySuccess", "newSuccess", seeds.successSingle],
    ["payment-failed", "legacyFailed", "newFailed", seeds.failedToken],
    ["payment-pending", "legacyPending", "newPending", seeds.pendingToken],
  ]) {
    const l = await openPage(browser, urls[lkey], { fixtures, seed, settle: 1200 });
    const n = await openPage(browser, urls[nkey], { fixtures, seed, settle: 1200 });
    check(`boot/${label}: no unstubbed write`, l.state.unstubbed, n.state.unstubbed);
    const eps = new Set([...Object.keys(l.counts), ...Object.keys(n.counts)]);
    for (const ep of eps) {
      check(
        `boot/${label}: ${ep} new<=legacy`,
        (n.counts[ep] || 0) <= (l.counts[ep] || 0),
        true
      );
    }
    note(`boot/${label}: legacy ${JSON.stringify(l.counts)} vs new ${JSON.stringify(n.counts)}`);
    await l.ctx.close();
    await n.ctx.close();
  }
  console.log("");
}

export default runPaymentParity;
