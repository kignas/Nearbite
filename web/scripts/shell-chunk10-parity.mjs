// Phase 2e chunk 10 — side-by-side parity harness for /restaurant-shell.
//
// Chunk 10 = legacy `restaurant-shell.html` L2686–3107: the (dead) inline search
// row, the minimum-order / free-delivery hint, the cart hook, the document
// Escape handler, the menu/info tab swipe gestures and `toggleCategory`.
//
// Runs the LEGACY page and the NEW page with the SAME answered fixtures, seeds
// the SAME localStorage, calls the SAME functions with the SAME inputs and
// compares the results:
//
//   A. cartSubtotalForRestaurant — direct call over 6 seeded carts;
//   B. getFreeDeliveryThreshold / firstPositiveNumber / money;
//   C. renderOrderHint — `#order-hint` outerHTML + hidden + classes at
//      subtotals 0 / below-min / between-min-and-free / at-free;
//   D. checkFreeDeliveryCrossed — return value + `#ew-free-delivery-toast`
//      `.show`, then the 3.2 s auto-hide;
//   E. tab gestures — `.menu-tab-indicator` geometry, `ewSyncTabIndicator`,
//      clicking the Info tab, a synthetic swipe commit, ArrowLeft/ArrowRight;
//   F. Escape order — full-screen search, then the (dead) inline row;
//   G. the dead inline search row — syncSearchClearButton / onMenuSearchInput /
//      clearMenuSearch / closeMenuSearch;
//   H. toggleCategory collapse;
//   I. the cart hook — `window.updateCart.__ewHinted`, single wrap, and
//      `nearbite_cart` + `#order-hint` unchanged after a real ADD / − click.
//
// The order-hint tests use a restaurant fixture whose `minimumOrder` (200) and
// `freeDeliveryAbove` (500) are explicit, because the recorded fixture's real
// values (minOrder 1, freeDeliveryAbove 1) are already met by any subtotal.
//
// Usage: node scripts/shell-chunk10-parity.mjs [legacyUrl] [newUrl]
// Writes compare-out/shell-chunk10-parity.txt and exits non-zero on any FAIL.
import { chromium } from "playwright";
import fs from "node:fs";

const LEGACY = process.argv[2] || "http://localhost:8080/restaurant-shell";
const NEW = process.argv[3] || "http://localhost:3000/restaurant-shell";
const ID = "6ac8f95828669b5f4e30f0ba";

const home = JSON.parse(fs.readFileSync("scripts/fixtures/home.json", "utf8"));
const baseRestaurant = home["/restaurants"]["data"].find((r) => r._id === ID);
const menuPayload = home[`/restaurants/${ID}/menu`];
const reviewsReal = JSON.parse(fs.readFileSync("scripts/fixtures/restaurant-shell.json", "utf8"))[
  `/restaurants/${ID}/reviews`
];

/* Explicit thresholds so the hint text can actually be exercised. */
const restaurant = Object.assign({}, baseRestaurant, {
  minimumOrder: 200,
  freeDeliveryAbove: 500,
});

const ROUTES = {
  [`/restaurants/${ID}`]: restaurant,
  [`/restaurants/${ID}/menu`]: menuPayload,
  [`/restaurants/${ID}/reviews`]: reviewsReal,
};

const lines = [];
const log = (...a) => {
  lines.push(a.join(" "));
  console.log(...a);
};
fs.mkdirSync("compare-out", { recursive: true });

let failures = 0;
const rows = [];
function check(name, l, n) {
  const eq = JSON.stringify(l) === JSON.stringify(n);
  if (!eq) failures++;
  rows.push({ name, ok: eq });
  if (!eq) {
    log(`  FAIL ${name}`);
    log(`    legacy: ${JSON.stringify(l).slice(0, 700)}`);
    log(`    new   : ${JSON.stringify(n).slice(0, 700)}`);
  }
  return eq;
}

