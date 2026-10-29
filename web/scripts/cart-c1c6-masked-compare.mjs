// C1–C6 pixel compare (Phase 2l).
//
// Usage: node scripts/cart-c1c6-masked-compare.mjs [legacyUrl] [newUrl] [fixtures] [seed]
//   defaults: http://localhost:8080/cart.html  http://localhost:3000/cart
//             scripts/fixtures/cart-seeded.json  scripts/fixtures/seed-cart-plain.json
//
// The plain compare.mjs run on /cart is NOT ~0% while chunks C5–C11 are
// unported: legacy renders the complete-your-meal rail (C5), the payment card
// (C7), the free-delivery progress bar (C7) and the platform banners (C7),
// none of which this task ports. To measure the C1 (shell + CSS) + C2 (money)
// + C3 (delivery fee) + C4 (item rows) surface honestly this script hides
// ONLY those later-chunk blocks and compares everything else exactly like
// compare.mjs (fullPage, pad to max W/H, animations off, threshold 0.12).
//
// Unlike the Phase-2j cart-masked-compare.mjs this does NOT hide the item
// card (.ct-card.ct-item-card) — C4 now paints it and it must match — and it
// does NOT neutralise #ct-dh-restaurant / #bill-delivery-label, because C3/C4
// now write those labels for real.
import { chromium } from "playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import fs from "node:fs";

const [
  legacyUrl = "http://localhost:8080/cart.html",
  newUrl = "http://localhost:3000/cart",
  fixturesArg = "scripts/fixtures/cart-seeded.json",
  seedArg = "scripts/fixtures/seed-cart-plain.json",
] = process.argv.slice(2);

function resolve(p) {
  for (const c of [p, p.replace(/^web\//, ""), "web/" + p]) if (fs.existsSync(c)) return c;
  return p;
}
const fixtures = JSON.parse(fs.readFileSync(resolve(fixturesArg), "utf8"));
const seed = JSON.parse(fs.readFileSync(resolve(seedArg), "utf8"));

/* Only the still-unported chunks: C5 meal rail, C7 payment card / fd progress
   / platform banners. C4's item card stays visible and is compared. */
const HIDE = "#ct-platform-banners, #ct-pay-card, #ct-fd-progress";

/* C7 (cart-checkout-upgrades.js) also REWRITES four bill-row labels that the
   frozen shell renders as "Item total" / "Platform fee" / "Packaging fee" /
   "To Pay". Those are unported, so neutralise them to the SAME text on both
   pages (the identical trick Phase 2j used for #ct-dh-restaurant). Every
   other node — including the C3 delivery label and C4 item rows — is compared
   exactly. */
const NEUTRALISE = () => {
  const set = (sel, v) => {
    const e = document.querySelector(sel);
    if (e) e.textContent = v;
  };
  set(".ct-bill-row--item-total .ct-bill-label", "Item Subtotal");
  set("#bill-platform-fee-row .ct-bill-label", "Platform Handling Fee");
  set("#bill-packaging-fee-row .ct-bill-label", "Packaging Charge");
  set(".ct-bill-total .ct-total-label", "Grand Total (To Pay)");
};

const sizes = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } };
fs.mkdirSync("compare-out", { recursive: true });

const browser = await chromium.launch();
let worst = 0;
for (const [label, viewport] of Object.entries(sizes)) {
  const shots = [];
  for (const [tag, url] of [["legacy", legacyUrl], ["new", newUrl]]) {
    const ctx = await browser.newContext({ viewport, reducedMotion: "reduce" });
    await ctx.addInitScript((entries) => {
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
          body: JSON.stringify({ success: false }),
        });
      return route.fulfill({
        status: 200,
        headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    });
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
    await page.addStyleTag({ content: "*{animation:none!important;transition:none!important;caret-color:transparent!important}" });
    await page.waitForTimeout(900);
    await page.evaluate(NEUTRALISE);
    await page.addStyleTag({ content: HIDE + "{display:none!important}" });
    const file = `compare-out/cart-c1c6-${label}-${tag}.png`;
    await page.screenshot({ path: file, fullPage: true });
    shots.push(file);
    await ctx.close();
  }
  const a = PNG.sync.read(fs.readFileSync(shots[0]));
  const b = PNG.sync.read(fs.readFileSync(shots[1]));
  const w = Math.max(a.width, b.width), h = Math.max(a.height, b.height);
  const pad = (img) => {
    const out = new PNG({ width: w, height: h });
    out.data.fill(255);
    PNG.bitblt(img, out, 0, 0, img.width, img.height, 0, 0);
    return out;
  };
  const A = pad(a), B = pad(b), D = new PNG({ width: w, height: h });
  const diff = pixelmatch(A.data, B.data, D.data, w, h, { threshold: 0.12 });
  fs.writeFileSync(`compare-out/cart-c1c6-${label}-diff.png`, PNG.sync.write(D));
  const pct = (diff / (w * h)) * 100;
  worst = Math.max(worst, pct);
  const heightNote = a.height !== b.height ? `  (height differs: legacy ${a.height}px vs new ${b.height}px)` : `  (height ${a.height}px)`;
  console.log(`cart-c1c6 ${label}: ${pct.toFixed(2)}% different${heightNote}`);
}
await browser.close();
console.log(worst < 1 ? "PASS (under 1%)" : "FAIL: open compare-out/cart-c1c6-*-diff.png");
process.exit(worst < 1 ? 0 : 2);
