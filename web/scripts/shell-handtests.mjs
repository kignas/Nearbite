// Phase 2 chunks 1–3 hand-tests for /restaurant-shell.
// Runs legacy and new side by side with the __hang__ fixtures (so both stay on
// the skeleton) and checks: the 46 static ids, the inline-handler attributes,
// the initial state, the chunk-3 globals, dark mode, and the CSS leak check.
// Writes compare-out/shell-handtests.txt.
import { chromium } from "playwright";
import fs from "node:fs";

const LEGACY = process.env.LEGACY || "http://localhost:8080/restaurant-shell";
const NEW = process.env.NEW || "http://localhost:3000/restaurant-shell";
const ID = "6ac8f95828669b5f4e30f0ba";
const HANG = "__hang__";
const fixtures = JSON.parse(
  fs.readFileSync("scripts/fixtures/restaurant-shell-hang.json", "utf8")
);

const lines = [];
const log = (...a) => {
  lines.push(a.join(" "));
  console.log(...a);
};

function fixtureFor(raw) {
  const u = new URL(raw);
  const p = u.pathname.replace(/^\/api/, "");
  if (fixtures[p + u.search] !== undefined) return fixtures[p + u.search];
  if (fixtures[p] !== undefined) return fixtures[p];
  return undefined;
}
async function install(page) {
  await page.route("https://api.eatswada.com/**", (r) => {
    const b = fixtureFor(r.request().url());
    if (b === undefined)
      return r.fulfill({
        status: 404,
        headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
        body: "{}",
      });
    if (b === HANG) return;
    return r.fulfill({
      status: 200,
      headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
      body: JSON.stringify(b),
    });
  });
}

const SNAPSHOT = () => {
  const ids = Array.from(document.querySelectorAll("[id]")).map((e) => e.id);
  const handlers = [];
  document.querySelectorAll("[onclick],[oninput]").forEach((e) => {
    if (e.hasAttribute("onclick"))
      handlers.push({ id: e.id || e.tagName, attr: "onclick", value: e.getAttribute("onclick") });
    if (e.hasAttribute("oninput"))
      handlers.push({ id: e.id || e.tagName, attr: "oninput", value: e.getAttribute("oninput") });
  });
  const leftover = document.querySelectorAll("[data-ew-onclick],[data-ew-oninput]").length;
  const el = (id) => document.getElementById(id);
  const style = (id) => {
    const e = el(id);
    return e ? getComputedStyle(e).display : null;
  };
  return {
    ids,
    handlers,
    leftover,
    resName: el("res-name") ? el("res-name").textContent : null,
    menuContainerDisplay: style("menu-container"),
    menuSkeletonDisplay: style("menu-skeleton"),
    infoPaneHidden: el("info-pane") ? el("info-pane").hidden : null,
    globals: {
      ewLoadVisibleImages: typeof window.ewLoadVisibleImages,
      scrollToCategory: typeof window.scrollToCategory,
      toggleFilter: typeof window.toggleFilter,
      ewAutoScrollIntoMenu: typeof window.ewAutoScrollIntoMenu,
      optimizedImageUrl: typeof window.optimizedImageUrl,
      optimizedImageUrlSample:
        typeof window.optimizedImageUrl === "function"
          ? window.optimizedImageUrl(
              "https://res.cloudinary.com/x/image/upload/v1/a.jpg",
              200
            )
          : null,
    },
  };
};

// The 46 static ids of legacy L115–278 (chunks 1–3's own markup). Anything else
// the legacy page carries at runtime belongs to a later chunk or is the
// extracted inline <style id="ew-header-v2">.
const STATIC_IDS = [
  "ew-free-delivery-toast", "menu-search-btn", "restaurant-heart-icon",
  "menu-search-row", "menu-search-input", "menu-search-clear", "res-name",
  "res-verified", "res-cuisine", "res-distance", "res-time", "res-rating-pill",
  "res-rating-num", "res-rating-count", "res-offer-banner", "res-offer-text",
  "res-free-delivery", "delivery-rider-image", "delivery-rider-fallback",
  "order-hint", "res-tabs", "res-tab-menu", "res-tab-info", "cat-nav-sentinel",
  "cat-nav", "cat-nav-inner", "menu-pane", "restaurant-filter-bar",
  "quick-filter-row", "filter-popular", "filter-rating", "filter-price",
  "filter-veg", "filter-nonveg", "menu-skeleton", "menu-container",
  "empty-filter-msg", "empty-filter-icon", "empty-filter-title",
  "empty-filter-sub", "empty-filter-clear", "menu-footer", "rmf-fssai",
  "info-pane", "info-skeleton", "info-content",
];