/* ── seeding / routing ────────────────────────────────────────────────── */
function seedInit(args) {
  try {
    if (args.cart) localStorage.setItem("nearbite_cart", JSON.stringify(args.cart));
    else localStorage.removeItem("nearbite_cart");
    window.__EW_SHELL_TEST_HOOKS = true;
  } catch (e) {}
}

async function installAnswered(page) {
  await page.route("https://api.eatswada.com/**", (route) => {
    const u = new URL(route.request().url());
    const p = u.pathname.replace(/^\/api/, "");
    const body = ROUTES[p];
    if (body === undefined)
      return route.fulfill({
        status: 404,
        headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
        body: "{}",
      });
    return route.fulfill({
      status: 200,
      headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  });
}

async function load(url, cart) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e).split("\n")[0]));
  await page.addInitScript(seedInit, { cart });
  await installAnswered(page);
  await page.goto(`${url}?id=${ID}`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(1200);
  return { browser, page, errs };
}

const HINT_SNAPSHOT = () => {
  const box = document.getElementById("order-hint");
  return box
    ? { hidden: box.hidden, cls: box.className, html: box.innerHTML }
    : { missing: true };
};

/* ── A. cartSubtotalForRestaurant ─────────────────────────────────────── */
const CARTS = {
  "empty (no key)": null,
  "empty object": {},
  "wrong restaurant only": {
    k1: { quantity: 2, price: 100, resId: "someone-else" },
  },
  "no price at all": {
    k1: { quantity: 2, resId: ID },
  },
  "qty 0": {
    k1: { quantity: 0, price: 100, resId: ID },
  },
  "valid multi (2x120 + 1x40)": {
    k1: { quantity: 2, price: 120, resId: ID },
    k2: { quantity: 1, itemPrice: 40, resId: ID },
  },
  "mixed: one valid, one wrong restaurant": {
    k1: { quantity: 3, price: 50, resId: ID },
    k2: { quantity: 9, price: 999, resId: "other" },
  },
  "no rid (counted)": {
    k1: { quantity: 4, price: 25 },
  },
};

/* ── C. renderOrderHint subtotals (thresholds 200 / 500) ──────────────── */
const HINT_CARTS = {
  "subtotal 0 (hidden)": null,
  "subtotal 80 (below min)": { k: { quantity: 1, price: 80, resId: ID } },
  "subtotal 300 (min met, below free)": { k: { quantity: 3, price: 100, resId: ID } },
  "subtotal 500 (free met)": { k: { quantity: 5, price: 100, resId: ID } },
};

