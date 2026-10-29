// Cart money-parity harness (Phase 2j, chunk C2).
//
// Usage: node scripts/cart-money-parity.mjs [legacyUrl] [newUrl] [fixturesFile]
//   defaults: http://localhost:8080/cart.html  http://localhost:3000/cart
//             scripts/fixtures/cart-seeded.json
//
// Part 1 — storage + C2 money DOM parity on seeded carts.
//   The SAME localStorage seed is installed on both pages before boot; after
//   load the harness deep-compares:
//     * nearbite_cart and nearbite_cart_extras BEFORE (seed) and AFTER load,
//       so sanitizeLegacyCarts()'s migration is proven identical;
//     * every bill figure C2 computes from the cart alone (item total, MRP,
//       subtotal, tip/discount/tax rows, compact bill, savings texts, the
//       CTA label). Delivery-dependent nodes (delivery fee row, To Pay total,
//       hero total) come from chunk C3 (refreshDelivery) which is NOT ported
//       in this task, so they are captured and reported, not asserted.
//
// Part 2 — direct C2 function parity with page.evaluate (same inputs both
//   pages, deep-compare returns): ctCleanNote, ctCleanTip, esc, ctCartGroups,
//   deliveryFeeForDistance, distanceKm, normalizeCoords, getCartRestaurantId,
//   ctEtaText, customLine, updateBillCompact, plus a full paintBill+applyTotals
//   pass on a synthetic cart (with deliveryFee forced equal) compared row by row.
//
// Part 3 — rounding edge cases (x.5 prices, quantity > 1, MRP vs price) and a
//   malformed cart that sanitizeLegacyCarts must migrate identically.
//
// Owner decision 1: cart keys are deterministic composites and are compared
// EXACTLY — no Date.now() normalisation.
import { chromium } from "playwright";
import fs from "node:fs";
import { runPartA, runPartB, runPartC } from "./lib/cart-c7c11.mjs";
import { runPartA as runC8PartA, runPartB as runC8PartB, runPartC as runC8PartC, runPartD as runC8PartD, runPartE as runC8PartE } from "./lib/cart-c8.mjs";
import { runC9Probes } from "./lib/cart-c9.mjs";

const [
  legacyUrl = "http://localhost:8080/cart.html",
  newUrl = "http://localhost:3000/cart",
  fixturesArg = "scripts/fixtures/cart-seeded.json",
] = process.argv.slice(2);