// #es-pink-inner is the already-ported shared CartBar's own button; legacy
// cart-bar.js writes its onclick via innerHTML, the React port uses a real
// onClick. Out of scope for this task.
const OUT_OF_SCOPE_HANDLER_IDS = new Set(["es-pink-inner"]);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });

async function load(url, extra) {
  const page = await ctx.newPage();
  await install(page);
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e).split("\n")[0]));
  if (extra) await page.addInitScript(extra);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1600);
  return { page, errs };
}

// ── 1. Legacy vs new snapshot ──────────────────────────────────────────
const legacy = await load(`${LEGACY}?id=${ID}`);
const newp = await load(`${NEW}?id=${ID}`);
const L = await legacy.page.evaluate(SNAPSHOT);
const N = await newp.page.evaluate(SNAPSHOT);

log("## /restaurant-shell chunks 1-3 hand-tests");
log("");
log("### 1. Static id set (the 46 ids of legacy L115-278)");
log(`legacy total ids: ${L.ids.length}   new total ids: ${N.ids.length}`);
const lset = new Set(L.ids);
const nset = new Set(N.ids);
const missing = STATIC_IDS.filter((i) => !nset.has(i));
const notInLegacy = STATIC_IDS.filter((i) => !lset.has(i));
log(`of the 46 static ids, missing in new: ${missing.length ? missing.join(", ") : "(none)"}`);
log(`of the 46 static ids, absent from legacy too: ${notInLegacy.length ? notInLegacy.join(", ") : "(none)"}`);
const newOnly = N.ids.filter((i) => !lset.has(i));
log(`ids present only on the new page (Next internals expected): ${newOnly.length ? newOnly.join(", ") : "(none)"}`);
log(`ALL 46 STATIC IDS PRESENT IN NEW: ${missing.length === 0 && notInLegacy.length === 0 ? "PASS" : "FAIL"}`);

log("");
log("### 2. Inline handler attributes (must be byte-identical)");
const key = (h) => `${h.id}|${h.attr}`;
const inScope = (h) => !OUT_OF_SCOPE_HANDLER_IDS.has(h.id);
const lmap = new Map(L.handlers.filter(inScope).map((h) => [key(h), h.value]));
const nmap = new Map(N.handlers.filter(inScope).map((h) => [key(h), h.value]));
let hDiff = 0;
for (const [k, v] of lmap) {
  if (nmap.get(k) !== v) {
    hDiff++;
    log(`  DIFF ${k}\n    legacy: ${v}\n    new   : ${nmap.get(k)}`);
  }
}
for (const k of nmap.keys()) if (!lmap.has(k)) { hDiff++; log(`  NEW-ONLY handler ${k}`); }
log(`legacy in-scope handlers: ${lmap.size}   new in-scope handlers: ${nmap.size}   diffs: ${hDiff}`);
log(`out of scope (already-ported CartBar): ${[...OUT_OF_SCOPE_HANDLER_IDS].join(", ")}`);
log(`leftover data-ew-* attributes: legacy ${L.leftover} / new ${N.leftover}`);
log(`HANDLERS IDENTICAL: ${hDiff === 0 && N.leftover === 0 ? "PASS" : "FAIL"}`);

log("");
log("### 3. Initial skeleton state");
for (const [name, v] of [["res-name", "resName"], ["#menu-container display", "menuContainerDisplay"], ["#menu-skeleton display", "menuSkeletonDisplay"], ["#info-pane hidden", "infoPaneHidden"]]) {
  const eq = JSON.stringify(L[v]) === JSON.stringify(N[v]);
  log(`  ${name}: legacy=${JSON.stringify(L[v])} new=${JSON.stringify(N[v])} ${eq ? "PASS" : "FAIL"}`);
}

log("");
log("### 4. Chunk-3 globals (new page)");
for (const [k, v] of Object.entries(N.globals)) log(`  window.${k} = ${JSON.stringify(v)}`);
const globalsOk =
  N.globals.ewLoadVisibleImages === "function" &&
  N.globals.scrollToCategory === "function" &&
  N.globals.toggleFilter === "function" &&
  N.globals.ewAutoScrollIntoMenu === "function" &&
  N.globals.optimizedImageUrl === "function" &&
  String(N.globals.optimizedImageUrlSample).includes("f_auto,q_auto,w_200");
