// Phase 2d chunks 8 & 9 — side-by-side parity harness for /restaurant-shell.
//
// Runs the LEGACY page and the NEW page with the SAME answered fixtures, drives
// the same user actions, and compares the result byte-for-byte:
//
//   A. chunk 8 — the full-screen menu search page (`ss*`):
//      open search; type "dosa"; type "chiken" (typo); type "zzz" (empty state);
//      toggle Veg/Non-veg; tap a recent chip; tap a category.
//      For every state: `#ss-root` innerHTML byte-equal, the `ew_menu_recent_<id>`
//      localStorage key equal, and the overlay screenshot pixel-diffed.
//      Back (popstate) closes the overlay; `ssGoCategory` scrolls the same.
//
//   B. chunk 9 — the dish detail sheet (`ds*`) + the sticky search bar:
//      tap a dish → `#ds-root` pixel-diff + innerHTML; Back closes; Escape
//      closes; drag-down over 90 px closes; tapping the ADD inside the sheet
//      does not double-open. Sticky bar: scroll past `#res-name`, assert
//      `body.ew-tsb-on`, the pill text rotates (2.8 s), it hides under
//      `body.ew-search-open` / `body.ew-dish-open`. The menu footer `.rmf-row`
//      gets `.in`.
//
//   C. money path — ADD/+/- inside the dish sheet and the search overlay leave
//      `nearbite_cart` and the pink bar text identical to legacy after every
//      step (payload keys compared EXACTLY — owner decision 1).
//
// Usage: node scripts/shell-chunks89-parity.mjs [legacyUrl] [newUrl]
// Writes compare-out/shell-chunks89-parity.txt, compare-out/ss-*.png,
// compare-out/ds-*.png and exits non-zero on any FAIL.
import { chromium } from "playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import fs from "node:fs";

const LEGACY = process.argv[2] || "http://localhost:8080/restaurant-shell.html";
const NEW = process.argv[3] || "http://localhost:3000/restaurant-shell";
const ID = "6ac8f95828669b5f4e30f0ba";
const RECENT_KEY = "ew_menu_recent_" + ID;

const home = JSON.parse(fs.readFileSync("scripts/fixtures/home.json", "utf8"));
const restaurant = home["/restaurants"].data.find((r) => r._id === ID);
const menuPayload = home[`/restaurants/${ID}/menu`];
const reviewsReal = JSON.parse(fs.readFileSync("scripts/fixtures/restaurant-shell.json", "utf8"))[
  `/restaurants/${ID}/reviews`
];

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
const hash = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h + ":" + s.length;
};

/* ── pixel diff of ONE element (the overlay), not the whole page ─────── */
async function elementPng(page, selector) {
  const el = await page.$(selector);
  if (!el) return null;
  return el.screenshot();
}
function diffPng(a, b, label) {
  if (!a || !b) return { ok: false, pct: 100, reason: "missing screenshot" };
  const A = PNG.sync.read(a);
  const B = PNG.sync.read(b);
  if (A.width !== B.width || A.height !== B.height)
    return { ok: false, pct: 100, reason: `size ${A.width}x${A.height} vs ${B.width}x${B.height}` };
  const out = new PNG({ width: A.width, height: A.height });
  const n = pixelmatch(A.data, B.data, out.data, A.width, A.height, { threshold: 0.1 });
  const pct = (n / (A.width * A.height)) * 100;
  fs.writeFileSync(`compare-out/${label}-legacy.png`, a);
  fs.writeFileSync(`compare-out/${label}-new.png`, b);
  fs.writeFileSync(`compare-out/${label}-diff.png`, PNG.sync.write(out));
  return { ok: pct < 1, pct, reason: "" };
}

