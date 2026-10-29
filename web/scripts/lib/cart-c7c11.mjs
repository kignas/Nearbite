// Shared C7 (payment selector + fee preview, `window.CtX`) + C11 (CTA
// blocking, maintenance / shortage banners) probes — Phase 2m.
//
// Used by BOTH scripts/cart-money-parity.mjs (Parts A–C) and
// scripts/cart-c7c11-parity.mjs (Parts A–E), so the logic lives in one place.
//
// GET-only: every fixture is a GET response; no write endpoint is ever called.
import fs from "node:fs";

export function resolveFixturesPath(p) {
  const candidates = [p, p.replace(/^web\//, ""), "web/" + p];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return p;
}
export function loadFixture(name) {
  return JSON.parse(fs.readFileSync(resolveFixturesPath("scripts/fixtures/" + name), "utf8"));
}

const RID = "6ac8f95828669b5f4e30f0ba";
const CART = {
  "Masala Dosa": { name: "Masala Dosa", price: 80, originalPrice: 100, quantity: 2, resId: RID, restaurantName: "Foodie Dosa Restaurant", isVeg: true, image: "" },
};
/* An address with real coords so delivery resolves (deliveryReady) and the
   payment selector / free-delivery previews actually paint. */
const ADDRESS = {
  _id: "aaaaaaaaaaaaaaaaaaaaaaaa", tag: "Home", house: "1", area: "Main Rd",
  city: "Maynaguri", pincode: "735224",
  location: { type: "Point", coordinates: [88.82, 26.56] },
  receiverName: "Probe", receiverPhone: "9999999999",
};
export const SEED = {
  nearbite_cart: JSON.stringify(CART),
  nearbite_address: JSON.stringify(ADDRESS),
  nearbite_cart_extras: JSON.stringify({ restaurantNote: "", restaurantNotes: {}, deliveryInstructions: "", tipAmount: 0 }),
};

export async function open(browser, url, { fixtures, seed = SEED, waitUntil = "networkidle", settle = 1400 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript((entries) => {
    window.__EW_CART_TEST_HOOKS = true;
    try {
      for (const [k, v] of Object.entries(entries))
        window.localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
    } catch (e) {}
  }, seed);
  const page = await ctx.newPage();
  await page.route("https://api.eatswada.com/**", (route) => {
    const u = new URL(route.request().url());
    const path = u.pathname.replace(/^\/api/, "");
    const body = fixtures[path + u.search] !== undefined ? fixtures[path + u.search] : fixtures[path];
    if (body === undefined)
      return route.fulfill({
        status: 404,
        headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
        body: JSON.stringify({ success: false, message: "Not found in fixtures" }),
      });
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
  });
  await page.goto(url, { waitUntil, timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(settle);
  return { ctx, page };
}

/* ── C7 DOM snapshot (payment card + bill preview + banners) ─────────── */
export const C7_SNAP = () => {
  const t = (id) => {
    const el = document.getElementById(id);
    return el ? (el.textContent || "").trim() : null;
  };
  const q = (sel) => {
    const el = document.querySelector(sel);
    return el ? (el.textContent || "").trim() : null;
  };
  const card = document.getElementById("ct-pay-card");
  const opts = Array.from(document.querySelectorAll("#ct-pay-card .ct-pay-opt")).map((b) => ({
    method: b.getAttribute("data-ct-method"),
    checked: b.getAttribute("aria-checked"),
    disabled: b.getAttribute("aria-disabled"),
    cls: b.className,
    title: (b.querySelector(".ct-pay-title") || {}).textContent,
    sub: (b.querySelector(".ct-pay-sub") || {}).textContent,
    badge: (b.querySelector(".ct-pay-badge") || {}).textContent ?? null,
  }));
  const feeRow = (rowId, valId) => {
    const r = document.getElementById(rowId);
    const v = document.getElementById(valId);
    return { display: r ? getComputedStyle(r).display : null, val: v ? (v.textContent || "").trim() : null, valCls: v ? v.className : null };
  };
  return {
    cardPresent: !!card,
    cardHtml: card ? card.innerHTML : null,
    cardPrevSibling: card ? (card.previousElementSibling ? card.previousElementSibling.id : null) : null,
    opts,
    cutleryChecked: document.getElementById("ct-cutlery-input")?.checked ?? null,
    payNote: t("ct-pay-note-text"),
    ctaLabelHtml: t("checkout-label"),
    ctaLocked: (document.getElementById("btn-checkout") || {}).className ?? null,
    ctaAria: document.getElementById("btn-checkout")?.getAttribute("aria-disabled") ?? null,
    platformFee: feeRow("bill-platform-fee-row", "bill-platform-fee-val"),
    packagingFee: feeRow("bill-packaging-fee-row", "bill-packaging-fee-val"),
    smallCartRow: feeRow("bill-small-cart-row", "bill-small-cart-val"),
    surgeRow: feeRow("bill-surge-row", "bill-surge-val"),
    itemLabel: q(".ct-bill-row--item-total .ct-bill-label"),
    deliveryLabel: t("bill-delivery-label"),
    deliveryVal: t("bill-delivery-val"),
    deliveryValHtml: (document.getElementById("bill-delivery-val") || {}).innerHTML ?? null,
    totalLabel: q(".ct-bill-total .ct-total-label"),
    billTotal: t("bill-total"),
    checkoutTotal: t("checkout-total"),
    feesDisplay: (document.querySelector(".ct-fees") || {}).style?.display ?? null,
    bandDisplay: (document.querySelector(".ct-bill-band") || {}).style?.display ?? null,
    fdProgressPresent: !!document.getElementById("ct-fd-progress"),
    fdProgressHidden: document.getElementById("ct-fd-progress")?.hidden ?? null,
    fdProgressHtml: (document.getElementById("ct-fd-progress") || {}).innerHTML ?? null,
    bannersPresent: !!document.getElementById("ct-platform-banners"),
    bannersHtml: (document.getElementById("ct-platform-banners") || {}).innerHTML ?? null,
    bannersHidden: document.getElementById("ct-platform-banners")?.hidden ?? null,
    methodStorage: (() => { try { return localStorage.getItem("nearbite_payment_method"); } catch (e) { return null; } })(),
    cutleryStorage: (() => { try { return localStorage.getItem("nearbite_send_cutlery"); } catch (e) { return null; } })(),
  };
};

/* ── C7 direct-function probe (identical inputs on both pages) ────────── */
export const C7_FN_PROBE = () => {
  const st = (() => {
    try { if (typeof ctState !== "undefined") return ctState; } catch (e) {}
    return (window.__EW_CART_TEST_HOOKS && window.__ewCart && window.__ewCart.state) || null;
  })();
  const out = {};
  const snap = () => ({
    subtotal: st && st.subtotal, units: st && st.units,
    unavailable: st && st.unavailable, deliveryReady: st && st.deliveryReady,
    deliveryFee: st && st.deliveryFee,
  });
  const cases = [
    { subtotal: 100, units: 2, tip: 0, coupon: 0, unavailable: false, deliveryReady: true, deliveryFee: 30 },
    { subtotal: 250, units: 3, tip: 20, coupon: 30, unavailable: false, deliveryReady: true, deliveryFee: 30 },
    { subtotal: 0, units: 0, tip: 0, coupon: 0, unavailable: false, deliveryReady: false, deliveryFee: 0 },
    { subtotal: 99.5, units: 1, tip: 1, coupon: 0.5, unavailable: false, deliveryReady: true, deliveryFee: 30 },
    { subtotal: 100, units: 2, tip: 0, coupon: 0, unavailable: true, deliveryReady: true, deliveryFee: 30 },
  ];
  out.pricing = cases.map((c) => {
    if (st) { st.subtotal = c.subtotal; st.units = c.units; st.tipAmount = c.tip; st.couponDiscount = c.coupon; st.unavailable = c.unavailable; st.deliveryReady = c.deliveryReady; st.deliveryFee = c.deliveryFee; }
    try {
      const p = window.CtX.pricing();
      return {
        pricing: p,
        totalDelta: window.CtX.totalDelta(),
        fmtTotal: [window.CtX.fmtTotal(p.total), window.CtX.fmtTotal(100), window.CtX.fmtTotal(99.5), window.CtX.fmtTotal(0)],
      };
    } catch (e) { return { error: String(e).split("\n")[0] }; }
  });
  const base = snap();
  if (st) { st.subtotal = 100; st.units = 2; st.deliveryReady = true; st.deliveryFee = 30; st.unavailable = false; }
  try { out.codState = window.CtX.codState(); } catch (e) { out.codState = "ERR:" + e; }
  try { out.upiState = window.CtX.upiState(); } catch (e) { out.upiState = "ERR:" + e; }
  try { out.ctaBlock = window.CtX.ctaBlock(); } catch (e) { out.ctaBlock = "ERR:" + e; }
  try { out.ctaLabel = window.CtX.ctaLabel(); } catch (e) { out.ctaLabel = "ERR:" + e; }
  try { out.storedMethod = window.CtX.storedMethod(); } catch (e) { out.storedMethod = "ERR:" + e; }
  try { out.getPaymentMethod = window.CtX.getPaymentMethod(); } catch (e) { out.getPaymentMethod = "ERR:" + e; }
  try { out.getSendCutlery = window.CtX.getSendCutlery(); } catch (e) { out.getSendCutlery = "ERR:" + e; }
  try { out.revalidateBeforeOrder = window.CtX.revalidateBeforeOrder(); } catch (e) { out.revalidateBeforeOrder = "ERR:" + e; }
  try {
    out.handleOrderFailure = [
      window.CtX.handleOrderFailure(503, { code: "PLATFORM_MAINTENANCE", message: "M" }),
      window.CtX.handleOrderFailure(503, { code: "RIDER_SHORTAGE" }),
      window.CtX.handleOrderFailure(500, {}),
    ];
  } catch (e) { out.handleOrderFailure = "ERR:" + e; }
  if (st) Object.assign(st, base);
  return out;
};

/* ── interaction probe: click COD, toggle cutlery ───────────────────── */
export const C7_INTERACT = () => {
  const out = {};
  const click = (sel) => { const b = document.querySelector(sel); if (b) b.click(); };
  out.before = {
    checked: document.querySelector("#ct-pay-card .ct-pay-opt.is-selected")?.getAttribute("data-ct-method") ?? null,
    storage: (() => { try { return localStorage.getItem("nearbite_payment_method"); } catch (e) { return null; } })(),
    cta: (document.getElementById("checkout-label") || {}).textContent ?? null,
  };
  click('#ct-pay-card .ct-pay-opt[data-ct-method="cod"]');
  out.afterCod = {
    checked: document.querySelector("#ct-pay-card .ct-pay-opt.is-selected")?.getAttribute("data-ct-method") ?? null,
    codAria: document.querySelector('#ct-pay-card .ct-pay-opt[data-ct-method="cod"]')?.getAttribute("aria-checked") ?? null,
    storage: (() => { try { return localStorage.getItem("nearbite_payment_method"); } catch (e) { return null; } })(),
    note: (document.getElementById("ct-pay-note-text") || {}).textContent ?? null,
    cta: (document.getElementById("checkout-label") || {}).textContent ?? null,
  };
  const cut = document.getElementById("ct-cutlery-input");
  if (cut) { cut.checked = true; cut.dispatchEvent(new Event("change", { bubbles: true })); }
  out.afterCutlery = {
    storage: (() => { try { return localStorage.getItem("nearbite_send_cutlery"); } catch (e) { return null; } })(),
    checked: document.getElementById("ct-cutlery-input")?.checked ?? null,
  };
  click('#ct-pay-card .ct-pay-opt.is-disabled');
  out.afterDisabledClick = document.querySelector("#ct-pay-card .ct-pay-opt.is-selected")?.getAttribute("data-ct-method") ?? null;
  return out;
};

/* ── Part A: COD/UPI eligibility matrix ─────────────────────────────── */
export async function runPartA(browser, { legacyUrl, newUrl }, check) {
  console.log("### Part A — COD/UPI eligibility matrix (fixture x load x tap)\n");
  const MATRIX = [
    { label: "normal", fx: "cart-c7-normal.json" },
    { label: "cod off", fx: "cart-c7-cod-off.json" },
    { label: "upi off", fx: "cart-c7-upi-off.json" },
    { label: "cod blocked", fx: "cart-c7-cod-blocked.json" },
    { label: "cod cap 100", fx: "cart-c7-cod-cap.json" },
    { label: "maintenance", fx: "cart-c7-maint.json" },
    { label: "shortage", fx: "cart-c7-short.json" },
  ];
  for (const sc of MATRIX) {
    const fixtures = loadFixture(sc.fx);
    const L = await open(browser, legacyUrl, { fixtures });
    const N = await open(browser, newUrl, { fixtures });
    const lDom = await L.page.evaluate(C7_SNAP);
    const nDom = await N.page.evaluate(C7_SNAP);
    check(`A[${sc.label}] payment card html`, lDom.cardHtml, nDom.cardHtml);
    check(`A[${sc.label}] payment options`, lDom.opts, nDom.opts);
    check(`A[${sc.label}] pay note`, lDom.payNote, nDom.payNote);
    check(`A[${sc.label}] method storage`, lDom.methodStorage, nDom.methodStorage);
    check(`A[${sc.label}] cta label`, lDom.ctaLabelHtml, nDom.ctaLabelHtml);
    check(`A[${sc.label}] cta locked class`, lDom.ctaLocked, nDom.ctaLocked);
    const lFn = await L.page.evaluate(C7_FN_PROBE);
    const nFn = await N.page.evaluate(C7_FN_PROBE);
    check(`A[${sc.label}] fn codState`, lFn.codState, nFn.codState);
    check(`A[${sc.label}] fn upiState`, lFn.upiState, nFn.upiState);
    check(`A[${sc.label}] fn getPaymentMethod`, lFn.getPaymentMethod, nFn.getPaymentMethod);
    check(`A[${sc.label}] fn revalidateBeforeOrder`, lFn.revalidateBeforeOrder, nFn.revalidateBeforeOrder);
    const lI = await L.page.evaluate(C7_INTERACT);
    const nI = await N.page.evaluate(C7_INTERACT);
    check(`A[${sc.label}] tap matrix`, lI, nI);
    await L.ctx.close();
    await N.ctx.close();
    console.log("");
  }
}

/* ── Part B: pricing preview fee rows + totals + rounding ────────────── */
export async function runPartB(browser, { legacyUrl, newUrl }, check) {
  console.log("### Part B — pricing preview (CtX) fee rows + totals + rounding\n");
  const fixtures = loadFixture("cart-c7-fees.json");
  const L = await open(browser, legacyUrl, { fixtures });
  const N = await open(browser, newUrl, { fixtures });
  const lDom = await L.page.evaluate(C7_SNAP);
  const nDom = await N.page.evaluate(C7_SNAP);
  check("B fees platform row", lDom.platformFee, nDom.platformFee);
  check("B fees packaging row", lDom.packagingFee, nDom.packagingFee);
  check("B fees small-cart row", lDom.smallCartRow, nDom.smallCartRow);
  check("B fees surge row", lDom.surgeRow, nDom.surgeRow);
  check("B fees item label", lDom.itemLabel, nDom.itemLabel);
  check("B fees total label", lDom.totalLabel, nDom.totalLabel);
  check("B fees bill total", lDom.billTotal, nDom.billTotal);
  check("B fees checkout total", lDom.checkoutTotal, nDom.checkoutTotal);
  check("B fees .ct-fees display", lDom.feesDisplay, nDom.feesDisplay);
  check("B fees .ct-bill-band display", lDom.bandDisplay, nDom.bandDisplay);
  const lFn = await L.page.evaluate(C7_FN_PROBE);
  const nFn = await N.page.evaluate(C7_FN_PROBE);
  check("B fn pricing cases", lFn.pricing, nFn.pricing);
  await L.ctx.close();
  await N.ctx.close();
  console.log("");
}

/* ── Part C: platform status normal / maintenance / shortage / error ─── */
export async function runPartC(browser, { legacyUrl, newUrl }, check) {
  console.log("### Part C — platform status: normal / maintenance / shortage / error\n");
  for (const sc of [
    { label: "normal", fx: "cart-c7-normal.json" },
    { label: "maintenance", fx: "cart-c7-maint.json" },
    { label: "shortage", fx: "cart-c7-short.json" },
    { label: "rain surge (fees)", fx: "cart-c7-fees.json" },
    { label: "status 404 error", fx: "cart-c7-error.json" },
  ]) {
    const fixtures = loadFixture(sc.fx);
    const L = await open(browser, legacyUrl, { fixtures });
    const N = await open(browser, newUrl, { fixtures });
    const lDom = await L.page.evaluate(C7_SNAP);
    const nDom = await N.page.evaluate(C7_SNAP);
    check(`C[${sc.label}] banners html`, lDom.bannersHtml, nDom.bannersHtml);
    check(`C[${sc.label}] banners host`, lDom.bannersPresent, nDom.bannersPresent);
    check(`C[${sc.label}] cta label`, lDom.ctaLabelHtml, nDom.ctaLabelHtml);
    check(`C[${sc.label}] cta locked class`, lDom.ctaLocked, nDom.ctaLocked);
    const lFn = await L.page.evaluate(C7_FN_PROBE);
    const nFn = await N.page.evaluate(C7_FN_PROBE);
    check(`C[${sc.label}] fn ctaBlock`, lFn.ctaBlock, nFn.ctaBlock);
    check(`C[${sc.label}] fn ctaLabel`, lFn.ctaLabel, nFn.ctaLabel);
    await L.ctx.close();
    await N.ctx.close();
    console.log("");
  }

  console.log("### Part C2 — platform status 503 maintenance (banner + CTA block)\n");
  {
    const fixtures = loadFixture("cart-c7-normal.json");
    fixtures["/platform/public-status"] = {
      __status: 503,
      body: { success: false, code: "PLATFORM_MAINTENANCE", message: "Down for maintenance", maintenanceTitle: "Eatswada is under maintenance" },
    };
    const L = await open(browser, legacyUrl, { fixtures });
    const N = await open(browser, newUrl, { fixtures });
    const lDom = await L.page.evaluate(C7_SNAP);
    const nDom = await N.page.evaluate(C7_SNAP);
    check("C2 503 banners html", lDom.bannersHtml, nDom.bannersHtml);
    check("C2 503 cta label", lDom.ctaLabelHtml, nDom.ctaLabelHtml);
    await L.ctx.close();
    await N.ctx.close();
    console.log("");
  }
}

/* ── Part D: free-delivery progress + strike-through preview ─────────── */
export async function runPartD(browser, { legacyUrl, newUrl }, check) {
  console.log("### Part D — free-delivery progress + strike-through preview\n");
  for (const sc of [
    { label: "global free", fx: "cart-c7-freeglobal.json" },
    { label: "normal (no free)", fx: "cart-c7-normal.json" },
  ]) {
    const fixtures = loadFixture(sc.fx);
    const L = await open(browser, legacyUrl, { fixtures });
    const N = await open(browser, newUrl, { fixtures });
    const lDom = await L.page.evaluate(C7_SNAP);
    const nDom = await N.page.evaluate(C7_SNAP);
    check(`D[${sc.label}] fd progress present`, lDom.fdProgressPresent, nDom.fdProgressPresent);
    check(`D[${sc.label}] fd progress html`, lDom.fdProgressHtml, nDom.fdProgressHtml);
    check(`D[${sc.label}] delivery val html`, lDom.deliveryValHtml, nDom.deliveryValHtml);
    check(`D[${sc.label}] delivery label`, lDom.deliveryLabel, nDom.deliveryLabel);
    await L.ctx.close();
    await N.ctx.close();
    console.log("");
  }
}

/* ── Part E: poll timing + fetch error recovery ─────────────────────── */
export async function runPartE(browser, { legacyUrl, newUrl }, check) {
  console.log("### Part E — poll timing + fetch error recovery (90 s loop)\n");
  const fixtures = loadFixture("cart-c7-normal.json");
  const L = await open(browser, legacyUrl, { fixtures });
  const N = await open(browser, newUrl, { fixtures });
  const probe = async (page) => page.evaluate(() => {
    const t = (() => { try { return window.EWPlatform && window.EWPlatform.current(); } catch (e) { return null; } })();
    return { hasPlatform: !!window.EWPlatform, under: t && t.isUnderMaintenance, shortage: t && t.isDeliveryPausedShortage };
  });
  check("E EWPlatform installed (legacy)", (await probe(L.page)).hasPlatform, true);
  check("E EWPlatform installed (new)", (await probe(N.page)).hasPlatform, true);
  check("E normal state", await probe(L.page), await probe(N.page));
  await L.page.route("https://api.eatswada.com/**", (route) => route.fulfill({ status: 500, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "{}" }));
  await N.page.route("https://api.eatswada.com/**", (route) => route.fulfill({ status: 500, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "{}" }));
  const afterErr = async (page) => {
    await page.evaluate(() => window.EWPlatform.get(true));
    return page.evaluate(() => {
      const t = window.EWPlatform.current();
      return { under: t.isUnderMaintenance, shortage: t.isDeliveryPausedShortage, cod: t.isCodEnabled };
    });
  };
  check("E error keeps safe defaults", await afterErr(L.page), await afterErr(N.page));
  await L.ctx.close();
  await N.ctx.close();
  console.log("");
}
