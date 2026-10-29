// Phase 2 chunks 6 & 7 — side-by-side parity harness for /restaurant-shell.
//
// Runs the LEGACY page and the NEW page with the SAME fixtures and the SAME
// direct function calls, then compares the result byte-for-byte:
//
//   chunk 6 — menu render (`renderMenu`, `categoryDomId`,
//             `syncVegFilterAvailability`):
//     * `#menu-container` and `#cat-nav-inner` innerHTML byte-equal (the
//       `animation-delay` values are index-derived and deterministic);
//     * `window.__ewSearchData` / `__ewMenuGroups` / `__ewCust` shapes;
//     * direct `categoryDomId` / `resolveMenuImage` / `escapeMenuHtml` calls;
//     * `syncVegFilterAvailability` side effects.
//
//   chunk 7 — data loading, states, the (dead) filter sheet, quick filters:
//     * boot issues exactly ONE request per route, and the reviews GET is
//       `?page=1&limit=5`;
//     * no `?id=` → error card, exact message, NO retry button;
//     * restaurant route 500 → error card WITH "Try Again";
//     * menu `data: {}` → "Menu not available";
//     * `focusItem` → `.ew-search-focus-item` added then removed;
//     * each of the 5 quick chips → `aria-pressed`, `.active`,
//       `.hidden-by-filter` counts, `.cat-group-empty`, `#empty-filter-msg`;
//     * `resetAllMenuFilters()` restores;
//     * the dead filter sheet driven through its public functions
//       (`toggleDraftReordered` + `applySheetFilters`) → the "highly
//       reordered" empty message, and `#filter-count-badge` /
//       `#apply-filter-btn` stay `null` on BOTH pages.
//
// Usage: node scripts/shell-chunks67-parity.mjs [legacyUrl] [newUrl]
// Writes compare-out/shell-chunks67-parity.txt and exits non-zero on any FAIL.
import { chromium } from "playwright";
import fs from "node:fs";

const LEGACY = process.argv[2] || "http://localhost:8080/restaurant-shell.html";
const NEW = process.argv[3] || "http://localhost:3000/restaurant-shell";
const ID = "6ac8f95828669b5f4e30f0ba";

const home = JSON.parse(fs.readFileSync("scripts/fixtures/home.json", "utf8"));
const restaurant = home["/restaurants"].data.find((r) => r._id === ID);
const menuPayload = home[`/restaurants/${ID}/menu`];
const reviewsReal = JSON.parse(fs.readFileSync("scripts/fixtures/restaurant-shell.json", "utf8"))[
  `/restaurants/${ID}/reviews`
];

/* A menu whose every price is OUTSIDE the ₹99–₹149 quick chip, so that chip
   can drive the list to zero visible items (the empty state + category
   collapse). Clearly labelled synthetic in the output. */
const menuOutOfRange = (() => {
  const m = JSON.parse(JSON.stringify(menuPayload));
  Object.keys(m.data).forEach((g) => m.data[g].forEach((it) => { it.price = 10; }));
  return m;
})();

const lines = [];
const log = (...a) => {
  lines.push(a.join(" "));
  console.log(...a);
};

let failures = 0;
const rows = [];
function check(name, l, n) {
  const eq = JSON.stringify(l) === JSON.stringify(n);
  if (!eq) failures++;
  rows.push({ name, ok: eq, l, n });
  if (!eq) {
    log(`  FAIL ${name}`);
    log(`    legacy: ${JSON.stringify(l).slice(0, 600)}`);
    log(`    new   : ${JSON.stringify(n).slice(0, 600)}`);
  }
  return eq;
}

const hash = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h + ":" + s.length;
};

