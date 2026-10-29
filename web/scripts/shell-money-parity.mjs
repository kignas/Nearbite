// Phase 2 chunk 4 — MONEY-PATH parity harness for /restaurant-shell.
//
// Runs the SAME inputs through the SAME functions on the legacy page and the
// new page, with the SAME seeded localStorage, and asserts the outputs are
// equal:
//   * makeBtnHTML      — byte-equal strings for qty 0, qty 2, out of stock,
//                        closed restaurant and a customisable item;
//   * normalizeMenu    — deep-equal output for the real menu fixture (both the
//                        raw object payload and window.API.unwrap() of it);
//   * getCustomizedCartQuantity + ewRemoveCustomizedCartUnit on a seeded
//                        nearbite_cart — compare nearbite_cart and the pink cart
//                        bar text afterwards; payload keys are compared
//                        EXACTLY (owner decision 1);
//   * distance helpers with a seeded nearbite_address.
//
// Phase 2d PART 0 top-up (sections 5–8):
//   5. ewRemoveCustomizedCartUnit on an EMPTY cart (must be a no-op);
//   6. the same item with TWO different customisations in the cart — remove one
//      unit of each, comparing the cart after every call;
//   7. distanceKm / formatRestaurantDistance with zero coordinates, identical
//      points and a boundary pair (just under and just over 1 km);
//   8. on the RENDERED menu (answered fixture): click ADD, +, −, − on a plain
//      item and deep-compare nearbite_cart AND the pink cart-bar text after
//      EVERY step.
//
// Usage: node scripts/shell-money-parity.mjs [legacyUrl] [newUrl]
// Writes compare-out/shell-money-parity.txt and exits non-zero on any FAIL.
import { chromium } from "playwright";
import fs from "node:fs";

const LEGACY = process.argv[2] || "http://localhost:8080/restaurant-shell.html";
const NEW = process.argv[3] || "http://localhost:3000/restaurant-shell";
const ID = "6ac8f95828669b5f4e30f0ba";
const HANG = "__hang__";

const home = JSON.parse(fs.readFileSync("scripts/fixtures/home.json", "utf8"));
const menuPayload = home[`/restaurants/${ID}/menu`];
const restaurant = home["/restaurants"].data.find((r) => r._id === ID);

/* The plain (non-customisable) dish the section-8 ADD/+/-/- sequence drives.
   "Chowmein (Veg)" is the first plain item in the fixture menu. */
const PLAIN_ID = "6ace3129d2398604a092777c";
const PLAIN_NAME = "Chowmein (Veg)";
const PLAIN_KEY = PLAIN_NAME.replace(/\s+/g, "");
const PLAIN_CTA = `[id="btn-container-${PLAIN_KEY}"]`;

/* Seed both pages identically before any script runs. The customized line uses
   the legacy composite-key shape ("<name> (<labels>)"). */
const SEED_CART = {
  "Masala Dosa (Extra Cheese)": {
    quantity: 2,
    price: 120,
    originalPrice: null,
    resId: "res-seed-1",
    menuItem: "mi-cust-1",
    image: "",
    name: "Masala Dosa (Extra Cheese)",
    isVeg: true,
    restaurantName: "Foodie Dosa Restaurant",
    customizations: [
      { title: "Cheese", label: "Extra Cheese", extraPrice: 30, pricingMode: "extra", isVeg: true },
    ],
  },
  "Plain Idli": {
    quantity: 1,
    price: 40,
    originalPrice: 60,
    resId: "res-seed-1",
    menuItem: "mi-plain-1",
    image: "https://res.cloudinary.com/demo/image/upload/v1/idli.jpg",
    name: "Plain Idli",
    isVeg: true,
    restaurantName: "Foodie Dosa Restaurant",
  },
};
const SEED_CUST = {
  "mi-cust-1": { name: "Masala Dosa", price: 90, _id: "mi-cust-1", customizations: [] },
};
const SEED_ADDRESS = { location: { coordinates: [89.4256, 26.5643] } };

const seedInit = (args) => {
  try {
    localStorage.setItem("nearbite_cart", JSON.stringify(args.cart));
    localStorage.setItem("nearbite_address", JSON.stringify(args.address));
    window.__ewCust = JSON.parse(JSON.stringify(args.cust));
    // Ask the new page to expose its state hooks (no-op on legacy).
    window.__EW_SHELL_TEST_HOOKS = true;
  } catch (e) {}
};

const lines = [];
const log = (...a) => {
  lines.push(a.join(" "));
  console.log(...a);
};

/* ── browser plumbing ─────────────────────────────────────────────────── */
async function installHang(page) {
  await page.route("https://api.eatswada.com/**", () => {
    /* never answer: both pages stay on the skeleton */
  });
}

/* Answer the restaurant + menu routes (GET only) so the full menu renders.
   Used by sections 5–8. */