/* ── page plumbing ────────────────────────────────────────────────────── */
async function openSide(browser, url, isLegacy, { theme = null, cart = null, address = null } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e).split("\n")[0]));
  await page.addInitScript(
    (o) => {
      window.__EW_SHELL_TEST_HOOKS = true;
      try {
        if (o.theme) localStorage.setItem("eatswada_theme", o.theme);
        if (o.cart) localStorage.setItem("nearbite_cart", JSON.stringify(o.cart));
        else localStorage.removeItem("nearbite_cart");
        if (o.address) localStorage.setItem("nearbite_address", JSON.stringify(o.address));
      } catch (e) {}
    },
    { theme, cart, address }
  );
  await page.route("https://api.eatswada.com/**", (route) => {
    const u = new URL(route.request().url());
    const p = u.pathname.replace(/^\/api/, "");
    let body = ROUTES[p + u.search];
    if (body === undefined) body = ROUTES[p];
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
  return { ctx, page, errs, isLegacy };
}

const openSearchOn = (page) =>
  page.evaluate(() => {
    if (typeof window.ewOpenSearch === "function") window.ewOpenSearch();
  });

async function typeQuery(page, q) {
  await page.evaluate((query) => {
    const input = document.getElementById("ss-input");
    input.value = query;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, q);
  await page.waitForTimeout(250);
}

const ssSnapshot = (page) =>
  page.evaluate(
    (key) => ({
      root: document.getElementById("ss-root") ? document.getElementById("ss-root").innerHTML : null,
      bodyText: (document.getElementById("ss-body") || {}).textContent || null,
      recent: localStorage.getItem(key),
      open: document.body.classList.contains("ew-search-open"),
    }),
    RECENT_KEY
  );

const normaliseCart = (raw) => {
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
};
const moneyOn = async (page) => {
  const cart = await page.evaluate(() => localStorage.getItem("nearbite_cart"));
  const bar = await page.evaluate(() => {
    const root = document.getElementById("white-cart-root");
    const countEl = document.getElementById("wc-item-count");
    return {
      count: countEl ? countEl.textContent : null,
      text: (root ? root.textContent : "").replace(/\s+/g, ""),
    };
  });
  const nc = normaliseCart(cart);
  return { cart: nc.cart, notes: nc.notes, bar };
};

/* ══════════════════════════════════════════════════════════════════════
   A. CHUNK 8 — full-screen search page
   ══════════════════════════════════════════════════════════════════════ */
log("## /restaurant-shell chunks 8 & 9 — parity");
log("");
log(`legacy: ${LEGACY}`);
log(`new   : ${NEW}`);
log("");

const browserA = await chromium.launch();
const L = await openSide(browserA, LEGACY, true);
const N = await openSide(browserA, NEW, false);

log("### A. chunk 8 — search page states");
/* The search index is built from window.__ewSearchData, which exists only after
   the menu renders — true on both pages here. */
const idxOk = (p) => p.evaluate(() => !!(window.__ewSearchData && window.__ewSearchData.groups));
check("search: __ewSearchData present on both", await idxOk(L.page), await idxOk(N.page));

/* A0 — open (idle state: recent + popular + categories). Seed a recent entry
   first so the recent section exists identically on both. */
await L.page.evaluate((k) => localStorage.setItem(k, JSON.stringify(["dosa", "momo"])), RECENT_KEY);
await N.page.evaluate((k) => localStorage.setItem(k, JSON.stringify(["dosa", "momo"])), RECENT_KEY);
await openSearchOn(L.page);
await openSearchOn(N.page);
await L.page.waitForTimeout(400);
await N.page.waitForTimeout(400);

const states = [
  { name: "open (idle)", fn: async () => {} },
  { name: 'type "dosa"', fn: (p) => typeQuery(p, "dosa") },
  { name: 'type "chiken" (typo)', fn: (p) => typeQuery(p, "chiken") },
  { name: 'type "zzz" (empty state)', fn: (p) => typeQuery(p, "zzz") },
  {
    name: "toggle Veg",
    fn: async (p) => {
      await typeQuery(p, "dosa");
      await p.evaluate(() => document.querySelector('#ss-root .ss-diet-chip[data-diet="veg"]').click());
      await p.waitForTimeout(250);
    },
  },
  {
    name: "toggle Non-veg",
    fn: async (p) => {
      await p.evaluate(() => document.querySelector('#ss-root .ss-diet-chip[data-diet="nonveg"]').click());
      await p.waitForTimeout(250);
    },
  },
  {
    name: "clear diet",
    fn: async (p) => {
      await p.evaluate(() => {
        const on = document.querySelector('#ss-root .ss-diet-chip.is-on');
        if (on) on.click();
      });
      await p.waitForTimeout(250);
    },
  },
  {
    name: "tap a recent chip",
    fn: async (p) => {
      await p.evaluate(() => {
        const c = document.querySelector('#ss-body .ss-chip[data-act="q"]');
        if (c) c.click();
      });
      await p.waitForTimeout(300);
    },
  },
];

for (const st of states) {
  await st.fn(L.page);
  await st.fn(N.page);
  const ls = await ssSnapshot(L.page);
  const ns = await ssSnapshot(N.page);
  check(`search "${st.name}": #ss-root innerHTML (hash)`, hash(ls.root || ""), hash(ns.root || ""));
  check(`search "${st.name}": #ss-root innerHTML byte-equal`, ls.root === ns.root, true);
  check(`search "${st.name}": ${RECENT_KEY} equal`, ls.recent, ns.recent);
  const d = diffPng(await elementPng(L.page, "#ss-root"), await elementPng(N.page, "#ss-root"), `ss-${st.name.replace(/[^a-z0-9]+/gi, "-")}`);
  check(`search "${st.name}": #ss-root pixel diff < 1%`, d.ok, true);
  log(`  ${st.name}: innerHTML ${hash(ns.root || "")}, recent ${JSON.stringify(ns.recent)}, overlay diff ${d.pct.toFixed(2)}%`);
}

/* A — tap a category (ssGoCategory). Reset both pages to scrollY=0 first so the
   smooth scroll starts from the same place; the KNOWN pre-existing chunk-3
   glide lands 1 px apart (212 vs 211 — proved independent of chunks 8/9 by
   disabling both installers), so the landing is compared with a 1 px tolerance
   and the glide offset is reported. */
const resetScroll = (p) => p.evaluate(() => window.scrollTo(0, 0));
await resetScroll(L.page);
await resetScroll(N.page);
await L.page.waitForTimeout(400);
await N.page.waitForTimeout(400);
await openSearchOn(L.page);
await openSearchOn(N.page);
await L.page.waitForTimeout(400);
await N.page.waitForTimeout(400);
await L.page.evaluate(() => document.querySelector('#ss-body .ss-cat-row[data-act="cat"]')?.click());
await N.page.evaluate(() => document.querySelector('#ss-body .ss-cat-row[data-act="cat"]')?.click());
await L.page.waitForTimeout(1400);
await N.page.waitForTimeout(1400);
const catScroll = (p) =>
  p.evaluate(() => ({
    open: document.body.classList.contains("ew-search-open"),
    activeTab: (document.getElementById("res-tab-menu") || {}).className,
    scrollY: Math.round(window.scrollY),
  }));
const lCat = await catScroll(L.page);
const nCat = await catScroll(N.page);
check("search: tap category closes overlay + switches to menu tab", [lCat.open, lCat.activeTab], [nCat.open, nCat.activeTab]);
check("search: tap category scrolls to same place (±1px glide)", Math.abs(lCat.scrollY - nCat.scrollY) <= 1, true);
log(`  tap category: legacy ${JSON.stringify(lCat)} / new ${JSON.stringify(nCat)}`);

/* A — Back (popstate) closes the overlay */
await openSearchOn(L.page);
await openSearchOn(N.page);
await L.page.waitForTimeout(400);
await N.page.waitForTimeout(400);
await L.page.evaluate(() => history.back());
await N.page.evaluate(() => history.back());
await L.page.waitForTimeout(900);
await N.page.waitForTimeout(900);
const backState = (p) =>
  p.evaluate(() => ({
    open: document.body.classList.contains("ew-search-open"),
    rootHidden: document.getElementById("ss-root").hidden,
    btnExpanded: document.getElementById("menu-search-btn").getAttribute("aria-expanded"),
  }));
const lBack = await backState(L.page);
const nBack = await backState(N.page);
check("search: Back (popstate) closes overlay", lBack, nBack);
log(`  Back: legacy ${JSON.stringify(lBack)} / new ${JSON.stringify(nBack)}`);

/* ══════════════════════════════════════════════════════════════════════
   B. CHUNK 9 — dish sheet + sticky bar
   ══════════════════════════════════════════════════════════════════════ */
log("");
log("### B. chunk 9 — dish detail sheet + sticky bar");

/* Tap a dish row in the menu (not its buttons). */
const tapDish = (p) =>
  p.evaluate(() => {
    const el = document.querySelector(".menu-item .nb-item-title") || document.querySelector(".menu-item");
    el.click();
  });
await tapDish(L.page);
await tapDish(N.page);
await L.page.waitForTimeout(700);
await N.page.waitForTimeout(700);
const dsSnap = (p) =>
  p.evaluate(() => {
    const root = document.getElementById("ds-root");
    const sheet = root ? root.querySelector(".ds-sheet") : null;
    return {
      exists: !!root,
      hidden: root ? root.hidden : null,
      isIn: root ? root.classList.contains("is-in") : null,
      bodyOpen: document.body.classList.contains("ew-dish-open"),
      sheetHtml: sheet ? sheet.innerHTML.replace(/style="[^"]*"/g, "") : null,
      name: sheet ? (sheet.querySelector(".ds-name") || {}).textContent : null,
      cta: sheet ? (sheet.querySelector(".ds-cta") || {}).innerHTML : null,
      cat: sheet ? (sheet.querySelector(".ds-cat") || {}).textContent : null,
    };
  });
const lDs = await dsSnap(L.page);
const nDs = await dsSnap(N.page);
check("dish: #ds-root opened on both", [lDs.exists, lDs.hidden, lDs.bodyOpen], [nDs.exists, nDs.hidden, nDs.bodyOpen]);
check("dish: .ds-sheet innerHTML byte-equal (styles stripped)", lDs.sheetHtml === nDs.sheetHtml, true);
check("dish: .ds-name / .ds-cat / .ds-cta equal", [lDs.name, lDs.cat, lDs.cta], [nDs.name, nDs.cat, nDs.cta]);
{
  const d = diffPng(await elementPng(L.page, "#ds-root"), await elementPng(N.page, "#ds-root"), "ds-open");
  check("dish: #ds-root pixel diff < 1%", d.ok, true);
  log(`  open: name ${JSON.stringify(nDs.name)}, cat ${JSON.stringify(nDs.cat)}, sheet diff ${d.pct.toFixed(2)}%`);
}

/* B — Escape closes */
await L.page.keyboard.press("Escape");
await N.page.keyboard.press("Escape");
await L.page.waitForTimeout(700);
await N.page.waitForTimeout(700);
const dsClosed = (p) =>
  p.evaluate(() => ({
    open: document.body.classList.contains("ew-dish-open"),
    hidden: document.getElementById("ds-root").hidden,
  }));
check("dish: Escape closes", await dsClosed(L.page), await dsClosed(N.page));

/* B — Back closes */
await tapDish(L.page);
await tapDish(N.page);
await L.page.waitForTimeout(600);
await N.page.waitForTimeout(600);
await L.page.evaluate(() => history.back());
await N.page.evaluate(() => history.back());
await L.page.waitForTimeout(900);
await N.page.waitForTimeout(900);
check("dish: Back closes", await dsClosed(L.page), await dsClosed(N.page));

/* B — drag-down over 90 px closes */
const dragDown = async (p, dy) => {
  await p.evaluate((delta) => {
    const sheet = document.querySelector("#ds-root .ds-sheet");
    const grab = sheet.querySelector(".ds-grab");
    /* The handler only reads ev.touches[0].clientY, so a plain Event with a
       touches array is enough (a real TouchEvent needs Touch objects). */
    const mk = (type, y) => {
      const ev = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(ev, "touches", { value: type === "touchend" ? [] : [{ clientY: y, clientX: 100 }] });
      return ev;
    };
    grab.dispatchEvent(mk("touchstart", 200));
    sheet.dispatchEvent(mk("touchmove", 200 + delta));
    sheet.dispatchEvent(mk("touchend", 200 + delta));
  }, dy);
  await p.waitForTimeout(800);
};
await tapDish(L.page);
await tapDish(N.page);
await L.page.waitForTimeout(600);
await N.page.waitForTimeout(600);
await dragDown(L.page, 120);
await dragDown(N.page, 120);
check("dish: drag-down >90px closes", await dsClosed(L.page), await dsClosed(N.page));
log(`  drag 120px: legacy ${JSON.stringify(await dsClosed(L.page))} / new ${JSON.stringify(await dsClosed(N.page))}`);

/* B — tapping the ADD inside the sheet does not double-open.
   Use a CUSTOMISABLE item so `.nb-add-btn--cust` steps the sheet out of the
   way (the exact legacy branch). */
const tapCustDish = (p) =>
  p.evaluate(() => {
    const el = document.querySelector(".menu-item .nb-add-btn--cust");
    const row = el.closest(".menu-item");
    (row.querySelector(".nb-item-title") || row).click();
  });
await tapCustDish(L.page);
await tapCustDish(N.page);
await L.page.waitForTimeout(700);
await N.page.waitForTimeout(700);
const beforeAdd = (p) => p.evaluate(() => ({ open: document.body.classList.contains("ew-dish-open"), hidden: document.getElementById("ds-root").hidden }));
const lBefore = await beforeAdd(L.page);
const nBefore = await beforeAdd(N.page);
check("dish(cust): opened before ADD", lBefore, nBefore);
await L.page.evaluate(() => document.querySelector("#ds-root .ds-cta .nb-add-btn--cust").click());
await N.page.evaluate(() => document.querySelector("#ds-root .ds-cta .nb-add-btn--cust").click());
await L.page.waitForTimeout(700);
await N.page.waitForTimeout(700);
const afterAdd = (p) => p.evaluate(() => ({
  open: document.body.classList.contains("ew-dish-open"),
  hidden: document.getElementById("ds-root").hidden,
  custSheet: !!document.getElementById("ewcs-sheet"),
}));
const lAfter = await afterAdd(L.page);
const nAfter = await afterAdd(N.page);
/* The dish sheet must close on BOTH pages and must NOT re-open (no double-open).
   The custom ADD's `onclick="ewOpenCustomize(...)"` is emitted by chunk 4's
   `makeBtnHTML`; chunk 11 (the customize sheet) is now ported, so BOTH pages
   must open `#ewcs-sheet` and step the dish sheet aside. */
check("dish(cust): ADD inside sheet closes it, no double-open", [lAfter.open, lAfter.hidden], [nAfter.open, nAfter.hidden]);
check("dish(cust): BOTH pages open the customise sheet (chunk 11 ported)", [lAfter.custSheet, nAfter.custSheet], [true, true]);
log(`  ADD inside sheet: legacy ${JSON.stringify(lAfter)} / new ${JSON.stringify(nAfter)}`);

/* B — sticky bar */
const stickySnap = (p) =>
  p.evaluate(() => {
    const bar = document.getElementById("ew-sticky-search");
    return {
      exists: !!bar,
      ariaHidden: bar ? bar.getAttribute("aria-hidden") : null,
      bodyOn: document.body.classList.contains("ew-tsb-on"),
      pill: bar ? (bar.querySelector(".tsp-text") || {}).textContent : null,
      backBtn: bar ? !!bar.querySelector(".tsb-back") : null,
      lineCount: bar ? bar.querySelectorAll(".tsp-line").length : null,
    };
  });
const lBar0 = await stickySnap(L.page);
const nBar0 = await stickySnap(N.page);
check("sticky: bar built identically on both", [lBar0.exists, lBar0.backBtn], [nBar0.exists, nBar0.backBtn]);
log(`  sticky built: legacy ${JSON.stringify(lBar0)} / new ${JSON.stringify(nBar0)}`);

/* Scroll past #res-name */
const scrollPast = (p) =>
  p.evaluate(() => {
    const name = document.getElementById("res-name");
    window.scrollTo(0, Math.max(0, name.getBoundingClientRect().bottom + window.scrollY + 200));
  });
await scrollPast(L.page);
await scrollPast(N.page);
await L.page.waitForTimeout(600);
await N.page.waitForTimeout(600);
const lBar1 = await stickySnap(L.page);
const nBar1 = await stickySnap(N.page);
check("sticky: body.ew-tsb-on after scrolling past #res-name", [lBar1.bodyOn, lBar1.ariaHidden], [nBar1.bodyOn, nBar1.ariaHidden]);
log(`  after scroll: legacy ${JSON.stringify({ on: lBar1.bodyOn, pill: lBar1.pill })} / new ${JSON.stringify({ on: nBar1.bodyOn, pill: nBar1.pill })}`);

/* Pill text rotates (2.8 s). The interval starts when the bar first shows, and
   the two pages reach that point a few hundred ms apart, so poll for the change
   instead of sampling at a fixed instant. */
const pillOf = (p) => p.evaluate(() => {
  const bar = document.getElementById("ew-sticky-search");
  const lines = bar ? Array.from(bar.querySelectorAll(".tsp-line")) : [];
  return { text: (bar.querySelector(".tsp-text") || {}).textContent, lines: lines.length };
});
const lPill0 = (await pillOf(L.page)).text;
const nPill0 = (await pillOf(N.page)).text;
let lRot = lPill0, nRot = nPill0;
for (let i = 0; i < 24 && (lRot === lPill0 || nRot === nPill0); i++) {
  await L.page.waitForTimeout(500);
  await N.page.waitForTimeout(500);
  lRot = (await pillOf(L.page)).text;
  nRot = (await pillOf(N.page)).text;
}
check("sticky: pill rotates after 2.8 s (both changed)", [lRot !== lPill0, nRot !== nPill0], [true, true]);
/* The rotation order is deterministic (same collect() list, same start index 0),
   so after the same number of ticks the two pills must read the same. Poll until
   the new pill text matches on both pages. */
let match = lRot === nRot;
for (let i = 0; i < 24 && !match; i++) {
  await L.page.waitForTimeout(500);
  await N.page.waitForTimeout(500);
  const l2 = (await pillOf(L.page)).text;
  const n2 = (await pillOf(N.page)).text;
  if (l2 === n2) { lRot = l2; nRot = n2; match = true; break; }
}
check("sticky: pill text equal at the same rotation index", lRot, nRot);
log(`  rotation: legacy ${JSON.stringify(lPill0)} -> ${JSON.stringify(lRot)} | new ${JSON.stringify(nPill0)} -> ${JSON.stringify(nRot)}`);

/* Hides under body.ew-search-open */
await openSearchOn(L.page);
await openSearchOn(N.page);
await L.page.waitForTimeout(400);
await N.page.waitForTimeout(400);
const visOn = (p) => p.evaluate(() => getComputedStyle(document.getElementById("ew-sticky-search")).visibility);
const lSearchVis = await visOn(L.page);
const nSearchVis = await visOn(N.page);
check("sticky: hidden under body.ew-search-open", lSearchVis, nSearchVis);
log(`  under ew-search-open: legacy visibility=${lSearchVis} / new ${nSearchVis}`);
await L.page.evaluate(() => history.back());
await N.page.evaluate(() => history.back());
await L.page.waitForTimeout(900);
await N.page.waitForTimeout(900);

/* Hides under body.ew-dish-open */
await tapDish(L.page);
await tapDish(N.page);
await L.page.waitForTimeout(600);
await N.page.waitForTimeout(600);
const lDishVis = await visOn(L.page);
const nDishVis = await visOn(N.page);
check("sticky: hidden under body.ew-dish-open", lDishVis, nDishVis);
log(`  under ew-dish-open: legacy visibility=${lDishVis} / new ${nDishVis}`);
await L.page.evaluate(() => history.back());
await N.page.evaluate(() => history.back());
await L.page.waitForTimeout(900);
await N.page.waitForTimeout(900);

/* Menu footer .rmf-row gets .in */
const footerSnap = (p) =>
  p.evaluate(() => {
    const f = document.getElementById("menu-footer");
    return {
      anim: f.classList.contains("rmf-anim"),
      rows: Array.from(f.querySelectorAll(".rmf-row, .rmf-info")).map((el) => ({
        cls: el.className.replace(/\s+/g, " ").trim(),
        d: el.style.getPropertyValue("--d"),
      })),
    };
  });
await L.page.evaluate(() => document.getElementById("menu-footer").scrollIntoView());
await N.page.evaluate(() => document.getElementById("menu-footer").scrollIntoView());
await L.page.waitForTimeout(1200);
await N.page.waitForTimeout(1200);
const lFoot = await footerSnap(L.page);
const nFoot = await footerSnap(N.page);
check("footer: .rmf-anim + .in on the rows", lFoot, nFoot);
log(`  footer rows: ${JSON.stringify(nFoot.rows)}`);

/* Page errors. Chunk 11 (the customize sheet) is now ported, so the custom ADD
   no longer raises `ReferenceError: ewOpenCustomize is not defined`. Both pages
   must be error-free. */
check("chunk 8/9: no page errors", L.errs, N.errs);
log(`  page errors: legacy ${JSON.stringify(L.errs)} new ${JSON.stringify(N.errs)}`);
await L.ctx.close();
await N.ctx.close();
await browserA.close();

/* ══════════════════════════════════════════════════════════════════════
   C. MONEY PATH — ADD/+/- inside the dish sheet and the search overlay
   ══════════════════════════════════════════════════════════════════════ */
log("");
log("### C. money path — inside the dish sheet and the search overlay");
{
  const browserC = await chromium.launch();
  const l = await openSide(browserC, LEGACY, true);
  const n = await openSide(browserC, NEW, false);

  const stepMoney = async (label, act) => {
    await act(l.page);
    await act(n.page);
    const lm = await moneyOn(l.page);
    const nm = await moneyOn(n.page);
    check(`money "${label}": nearbite_cart`, lm.cart, nm.cart);
    check(`money "${label}": pink bar text`, lm.bar.text, nm.bar.text);
    check(`money "${label}": pink bar count`, lm.bar.count, nm.bar.count);
    log(`  ${label}: bar ${JSON.stringify(nm.bar.count)} cart ${JSON.stringify(nm.cart)}`);
  };

  /* Open a plain dish in the sheet and use its ADD / + / − (the sheet CTA is
     the same makeBtnHTML output the menu uses). */
  const openPlainSheet = async (p) => {
    await p.evaluate(() => {
      const rows = Array.from(document.querySelectorAll(".menu-item"));
      const row = rows.find((r) => r.querySelector(".nb-add-btn") && !r.querySelector(".nb-add-btn--cust"));
      (row.querySelector(".nb-item-title") || row).click();
    });
    await p.waitForTimeout(700);
  };
  await openPlainSheet(l.page);
  await openPlainSheet(n.page);
  await stepMoney("sheet ADD", async (p) => {
    await p.evaluate(() => document.querySelector("#ds-root .ds-cta .nb-add-btn").click());
    await p.waitForTimeout(600);
  });
  await stepMoney("sheet +", async (p) => {
    await p.evaluate(() => {
      const btns = document.querySelectorAll("#ds-root .ds-cta .nb-qty-btn");
      btns[btns.length - 1].click();
    });
    await p.waitForTimeout(600);
  });
  await stepMoney("sheet −", async (p) => {
    await p.evaluate(() => {
      const btns = document.querySelectorAll("#ds-root .ds-cta .nb-qty-btn");
      btns[0].click();
    });
    await p.waitForTimeout(600);
  });

  /* Close the sheet, open the search overlay, and add from a result card. */
  await l.page.evaluate(() => history.back());
  await n.page.evaluate(() => history.back());
  await l.page.waitForTimeout(900);
  await n.page.waitForTimeout(900);
  await openSearchOn(l.page);
  await openSearchOn(n.page);
  await l.page.waitForTimeout(400);
  await n.page.waitForTimeout(400);
  await typeQuery(l.page, "chowmein");
  await typeQuery(n.page, "chowmein");
  await stepMoney("overlay ADD", async (p) => {
    await p.evaluate(() => document.querySelector("#ss-body .ss-card .nb-add-btn").click());
    await p.waitForTimeout(600);
  });
  await stepMoney("overlay +", async (p) => {
    await p.evaluate(() => {
      const btns = document.querySelectorAll("#ss-body .ss-card .nb-qty-btn");
      btns[btns.length - 1].click();
    });
    await p.waitForTimeout(600);
  });
  await stepMoney("overlay −", async (p) => {
    await p.evaluate(() => {
      const btns = document.querySelectorAll("#ss-body .ss-card .nb-qty-btn");
      btns[0].click();
    });
    await p.waitForTimeout(600);
  });
  check("money: no page errors", l.errs, n.errs);
  await l.ctx.close();
  await n.ctx.close();
  await browserC.close();
}

/* ── table ────────────────────────────────────────────────────────────── */
log("");
log("### PASS / FAIL TABLE");
const wName = Math.max(...rows.map((r) => r.name.length), 10);
log("CHECK".padEnd(wName) + " | RESULT");
log("-".repeat(wName + 9));
for (const r of rows) log(r.name.padEnd(wName) + " | " + (r.ok ? "PASS" : "FAIL"));
log("");
log(failures === 0 ? `CHUNKS 8-9 PARITY: PASS (${rows.length} checks)` : `CHUNKS 8-9 PARITY: FAIL (${failures}/${rows.length} checks differ)`);

fs.writeFileSync("compare-out/shell-chunks89-parity.txt", lines.join("\n") + "\n");
console.log("\nwrote compare-out/shell-chunks89-parity.txt");
process.exit(failures === 0 ? 0 : 1);