function resolveFixturesPath(p) {
  const candidates = [p, p.replace(/^web\//, ""), "web/" + p];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return p;
}
const fixtures = JSON.parse(fs.readFileSync(resolveFixturesPath(fixturesArg), "utf8"));

function fixtureFor(rawUrl) {
  const u = new URL(rawUrl);
  const path = u.pathname.replace(/^\/api/, "");
  const exact = path + u.search;
  if (fixtures[exact] !== undefined) return fixtures[exact];
  if (fixtures[path] !== undefined) return fixtures[path];
  return undefined;
}
async function installFixtures(page) {
  await page.route("https://api.eatswada.com/**", (route) => {
    const body = fixtureFor(route.request().url());
    if (body === undefined) {
      return route.fulfill({
        status: 404,
        headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
        body: JSON.stringify({ success: false, message: "Not found in fixtures" }),
      });
    }
    return route.fulfill({
      status: 200,
      headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  });
}

let pass = 0;
let fail = 0;
const failures = [];
function check(label, a, b) {
  const sa = JSON.stringify(a);
  const sb = JSON.stringify(b);
  if (sa === sb) {
    pass++;
    console.log(`  PASS  ${label}`);
  } else {
    fail++;
    failures.push(label);
    console.log(`  FAIL  ${label}`);
    console.log(`        legacy: ${sa}`);
    console.log(`        new:    ${sb}`);
  }
}
function note(msg) {
  console.log(`  · ${msg}`);
}

const RID = "6ac8f95828669b5f4e30f0ba";

/* ── DOM snapshot: only the nodes C2 computes ────────────────────────── */
const DOM_SNAP = () => {
  const t = (id) => {
    const el = document.getElementById(id);
    return el ? (el.textContent || "").trim() : null;
  };
  const q = (sel) => {
    const el = document.querySelector(sel);
    return el ? (el.textContent || "").trim() : null;
  };
  return {
    // C2-owned, id-stable nodes. NOTE: legacy chunk C7
    // (cart-checkout-upgrades.js) RELABELS the bill rows ("Item Subtotal",
    // "Delivery fee (estimated)", …) and adds fee rows; that is a later chunk
    // and is NOT ported here, so row LABELS are deliberately not compared.
    // The values C2 computes live on id-stable nodes and are.
    itemTotalPair: q(".ct-bill-row--item-total .ct-bill-price-pair"),
    billTotal: t("bill-total"),
    checkoutTotal: t("checkout-total"),
    billSubtotal: t("bill-subtotal"),
    billMrp: t("bill-mrp"),
    billMrpHidden: document.getElementById("bill-mrp")?.hidden ?? null,
    compactLine: t("bill-compact-line"),
    compactTotal: t("bill-peek-total"),
    heroTotal: t("bill-hero-total"),
    heroSaved: t("bill-hero-saved"),
    footerSaveText: t("ct-footer-save-text"),
    savCornerText: t("ct-sav-items-text"),
    ctaLabel: t("checkout-label"),
    tipVal: t("bill-tip-val"),
    discountVal: t("bill-discount-val"),
    taxVal: t("bill-tax-val"),
    deliveryFeeRowDisplay: getComputedStyle(document.getElementById("bill-delivery-val")).display,
    /* C3 (delivery) owned nodes. */
    deliveryLabel: t("bill-delivery-label"),
    deliveryVal: t("bill-delivery-val"),
    deliveryValClass: (document.getElementById("bill-delivery-val") || {}).className ?? null,
    nudgeClass: (document.getElementById("free-delivery-nudge") || {}).className ?? null,
    nudgeDisplay: getComputedStyle(document.getElementById("free-delivery-nudge")).display,
    nudgeText: t("nudge-text"),
    nudgeSub: t("nudge-sub"),
    nudgeSubHidden: document.getElementById("nudge-sub")?.hidden ?? null,
    nudgeIconClass: (document.getElementById("nudge-icon") || {}).getAttribute
      ? document.getElementById("nudge-icon").getAttribute("class")
      : null,
    billPerRestaurantDisplay: getComputedStyle(document.getElementById("bill-per-restaurant")).display,
    billPerRestaurantHtml: (document.getElementById("bill-per-restaurant") || {}).innerHTML ?? null,
    /* C4 (items) owned nodes. */
    itemsHtml: (document.getElementById("cart-items-list") || {}).innerHTML ?? null,
    itemsAriaBusy: document.getElementById("cart-items-list")?.getAttribute("aria-busy") ?? null,
    groupCount: document.querySelectorAll("#cart-items-list .ct-restaurant-group").length,
    rowCount: document.querySelectorAll("#cart-items-list .ct-row").length,
    dhRestaurant: t("ct-dh-restaurant"),
    hiddenRestaurantName: t("cart-restaurant-name"),
  };
};

async function snapshot(browser, url, seed) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  if (seed) {
    await ctx.addInitScript((entries) => {
      try {
        for (const [k, v] of Object.entries(entries)) {
          window.localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
        }
      } catch (e) {}
    }, seed);
  }
  const page = await ctx.newPage();
  await installFixtures(page);
  await page.goto(url, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const dom = await page.evaluate(DOM_SNAP);
  const ls = await page.evaluate(() => ({
    cart: localStorage.getItem("nearbite_cart"),
    extras: localStorage.getItem("nearbite_cart_extras"),
  }));
  await ctx.close();
  return { dom, ls };
}


/* Legacy `cart-page.js` is a classic script, so its top-level `const ctState`
   is reachable as a BARE global from page.evaluate. A module cannot publish a
   `const` that way, so the new page exposes the SAME object through the
   `__EW_CART_TEST_HOOKS` bridge (see lib/cart-page-state.ts). This resolver
   returns that object on both pages — and throws loudly if neither exists, so
   a broken bridge can never masquerade as a passing check. */
const STATE_PROBE = () => {
  const resolve = () => {
    try {
      if (typeof ctState !== "undefined") return ctState; // legacy bare global
    } catch (e) {}
    const hooks = window.__EW_CART_TEST_HOOKS && window.__ewCart;
    if (hooks && hooks.state) return hooks.state;
    return null;
  };
  const st = resolve();
  return { hasState: !!st, state: st };
};

/* ── direct C3 function probes (identical inputs both pages) ─────────── */
const C3_FN_PROBE = (RID) => {
  const out = {};
  const st = (() => {
    try { if (typeof ctState !== "undefined") return ctState; } catch (e) {}
    return (window.__EW_CART_TEST_HOOKS && window.__ewCart && window.__ewCart.state) || null;
  })();
  /* applyDelivery across every branch: outside-radius, free, free-above
     (not reached), GPS distance, GPS-less estimate. Force ctState.subtotal
     and deliveryReady the same on both sides so only the branch logic runs. */
  const scenarios = [
    { label: "outside radius", d: { fee: null, distance: 19.7, source: "gps", outsideRadius: true, radius: 10 } },
    { label: "free delivery", d: { fee: 0, distance: 4.66, source: "gps", freeDelivery: true, freeDeliveryAbove: 500 } },
    { label: "free above not reached", d: { fee: 30, distance: 4.66, source: "gps", freeDelivery: false, freeDeliveryAbove: 5000 } },
    { label: "gps distance", d: { fee: 30, distance: 4.66, source: "gps" } },
    { label: "fallback estimate", d: { fee: null, distance: null, source: "fallback" } },
    { label: "null fee no distance", d: { fee: null, distance: null } },
  ];
  out.applyDelivery = scenarios.map((s) => {
    try {
      window.applyDelivery(JSON.parse(JSON.stringify(s.d)));
    } catch (e) {
      return { label: s.label, error: String(e).split("\n")[0] };
    }
    return {
      label: s.label,
      deliveryVal: document.getElementById("bill-delivery-val")?.textContent,
      deliveryValClass: document.getElementById("bill-delivery-val")?.className,
      /* C7 (cart-checkout-upgrades.js) rewrites "Delivery Fee" ->
         "Delivery Partner Fee"; that chunk is NOT ported, so normalise the
         C7-owned prefix away and compare only the C3-owned text. */
      deliveryLabel: (document.getElementById("bill-delivery-label")?.textContent || "").replace("Delivery Partner Fee", "Delivery Fee"),
      nudgeClass: document.getElementById("free-delivery-nudge")?.className,
      nudgeDisplay: getComputedStyle(document.getElementById("free-delivery-nudge")).display,
      nudgeText: document.getElementById("nudge-text")?.textContent,
      nudgeSub: document.getElementById("nudge-sub")?.textContent,
      nudgeSubHidden: document.getElementById("nudge-sub")?.hidden,
      stateFee: st && st.deliveryFee,
      stateEst: st && st.deliveryFeeEstimated,
      stateUnavail: st && st.unavailable,
      stateReady: st && st.deliveryReady,
      billTotal: document.getElementById("bill-total")?.textContent,
    };
  });

  /* renderMultiBreakdown + applyMultiDelivery with synthetic rows (multi-
     restaurant bill). No network, no ctState mutation beyond the documented
     fields. */
  const rows = [
    { resId: "r1", name: "Alpha", subtotal: 300, units: 3, fee: 30, distance: 4.6, outsideRadius: false, radius: 10, freeDelivery: false, freeAbove: 500, minOrder: 0, codEnabled: true },
    { resId: "r2", name: "Beta & Co", subtotal: 120, units: 2, fee: 0, distance: 6.2, outsideRadius: false, radius: 10, freeDelivery: true, freeAbove: 100, minOrder: 0, codEnabled: false },
  ];
  try {
    window.renderMultiBreakdown(rows);
    out.multiBreakdownHtml = document.getElementById("bill-per-restaurant")?.innerHTML;
    out.multiBreakdownDisplay = getComputedStyle(document.getElementById("bill-per-restaurant")).display;
  } catch (e) {
    out.multiBreakdownHtml = "ERR:" + String(e).split("\n")[0];
  }
  try {
    window.applyMultiDelivery(rows);
    out.multi = {
      deliveryVal: document.getElementById("bill-delivery-val")?.textContent,
      deliveryLabel: document.getElementById("bill-delivery-label")?.textContent,
      nudgeClass: document.getElementById("free-delivery-nudge")?.className,
      nudgeText: document.getElementById("nudge-text")?.textContent,
      stateFee: st && st.deliveryFee,
      stateUnavail: st && st.unavailable,
      stateFreeAbove: st && st.freeDeliveryAbove,
      stateMultiBelowMin: st && JSON.stringify(st.multiBelowMin),
    };
  } catch (e) {
    out.multi = { error: String(e).split("\n")[0] };
  }

  /* Outside-radius + below-min multi rows exercise the other strip tones. */
  try {
    window.renderMultiBreakdown([{ resId: "r3", name: "Gamma", subtotal: 50, units: 1, fee: null, distance: 12, outsideRadius: true, radius: 10, freeAbove: 0, minOrder: 200 }]);
    out.multiOutsideHtml = document.getElementById("bill-per-restaurant")?.innerHTML;
  } catch (e) {
    out.multiOutsideHtml = "ERR:" + String(e).split("\n")[0];
  }
  return out;
};

/* ── C4 item interaction probe: qty +, qty -, remove, clear ──────────── */
const C4_FN_PROBE = (RID) => {
  const out = {};
  const readCart = () => {
    try { return localStorage.getItem("nearbite_cart"); } catch (e) { return "ERR"; }
  };
  const seedCart = () => {
    localStorage.setItem("nearbite_cart", JSON.stringify({
      "Masala Dosa": { name: "Masala Dosa", price: 80, originalPrice: 100, quantity: 2, resId: RID, restaurantName: "Foodie Dosa Restaurant", isVeg: true },
      "Plain Idli": { name: "Plain Idli", price: 40, quantity: 1, resId: RID, restaurantName: "Foodie Dosa Restaurant", isVeg: true },
    }));
  };
  try {
    seedCart();
    window.repaintCart();
    out.beforeRows = document.querySelectorAll("#cart-items-list .ct-row").length;
    /* +1 on Masala Dosa */
    window.cartAdjust("Masala Dosa", 1);
    out.afterPlus = readCart();
    out.plusRows = document.querySelectorAll("#cart-items-list .ct-row").length;
    out.plusQtyText = document.querySelector('#cart-items-list .ct-row[data-name="Masala Dosa"] .ct-qty')?.textContent;
    /* -1 on Plain Idli (qty 1 -> removed) */
    window.cartAdjust("Plain Idli", -1);
    out.afterRemove = readCart();
    out.removeRows = document.querySelectorAll("#cart-items-list .ct-row").length;
    /* stepper click path (delegated listener) — click the + button */
    const up = document.querySelector('#cart-items-list .ct-row[data-name="Masala Dosa"] .ct-step-up');
    if (up) up.click();
    out.afterClickPlus = readCart();
    out.clickQty = document.querySelector('#cart-items-list .ct-row[data-name="Masala Dosa"] .ct-qty')?.textContent;
    /* clear */
    window.clearCart();
    out.afterClear = readCart();
    out.emptyVisible = getComputedStyle(document.getElementById("empty-cart")).display;
    out.hasItemsVisible = getComputedStyle(document.getElementById("cart-has-items")).display;
  } catch (e) {
    out.error = String(e).split("\n")[0];
  }
  return out;
};

/* ── direct C2 function probes (identical inputs both pages) ──────────── */
const FN_PROBE = (RID) => {
  const out = {};
  out.cleanNote = [
    window.ctCleanNote("  a\n\nb\tc  "),
    window.ctCleanNote("x".repeat(400)),
    window.ctCleanNote(42),
    window.ctCleanNote(null),
  ];
  out.cleanTip = [
    window.ctCleanTip(0), window.ctCleanTip(10), window.ctCleanTip("20"),
    window.ctCleanTip(1000), window.ctCleanTip(1001), window.ctCleanTip(0.5),
    window.ctCleanTip(-3), window.ctCleanTip("abc"), window.ctCleanTip(19.6),
  ];
  out.esc = [
    window.esc(`<a href="x">&'</a>`),
    window.esc(null), window.esc(0), window.esc(false),
  ];
  out.deliveryFee = [
    window.deliveryFeeForDistance(0), window.deliveryFeeForDistance(9.999),
    window.deliveryFeeForDistance(10), window.deliveryFeeForDistance(12),
    window.deliveryFeeForDistance(15), window.deliveryFeeForDistance(15.001),
    window.deliveryFeeForDistance(20), window.deliveryFeeForDistance(-1),
    window.deliveryFeeForDistance(NaN),
  ];
  out.distanceKm = [
    window.distanceKm([89.0, 26.5], [89.05, 26.55]),
    window.distanceKm([89.0, 26.5], [89.0, 26.5]),
  ];
  out.normalizeCoords = [
    window.normalizeCoords({ type: "Point", coordinates: [89.0, 26.5] }),
    window.normalizeCoords({ longitude: 89.0, latitude: 26.5 }),
    window.normalizeCoords({ coordinates: [200, 10] }),
    window.normalizeCoords(null),
  ];
  out.getCartRestaurantId = [
    window.getCartRestaurantId({ a: { resId: RID } }),
    window.getCartRestaurantId({ a: { resId: "null" } }),
    window.getCartRestaurantId({}),
  ];
  out.ctEtaText = [
    window.ctEtaText({ estimatedDeliveryMin: 30, estimatedDeliveryMax: 40 }),
    window.ctEtaText({ time: "30-40 mins" }),
    window.ctEtaText({ deliveryTimeMax: 25 }),
    window.ctEtaText({}),
    window.ctEtaText(null),
  ];
  out.customLine = [
    window.customLine("plain"),
    window.customLine({ a: 1, b: true, c: "z" }),
    window.customLine(["x", "y"]),
    window.customLine(null),
  ];
  out.cartGroups = window.ctCartGroups();

  /* Full paintBill + applyTotals on a synthetic cart, delivery fee forced
     equal on both sides so only C2 arithmetic is compared. */
  const synthetic = {
    "Item A": { name: "Item A", price: 33.5, originalPrice: 50, quantity: 3, resId: RID, restaurantName: "R", isVeg: true },
    "Item B": { name: "Item B", price: 99, quantity: 1, resId: RID, restaurantName: "R", isVeg: false },
  };
  const st = (() => {
    try { if (typeof ctState !== "undefined") return ctState; } catch (e) {}
    return (window.__EW_CART_TEST_HOOKS && window.__ewCart && window.__ewCart.state) || null;
  })();
  if (!st) {
    out.synth = { error: "NO_STATE_OBJECT" };
  } else {
    try {
      localStorage.setItem("nearbite_cart", JSON.stringify(synthetic));
      st.deliveryFee = 30;
      st.deliveryReady = true;
      st.unavailable = false;
      st.loggedIn = false;
      st.addressOk = false;
      st.tipAmount = 20;
      window.paintBill(synthetic);
      window.applyTotals();
      window.updateBillCompact(st.subtotal + st.deliveryFee + 20);
      out.synth = {
        subtotal: st.subtotal,
        units: st.units,
        itemSavings: st.itemSavings,
        originalCartTotal: st.originalCartTotal,
        billTotal: document.getElementById("bill-total")?.textContent,
        checkoutTotal: document.getElementById("checkout-total")?.textContent,
        billSubtotal: document.getElementById("bill-subtotal")?.textContent,
        billMrp: document.getElementById("bill-mrp")?.textContent,
        compactLine: document.getElementById("bill-compact-line")?.textContent,
        tipRow: document.getElementById("bill-tip-val")?.textContent,
        heroTotal: document.getElementById("bill-hero-total")?.textContent,
      };
    } catch (e) {
      out.synth = { error: String(e).split("\n")[0] };
    }
  }
  return out;
};

/* ── rounding edge cases: each case is a cart + forced deliveryFee ────── */
const ROUND_CASES = [
  {
    label: "x.5 prices, qty 2, MRP>price",
    cart: { P: { name: "P", price: 10.5, originalPrice: 12.5, quantity: 2, resId: RID } },
    fee: 30, tip: 0,
  },
  {
    label: "x.5 prices, qty 3, no MRP",
    cart: { Q: { name: "Q", price: 7.5, originalPrice: 7.5, quantity: 3, resId: RID } },
    fee: 0, tip: 0,
  },
  {
    label: "MRP lower than price (no saving)",
    cart: { R: { name: "R", price: 40, originalPrice: 25, quantity: 1, resId: RID } },
    fee: 30, tip: 10,
  },
  {
    label: "string numbers",
    cart: { S: { name: "S", price: "19.5", originalPrice: "20", quantity: "4", resId: RID } },
    fee: 30, tip: 0,
  },
];

const ROUND_PROBE = (c) => {
  const out = {};
  const st = (() => {
    try { if (typeof ctState !== "undefined") return ctState; } catch (e) {}
    return (window.__EW_CART_TEST_HOOKS && window.__ewCart && window.__ewCart.state) || null;
  })();
  if (!st) return { error: "NO_STATE_OBJECT" };
  try {
    localStorage.setItem("nearbite_cart", JSON.stringify(c.cart));
    st.deliveryFee = c.fee;
    st.deliveryReady = true;
    st.unavailable = false;
    st.loggedIn = false;
    st.addressOk = false;
    st.tipAmount = c.tip;
    window.paintBill(c.cart);
    window.applyTotals();
    out.subtotal = st.subtotal;
    out.units = st.units;
    out.itemSavings = st.itemSavings;
    out.originalCartTotal = st.originalCartTotal;
    out.billTotal = document.getElementById("bill-total")?.textContent;
    out.billSubtotal = document.getElementById("bill-subtotal")?.textContent;
    out.billMrp = document.getElementById("bill-mrp")?.textContent;
    out.compactLine = document.getElementById("bill-compact-line")?.textContent;
  } catch (e) {
    out.error = String(e).split("\n")[0];
  }
  return out;
};

/* ── malformed cart migration probe ──────────────────────────────────── */
const MALFORMED_SEED = {
  nearbite_cart: JSON.stringify({
    "Broken line": { name: "Broken line", price: 50, quantity: 1, resId: "undefined" },
  }),
};

async function migrateSnapshot(browser, url) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  /* sanitizeLegacyCarts() removes the corrupt cart, alerts, then calls
     location.reload(). The reload must be ALLOWED to run so the post-reset
     state is observed for real (freezing it with route.abort() leaves the
     document on about:blank, where localStorage is unreadable on both sides
     and the comparison becomes meaningless). The seed therefore runs only on
     the FIRST document; a sessionStorage guard (which survives the reload)
     stops the init script from re-seeding the corrupt cart on load two. */
  await ctx.addInitScript((entries) => {
    try {
      if (sessionStorage.getItem("__ew_migrated")) return;
      for (const [k, v] of Object.entries(entries)) window.localStorage.setItem(k, v);
      sessionStorage.setItem("__ew_migrated", "1");
    } catch (e) {}
  }, MALFORMED_SEED);
  const page = await ctx.newPage();
  await installFixtures(page);
  /* Count only MAIN-FRAME document loads of the page's own URL. Legacy
     cart.html also loads a Razorpay iframe (whose own document requests are
     unrelated) and the two pages embed a different number of those, so a raw
     document counter is not a reload counter. */
  const pagePath = new URL(url).pathname;
  let documents = 0;
  page.on("request", (r) => {
    if (r.resourceType() !== "document") return;
    if (r.frame() !== page.mainFrame()) return;
    if (new URL(r.url()).pathname !== pagePath) return;
    documents++;
  });
  const dialogs = [];
  page.on("dialog", (d) => {
    dialogs.push(d.message());
    d.accept().catch(() => {});
  });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(2500);
  let ls = null;
  try {
    ls = await page.evaluate(() => localStorage.getItem("nearbite_cart"));
  } catch (e) {
    ls = "UNREADABLE";
  }
  await ctx.close();
  return { cart: ls, dialog: dialogs[0] ?? null, reloads: documents - 1 };
}

/* ────────────────────────────────────────────────────────────────────── */
const browser = await chromium.launch();

console.log("### Part 1 — seeded cart: storage + C2 money DOM parity\n");
for (const seed of [
  { label: "plain single-restaurant cart", cart: {
      "Masala Dosa": { name: "Masala Dosa", price: 80, originalPrice: 100, quantity: 2, resId: RID, restaurantName: "Foodie Dosa Restaurant", isVeg: true },
  } },
  { label: "customized item + portion pricingMode item", cart: {
      [`${encodeURIComponent(JSON.stringify({ name: "Custom Thali", price: 120, resId: RID, menuItem: "m1", image: "", isVeg: true, options: [{ group: "Size", name: "Large", price: 20 }] }))}`]: {
        name: "Custom Thali", price: 140, originalPrice: 160, quantity: 1, resId: RID, restaurantName: "Foodie Dosa Restaurant", isVeg: true, pricingMode: "portion",
      },
      "Plain Idli": { name: "Plain Idli", price: 40, originalPrice: 50, quantity: 3, resId: RID, restaurantName: "Foodie Dosa Restaurant", isVeg: true },
  } },
]) {
  console.log(`-- ${seed.label}`);
  const storeSeed = {
    nearbite_cart: JSON.stringify(seed.cart),
    nearbite_cart_extras: JSON.stringify({ restaurantNote: "", restaurantNotes: {}, deliveryInstructions: "", tipAmount: 10 }),
  };
  const L = await snapshot(browser, legacyUrl, storeSeed);
  const N = await snapshot(browser, newUrl, storeSeed);

  // storage AFTER load (sanitizeLegacyCarts must not have changed it)
  check("nearbite_cart after load", L.ls.cart, N.ls.cart);
  check("nearbite_cart_extras after load", L.ls.extras, N.ls.extras);

  // C2-owned DOM
  check("item total row value", L.dom.itemTotalPair, N.dom.itemTotalPair);
  check("bill-subtotal text", L.dom.billSubtotal, N.dom.billSubtotal);
  check("bill-mrp text", L.dom.billMrp, N.dom.billMrp);
  check("bill-mrp hidden", L.dom.billMrpHidden, N.dom.billMrpHidden);
  check("tip row value", L.dom.tipVal, N.dom.tipVal);
  check("discount row value", L.dom.discountVal, N.dom.discountVal);
  check("tax row value", L.dom.taxVal, N.dom.taxVal);
  check("compact bill line", L.dom.compactLine, N.dom.compactLine);
  check("hero saved text", L.dom.heroSaved, N.dom.heroSaved);
  check("footer savings text", L.dom.footerSaveText, N.dom.footerSaveText);
  check("savings corner text", L.dom.savCornerText, N.dom.savCornerText);
  check("CTA label", L.dom.ctaLabel, N.dom.ctaLabel);
  // C3 (delivery fee) — asserted now that C3 is ported
  check("C3 delivery value", L.dom.deliveryVal, N.dom.deliveryVal);
  check("C3 delivery value class", L.dom.deliveryValClass, N.dom.deliveryValClass);
  check("C3 nudge class", L.dom.nudgeClass, N.dom.nudgeClass);
  check("C3 nudge display", L.dom.nudgeDisplay, N.dom.nudgeDisplay);
  check("C3 nudge text", L.dom.nudgeText, N.dom.nudgeText);
  check("C3 nudge sub", L.dom.nudgeSub, N.dom.nudgeSub);
  check("C3 nudge sub hidden", L.dom.nudgeSubHidden, N.dom.nudgeSubHidden);
  check("C3 nudge icon class (svg no-op)", L.dom.nudgeIconClass, N.dom.nudgeIconClass);
  check("C3 bill-per-restaurant display", L.dom.billPerRestaurantDisplay, N.dom.billPerRestaurantDisplay);
  check("C3 bill-per-restaurant html", L.dom.billPerRestaurantHtml, N.dom.billPerRestaurantHtml);
  // C4 (item rows) — asserted now that C4 is ported
  check("C4 items html (exact)", L.dom.itemsHtml, N.dom.itemsHtml);
  check("C4 items aria-busy", L.dom.itemsAriaBusy, N.dom.itemsAriaBusy);
  check("C4 restaurant group count", L.dom.groupCount, N.dom.groupCount);
  check("C4 row count", L.dom.rowCount, N.dom.rowCount);
  check("C4 visible restaurant header", L.dom.dhRestaurant, N.dom.dhRestaurant);
  check("C4 hidden restaurant name", L.dom.hiddenRestaurantName, N.dom.hiddenRestaurantName);
  // delivery-dependent (C3) — reported, not asserted
  note(`delivery fee row display: legacy ${L.dom.deliveryFeeRowDisplay} vs new ${N.dom.deliveryFeeRowDisplay}`);
  note(`To Pay: legacy ${L.dom.billTotal} vs new ${N.dom.billTotal}`);
  console.log("");
}

console.log("### Part 2 — direct C2 function parity (page.evaluate, identical inputs)\n");
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => {
    window.__EW_CART_TEST_HOOKS = true;
  });
  const lp = await ctx.newPage();
  await installFixtures(lp);
  await lp.goto(legacyUrl, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
  await lp.waitForTimeout(800);
  const lState = await lp.evaluate(STATE_PROBE);
  const lFn = await lp.evaluate(FN_PROBE, RID);
  const np = await ctx.newPage();
  await installFixtures(np);
  await np.goto(newUrl, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
  await np.waitForTimeout(800);
  const nState = await np.evaluate(STATE_PROBE);
  const nFn = await np.evaluate(FN_PROBE, RID);
  await ctx.close();
  check("state object present (legacy)", lState.hasState, true);
  check("state object present (new)", nState.hasState, true);

  for (const key of Object.keys(lFn)) {
    if (key === "cartGroups") continue;
    check(`fn ${key}`, lFn[key], nFn[key]);
  }
  check("fn ctCartGroups", lFn.cartGroups, nFn.cartGroups);
  console.log("");
}

console.log("### Part 2b — direct C3 delivery-function parity (page.evaluate)\n");
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => {
    window.__EW_CART_TEST_HOOKS = true;
  });
  const lp = await ctx.newPage();
  await installFixtures(lp);
  await lp.goto(legacyUrl, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
  await lp.waitForTimeout(800);
  const np = await ctx.newPage();
  await installFixtures(np);
  await np.goto(newUrl, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
  await np.waitForTimeout(800);
  const a = await lp.evaluate(C3_FN_PROBE, RID);
  const b = await np.evaluate(C3_FN_PROBE, RID);
  check("C3 applyDelivery branches", a.applyDelivery, b.applyDelivery);
  check("C3 renderMultiBreakdown html", a.multiBreakdownHtml, b.multiBreakdownHtml);
  check("C3 renderMultiBreakdown display", a.multiBreakdownDisplay, b.multiBreakdownDisplay);
  check("C3 applyMultiDelivery", a.multi, b.multi);
  check("C3 renderMultiBreakdown outside-radius html", a.multiOutsideHtml, b.multiOutsideHtml);
  await ctx.close();
  console.log("");
}

console.log("### Part 2c — C4 item interactions (qty +, -, remove, clear)\n");
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => {
    window.__EW_CART_TEST_HOOKS = true;
  });
  const lp = await ctx.newPage();
  await installFixtures(lp);
  await lp.goto(legacyUrl, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
  await lp.waitForTimeout(800);
  const np = await ctx.newPage();
  await installFixtures(np);
  await np.goto(newUrl, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
  await np.waitForTimeout(800);
  const a = await lp.evaluate(C4_FN_PROBE, RID);
  const b = await np.evaluate(C4_FN_PROBE, RID);
  for (const k of Object.keys(a)) check(`C4 ${k}`, a[k], b[k]);
  await ctx.close();
  console.log("");
}

console.log("### Part 3 — rounding edge cases\n");
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => {
    window.__EW_CART_TEST_HOOKS = true;
  });
  const lp = await ctx.newPage();
  await installFixtures(lp);
  await lp.goto(legacyUrl, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
  await lp.waitForTimeout(800);
  const np = await ctx.newPage();
  await installFixtures(np);
  await np.goto(newUrl, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
  await np.waitForTimeout(800);
  const lpState = await lp.evaluate(STATE_PROBE);
  const npState = await np.evaluate(STATE_PROBE);
  check("round: state object present (legacy)", lpState.hasState, true);
  check("round: state object present (new)", npState.hasState, true);
  for (const c of ROUND_CASES) {
    const a = await lp.evaluate(ROUND_PROBE, c);
    const b = await np.evaluate(ROUND_PROBE, c);
    check(`round: ${c.label}`, a, b);
  }
  await ctx.close();
  console.log("");
}

console.log("### Part 3b — malformed cart migrated by sanitizeLegacyCarts\n");
{
  const L = await migrateSnapshot(browser, legacyUrl);
  const N = await migrateSnapshot(browser, newUrl);
  check("malformed cart: reset dialog text", L.dialog, N.dialog);
  check("malformed cart: storage after migration", L.cart, N.cart);
  check("malformed cart: exactly one reload", L.reloads, N.reloads);
  console.log("");
}

console.log("### Part 4 — C3 delivery scenarios (fixture x address seed)\n");
{
  const scenarios = [
    { label: "GPS near (0.7km)", fixtures: "scripts/fixtures/cart-seeded.json", seed: "scripts/fixtures/seed-cart-near.json" },
    { label: "GPS 9.1km (under 10)", fixtures: "scripts/fixtures/cart-seeded.json", seed: "scripts/fixtures/seed-cart-boundary.json" },
    { label: "outside 10km radius", fixtures: "scripts/fixtures/cart-seeded.json", seed: "scripts/fixtures/seed-cart-plain.json" },
    { label: "restaurant radius 1km -> outside", fixtures: "scripts/fixtures/cart-outside.json", seed: "scripts/fixtures/seed-cart-near.json" },
    { label: "no restaurant GPS -> fallback", fixtures: "scripts/fixtures/cart-nogps.json", seed: "scripts/fixtures/seed-cart-plain.json" },
    { label: "free above not reached", fixtures: "scripts/fixtures/cart-freeabove.json", seed: "scripts/fixtures/seed-cart-near.json" },
    { label: "min order 1000", fixtures: "scripts/fixtures/cart-minorder.json", seed: "scripts/fixtures/seed-cart-near.json" },
    { label: "cod enabled", fixtures: "scripts/fixtures/cart-cod.json", seed: "scripts/fixtures/seed-cart-near.json" },
  ];
  for (const sc of scenarios) {
    const fx = JSON.parse(fs.readFileSync(resolveFixturesPath(sc.fixtures), "utf8"));
    const sd = JSON.parse(fs.readFileSync(resolveFixturesPath(sc.seed), "utf8"));
    const run = async (url) => {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await ctx.addInitScript((entries) => {
        try {
          for (const [k, v] of Object.entries(entries))
            window.localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
        } catch (e) {}
      }, sd);
      const page = await ctx.newPage();
      await page.route("https://api.eatswada.com/**", (route) => {
        const u = new URL(route.request().url());
        const path = u.pathname.replace(/^\/api/, "");
        const body = fx[path + u.search] !== undefined ? fx[path + u.search] : fx[path];
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
      await page.goto(url, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
      await page.waitForTimeout(1200);
      const dom = await page.evaluate(DOM_SNAP);
      await ctx.close();
      return dom;
    };
    const L = await run(legacyUrl);
    const N = await run(newUrl);
    check(`C3[${sc.label}] delivery value`, L.deliveryVal, N.deliveryVal);
    check(`C3[${sc.label}] delivery value class`, L.deliveryValClass, N.deliveryValClass);
    check(`C3[${sc.label}] nudge class`, L.nudgeClass, N.nudgeClass);
    check(`C3[${sc.label}] nudge display`, L.nudgeDisplay, N.nudgeDisplay);
    check(`C3[${sc.label}] nudge text`, L.nudgeText, N.nudgeText);
    check(`C3[${sc.label}] nudge sub`, L.nudgeSub, N.nudgeSub);
    check(`C3[${sc.label}] nudge sub hidden`, L.nudgeSubHidden, N.nudgeSubHidden);
    check(`C3[${sc.label}] nudge icon class`, L.nudgeIconClass, N.nudgeIconClass);
    check(`C3[${sc.label}] bill total`, L.billTotal, N.billTotal);
    check(`C3[${sc.label}] CTA label`, L.ctaLabel, N.ctaLabel);
  }
  console.log("");
}

/* ── Part 5 — C7 + C11 (payment selector, fee preview, banners, CTA) ──── */
await runPartA(browser, { legacyUrl, newUrl }, check);
await runPartB(browser, { legacyUrl, newUrl }, check);
await runPartC(browser, { legacyUrl, newUrl }, check);

/* ── Part 6 — C8 (address + profile hydration + lifecycle) ──────────────
   The C8 probes are shared with scripts/cart-c8-parity.mjs via
   lib/cart-c8.mjs so both harnesses stay in lockstep. `note` is threaded
   through so the C8 GET-count observations print without becoming checks. */
await runC8PartA(browser, { legacyUrl, newUrl }, check, note);
await runC8PartB(browser, { legacyUrl, newUrl }, check, note);
await runC8PartC(browser, { legacyUrl, newUrl }, check, note);
await runC8PartD(browser, { legacyUrl, newUrl }, check, note);
await runC8PartE(browser, { legacyUrl, newUrl }, check, note);

/* ── Part 7 — C9 (place-order + idempotency + Razorpay) ─────────────────
   The C9 probes are shared with scripts/cart-c9-parity.mjs via lib/cart-c9.mjs
   so both harnesses stay in lockstep. */
await runC9Probes(browser, { legacyUrl, newUrl }, check, note);

await browser.close();
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
if (fail) {
  console.log("Failed checks:\n  " + failures.join("\n  "));
  process.exit(1);
}
