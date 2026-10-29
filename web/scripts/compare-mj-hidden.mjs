// Like web/scripts/compare.mjs but additionally hides a fixed set of selectors on
// BOTH pages before the screenshot. Used for the chunk-11 report: `#ew-mj-btn`
// (the "browse menu categories" jump button) is provided by legacy `js/menu-jump.js`,
// which is a LATER chunk than 11, so it is absent from the new page and accounts
// for the whole phone diff. Hiding it on both pages isolates the chunk-11 work.
//
// Usage: node scripts/compare-mj-hidden.mjs <legacyUrl> <newUrl> <name> [fixturesFile]
import { chromium } from "playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import fs from "node:fs";

const [legacyUrl, newUrl, name = "page", fixturesFile] = process.argv.slice(2);
if (!legacyUrl || !newUrl) {
  console.error("Usage: node scripts/compare-mj-hidden.mjs <legacyUrl> <newUrl> <name> [fixturesFile]");
  process.exit(1);
}
const sizes = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } };
fs.mkdirSync("compare-out", { recursive: true });

function resolveFixturesPath(p) {
  for (const c of [p, p.replace(/^web\//, ""), "web/" + p]) if (fs.existsSync(c)) return c;
  return p;
}
const fixtures = fixturesFile
  ? JSON.parse(fs.readFileSync(resolveFixturesPath(fixturesFile), "utf8"))
  : null;
const HANG = "__hang__";
const hasHang = !!fixtures && JSON.stringify(fixtures).includes('"' + HANG + '"');

function fixtureFor(rawUrl) {
  const u = new URL(rawUrl);
  const path = u.pathname.replace(/^\/api/, "");
  const exact = path + u.search;
  if (fixtures[exact] !== undefined) return fixtures[exact];
  if (fixtures[path] !== undefined) return fixtures[path];
  return undefined;
}
async function installFixtures(page) {
  if (!fixtures) return;
  await page.route("https://api.eatswada.com/**", (route) => {
    const body = fixtureFor(route.request().url());
    if (body === undefined)
      return route.fulfill({
        status: 404,
        headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
        body: "{}",
      });
    if (body === HANG) return; // never answer
    return route.fulfill({
      status: 200,
      headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  });
}

const HIDE = ["#ew-mj-btn", "#ew-mj-backdrop", ".ew-mj-sheet"];

const browser = await chromium.launch();
let worst = 0;
for (const [label, viewport] of Object.entries(sizes)) {
  const shots = [];
  for (const [tag, url] of [["legacy", legacyUrl], ["new", newUrl]]) {
    const ctx = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await installFixtures(page);
    await page
      .goto(url, { waitUntil: hasHang ? "domcontentloaded" : "networkidle", timeout: 45000 })
      .catch(() => {});
    await page.addStyleTag({ content: "*{animation:none!important;transition:none!important;caret-color:transparent!important}" });
    await page.addStyleTag({ content: HIDE.join(",") + "{display:none !important}" });
    await page.waitForTimeout(hasHang ? 1600 : 800);
    const file = `compare-out/${name}-mjhidden-${label}-${tag}.png`;
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
  fs.writeFileSync(`compare-out/${name}-mjhidden-${label}-diff.png`, PNG.sync.write(D));
  const pct = (diff / (w * h)) * 100;
  worst = Math.max(worst, pct);
  const heightNote = a.height !== b.height ? `  (page height differs: legacy ${a.height}px vs new ${b.height}px)` : "";
  console.log(`${name} [${label}] with #ew-mj-btn hidden on both: ${pct.toFixed(2)}% different${heightNote}`);
}
await browser.close();
console.log(worst < 1 ? "PASS (under 1%)" : "FAIL: open compare-out/*-diff.png and fix the differences");
process.exit(worst < 1 ? 0 : 2);
