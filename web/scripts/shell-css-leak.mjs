// Phase 2h PART A4 — CSS leak: /under99 -> (soft nav) /restaurant-shell -> /under99.
//
// Reports (does NOT fix) whether a client-side navigation into
// /restaurant-shell changes how /under99 renders. The sequence:
//   1. hard-load /under99                     -> baseline pixel + computed styles
//   2. soft-nav to /restaurant-shell          (client-side, keeps CSS in <head>)
//   3. soft-nav back to /under99
//   4. pixel-diff that second /under99 vs the fresh load
//
// Uses the temporary app/leakprobe route only as a navigation vehicle (the app
// has no next/link elsewhere; every real internal link is a plain <a>).
//
// Usage: node scripts/shell-css-leak.mjs [newOrigin]
import { chromium } from "playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import fs from "node:fs";

const ORIGIN = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const ID = "6ac8f95828669b5f4e30f0ba";
fs.mkdirSync("compare-out", { recursive: true });

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

const SELECTORS = [
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
  }, SELECTORS);

const shot = async (page, file) => {
  await page.addStyleTag({ content: "*{animation:none!important;transition:none!important;caret-color:transparent!important}" });
  await page.waitForTimeout(900);
  await page.screenshot({ path: file, fullPage: true });
};

function diffPct(fa, fb) {
  const a = PNG.sync.read(fs.readFileSync(fa));
  const b = PNG.sync.read(fs.readFileSync(fb));
  const w = Math.max(a.width, b.width), h = Math.max(a.height, b.height);
  const pad = (img) => { const o = new PNG({ width: w, height: h }); o.data.fill(255); PNG.bitblt(img, o, 0, 0, img.width, img.height, 0, 0); return o; };
  const A = pad(a), B = pad(b), D = new PNG({ width: w, height: h });
  const d = pixelmatch(A.data, B.data, D.data, w, h, { threshold: 0.12 });
  fs.writeFileSync("compare-out/leak-diff.png", PNG.sync.write(D));
  return { pct: (d / (w * h)) * 100, heightDiffers: a.height !== b.height, ah: a.height, bh: b.height };
}

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await install(page);

  // 1. fresh /under99
  await page.goto(`${ORIGIN}/under99`, { waitUntil: "networkidle" });
  await shot(page, "compare-out/leak-under99-fresh.png");
  const before = await computed(page);

  // 2. soft-nav to /restaurant-shell via the probe (client-side)
  await page.goto(`${ORIGIN}/leakprobe`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await page.click("#to-shell");
  await page.waitForURL("**/restaurant-shell**");
  await page.waitForTimeout(2500);
  const onShell = await computed(page);

  // 3. soft-nav back to /under99
  await page.goto(`${ORIGIN}/leakprobe`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await page.click("#to-u99");
  await page.waitForURL("**/under99");
  await shot(page, "compare-out/leak-under99-after.png");
  const after = await computed(page);

  const { pct, heightDiffers, ah, bh } = diffPct("compare-out/leak-under99-fresh.png", "compare-out/leak-under99-after.png");

  let styleDiffs = 0;
  for (const s of SELECTORS) if (before[s] !== after[s]) { styleDiffs++; console.log(`  DIFF ${s}\n    fresh: ${before[s]}\n    after: ${after[s]}`); }
  const added = after.__list.filter((h) => !before.__list.includes(h));

  console.log("### A4 CSS leak (/under99 -> /restaurant-shell -> /under99)");
  console.log(`  fresh /under99 sheets        : ${before.__sheets}`);
  console.log(`  on /restaurant-shell sheets  : ${onShell.__sheets}`);
  console.log(`  after soft-nav /under99      : ${after.__sheets}`);
  console.log(`  stylesheets retained after soft-nav: ${added.length}`);
  added.forEach((h) => console.log(`    + ${h}`));
  console.log(`  computed-style diffs (${SELECTORS.length} selectors): ${styleDiffs}`);
  console.log(`  body background ${before.body === after.body ? "UNCHANGED" : "CHANGED"}`);
  console.log(`  pixel diff fresh vs after    : ${pct.toFixed(2)}%${heightDiffers ? ` (page height ${ah} vs ${bh})` : ""}`);
} finally {
  await browser.close();
}
