// Usage: node tools/compare.mjs <legacyUrl> <newUrl> <name>
// Needs: npm i -D playwright pixelmatch pngjs   (then: npx playwright install chromium)
// Screenshots both URLs at phone and desktop sizes, writes diffs to ./compare-out/, prints % different.
import { chromium } from "playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import fs from "node:fs";

const [legacyUrl, newUrl, name = "page"] = process.argv.slice(2);
if (!legacyUrl || !newUrl) {
  console.error("Usage: node tools/compare.mjs <legacyUrl> <newUrl> <name>");
  process.exit(1);
}
const sizes = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } };
fs.mkdirSync("compare-out", { recursive: true });

const browser = await chromium.launch();
let worst = 0;
for (const [label, viewport] of Object.entries(sizes)) {
  const shots = [];
  for (const [tag, url] of [["legacy", legacyUrl], ["new", newUrl]]) {
    const ctx = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
    await page.addStyleTag({ content: "*{animation:none!important;transition:none!important;caret-color:transparent!important}" });
    await page.waitForTimeout(800);
    const file = `compare-out/${name}-${label}-${tag}.png`;
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
  fs.writeFileSync(`compare-out/${name}-${label}-diff.png`, PNG.sync.write(D));
  const pct = (diff / (w * h)) * 100;
  worst = Math.max(worst, pct);
  const heightNote = a.height !== b.height ? `  (page height differs: legacy ${a.height}px vs new ${b.height}px)` : "";
  console.log(`${name} ${label}: ${pct.toFixed(2)}% different${heightNote}`);
}
await browser.close();
console.log(worst < 1 ? "PASS (under 1%)" : "FAIL: open compare-out/*-diff.png and fix the differences");
process.exit(worst < 1 ? 0 : 2);