/* ── page plumbing ────────────────────────────────────────────────────── */
async function withBoth({ routes, id = ID, focusItem = null, theme = null, drive = null, settle = 2200 }) {
  const browser = await chromium.launch();
  const out = {};
  for (const [tag, url, isLegacy] of [
    ["legacy", LEGACY, true],
    ["new", NEW, false],
  ]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e).split("\n")[0]));
    const api = [];
    page.on("request", (r) => {
      if (r.url().includes("api.eatswada.com"))
        api.push(r.url().replace(/^https:\/\/api\.eatswada\.com\/api/, ""));
    });
    if (theme) await page.addInitScript((t) => { try { localStorage.setItem("eatswada_theme", t); } catch (e) {} }, theme);
    await page.addInitScript(() => { window.__EW_SHELL_TEST_HOOKS = true; });
    await page.route("https://api.eatswada.com/**", (route) => {
      const u = new URL(route.request().url());
      const p = u.pathname.replace(/^\/api/, "");
      const key = p + u.search;
      let body = routes[key];
      if (body === undefined) body = routes[p];
      if (body === undefined)
        return route.fulfill({ status: 404, headers: { "access-control-allow-origin": "*" }, body: "{}" });
      if (typeof body === "object" && body.__status) {
        return route.fulfill({
          status: body.__status,
          headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
          body: JSON.stringify(body.__body || { success: false, message: "boom" }),
        });
      }
      return route.fulfill({
        status: 200,
        headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    });
    const qs = new URLSearchParams();
    if (id) qs.set("id", id);
    if (focusItem) qs.set("focusItem", focusItem);
    await page.goto(`${url}${qs.toString() ? "?" + qs : ""}`, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(settle);
    if (drive) await drive(page, isLegacy);
    out[tag] = { page, errs, api, ctx };
  }
  out.close = async () => { await out.legacy.ctx.close(); await out.new.ctx.close(); await browser.close(); };
  return out;
}

const ROUTES = {
  [`/restaurants/${ID}`]: restaurant,
  [`/restaurants/${ID}/menu`]: menuPayload,
  [`/restaurants/${ID}/reviews`]: reviewsReal,
};

/* ── chunk 6: menu render ─────────────────────────────────────────────── */
log("## /restaurant-shell chunks 6 & 7 — parity");
log("");
log(`legacy: ${LEGACY}`);
log(`new   : ${NEW}`);
log("");

log("### 1. chunk 6 — renderMenu: menu DOM + nav + globals (fixture answered)");
{
  const B = await withBoth({ routes: ROUTES });
  const snap = (p) => p.evaluate(() => {
    const mc = document.getElementById("menu-container");
    const nav = document.getElementById("cat-nav-inner");
    const groups = Array.from(document.querySelectorAll(".menu-cat-group"));
    return {
      menuHtml: mc.innerHTML,
      menuHash: (() => { const s = mc.innerHTML; let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h + ":" + s.length; })(),
      navHtml: nav.innerHTML,
      skeletonDisplay: getComputedStyle(document.getElementById("menu-skeleton")).display,
      containerDisplay: getComputedStyle(mc).display,
      groupCount: groups.length,
      itemCount: document.querySelectorAll(".menu-item").length,
      groupIds: groups.map((g) => g.id),
      catTitles: groups.map((g) => g.querySelector(".menu-cat-title").textContent.replace(/\s+/g, " ").trim()),
      searchData: window.__ewSearchData ? { keys: Object.keys(window.__ewSearchData).sort(), names: window.__ewSearchData.groups.map((g) => g.name), resId: window.__ewSearchData.resId } : null,
      menuGroups: window.__ewMenuGroups ? { len: window.__ewMenuGroups.length, names: window.__ewMenuGroups.map((g) => g.name) } : null,
      custKeys: window.__ewCust ? Object.keys(window.__ewCust) : null,
      custSample: window.__ewCust ? window.__ewCust[Object.keys(window.__ewCust)[0]] : null,
      ctaCount: document.querySelectorAll(".nb-item-cta").length,
      btnIds: Array.from(document.querySelectorAll(".nb-item-cta")).slice(0, 3).map((e) => e.id),
      quickRowDisplay: getComputedStyle(document.getElementById("quick-filter-row")).display,
      filterBarDisplay: getComputedStyle(document.getElementById("restaurant-filter-bar")).display,
      firstItemOuter: document.querySelector(".menu-item").outerHTML,
      catNavPills: Array.from(document.querySelectorAll(".cat-nav-pill")).map((e) => ({ t: e.dataset.target, cls: e.className, oc: e.getAttribute("onclick") })),
    };
  });
  const L = await snap(B.legacy.page);
  const N = await snap(B.new.page);

  check("renderMenu: #menu-container innerHTML (hash)", L.menuHash, N.menuHash);
  log(`  menu innerHTML hash: legacy ${L.menuHash} / new ${N.menuHash}`);
  check("renderMenu: #menu-container innerHTML (byte-equal)", L.menuHtml === N.menuHtml, true);
  check("renderMenu: #cat-nav-inner innerHTML", L.navHtml, N.navHtml);
  check("renderMenu: #menu-skeleton display", L.skeletonDisplay, N.skeletonDisplay);
  check("renderMenu: #menu-container display", L.containerDisplay, N.containerDisplay);
  check("renderMenu: category group count", L.groupCount, N.groupCount);
  check("renderMenu: item count", L.itemCount, N.itemCount);
  check("renderMenu: category group ids", L.groupIds, N.groupIds);
  check("renderMenu: category titles (with counts)", L.catTitles, N.catTitles);
  check("renderMenu: cat-nav pills (target/class/onclick)", L.catNavPills, N.catNavPills);
  check("renderMenu: window.__ewSearchData shape", L.searchData, N.searchData);
  check("renderMenu: window.__ewMenuGroups shape", L.menuGroups, N.menuGroups);
  check("renderMenu: window.__ewCust keys", L.custKeys, N.custKeys);
  check("renderMenu: window.__ewCust[first] entry", L.custSample, N.custSample);
  check("renderMenu: .nb-item-cta count + ids", [L.ctaCount, L.btnIds], [N.ctaCount, N.btnIds]);
  check("renderMenu: first .menu-item outerHTML (byte-equal)", L.firstItemOuter === N.firstItemOuter, true);
  log(`  groups ${L.groupCount} / items ${L.itemCount} / cta ${L.ctaCount} / cust keys ${L.custKeys ? L.custKeys.length : 0}`);

  /* Direct function calls. */
  const direct = (p) => p.evaluate(() => ({
    categoryDomId: ["Veg Starters", "  Noodles ", "A & B / C!", "", null, "MiXeD   Case 123", "x".repeat(80)].map((n) => window.categoryDomId(n)),
    resolveMenuImage: [null, "", "  ", "null", "None", "https://x/y.jpg", "//cdn/x.jpg", "/rel/x.jpg", "data:image/png;base64,AAAA", "javascript:alert(1)", "ftp://x", 42].map((v) => window.resolveMenuImage(v)),
    escapeMenuHtml: ["a<b>&\"'", null, undefined, 5].map((v) => window.escapeMenuHtml(v)),
  }));
  const dL = await direct(B.legacy.page);
  const dN = await direct(B.new.page);
  check("categoryDomId: 7 inputs byte-equal", dL.categoryDomId, dN.categoryDomId);
  check("resolveMenuImage: 12 inputs byte-equal", dL.resolveMenuImage, dN.resolveMenuImage);
  check("escapeMenuHtml: 4 inputs byte-equal", dL.escapeMenuHtml, dN.escapeMenuHtml);

  /* syncVegFilterAvailability side effects. */
  const syncVeg = (p) => p.evaluate(() => {
    window.syncVegFilterAvailability();
    return {
      quickRow: getComputedStyle(document.getElementById("quick-filter-row")).display,
      bar: getComputedStyle(document.querySelector(".filter-bar")).display,
      knownVeg: document.querySelectorAll('.menu-item[data-veg-known="true"]').length,
    };
  });
  check("syncVegFilterAvailability effects", await syncVeg(B.legacy.page), await syncVeg(B.new.page));

  /* Boot request counts. Both pages must issue exactly the two GETs
     `/restaurants/:id` and `/restaurants/:id/menu` (in that order) — the
     reviews GET is only fired when the Info tab first renders (chunk 5) and is
     covered by shell-chunk5-parity.mjs. */
  check("boot: API request list (order + count)", B.legacy.api, B.new.api);
  log(`  API requests: ${JSON.stringify(B.new.api)}`);
  check("boot: no page errors", B.legacy.errs, B.new.errs);
  await B.close();
}

/* ── chunk 7: quick filters + reset ───────────────────────────────────── */
log("");
log("### 2. chunk 7 — the 5 quick chips + resetAllMenuFilters (real menu)");
{
  const CHIPS = ["filter-popular", "filter-rating", "filter-price", "filter-veg", "filter-nonveg"];
  const snapFilters = (p) => p.evaluate(() => {
    const CHIPS = ["filter-popular", "filter-rating", "filter-price", "filter-veg", "filter-nonveg"];
    return {
      visible: document.querySelectorAll(".menu-item:not(.hidden-by-filter)").length,
      hidden: document.querySelectorAll(".menu-item.hidden-by-filter").length,
      emptyGroups: document.querySelectorAll(".menu-cat-group.cat-group-empty").length,
      emptyMsgDisplay: getComputedStyle(document.getElementById("empty-filter-msg")).display,
      emptyIcon: document.getElementById("empty-filter-icon").className,
      emptyTitle: document.getElementById("empty-filter-title").textContent,
      emptySub: document.getElementById("empty-filter-sub").textContent,
      clearHidden: document.getElementById("empty-filter-clear").hidden,
      chips: CHIPS.map((id) => { const b = document.getElementById(id); return { id, pressed: b.getAttribute("aria-pressed"), active: b.classList.contains("active") }; }),
      badge: document.getElementById("filter-count-badge"),
      applyBtn: document.getElementById("apply-filter-btn"),
    };
  });

  const B = await withBoth({ routes: ROUTES });
  for (const chip of CHIPS) {
    await B.legacy.page.click(`#${chip}`);
    await B.new.page.click(`#${chip}`);
    await B.legacy.page.waitForTimeout(850);
    await B.new.page.waitForTimeout(850);
    check(`chip ${chip}: filter state`, await snapFilters(B.legacy.page), await snapFilters(B.new.page));
  }
  /* reset */
  await B.legacy.page.evaluate(() => window.resetAllMenuFilters());
  await B.new.page.evaluate(() => window.resetAllMenuFilters());
  await B.legacy.page.waitForTimeout(850);
  await B.new.page.waitForTimeout(850);
  check("resetAllMenuFilters: restores", await snapFilters(B.legacy.page), await snapFilters(B.new.page));
  const rst = await snapFilters(B.new.page);
  log(`  after reset: visible ${rst.visible} hidden ${rst.hidden} emptyGroups ${rst.emptyGroups} emptyMsg ${rst.emptyMsgDisplay}`);
  check("dead sheet: #filter-count-badge is null on BOTH", rst.badge, null);
  check("dead sheet: #apply-filter-btn is null on BOTH", rst.applyBtn, null);
  await B.close();
}

/* ── chunk 7: empty state via the ₹99–₹149 chip on an out-of-range menu ── */
log("");
log("### 3. chunk 7 — empty state + category collapse (all prices ₹10)");
{
  const B = await withBoth({
    routes: { ...ROUTES, [`/restaurants/${ID}/menu`]: menuOutOfRange },
  });
  const snapEmpty = (p) => p.evaluate(() => ({
    visible: document.querySelectorAll(".menu-item:not(.hidden-by-filter)").length,
    emptyGroups: document.querySelectorAll(".menu-cat-group.cat-group-empty").length,
    groups: document.querySelectorAll(".menu-cat-group").length,
    emptyMsgDisplay: getComputedStyle(document.getElementById("empty-filter-msg")).display,
    emptyIcon: document.getElementById("empty-filter-icon").className,
    emptyTitle: document.getElementById("empty-filter-title").textContent,
    emptySub: document.getElementById("empty-filter-sub").textContent,
    clearHidden: document.getElementById("empty-filter-clear").hidden,
  }));
  await B.legacy.page.click("#filter-price");
  await B.new.page.click("#filter-price");
  await B.legacy.page.waitForTimeout(850);
  await B.new.page.waitForTimeout(850);
  const L = await snapEmpty(B.legacy.page);
  const N = await snapEmpty(B.new.page);
  check("empty state: filter-price on ₹10 menu", L, N);
  log(`  visible ${N.visible} / emptyGroups ${N.emptyGroups} / msg ${JSON.stringify(N.emptyTitle)} clearHidden ${N.clearHidden}`);
  await B.close();
}

/* ── chunk 7: the DEAD filter sheet, driven through its public functions ── */
log("");
log("### 4. chunk 7 — dead filter sheet (toggleDraftReordered + applySheetFilters)");
{
  const B = await withBoth({ routes: ROUTES });
  const drive = async (p) => {
    await p.evaluate(() => {
      window.toggleDraftReordered();
      window.applySheetFilters();
    });
    await p.waitForTimeout(850);
  };
  await drive(B.legacy.page);
  await drive(B.new.page);
  const snapSheet = (p) => p.evaluate(() => ({
    visible: document.querySelectorAll(".menu-item:not(.hidden-by-filter)").length,
    emptyMsgDisplay: getComputedStyle(document.getElementById("empty-filter-msg")).display,
    emptyIcon: document.getElementById("empty-filter-icon").className,
    emptyTitle: document.getElementById("empty-filter-title").textContent,
    emptySub: document.getElementById("empty-filter-sub").textContent,
    clearHidden: document.getElementById("empty-filter-clear").hidden,
    badge: document.getElementById("filter-count-badge"),
    applyBtn: document.getElementById("apply-filter-btn"),
    backdrop: document.getElementById("filter-sheet-backdrop"),
  }));
  const L = await snapSheet(B.legacy.page);
  const N = await snapSheet(B.new.page);
  check("dead sheet: applySheetFilters(reordered) result", L, N);
  log(`  msg ${JSON.stringify(N.emptyTitle)} / clearHidden ${N.clearHidden} / backdrop ${N.backdrop}`);
  /* reset for cleanliness */
  await B.legacy.page.evaluate(() => window.resetAllMenuFilters());
  await B.new.page.evaluate(() => window.resetAllMenuFilters());
  await B.close();
}

/* ── chunk 7: states (no id / 500 / empty menu) ───────────────────────── */
log("");
log("### 5. chunk 7 — error / empty states");
{
  const stateSnap = (p) => p.evaluate(() => {
    const c = document.getElementById("menu-container");
    return {
      html: c.innerHTML.replace(/\s+/g, " ").trim(),
      display: getComputedStyle(c).display,
      skeleton: getComputedStyle(document.getElementById("menu-skeleton")).display,
      filterBar: getComputedStyle(document.querySelector(".filter-bar")).display,
      hasRetry: !!document.getElementById("menu-retry-btn"),
    };
  });

  /* (a) no ?id= */
  {
    const B = await withBoth({ routes: ROUTES, id: "" });
    check("state: no ?id= → error card", await stateSnap(B.legacy.page), await stateSnap(B.new.page));
    log(`  no-id html: ${JSON.stringify((await stateSnap(B.new.page)).html).slice(0, 160)}`);
    await B.close();
  }
  /* (b) restaurant 500 */
  {
    const B = await withBoth({
      routes: { ...ROUTES, [`/restaurants/${ID}`]: { __status: 500, __body: { success: false, message: "Internal Server Error" } } },
    });
    const L = await stateSnap(B.legacy.page);
    const N = await stateSnap(B.new.page);
    check("state: restaurant 500 → error card WITH retry", L, N);
    log(`  500 html: ${JSON.stringify(N.html).slice(0, 200)} hasRetry=${N.hasRetry}`);
    await B.close();
  }
  /* (c) menu data {} */
  {
    const B = await withBoth({
      routes: { ...ROUTES, [`/restaurants/${ID}/menu`]: { success: true, count: 0, data: {} } },
    });
    const L = await stateSnap(B.legacy.page);
    const N = await stateSnap(B.new.page);
    check("state: menu data {} → Menu not available", L, N);
    log(`  empty-menu html: ${JSON.stringify(N.html).slice(0, 160)}`);
    await B.close();
  }
}

/* ── chunk 7: focusItem scroll + class add/remove ─────────────────────── */
log("");
log("### 6. chunk 7 — focusItem adds then removes .ew-search-focus-item");
{
  const target = Object.values(menuPayload.data)[0][1] && Object.values(menuPayload.data)[0][1]._id;
  /* settle: 0 — the class is added ~120 ms after the menu renders and removed
     1800 ms later, so a normal 2.2 s settle would already be past it. */
  const B = await withBoth({ routes: ROUTES, focusItem: target, settle: 0 });
  /* The class is added ~120 ms after the menu renders and removed 1800 ms later.
     withBoth opens the two pages SEQUENTIALLY, so by the time both are ready the
     legacy page's window may already have closed. Install a recorder with
     `addInitScript` (so it runs before every document's scripts) and reload both
     pages, then read whether the class was EVER added and later removed. */
  const recorder = (tid) => {
    window.__focus = { added: false, removed: false, seen: false };
    const check = () => {
      const el = document.querySelector('.menu-item[data-menu-item-id="' + tid + '"]');
      if (!el) return;
      if (el.classList.contains("ew-search-focus-item")) {
        window.__focus.added = true;
        window.__focus.seen = true;
      } else if (window.__focus.seen) {
        window.__focus.removed = true;
      }
    };
    const start = () =>
      new MutationObserver(check).observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["class"],
      });
    if (document.body) start();
    else document.addEventListener("DOMContentLoaded", start);
  };
  await B.legacy.page.addInitScript(recorder, target);
  await B.new.page.addInitScript(recorder, target);
  const lUrl = B.legacy.page.url();
  const nUrl = B.new.page.url();
  await Promise.all([
    B.legacy.page.goto(lUrl, { waitUntil: "networkidle" }),
    B.new.page.goto(nUrl, { waitUntil: "networkidle" }),
  ]);
  await B.legacy.page.waitForTimeout(700);
  const focusState = (p) => p.evaluate(() => window.__focus);
  const lFocus = await focusState(B.legacy.page);
  const nFocus = await focusState(B.new.page);
  const lAdd = lFocus.added;
  const nAdd = nFocus.added;
  check("focusItem: class appears on BOTH pages", lAdd, nAdd);
  check("focusItem: class IS present", nAdd, true);
  await B.legacy.page.waitForTimeout(2200);
  await B.new.page.waitForTimeout(2200);
  const atGone = (p) => p.evaluate((id) => {
    const el = document.querySelector(`.menu-item[data-menu-item-id="${id}"]`);
    return el ? el.classList.contains("ew-search-focus-item") : null;
  }, target);
  const lGone = await atGone(B.legacy.page);
  const nGone = await atGone(B.new.page);
  check("focusItem: class removed after 1800ms", lGone, nGone);
  check("focusItem: class IS gone", nGone, false);
  log(`  focusItem ${target}: appeared ${nAdd} / gone ${nGone}`);
  await B.close();
}

