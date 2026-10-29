// Phase 2h PART A3 — dead-code presence parity for /restaurant-shell.
//
// Legacy keeps several dead / decorative code paths on this page. The port must
// keep them present (or absent) EXACTLY as legacy, for byte-parity. Each item is
// measured on the legacy page and on the new page and compared.
//
// Items (map §7.1–§7.3, §7.5, §7.11):
//   1. dead advanced-filter sheet  — no sheet markup, but the sheet functions
//      exist on `window` (openFilterSheet/applySheetFilters/…) and the badge
//      elements are absent.
//   2. decorative heart            — `#restaurant-heart-icon` present, and
//      `toggleRestaurantFavorite` exists but does NOT touch `eatswada_favorites`.
//   3. hidden search row           — `#menu-search-row[hidden]` + input + clear.
//   4. FSSAI logo reference        — `#rmf-fssai[hidden]` present; FSSAI_LOGO_SRC
//      resolves to a non-empty string (the asset itself 404s on purpose).
//   5. search-overlay loading      — the overlay is loaded (css injected) but
//      never opened; `window.openEatswadaSearch` is a function.
//
// Usage: node scripts/shell-deadcode.mjs [legacyUrl] [newUrl]
import { chromium } from "playwright";
import fs from "node:fs";

const LEGACY = process.argv[2] || "http://localhost:8080/restaurant-shell.html";
const NEW = process.argv[3] || "http://localhost:3000/restaurant-shell";
const ID = "6ac8f95828669b5f4e30f0ba";

const home = JSON.parse(fs.readFileSync("scripts/fixtures/home.json", "utf8"));
const restaurant = home["/restaurants"].data.find((r) => r._id === ID);
const menuPayload = home[`/restaurants/${ID}/menu`];

async function install(page) {
  await page.route("https://api.eatswada.com/**", (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    let body;
    if (p === `/restaurants/${ID}`) body = restaurant;
    else if (p === `/restaurants/${ID}/menu`) body = menuPayload;
    if (body === undefined)
      return route.fulfill({ status: 404, headers: { "access-control-allow-origin": "*" }, body: "{}" });
    return route.fulfill({
      status: 200,
      headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
      body: JSON.stringify(body),
    });
  });
}

const PROBE = () => {
  const el = (id) => document.getElementById(id);
  const has = (sel) => !!document.querySelector(sel);
  const fns = [
    "openFilterSheet", "closeFilterSheet", "syncSheetOptions", "applySheetFilters",
    "setDraftSort", "setDraftDiet", "toggleDraftReordered", "clearAllFilters",
    "previewFilterCount", "activeSheetCount", "updateFilterBadge",
    "toggleRestaurantFavorite", "onMenuSearchInput", "clearMenuSearch",
    "closeMenuSearch", "syncSearchClearButton", "toggleMenuSearch",
    "openEatswadaSearch", "ewFssaiHTML", "ewFssaiFill",
  ];
  const fnTypes = {};
  fns.forEach((n) => { fnTypes[n] = typeof window[n]; });
  const row = el("menu-search-row");
  const heart = el("restaurant-heart-icon");
  const fssai = el("rmf-fssai");
  // Heart must not be wired to favorites: no favorites key is created/read by it.
  let favBefore = null, favAfter = null;
  try {
    favBefore = localStorage.getItem("eatswada_favorites");
    if (heart && typeof window.toggleRestaurantFavorite === "function") window.toggleRestaurantFavorite();
    favAfter = localStorage.getItem("eatswada_favorites");
  } catch (e) {}
  return {
    // 1. dead filter sheet
    sheet: {
      advancedFilterBtn: has("#advanced-filter-btn"),
      backdrop: has("#filter-sheet-backdrop"),
      sheetOption: has(".sheet-option"),
      applyFilterBtn: has("#apply-filter-btn"),
      filterCountBadge: has("#filter-count-badge"),
    },
    // 2. decorative heart
    heart: {
      present: !!heart,
      className: heart ? heart.className : null,
      favUnchanged: favBefore === favAfter,
    },
    // 3. hidden search row
    searchRow: {
      present: !!row,
      hidden: row ? row.hidden : null,
      input: !!el("menu-search-input"),
      clear: !!el("menu-search-clear"),
      clearHidden: el("menu-search-clear") ? el("menu-search-clear").hidden : null,
    },
    // 4. FSSAI — `FSSAI_LOGO_SRC` is a legacy top-level const (NOT on window),
    // so probe the OBSERVABLE behaviour: ewFssaiHTML must still emit the dead
    // <img src="assets/fssai-logo.png"> reference.
    fssai: {
      present: !!fssai,
      hidden: fssai ? fssai.hidden : null,
      html: (() => {
        try { return String(window.ewFssaiHTML("12345678901234", "fss")); }
        catch (e) { return "ERR:" + e.message; }
      })(),
    },
    // 5. search-overlay
    overlay: {
      cssInjected: !!document.querySelector('link[href*="search-overlay.css"]'),
      openIsFn: typeof window.openEatswadaSearch === "function",
    },
    fnTypes,
  };
};