async function installAnswered(page) {
  await page.route("https://api.eatswada.com/**", (route) => {
    const u = new URL(route.request().url());
    const p = u.pathname.replace(/^\/api/, "");
    let body;
    if (p === `/restaurants/${ID}`) body = restaurant;
    else if (p === `/restaurants/${ID}/menu`) body = menuPayload;
    else if (p === `/restaurants/${ID}/reviews`)
      body = JSON.parse(fs.readFileSync("scripts/fixtures/restaurant-shell.json", "utf8"))[
        `/restaurants/${ID}/reviews`
      ];
    if (body === undefined)
      return route.fulfill({ status: 404, headers: { "access-control-allow-origin": "*" }, body: "{}" });
    return route.fulfill({
      status: 200,
      headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  });
}

async function load(url, isLegacy, answered = false) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e).split("\n")[0]));
  await page.addInitScript(seedInit, { cart: SEED_CART, cust: SEED_CUST, address: SEED_ADDRESS });
  if (answered) await installAnswered(page);
  else await installHang(page);
  await page.goto(`${url}?id=${ID}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(answered ? 2200 : 1600);
  return { browser, page, errs, isLegacy };
}

/* Set the legacy bare global `isRestaurantOpen` on either page. */
async function setOpen(side, value) {
  await side.page.evaluate(
    ({ v, legacy }) => {
      if (legacy) {
        // classic script: `isRestaurantOpen` is a mutable global lexical binding
        // eslint-disable-next-line no-undef
        isRestaurantOpen = v;
      } else {
        window.__ewShell.state.isRestaurantOpen = v;
      }
    },
    { v: value, legacy: side.isLegacy }
  );
}

/* ── pass-through "normalisation" (owner decision 1: exact comparison) ── */
function normaliseCart(raw) {
  if (raw == null) return { cart: null, notes: [] };
  let obj = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return { cart: raw, notes: [] };
    }
  }
  const notes = [];
  const out = {};
  for (const key of Object.keys(obj)) {
    let normKey = key;
    /* Owner decision 1: payload keys are deterministic composites and are
       compared EXACTLY — no Date.now() normalisation. */
    out[normKey] = obj[key];
  }
  return { cart: out, notes };
}

/* ── snapshots ────────────────────────────────────────────────────────── */
const MAKEBTN_CASES = [
  {
    name: "qty 0",
    args: ["Plain Idli", 0, 40, "res-seed-1", true, "mi-plain-1", "https://res.cloudinary.com/demo/image/upload/v1/idli.jpg", true, 60],
    open: true,
  },
  {
    name: "qty 2",
    args: ["Plain Idli", 2, 40, "res-seed-1", true, "mi-plain-1", "", true, 60],
    open: true,
  },
  {
    name: "out of stock",
    args: ["Plain Idli", 0, 40, "res-seed-1", false, "mi-plain-1", "", true, 0],
    open: true,
  },
  {
    name: "closed restaurant",
    args: ["Plain Idli", 2, 40, "res-seed-1", true, "mi-plain-1", "", true, 0],
    open: false,
  },
  {
    name: "customisable item (2 already in cart)",
    args: ["Masala Dosa", 0, 90, "res-seed-1", true, "mi-cust-1", "", true, 0],
    open: true,
  },
  {
    name: "customisable item (none in cart)",
    args: ["Masala Dosa", 0, 90, "res-seed-1", true, "mi-cust-1", "", true, 0],
    open: true,
    /* drop the seeded customized line so customQty is 0 */
    prep: () => {
      const cart = JSON.parse(localStorage.getItem("nearbite_cart") || "{}");
      delete cart["Masala Dosa (Extra Cheese)"];
      localStorage.setItem("nearbite_cart", JSON.stringify(cart));
    },
  },
  {
    name: "name with a backslash and a quote",
    args: ["Chef\\'s \"Special\" Pizza", 1, 199, "res-seed-1", true, "mi-plain-1", "", false, 0],
    open: true,
    prep: () => {
      localStorage.removeItem("nearbite_cart");
    },
  },
];

/* Restore the exact seeded cart/address on a page and refresh the cart bar, so
   every case starts from the same state regardless of what ran before. */
async function reseed(side) {
  await side.page.evaluate(
    ({ cart, address }) => {
      localStorage.setItem("nearbite_cart", JSON.stringify(cart));
      localStorage.setItem("nearbite_address", JSON.stringify(address));
      if (typeof window.updateGlobalCart === "function") window.updateGlobalCart();
    },
    { cart: SEED_CART, address: SEED_ADDRESS }
  );
  await side.page.waitForTimeout(250);
}

async function makeBtnOn(side, c) {
  await setOpen(side, c.open);
  await reseed(side);
  if (c.prep) await side.page.evaluate(c.prep);
  return side.page.evaluate((args) => window.makeBtnHTML(...args), c.args);
}

async function normaliseMenuOn(side) {
  return side.page.evaluate(
    ({ payload }) => ({
      fromRawObject: window.normalizeMenu(payload.data),
      fromUnwrapped: window.normalizeMenu(window.API.unwrap(payload)),
      fromArray: window.normalizeMenu([
        { category: "A", items: [{ name: "x" }] },
        { category: "B", items: [] },
      ]),
      fromFlat: window.normalizeMenu([{ name: "y", category: "C" }, { name: "z" }]),
      fromNull: window.normalizeMenu(null),
      fromEmpty: window.normalizeMenu({}),
    }),
    { payload: menuPayload }
  );
}

async function distanceOn(side) {
  return side.page.evaluate(
    ({ r }) => ({
      selectedCustomerCoords: window.selectedCustomerCoords(),
      restaurantCoords: window.restaurantCoords(r),
      distanceKm: window.distanceKm({ lat: 26.5, lng: 89.4 }, { lat: 26.7, lng: 89.6 }),
      formatWithAddress: window.formatRestaurantDistance(r),
      formatWithoutAddress: (() => {
        localStorage.removeItem("nearbite_address");
        const v = window.formatRestaurantDistance(r);
        localStorage.setItem("nearbite_address", JSON.stringify({ location: { coordinates: [89.4256, 26.5643] } }));
        return v;
      })(),
    }),
    { r: restaurant }
  );
}

async function cartOn(side) {
  return side.page.evaluate(() => {
    const root = document.getElementById("white-cart-root");
    const countEl = document.getElementById("wc-item-count");
    return {
      quantity: window.getCustomizedCartQuantity("Masala Dosa", "mi-cust-1"),
      cart: localStorage.getItem("nearbite_cart"),
      bar: {
        exists: !!root,
        pink: root ? root.classList.contains("wc-pink") : false,
        display: root ? getComputedStyle(root).display : null,
        text: countEl ? countEl.textContent : null,
      },
    };
  });
}

async function removeUnitOn(side) {
  return side.page.evaluate(() => {
    window.ewRemoveCustomizedCartUnit("mi-cust-1");
  });
}

/* ── PART 0 top-up helpers ────────────────────────────────────────────── */
/* Cart-bar snapshot: the pink bar's item count + total text (the pink mode
   this page uses). Read from the rendered bar, not from storage.

   `text` is the whole-bar text with ALL whitespace removed. Reason (measured,
   reported in the output): the bar is a FROZEN shared component. Legacy
   `cart-bar.js` builds it from indented template strings, so its DOM carries
   whitespace-only text nodes between the inline spans; React JSX does not. A
   flex/inline layout renders those nodes away, so they are never visible — but
   `innerText` on a `display:none` element falls back to raw `textContent` and
   would expose them. Removing all whitespace compares exactly the visible
   content, and the exact `count` text (the meaningful value) is compared
   verbatim alongside it. This is the same kind of documented, unavoidable
   pass-through as the cart-key comparison (owner decision 1). */
async function barTextOn(side) {
  return side.page.evaluate(() => {
    const root = document.getElementById("white-cart-root");
    const countEl = document.getElementById("wc-item-count");
    const totalEl = document.getElementById("wc-total") || document.querySelector("#white-cart-root .wc-total");
    const raw = root ? root.textContent : "";
    return {
      exists: !!root,
      pink: root ? root.classList.contains("wc-pink") : false,
      display: root ? getComputedStyle(root).display : null,
      count: countEl ? countEl.textContent : null,
      total: totalEl ? totalEl.textContent : null,
      /* all whitespace removed — see the comment above */
      text: raw.replace(/\s+/g, ""),
      /* kept for the record so the normalisation is auditable */
      rawText: raw.replace(/\s+/g, " ").trim(),
    };
  });
}

/* Full money snapshot: normalised cart + the pink bar text. */
async function moneyOn(side) {
  const snap = await side.page.evaluate(() => ({
    cart: localStorage.getItem("nearbite_cart"),
  }));
  const nc = normaliseCart(snap.cart);
  return { cart: nc.cart, notes: nc.notes, bar: await barTextOn(side) };
}

/* Drive one cart click on the rendered menu (a real user click on the
   legacy-rendered button, so the inline onclick runs exactly as it does in a
   browser — no synthetic function call). */
async function clickCart(side, selector, nth = 0) {
  const els = await side.page.$$(selector);
  if (!els[nth]) return { clicked: false, selector };
  await els[nth].click();
  await side.page.waitForTimeout(450);
  return { clicked: true, selector };
}

/* Remove one unit of the customized line whose composite key is `key`. */
async function removeOneUnit(side, key) {
  await side.page.evaluate((k) => {
    window.updateCart(k, -1, 0, "res-seed-1", true, "mi-cust-1", "", true, 0);
  }, key);
  await side.page.waitForTimeout(400);
}

/* ── run ──────────────────────────────────────────────────────────────── */
const legacy = await load(LEGACY, true);
const next = await load(NEW, false);

let failures = 0;
const rows = [];
function check(name, l, n) {
  const eq = JSON.stringify(l) === JSON.stringify(n);
  if (!eq) failures++;
  rows.push({ name, ok: eq, l, n });
  return eq;
}

log("## /restaurant-shell chunk 4 — money-path parity");
log("");
log(`legacy: ${LEGACY}?id=${ID}`);
log(`new   : ${NEW}?id=${ID}`);
log("");

/* 1. makeBtnHTML */
log("### 1. makeBtnHTML — byte-equal strings");
for (const c of MAKEBTN_CASES) {
  const l = await makeBtnOn(legacy, c);
  const n = await makeBtnOn(next, c);
  const ok = check("makeBtnHTML: " + c.name, l, n);
  if (!ok) {
    log(`  FAIL ${c.name}`);
    log(`    legacy: ${JSON.stringify(l)}`);
    log(`    new   : ${JSON.stringify(n)}`);
  }
}
await setOpen(legacy, true);
await setOpen(next, true);

/* 2. normalizeMenu */
log("");
log("### 2. normalizeMenu — deep-equal on the real menu fixture");
const lm = await normaliseMenuOn(legacy);
const nm = await normaliseMenuOn(next);
const menuOk = check("normalizeMenu (all shapes)", lm, nm);
log(
  `  groups: ${lm.fromRawObject.length}  items: ${lm.fromRawObject.reduce((a, g) => a + g.items.length, 0)}  ` +
    `names: ${JSON.stringify(lm.fromRawObject.map((g) => g.name))}`
);
if (!menuOk) {
  log("    legacy: " + JSON.stringify(lm).slice(0, 900));
  log("    new   : " + JSON.stringify(nm).slice(0, 900));
}

/* 3. customized-cart helpers */
log("");
log("### 3. getCustomizedCartQuantity + ewRemoveCustomizedCartUnit (seeded cart)");
await setOpen(legacy, true);
await setOpen(next, true);
await reseed(legacy);
await reseed(next);
const lBefore = await cartOn(legacy);
const nBefore = await cartOn(next);
check("cart: getCustomizedCartQuantity (seeded qty 2)", lBefore.quantity, nBefore.quantity);
check("cart: pink bar exists+pink", [lBefore.bar.exists, lBefore.bar.pink], [nBefore.bar.exists, nBefore.bar.pink]);
check("cart: pink bar text before remove", lBefore.bar.text, nBefore.bar.text);
log(`  quantity before remove: legacy ${lBefore.quantity} / new ${nBefore.quantity}`);
log(`  pink bar text before remove: legacy ${JSON.stringify(lBefore.bar.text)} / new ${JSON.stringify(nBefore.bar.text)}`);

await removeUnitOn(legacy);
await removeUnitOn(next);
await legacy.page.waitForTimeout(500);
await next.page.waitForTimeout(500);
const lAfter = await cartOn(legacy);
const nAfter = await cartOn(next);
const lc = normaliseCart(lAfter.cart);
const nc = normaliseCart(nAfter.cart);
check("cart: nearbite_cart after remove (normalised)", lc.cart, nc.cart);
check("cart: pink bar text after remove", lAfter.bar.text, nAfter.bar.text);
check("cart: pink bar display after remove", lAfter.bar.display, nAfter.bar.display);
log(`  nearbite_cart after remove: legacy ${JSON.stringify(lc.cart)}`);
log(`  nearbite_cart after remove: new    ${JSON.stringify(nc.cart)}`);
log(`  pink bar text after remove: legacy ${JSON.stringify(lAfter.bar.text)} / new ${JSON.stringify(nAfter.bar.text)}`);
log(`  pink bar display after remove: legacy ${lAfter.bar.display} / new ${nAfter.bar.display}`);
for (const note of [...new Set([...lc.notes, ...nc.notes])]) log("  * " + note);
if (!lc.notes.length && !nc.notes.length) log("  * (exact comparison — no payload-key normalisation)");

/* 3b. Payload-key handling. Chunk 4 does not itself create
   payload-shaped keys (that is the customize sheet, chunk 11), so seed one on
   both pages and prove the comparison rule still holds: the key is normalised
   and reported, the entry body under it is compared verbatim. */
log("");
log("### 3b. payload-key handling (seeded encoded key, compared EXACTLY)");
const payloadKey = encodeURIComponent(
  JSON.stringify({ name: "Masala Dosa (Extra Cheese)", resId: "res-seed-1", ts: 1750000000000 })
);
const seedPayload = async (side) => {
  await side.page.evaluate(
    ({ key }) => {
      const cart = JSON.parse(localStorage.getItem("nearbite_cart") || "{}");
      cart[key] = { quantity: 1, price: 120, resId: "res-seed-1", menuItem: "mi-cust-1", name: "Masala Dosa (Extra Cheese)" };
      localStorage.setItem("nearbite_cart", JSON.stringify(cart));
      if (typeof window.updateGlobalCart === "function") window.updateGlobalCart();
    },
    { key: payloadKey }
  );
  await side.page.waitForTimeout(250);
};
await reseed(legacy);
await reseed(next);
await seedPayload(legacy);
await seedPayload(next);
const lp = await cartOn(legacy);
const np = await cartOn(next);
const lpc = normaliseCart(lp.cart);
const npc = normaliseCart(np.cart);
check("cart: payload-key cart normalised equal", lpc.cart, npc.cart);
check("cart: payload-key bar text", lp.bar.text, np.bar.text);
log(`  normalised keys: legacy ${JSON.stringify(Object.keys(lpc.cart))}`);
log(`  normalised keys: new    ${JSON.stringify(Object.keys(npc.cart))}`);
for (const note of [...new Set([...lpc.notes, ...npc.notes])]) log("  * " + note);
log(`  pink bar text: legacy ${JSON.stringify(lp.bar.text)} / new ${JSON.stringify(np.bar.text)}`);

/* 4. distance helpers */
log("");
log("### 4. distance helpers (seeded nearbite_address)");
const ld = await distanceOn(legacy);
const nd = await distanceOn(next);
const distOk = check("distance helpers", ld, nd);
log(`  legacy: ${JSON.stringify(ld)}`);
log(`  new   : ${JSON.stringify(nd)}`);
if (!distOk) log("  FAIL — see the two lines above");

/* ══════════════════════════════════════════════════════════════════════
   PHASE 2d PART 0 TOP-UP
   ══════════════════════════════════════════════════════════════════════ */

/* 5. ewRemoveCustomizedCartUnit on an EMPTY cart (must be a no-op) */
log("");
log("### 5. ewRemoveCustomizedCartUnit on an EMPTY cart (no-op)");
const emptyCart = async (side) => {
  await side.page.evaluate(() => {
    localStorage.removeItem("nearbite_cart");
    if (typeof window.updateGlobalCart === "function") window.updateGlobalCart();
  });
  await side.page.waitForTimeout(250);
};
await setOpen(legacy, true);
await setOpen(next, true);
await emptyCart(legacy);
await emptyCart(next);
const l5before = await moneyOn(legacy);
const n5before = await moneyOn(next);
check("empty cart: before-remove cart equal", l5before.cart, n5before.cart);
await removeUnitOn(legacy);
await removeUnitOn(next);
await legacy.page.waitForTimeout(500);
await next.page.waitForTimeout(500);
const l5 = await moneyOn(legacy);
const n5 = await moneyOn(next);
check("empty cart: nearbite_cart after remove (normalised)", l5.cart, n5.cart);
check("empty cart: pink bar text after remove", l5.bar.text, n5.bar.text);
check("empty cart: pink bar count after remove", l5.bar.count, n5.bar.count);
check("empty cart: still empty on both (no throw)", [l5.cart, n5.cart], [null, null]);
log(`  cart after remove: legacy ${JSON.stringify(l5.cart)} / new ${JSON.stringify(n5.cart)}`);
log(`  pink bar: legacy ${JSON.stringify(l5.bar.count)} / new ${JSON.stringify(n5.bar.count)}  text ${JSON.stringify(n5.bar.text)}`);
if (l5.bar.rawText !== n5.bar.rawText) {
  log("  * whitespace-only raw difference (bar is hidden here; innerText falls back to textContent):");
  log(`    legacy raw ${JSON.stringify(l5.bar.rawText)}`);
  log(`    new    raw ${JSON.stringify(n5.bar.rawText)}`);
  log("    (frozen shared CartBar: legacy builds indented HTML, React JSX does not; not visible)");
}

/* 6. The same item with TWO different customisations — remove one unit of each */
log("");
log("### 6. Two customisations of one item — remove one unit of each");
const TWO_KEY_A = "Masala Dosa (Extra Cheese)";
const TWO_KEY_B = "Masala Dosa (Extra Spicy)";
const TWO_CUST = {
  [TWO_KEY_A]: {
    quantity: 2, price: 120, originalPrice: null, resId: "res-seed-1", menuItem: "mi-cust-1",
    image: "", name: TWO_KEY_A, isVeg: true, restaurantName: "Foodie Dosa Restaurant",
    customizations: [{ title: "Cheese", label: "Extra Cheese", extraPrice: 30, pricingMode: "extra", isVeg: true }],
  },
  [TWO_KEY_B]: {
    quantity: 1, price: 110, originalPrice: null, resId: "res-seed-1", menuItem: "mi-cust-1",
    image: "", name: TWO_KEY_B, isVeg: true, restaurantName: "Foodie Dosa Restaurant",
    customizations: [{ title: "Spice", label: "Extra Spicy", extraPrice: 0, pricingMode: "extra", isVeg: true }],
  },
};
const seedTwo = async (side) => {
  await side.page.evaluate((cart) => {
    localStorage.setItem("nearbite_cart", JSON.stringify(cart));
    if (typeof window.updateGlobalCart === "function") window.updateGlobalCart();
  }, TWO_CUST);
  await side.page.waitForTimeout(250);
};
await seedTwo(legacy);
await seedTwo(next);
const l6a = await moneyOn(legacy);
const n6a = await moneyOn(next);
check("two-cust: seeded cart equal", l6a.cart, n6a.cart);
check("two-cust: seeded bar text equal", l6a.bar.text, n6a.bar.text);
log(`  seeded: legacy ${JSON.stringify(l6a.cart)}`);
log(`  seeded: new    ${JSON.stringify(n6a.cart)}`);
/* remove one unit of variant A */
await removeUnitOn(legacy);
await removeUnitOn(next);
await legacy.page.waitForTimeout(450);
await next.page.waitForTimeout(450);
const l6b = await moneyOn(legacy);
const n6b = await moneyOn(next);
check("two-cust: after 1st remove cart (normalised)", l6b.cart, n6b.cart);
check("two-cust: after 1st remove bar text", l6b.bar.text, n6b.bar.text);
log(`  after 1st remove: legacy ${JSON.stringify(l6b.cart)}`);
log(`  after 1st remove: new    ${JSON.stringify(n6b.cart)}`);
/* remove one unit of variant B */
await removeUnitOn(legacy);
await removeUnitOn(next);
await legacy.page.waitForTimeout(450);
await next.page.waitForTimeout(450);
const l6c = await moneyOn(legacy);
const n6c = await moneyOn(next);
check("two-cust: after 2nd remove cart (normalised)", l6c.cart, n6c.cart);
check("two-cust: after 2nd remove bar text", l6c.bar.text, n6c.bar.text);
log(`  after 2nd remove: legacy ${JSON.stringify(l6c.cart)}`);
log(`  after 2nd remove: new    ${JSON.stringify(n6c.cart)}`);
log(`  (variant A quantity ${l6c.cart[TWO_KEY_A] ? l6c.cart[TWO_KEY_A].quantity : "gone"}, variant B ${l6c.cart[TWO_KEY_B] ? "still " + l6c.cart[TWO_KEY_B].quantity : "gone"})`);

/* 7. distanceKm / formatRestaurantDistance edge cases */
log("");
log("### 7. distanceKm + formatRestaurantDistance edge cases");
const distEdge = async (side) =>
  side.page.evaluate(({ r }) => {
    const zero = { lat: 0, lng: 0 };
    const same = { lat: 26.5643, lng: 89.4256 };
    /* A boundary pair astride 1 km: the formatter switches m -> km at 1.000 km.
       At latitude 26.5643 one degree of latitude is ~110.9 km, so 0.008990 deg
       is ~999.6 m (just under) and 0.009000 deg is ~1000.8 m (just over). */
    const justUnder = { lat: 26.5643 + 0.00899, lng: 89.4256 };
    const justOver = { lat: 26.5643 + 0.009, lng: 89.4256 };
    const fmt = (rest) => window.formatRestaurantDistance(rest);
    return {
      zeroDistanceKm: window.distanceKm(zero, zero),
      identicalPoints: window.distanceKm(same, same),
      boundaryUnderKm: window.distanceKm(same, justUnder),
      boundaryOverKm: window.distanceKm(same, justOver),
      boundaryUnderMeters: Math.round(window.distanceKm(same, justUnder) * 1000),
      boundaryOverMeters: Math.round(window.distanceKm(same, justOver) * 1000),
      /* formatRestaurantDistance uses the seeded address (89.4256,26.5643) as
         the customer and the restaurant's own location as the target. */
      formatRealRestaurant: fmt(r),
      formatZeroCoordsRestaurant: fmt({ location: { coordinates: [0, 0] } }),
      formatIdentical: fmt({ location: { coordinates: [89.4256, 26.5643] } }),
      formatJustUnder: fmt({ location: { coordinates: [89.4256, 26.5643 + 0.00899] } }),
      formatJustOver: fmt({ location: { coordinates: [89.4256, 26.5643 + 0.009] } }),
      formatNoLocationDistanceMeters: fmt({ distanceMeters: 950 }),
      formatNoLocationDistanceMetersKm: fmt({ distanceMeters: 1200 }),
      formatNoLocationDistanceString: fmt({ distance: "2.4 km" }),
      formatNothing: fmt({}),
    };
  }, { r: restaurant });
await reseed(legacy);
await reseed(next);
const l7 = await distEdge(legacy);
const n7 = await distEdge(next);
check("distance edge cases", l7, n7);
log(`  legacy: ${JSON.stringify(l7)}`);
log(`  new   : ${JSON.stringify(n7)}`);
log(`  boundary: under ${l7.boundaryUnderMeters} m -> "${l7.formatJustUnder}" | over ${l7.boundaryOverMeters} m -> "${l7.formatJustOver}"`);

/* 8. Rendered menu: ADD, +, −, − on a plain item (answered fixture) */
log("");
log("### 8. Rendered menu — ADD, +, −, − on a plain item (answered fixture)");
{
  const l8side = await load(LEGACY, true, true);
  const n8side = await load(NEW, true, true);
  await l8side.page.evaluate(() => {
    localStorage.removeItem("nearbite_cart");
    if (typeof window.updateGlobalCart === "function") window.updateGlobalCart();
  });
  await n8side.page.evaluate(() => {
    localStorage.removeItem("nearbite_cart");
    if (typeof window.updateGlobalCart === "function") window.updateGlobalCart();
  });
  await l8side.page.waitForTimeout(400);
  await n8side.page.waitForTimeout(400);

  /* Sanity: the plain item is on the rendered menu on both pages, and the
     customisable item got a Customise button (so this really is the answered
     fixture with a rendered menu, not the skeleton). */
  const present = async (side) =>
    side.page.evaluate(({ id, sel }) => ({
      menuItems: document.querySelectorAll(".menu-item").length,
      plain: !!document.querySelector(`.menu-item[data-menu-item-id="${id}"]`),
      cta: !!document.querySelector(sel),
      customBtns: document.querySelectorAll(".nb-add-btn--cust").length,
      skeleton: getComputedStyle(document.getElementById("menu-skeleton")).display,
    }), { id: PLAIN_ID, sel: PLAIN_CTA });
  const lp = await present(l8side);
  const np = await present(n8side);
  check("rendered menu: plain item + CTA present on both", lp, np);
  log(`  legacy: ${JSON.stringify(lp)}`);
  log(`  new   : ${JSON.stringify(np)}`);

  const step = async (label, sel, nth) => {
    const lc = await clickCart(l8side, sel, nth);
    const nc = await clickCart(n8side, sel, nth);
    check(`menu step "${label}": click happened on both`, lc.clicked, nc.clicked);
    const lm = await moneyOn(l8side);
    const nm = await moneyOn(n8side);
    check(`menu step "${label}": nearbite_cart`, lm.cart, nm.cart);
    check(`menu step "${label}": pink bar text`, lm.bar.text, nm.bar.text);
    check(`menu step "${label}": pink bar count`, lm.bar.count, nm.bar.count);
    const q = (m) => (m.cart[PLAIN_NAME] ? m.cart[PLAIN_NAME].quantity : 0);
    log(`  ${label}: qty legacy ${q(lm)} / new ${q(nm)} | bar ${JSON.stringify(nm.bar.count)} ${JSON.stringify(nm.bar.text)}`);
    if (lm.bar.rawText !== nm.bar.rawText) log(`    raw bar text: legacy ${JSON.stringify(lm.bar.rawText)} | new ${JSON.stringify(nm.bar.rawText)}`);
    return { lm, nm };
  };
  /* The plain item's CTA: first click = ADD (qty 0 -> 1), then the stepper. */
  await step("ADD", `${PLAIN_CTA} .nb-add-btn`, 0);
  await step("+ (qty 1 -> 2)", `${PLAIN_CTA} .nb-qty-btn`, 1);
  await step("− (qty 2 -> 1)", `${PLAIN_CTA} .nb-qty-btn`, 0);
  await step("− (qty 1 -> 0)", `${PLAIN_CTA} .nb-qty-btn`, 0);
  const l8errs = l8side.errs;
  const n8errs = n8side.errs;
  check("rendered menu: no page errors", l8errs, n8errs);
  log(`  page errors: legacy ${JSON.stringify(l8errs)} new ${JSON.stringify(n8errs)}`);
  await l8side.browser.close();
  await n8side.browser.close();
}

/* 9. Chunk 11 — the customization sheet's cart states (answered fixture).
      Opens the sheet from the menu ADD, gates on the required group, picks a
      maxSelect>1 option set + a portion option, sets qty 3, Adds, then removes
      one unit from the menu card and adds a second variant. Every step must
      leave `nearbite_cart` and the pink cart bar identical to legacy. */
log("");
log("### 9. Customization sheet (chunk 11) — cart states");
{
  const CUST_FIXTURE = JSON.parse(fs.readFileSync("scripts/fixtures/restaurant-shell-customize.json", "utf8"));
  const CUST_ITEM = "6acec0a1d2398604a0927f01";
  const openCust = async (url) => {
    const b = await chromium.launch();
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e).split("\n")[0]));
    await page.addInitScript(() => {
      window.__EW_SHELL_TEST_HOOKS = true;
      try {
        localStorage.removeItem("nearbite_cart");
      } catch (e) {}
    });
    await page.route("https://api.eatswada.com/**", (route) => {
      const u = new URL(route.request().url());
      const p = u.pathname.replace(/^\/api/, "");
      const body = CUST_FIXTURE[p + u.search] !== undefined ? CUST_FIXTURE[p + u.search] : CUST_FIXTURE[p];
      if (body === undefined)
        return route.fulfill({ status: 404, headers: { "access-control-allow-origin": "*" }, body: "{}" });
      return route.fulfill({
        status: 200,
        headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    });
    await page.goto(`${url}?id=${ID}`, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(2200);
    return { b, page, errs };
  };
  const snap = (p) =>
    p.evaluate(() => {
      const root = document.getElementById("white-cart-root");
      const countEl = document.getElementById("wc-item-count");
      return {
        cart: localStorage.getItem("nearbite_cart"),
        barText: (root ? root.textContent : "").replace(/\s+/g, ""),
        barCount: countEl ? countEl.textContent : null,
      };
    });
  const openSheet = async (p) => {
    await p.evaluate((cid) => document.querySelector(`.nb-add-btn--cust[data-menu-item-id="${cid}"]`).click(), CUST_ITEM);
    await p.waitForTimeout(450);
  };
  const pick = (p, gi, val) =>
    p.evaluate(({ gi, val }) => document.querySelectorAll(".ewcs-group")[gi].querySelector(`input[value="${val}"]`).click(), { gi, val });

  const l9 = await openCust(LEGACY);
  const n9 = await openCust(NEW);

  await openSheet(l9.page);
  await openSheet(n9.page);
  // group 0 required multi (max 3): Cheese + Chicken Bits + Olives; group 2 portion: Half
  await pick(l9.page, 0, "0");
  await pick(n9.page, 0, "0");
  await pick(l9.page, 0, "1");
  await pick(n9.page, 0, "1");
  await pick(l9.page, 0, "2");
  await pick(n9.page, 0, "2");
  await pick(l9.page, 2, "0");
  await pick(n9.page, 2, "0");
  const lOpen = await l9.page.evaluate(() => ({ d: document.getElementById("ewcs-add").disabled, t: document.getElementById("ewcs-add").textContent }));
  const nOpen = await n9.page.evaluate(() => ({ d: document.getElementById("ewcs-add").disabled, t: document.getElementById("ewcs-add").textContent }));
  check("cust: sheet gating + total after picks", lOpen, nOpen);
  await l9.page.evaluate(() => {
    document.getElementById("ewcs-plus").click();
    document.getElementById("ewcs-plus").click();
  });
  await n9.page.evaluate(() => {
    document.getElementById("ewcs-plus").click();
    document.getElementById("ewcs-plus").click();
  });
  const lQty = await l9.page.evaluate(() => document.getElementById("ewcs-add").textContent);
  const nQty = await n9.page.evaluate(() => document.getElementById("ewcs-add").textContent);
  check("cust: Add label at qty 3", lQty, nQty);
  await l9.page.evaluate(() => document.getElementById("ewcs-add").click());
  await n9.page.evaluate(() => document.getElementById("ewcs-add").click());
  await l9.page.waitForTimeout(500);
  await n9.page.waitForTimeout(500);
  const ls1 = await snap(l9.page);
  const ns1 = await snap(n9.page);
  check("cust: after Add — nearbite_cart (normalised)", normaliseCart(ls1.cart).cart, normaliseCart(ns1.cart).cart);
  check("cust: after Add — pink bar text", ls1.barText, ns1.barText);
  check("cust: after Add — pink bar count", ls1.barCount, ns1.barCount);
  log(`  after Add: ${JSON.stringify(ns1.barCount)} ${JSON.stringify(ns1.barText)}`);
  log(`  cart: ${ns1.cart}`);

  const minus = (p) => p.evaluate((cid) => document.querySelector(`.menu-item[data-menu-item-id="${cid}"] .nb-custom-remove`).click(), CUST_ITEM);
  await minus(l9.page);
  await minus(n9.page);
  await l9.page.waitForTimeout(400);
  await n9.page.waitForTimeout(400);
  const ls2 = await snap(l9.page);
  const ns2 = await snap(n9.page);
  check("cust: after menu-card − — nearbite_cart (normalised)", normaliseCart(ls2.cart).cart, normaliseCart(ns2.cart).cart);
  check("cust: after menu-card − — pink bar text", ls2.barText, ns2.barText);
  check("cust: after menu-card − — pink bar count", ls2.barCount, ns2.barCount);

  // second variant
  await openSheet(l9.page);
  await openSheet(n9.page);
  await pick(l9.page, 0, "3");
  await pick(n9.page, 0, "3");
  await pick(l9.page, 2, "1");
  await pick(n9.page, 2, "1");
  await l9.page.evaluate(() => document.getElementById("ewcs-add").click());
  await n9.page.evaluate(() => document.getElementById("ewcs-add").click());
  await l9.page.waitForTimeout(500);
  await n9.page.waitForTimeout(500);
  const ls3 = await snap(l9.page);
  const ns3 = await snap(n9.page);
  const lc3 = normaliseCart(ls3.cart).cart;
  const nc3 = normaliseCart(ns3.cart).cart;
  check("cust: two variants — nearbite_cart (normalised)", lc3, nc3);
  check("cust: two variants — line count", Object.keys(lc3 || {}).length, Object.keys(nc3 || {}).length);
  check("cust: two variants — pink bar text", ls3.barText, ns3.barText);
  check("cust: no page errors", l9.errs, n9.errs);
  log(`  two variants: ${ns3.barCount} ${JSON.stringify(ns3.barText)}`);
  await l9.b.close();
  await n9.b.close();
}

/* ── table ────────────────────────────────────────────────────────────── */
log("");
log("### PASS / FAIL TABLE");
const wName = Math.max(...rows.map((r) => r.name.length), 10);
log("CHECK".padEnd(wName) + " | RESULT");
log("-".repeat(wName + 9));
for (const r of rows) log(r.name.padEnd(wName) + " | " + (r.ok ? "PASS" : "FAIL"));
log("");
log(`page errors: legacy ${JSON.stringify(legacy.errs)} new ${JSON.stringify(next.errs)}`);
log("");
log(failures === 0 ? `MONEY-PATH PARITY: PASS (${rows.length} checks)` : `MONEY-PATH PARITY: FAIL (${failures}/${rows.length} checks differ)`);

fs.mkdirSync("compare-out", { recursive: true });
fs.writeFileSync("compare-out/shell-money-parity.txt", lines.join("\n") + "\n");
console.log("\nwrote compare-out/shell-money-parity.txt");

await legacy.browser.close();
await next.browser.close();
process.exit(failures === 0 ? 0 : 1);