async function run() {
  /* ── A + B ── */
  for (const [label, cart] of Object.entries(CARTS)) {
    const L = await load(LEGACY, cart);
    const N = await load(NEW, cart);
    const sub = (s) => s.page.evaluate(() => window.cartSubtotalForRestaurant());
    check(`A cartSubtotalForRestaurant: ${label}`, await sub(L), await sub(N));
    await L.browser.close();
    await N.browser.close();
  }
  log(`  A: ${Object.keys(CARTS).length} seeded carts compared`);

  {
    const L = await load(LEGACY, null);
    const N = await load(NEW, null);
    const thr = (s) =>
      s.page.evaluate(() => ({
        t: window.getFreeDeliveryThreshold(),
        fp1: window.firstPositiveNumber(undefined, 0, -3, "12", 7),
        fp2: window.firstPositiveNumber(null, 0, 0),
        fp3: window.firstPositiveNumber("abc", NaN, 5.5),
      }));
    check("B threshold + firstPositiveNumber", await thr(L), await thr(N));
    log(`  B: ${JSON.stringify(await thr(N))}`);
    await L.browser.close();
    await N.browser.close();
  }

  /* ── C. renderOrderHint ── */
  for (const [label, cart] of Object.entries(HINT_CARTS)) {
    const L = await load(LEGACY, cart);
    const N = await load(NEW, cart);
    const snap = (s) => s.page.evaluate(HINT_SNAPSHOT);
    check(`C renderOrderHint: ${label}`, await snap(L), await snap(N));
    log(`  C ${label}: ${JSON.stringify(await snap(N)).slice(0, 160)}`);
    await L.browser.close();
    await N.browser.close();
  }

  /* ── D. checkFreeDeliveryCrossed + toast ── */
  {
    const cart = { k: { quantity: 3, price: 100, resId: ID } }; // 300
    const L = await load(LEGACY, cart);
    const N = await load(NEW, cart);
    const cross = (s, prev, next) =>
      s.page.evaluate(
        ({ p, n }) =>
          new Promise((res) => {
            const box = document.getElementById("order-hint");
            box && (box.innerHTML = ""); // isolate the toast assertion from the hint
            const toast = document.getElementById("ew-free-delivery-toast");
            /* Reset the toast so the previous call's `.show` cannot leak in. */
            if (toast) toast.classList.remove("show");
            const ret = window.checkFreeDeliveryCrossed(p, n);
            /* showFreeDeliveryCongratulations adds `.show` two rAFs later. */
            setTimeout(() => {
              res({ ret, toastCls: toast ? toast.className : "missing" });
            }, 120);
          }),
        { p: prev, n: next }
      );
    check("D crossed 300 -> 500 (fires)", await cross(L, 300, 500), await cross(N, 300, 500));
    check("D crossed 500 -> 600 (no fire)", await cross(L, 500, 600), await cross(N, 500, 600));
    check("D crossed 100 -> 499 (no fire)", await cross(L, 100, 499), await cross(N, 100, 499));
    const waitHide = (s) =>
      s.page.evaluate(
        () =>
          new Promise((res) => {
            window.checkFreeDeliveryCrossed(100, 500);
            setTimeout(() => {
              const t = document.getElementById("ew-free-delivery-toast");
              res(t ? t.className : "missing");
            }, 3700);
          })
      );
    check("D toast auto-hides after 3.2 s", await waitHide(L), await waitHide(N));
    await L.browser.close();
    await N.browser.close();
  }

  /* ── E. tab gestures + indicator ── */
  {
    const L = await load(LEGACY, null);
    const N = await load(NEW, null);

    const ind = (s) =>
      s.page.evaluate(() => {
        const i = document.querySelector(".menu-tab-indicator");
        const tabs = document.getElementById("res-tabs");
        return i
          ? {
              present: true,
              width: i.style.width,
              transform: i.style.transform,
              hasIndicator: tabs.classList.contains("has-indicator"),
              syncFn: typeof window.ewSyncTabIndicator,
            }
          : { present: false };
      });
    check("E indicator present + geometry", await ind(L), await ind(N));
    log(`  E indicator: ${JSON.stringify(await ind(N))}`);

    const clickInfo = (s) =>
      s.page.evaluate(() => {
        document.getElementById("res-tab-info").click();
        return {
          menuHidden: document.getElementById("menu-pane").hidden,
          infoHidden: document.getElementById("info-pane").hidden,
          menuActive: document.getElementById("res-tab-menu").className,
          infoActive: document.getElementById("res-tab-info").className,
          menuSel: document.getElementById("res-tab-menu").getAttribute("aria-selected"),
          infoSel: document.getElementById("res-tab-info").getAttribute("aria-selected"),
          ind: document.querySelector(".menu-tab-indicator").style.transform,
        };
      });
    check("E click Info tab swaps panes + indicator", await clickInfo(L), await clickInfo(N));

    /* swipe left on the menu pane (drag past 22% of 390 px) -> Info */
    const swipe = (s, dx) =>
      s.page.evaluate((delta) => {
        const pane = document.getElementById("menu-pane");
        const mk = (type, x, y) => {
          const t = new Touch({ identifier: 1, target: pane, clientX: x, clientY: y });
          const ev = new TouchEvent(type, {
            touches: type === "touchend" ? [] : [t],
            targetTouches: [t],
            changedTouches: [t],
            bubbles: true,
            cancelable: true,
          });
          pane.dispatchEvent(ev);
        };
        mk("touchstart", 200, 300);
        mk("touchmove", 200 + delta, 302);
        mk("touchend", 200 + delta, 302);
        return {
          menuHidden: document.getElementById("menu-pane").hidden,
          infoHidden: document.getElementById("info-pane").hidden,
          infoSel: document.getElementById("res-tab-info").getAttribute("aria-selected"),
        };
      }, dx);
    /* start from Menu: swipe left commits -> Info. */
    const resetToMenu = (s) =>
      s.page.evaluate(() => {
        if (document.getElementById("menu-pane").hidden)
          document.getElementById("res-tab-menu").click();
      });
    await resetToMenu(L);
    await resetToMenu(N);
    check("E swipe left commits to Info", await swipe(L, -120), await swipe(N, -120));

    await resetToMenu(L);
    await resetToMenu(N);
    check("E swipe left too small springs back", await swipe(L, -20), await swipe(N, -20));

    /* keyboard */
    const arrows = (s) =>
      s.page.evaluate(() => {
        const tabs = document.getElementById("res-tabs");
        const key = (k) =>
          tabs.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
        if (document.getElementById("info-pane").hidden) document.getElementById("res-tab-menu").click();
        key("ArrowRight");
        const afterRight = document.getElementById("info-pane").hidden;
        key("ArrowLeft");
        const afterLeft = document.getElementById("menu-pane").hidden;
        return { afterRight, afterLeft };
      });
    check("E ArrowRight/ArrowLeft swap", await arrows(L), await arrows(N));

    check("E no page errors", L.errs, N.errs);
    await L.browser.close();
    await N.browser.close();
  }

  /* ── F. Escape order ── */
  {
    const L = await load(LEGACY, null);
    const N = await load(NEW, null);
    const esc = (s) =>
      s.page.evaluate(async () => {
        const out = {};
        /* 1. full-screen search open -> Escape closes it */
        window.ewOpenSearch();
        await new Promise((r) => setTimeout(r, 60));
        out.opened = document.body.classList.contains("ew-search-open");
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        await new Promise((r) => setTimeout(r, 350));
        out.afterSearch = document.body.classList.contains("ew-search-open");
        /* 2. dead inline row open -> Escape closes it */
        const row = document.getElementById("menu-search-row");
        row.hidden = false;
        document.body.classList.add("menu-search-open");
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        out.afterRow = row.hidden;
        out.bodyCls = document.body.classList.contains("menu-search-open");
        return out;
      });
    check("F Escape closes search, then inline row", await esc(L), await esc(N));
    log(`  F: ${JSON.stringify(await esc(N))}`);
    await L.browser.close();
    await N.browser.close();
  }

  /* ── G. dead inline search row functions ── */
  {
    const L = await load(LEGACY, null);
    const N = await load(NEW, null);
    const deadRow = (s) =>
      s.page.evaluate(() => {
        const out = {};
        const input = document.getElementById("menu-search-input");
        const clear = document.getElementById("menu-search-clear");
        /* onMenuSearchInput */
        input.value = "dosa";
        window.onMenuSearchInput();
        out.clearHiddenAfterType = clear.hidden;
        /* clearMenuSearch */
        window.clearMenuSearch();
        out.inputAfterClear = input.value;
        out.clearHiddenAfterClear = clear.hidden;
        /* closeMenuSearch */
        document.getElementById("menu-search-row").hidden = false;
        document.body.classList.add("menu-search-open");
        window.closeMenuSearch();
        out.rowHidden = document.getElementById("menu-search-row").hidden;
        out.bodyCls = document.body.classList.contains("menu-search-open");
        return out;
      });
    check("G inline search row (dead) functions", await deadRow(L), await deadRow(N));
    log(`  G: ${JSON.stringify(await deadRow(N))}`);
    await L.browser.close();
    await N.browser.close();
  }

  /* ── H. toggleCategory ── */
  {
    const L = await load(LEGACY, null);
    const N = await load(NEW, null);
    const tc = (s) =>
      s.page.evaluate(() => {
        const h = document.querySelector(".menu-cat-header");
        if (!h) return { missing: true };
        const items = h.nextElementSibling;
        window.toggleCategory(h);
        const once = { header: h.className, items: items ? items.className : null };
        window.toggleCategory(h);
        const twice = { header: h.className, items: items ? items.className : null };
        return { once, twice };
      });
    check("H toggleCategory collapse/expand", await tc(L), await tc(N));
    log(`  H: ${JSON.stringify(await tc(N))}`);
    await L.browser.close();
    await N.browser.close();
  }

  /* ── I. cart hook safety ── */
  {
    const L = await load(LEGACY, null);
    const N = await load(NEW, null);
    const hook = (s) =>
      s.page.evaluate(() => ({
        hinted: !!(window.updateCart && window.updateCart.__ewHinted),
        pair: !!(window.updateCart && window.updateCart.__ewPair),
        isFn: typeof window.updateCart,
      }));
    /* `__ewHinted` / `__ewPair` are INTERNAL markers. The OUTERMOST
       `window.updateCart` on BOTH pages is now chunk 12's
       `js/pairing-suggestions.js` wrapper (`__ewPair`), which wraps chunk 10's
       hinted wrapper — so neither page's outermost function carries
       `__ewHinted` any more. Chunk 12 landed, so legacy and new must MATCH. */
    const lh = await hook(L);
    const nh = await hook(N);
    log(`  I updateCart: legacy ${JSON.stringify(lh)} | new ${JSON.stringify(nh)}`);
    check("I updateCart is a function on both", lh.isFn, nh.isFn);
    check("I outermost updateCart is the chunk-12 pairing wrapper on both", [lh.pair, lh.hinted], [nh.pair, nh.hinted]);

    const PLAIN_KEY = "Chowmein(Veg)";
    const CTA = `[id="btn-container-${PLAIN_KEY}"]`;
    const drive = async (s) => {
      const out = [];
      const snap = async (label) =>
        out.push(
          await s.page.evaluate(
            ({ sel, l }) => ({
              label: l,
              cart: localStorage.getItem("nearbite_cart"),
              hint: document.getElementById("order-hint").outerHTML,
              hintHidden: document.getElementById("order-hint").hidden,
            }),
            { sel: CTA, l: label }
          )
        );
      await s.page.click(`${CTA} .nb-add-btn`);
      await s.page.waitForTimeout(120);
      await snap("ADD");
      await s.page.click(`${CTA} .nb-qty-btn:nth-child(3)`).catch(() => {});
      await s.page.waitForTimeout(120);
      await snap("after second click");
      return out;
    };
    const lOut = await drive(L);
    const nOut = await drive(N);
    check("I cart + hint unchanged after real clicks", lOut, nOut);
    check("I no page errors after hook", L.errs, N.errs);
    log(`  I page errors: legacy ${JSON.stringify(L.errs)} new ${JSON.stringify(N.errs)}`);
    await L.browser.close();
    await N.browser.close();
  }

  /* ── table ── */
  log("");
  log("### PASS / FAIL TABLE");
  const wName = Math.max(...rows.map((r) => r.name.length), 10);
  log("CHECK".padEnd(wName) + " | RESULT");
  log("-".repeat(wName + 9));
  for (const r of rows) log(r.name.padEnd(wName) + " | " + (r.ok ? "PASS" : "FAIL"));
  log("");
  log(
    failures === 0
      ? `CHUNK 10 PARITY: PASS (${rows.length} checks)`
      : `CHUNK 10 PARITY: FAIL (${failures}/${rows.length} checks differ)`
  );
  fs.writeFileSync("compare-out/shell-chunk10-parity.txt", lines.join("\n") + "\n");
  console.log("\nwrote compare-out/shell-chunk10-parity.txt");
  process.exit(failures === 0 ? 0 : 1);
}

await run();