log(`  optimizedImageUrl NOT overwritten by the chunk-3 fallback: ${String(N.globals.optimizedImageUrlSample).includes("f_auto,q_auto,w_200") ? "PASS" : "FAIL"}`);
log(`GLOBALS: ${globalsOk ? "PASS" : "FAIL"}`);
log(`page errors: legacy ${JSON.stringify(legacy.errs)} new ${JSON.stringify(newp.errs)}`);

// ── 5. Diet quick chip toggle ──────────────────────────────────────────
log("");
log("### 5. Diet quick chips (#filter-veg / #filter-nonveg)");
const chipSeq = async (page) => {
  return page.evaluate(() => {
    const veg = document.getElementById("filter-veg");
    const nonveg = document.getElementById("filter-nonveg");
    const snap = () => ({
      veg: veg.classList.contains("active") + "/" + veg.getAttribute("aria-pressed"),
      nonveg: nonveg.classList.contains("active") + "/" + nonveg.getAttribute("aria-pressed"),
    });
    const out = [snap()];
    veg.click();
    out.push(snap());
    nonveg.click();
    out.push(snap());
    nonveg.click();
    out.push(snap());
    return out;
  });
};
const lchips = await chipSeq(legacy.page);
const nchips = await newp.page.evaluate(() => {
  // new page uses the promoted onclick attribute; trigger via the same path
  const veg = document.getElementById("filter-veg");
  const nonveg = document.getElementById("filter-nonveg");
  const snap = () => ({
    veg: veg.classList.contains("active") + "/" + veg.getAttribute("aria-pressed"),
    nonveg: nonveg.classList.contains("active") + "/" + nonveg.getAttribute("aria-pressed"),
  });
  const out = [snap()];
  veg.click();
  out.push(snap());
  nonveg.click();
  out.push(snap());
  nonveg.click();
  out.push(snap());
  return out;
});
log(`  legacy: ${JSON.stringify(lchips)}`);
log(`  new   : ${JSON.stringify(nchips)}`);
log(`CHIP SEQUENCE IDENTICAL: ${JSON.stringify(lchips) === JSON.stringify(nchips) ? "PASS" : "FAIL"}`);

// ── 6. Dark mode ───────────────────────────────────────────────────────
log("");
log("### 6. Dark mode (eatswada_theme=dark)");
const darkInit = () => {
  try { localStorage.setItem("eatswada_theme", "dark"); } catch (e) {}
};
const ldark = await load(`${LEGACY}?id=${ID}`, darkInit);
const ndark = await load(`${NEW}?id=${ID}`, darkInit);
const dm = async (page) =>
  page.evaluate(() => ({
    theme: document.documentElement.dataset.ewTheme,
    htmlBg: getComputedStyle(document.documentElement).backgroundColor,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    bodyText: document.body.innerText.length,
    visibleChildren: Array.from(document.body.children).filter((e) => {
      const s = getComputedStyle(e);
      return s.display !== "none" && e.tagName !== "SCRIPT";
    }).length,
    darkReader: !!document.querySelector("script[data-ew-dark-reader]"),
  }));
const LD = await dm(ldark.page);
const ND = await dm(ndark.page);
log(`  legacy: ${JSON.stringify(LD)}`);
log(`  new   : ${JSON.stringify(ND)}`);
log(`DARK THEME MATCH: ${LD.theme === ND.theme && LD.theme === "dark" && LD.htmlBg === ND.htmlBg && LD.bodyBg === ND.bodyBg ? "PASS" : "FAIL"}`);