/* ── chunk 7: dark mode ───────────────────────────────────────────────── */
log("");
log("### 7. chunk 7 — dark mode");
{
  const B = await withBoth({ routes: ROUTES, theme: "dark" });
  const dm = (p) => p.evaluate(() => ({
    theme: document.documentElement.dataset.ewTheme,
    htmlBg: getComputedStyle(document.documentElement).backgroundColor,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    menuItems: document.querySelectorAll(".menu-item").length,
    firstTitle: document.querySelector(".nb-item-title") ? document.querySelector(".nb-item-title").textContent : null,
  }));
  const L = await dm(B.legacy.page);
  const N = await dm(B.new.page);
  check("dark mode: theme + backgrounds + menu", L, N);
  log(`  dark: ${JSON.stringify(N)}`);
  await B.close();
}

/* ── table ────────────────────────────────────────────────────────────── */
log("");
log("### PASS / FAIL TABLE");
const wName = Math.max(...rows.map((r) => r.name.length), 10);
log("CHECK".padEnd(wName) + " | RESULT");
log("-".repeat(wName + 9));
for (const r of rows) log(r.name.padEnd(wName) + " | " + (r.ok ? "PASS" : "FAIL"));
log("");
log(failures === 0 ? `CHUNKS 6-7 PARITY: PASS (${rows.length} checks)` : `CHUNKS 6-7 PARITY: FAIL (${failures}/${rows.length} checks differ)`);

fs.mkdirSync("compare-out", { recursive: true });
fs.writeFileSync("compare-out/shell-chunks67-parity.txt", lines.join("\n") + "\n");
console.log("\nwrote compare-out/shell-chunks67-parity.txt");
process.exit(failures === 0 ? 0 : 1);