const browser = await chromium.launch();
let fail = false;
const out = [];
try {
  async function probe(url) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await install(page);
    await page.goto(url + (url.includes("?") ? "&" : "?") + "id=" + ID, { waitUntil: "load" });
    await page.waitForTimeout(4000);
    const r = await page.evaluate(PROBE);
    await ctx.close();
    return r;
  }
  const legacy = await probe(LEGACY);
  const modern = await probe(NEW);

  const checks = [];
  const cmp = (name, a, b) => checks.push({ name, legacy: a, new: b, ok: a === b });
  cmp("1 advanced-filter-btn absent", legacy.sheet.advancedFilterBtn, modern.sheet.advancedFilterBtn);
  cmp("1 filter-sheet-backdrop absent", legacy.sheet.backdrop, modern.sheet.backdrop);
  cmp("1 .sheet-option absent", legacy.sheet.sheetOption, modern.sheet.sheetOption);
  cmp("1 apply-filter-btn absent", legacy.sheet.applyFilterBtn, modern.sheet.applyFilterBtn);
  cmp("1 filter-count-badge absent", legacy.sheet.filterCountBadge, modern.sheet.filterCountBadge);
  cmp("1 sheet fns are functions", legacy.fnTypes.applySheetFilters, modern.fnTypes.applySheetFilters);
  cmp("2 heart present", legacy.heart.present, modern.heart.present);
  cmp("2 heart class", legacy.heart.className, modern.heart.className);
  cmp("2 heart not wired to favorites", legacy.heart.favUnchanged, modern.heart.favUnchanged);
  cmp("3 search row present", legacy.searchRow.present, modern.searchRow.present);
  cmp("3 search row hidden", legacy.searchRow.hidden, modern.searchRow.hidden);
  cmp("3 search input present", legacy.searchRow.input, modern.searchRow.input);
  cmp("3 search clear present", legacy.searchRow.clear, modern.searchRow.clear);
  cmp("3 search clear hidden", legacy.searchRow.clearHidden, modern.searchRow.clearHidden);
  cmp("4 fssai div present", legacy.fssai.present, modern.fssai.present);
  cmp("4 fssai div hidden", legacy.fssai.hidden, modern.fssai.hidden);
  cmp("4 FSSAI dead img reference emitted", legacy.fssai.html, modern.fssai.html);
  cmp("5 overlay css injected", legacy.overlay.cssInjected, modern.overlay.cssInjected);
  cmp("5 openEatswadaSearch is fn", legacy.overlay.openIsFn, modern.overlay.openIsFn);

  for (const c of checks) {
    if (!c.ok) fail = true;
    const line = `${c.ok ? "PASS" : "FAIL"} ${c.name}: legacy=${JSON.stringify(c.legacy)} new=${JSON.stringify(c.new)}`;
    out.push(line);
    console.log(line);
  }
} finally {
  await browser.close();
}
fs.writeFileSync("compare-out/shell-deadcode.txt", out.join("\n") + "\n");
console.log(fail ? "FAIL" : "ALL PASS (" + out.length + " checks)");
process.exit(fail ? 1 : 0);
