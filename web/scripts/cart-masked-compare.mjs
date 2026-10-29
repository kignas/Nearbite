// C1+C2-core pixel compare (Phase 2j).
//
// Usage: node scripts/cart-masked-compare.mjs [legacyUrl] [newUrl] [fixtures] [seed]
//   defaults: http://localhost:8080/cart.html  http://localhost:3000/cart
//             scripts/fixtures/cart-seeded.json  scripts/fixtures/seed-cart-plain.json
//
// The plain compare.mjs run on /cart is NOT ~0% in this task, because the
// legacy page's later chunks (C3 delivery, C4 item painting, C5 complete-your-
// meal, C7 payment card) render hundreds of px of content that this task does
// NOT port. To measure the C1 (shell + CSS) + C2 (money math) surface honestly
// this script:
//   * hides (display:none, so heights normalise too) the sections owned by
//     later chunks: #ct-platform-banners, .ct-card.ct-item-card,
//     .ct-card.ct-cym, #ct-pay-card, #ct-fd-progress;
//   * neutralises the two TEXT labels a later chunk rewrites
//     (#ct-dh-restaurant — C4 paintItems; #bill-delivery-label — C3
//     applyDelivery), which otherwise show C1's static defaults on the new page.
// Everything else is compared exactly like compare.mjs (fullPage, pad to max
// W/H, animations off, pixelmatch threshold 0.12).
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

const HIDE = "#ct-platform-banners, .ct-card.ct-item-card, .ct-card.ct-cym, #ct-pay-card, #ct-fd-progress";
const NEUTRALISE = () => {
  const set = (id, v) => {
    const e = document.getElementById(id);
    if (e) e.textContent = v;
  };
  set("ct-dh-restaurant", "Foodie Dosa Restaurant");
  const dl = document.getElementById("bill-delivery-label");
  if (dl) dl.textContent = "Delivery Fee";
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
    await page.waitForTimeout(800);
    await page.evaluate(NEUTRALISE);
    await page.addStyleTag({ content: HIDE + "{display:none!important}" });
    const file = `compare-out/cart-c1c2-${label}-${tag}.png`;
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
  fs.writeFileSync(`compare-out/cart-c1c2-${label}-diff.png`, PNG.sync.write(D));
  const pct = (diff / (w * h)) * 100;
  worst = Math.max(worst, pct);
  const heightNote = a.height !== b.height ? `  (height differs: legacy ${a.height}px vs new ${b.height}px)` : `  (height ${a.height}px)`;
  console.log(`cart-c1c2 ${label}: ${pct.toFixed(2)}% different${heightNote}`);
}
await browser.close();
console.log(worst < 1 ? "PASS (under 1%)" : "FAIL: open compare-out/cart-c1c2-*-diff.png");
process.exit(worst < 1 ? 0 : 2);