// ── 7. CSS leak check ──────────────────────────────────────────────────
log("");
log("### 7. CSS leak check (/under99 -> /restaurant-shell -> /under99)");
// Every real internal link in the app is a plain <a>, i.e. a FULL reload, so a
// soft navigation can only be produced with a real next/link. A temporary probe
// route `app/leakprobe/page.tsx` (deleted before packaging) carries
// restaurant-shell's two inline CSS blocks as its own route CSS and links to
// /under99 with <Link>. Sequence:
//   1. hard-load /under99              -> baseline S0
//   2. hard-load /leakprobe (loads restaurant-shell's inline CSS)
//   3. soft-nav <Link> /leakprobe -> /under99
//   4. compare /under99 computed styles to S0
// If restaurant-shell's CSS leaked into /under99, step 4 would differ.
const LEAK_SELECTORS = [
  "body", ".u99-header", ".u99-hero", ".u99-filter-rail", ".u99-chip",
  ".u99-page", ".u99-price-seg", ".u99-price-tab", ".u99-products-head",
  "#u99-count", ".u99-product-grid", ".u99-card", ".u99-price", "#white-cart-root",
];
const computed = (page) =>
  page.evaluate((sels) => {
    const out = {};
    for (const s of sels) {
      const e = document.querySelector(s);
      if (!e) { out[s] = null; continue; }
      const cs = getComputedStyle(e);
      out[s] = [cs.backgroundColor, cs.color, cs.fontSize, cs.paddingTop, cs.marginTop, cs.display].join("|");
    }
    out.__sheets = document.styleSheets.length;
    out.__list = Array.from(document.styleSheets).map((s) => s.href || "(inline)");
    return out;
  }, LEAK_SELECTORS);

const leakCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
const leakPage = await leakCtx.newPage();
await install(leakPage);
const ORIGIN = new URL(NEW).origin;

// The probe route is temporary and is deleted before packaging. If it is not
// present (e.g. the owner runs this script on the shipped tree), say so instead
// of failing; the leak check is a one-off verification.
const probeRes = await leakPage.request.get(`${ORIGIN}/leakprobe`).catch(() => null);
if (!probeRes || !probeRes.ok()) {
  log("  SKIPPED: temporary probe route /leakprobe is not present.");
  log("  To re-run it: create web/app/leakprobe/page.tsx importing");
  log("  styles/legacy/restaurant-shell-inline-1.css and -2.css and linking to");
  log("  /under99 with next/link, rebuild, then run this script. The recorded");
  log("  result of the real run is in PROGRESS.md (0 computed-style diffs).");
  await leakCtx.close();
  await browser.close();
  fs.mkdirSync("compare-out", { recursive: true });
  fs.writeFileSync("compare-out/shell-handtests.txt", lines.join("\n") + "\n");
  console.log("\nwrote compare-out/shell-handtests.txt");
  process.exit(0);
}

// S0: a fresh, full load of /under99.
await leakPage.goto(`${ORIGIN}/under99`, { waitUntil: "domcontentloaded" });
await leakPage.waitForTimeout(1000);
const before = await computed(leakPage);

// Load the probe (which imports restaurant-shell's inline CSS), then soft-nav.
await leakPage.goto(`${ORIGIN}/leakprobe`, { waitUntil: "domcontentloaded" });
await leakPage.waitForTimeout(600);
const probeSheets = await leakPage.evaluate(() => document.styleSheets.length);
await leakPage.click("#to-u99");
await leakPage.waitForTimeout(1200);
const after = await computed(leakPage);
const afterPath = await leakPage.evaluate(() => location.pathname);

let styleDiffs = 0;
for (const s of LEAK_SELECTORS) {
  if (before[s] !== after[s]) {
    styleDiffs++;
    log(`  DIFF ${s}\n    baseline: ${before[s]}\n    leaked  : ${after[s]}`);
  }
}
log(`  baseline /under99 (full load)        : ${before.__sheets} sheets`);
log(`  /leakprobe (restaurant-shell CSS)     : ${probeSheets} sheets`);
log(`  after soft-nav probe -> /under99      : ${after.__sheets} sheets (path ${afterPath})`);
log(`  computed-style diffs on /under99 (${LEAK_SELECTORS.length} selectors): ${styleDiffs}`);
const added = after.__list.filter((h) => !before.__list.includes(h));
log(`  stylesheets retained after the soft nav: ${added.length}`);
added.forEach((h) => log(`    + ${h}`));
log(`  Body background ${before.body === after.body ? "UNCHANGED" : "CHANGED"} across the soft nav.`);
log(`  NOTE: Next.js App Router injects a route's CSS on soft navigation and`);
log(`  never removes it — stock framework behaviour (recorded in MEMORY for`);
log(`  Phase 1c), not a port bug. Every real internal link is a plain <a>`);
log(`  (full reload), so there is no user-visible effect.`);
log(`CSS LEAK (computed styles): ${styleDiffs === 0 ? "PASS (no restyle)" : "FAIL"}`);
await leakCtx.close();

await browser.close();
fs.mkdirSync("compare-out", { recursive: true });
fs.writeFileSync("compare-out/shell-handtests.txt", lines.join("\n") + "\n");
console.log("\nwrote compare-out/shell-handtests.txt");
