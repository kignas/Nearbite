// Usage: node tools/compare.mjs <legacyUrl> <newUrl> <name> [fixturesFile]
// Needs: npm i -D playwright pixelmatch pngjs   (then: npx playwright install chromium)
// Screenshots both URLs at phone and desktop sizes, writes diffs to ./compare-out/, prints % different.
//
// Optional 4th argument: a JSON fixtures file mapping an API path to its
// response body (e.g. {"/restaurants": {...}}). When given, requests to
// https://api.eatswada.com/** in BOTH pages are fulfilled from the fixtures
// with `access-control-allow-origin: *`; unknown API paths get a 404 JSON
// response. Everything else in this script is unchanged.
//
// A fixture value of the string "__hang__" means "never answer this route":
// the request is left pending forever, so both pages stay in their loading
// state. That is how the restaurant-shell chunks-1–3 skeleton is compared,
// where the API must not resolve (the page is intentionally data-free). When
// any fixture is "__hang__" the page is captured at `domcontentloaded` instead
// of `networkidle` (which can never fire while a request hangs) and given a
// slightly longer settle wait.
import { chromium } from "playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import fs from "node:fs";

const [legacyUrl, newUrl, name = "page", fixturesFile, seedFile] = process.argv.slice(2);
if (!legacyUrl || !newUrl) {
  console.error("Usage: node tools/compare.mjs <legacyUrl> <newUrl> <name> [fixturesFile]");
  process.exit(1);
}
const sizes = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } };
fs.mkdirSync("compare-out", { recursive: true });

// The fixtures path may be given relative to the repo root (web/scripts/...)
// or relative to this script's directory; accept either.
function resolveFixturesPath(p) {
  const candidates = [p, p.replace(/^web\//, ""), "web/" + p];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return p;
}
const fixtures = fixturesFile
  ? JSON.parse(fs.readFileSync(resolveFixturesPath(fixturesFile), "utf8"))
  : null;

// Optional 5th argument: a JSON object of localStorage key -> value seeded into
// BOTH pages before any script runs (so a pre-seeded cart is present at boot).
// The value is stored as a string exactly as localStorage expects.
const seed = seedFile
  ? JSON.parse(fs.readFileSync(resolveFixturesPath(seedFile), "utf8"))
  : null;
async function installSeed(context) {
  if (!seed) return;
  await context.addInitScript((entries) => {
    try {
      for (const [k, v] of Object.entries(entries)) {
        window.localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
      }
    } catch (e) {}
  }, seed);
}

// "__hang__" fixtures leave their request pending forever (both pages stay in
// the loading state). When present, `networkidle` can never fire.
const HANG = "__hang__";
const hasHang = !!fixtures && JSON.stringify(fixtures).includes('"' + HANG + '"');

// Resolve an intercepted API request to a fixtures entry. Fixture keys are
// paths relative to the API base ("/restaurants", "/restaurants/search?q=..").
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
    if (body === undefined) {
      return route.fulfill({
        status: 404,
        headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
        body: JSON.stringify({ success: false, message: "Not found in fixtures" }),
      });
    }
    // "__hang__": never resolve, so the page keeps its loading skeleton.
    if (body === HANG) return;
    return route.fulfill({
      status: 200,
      headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  });
}

const browser = await chromium.launch();
let worst = 0;
for (const [label, viewport] of Object.entries(sizes)) {
  const shots = [];
  for (const [tag, url] of [["legacy", legacyUrl], ["new", newUrl]]) {
    const ctx = await browser.newContext({ viewport, reducedMotion: "reduce" });
    await installSeed(ctx);
    const page = await ctx.newPage();
    await installFixtures(page);
    await page
      .goto(url, {
        waitUntil: hasHang ? "domcontentloaded" : "networkidle",
        timeout: 45000,
      })
      .catch(() => {});
    await page.addStyleTag({ content: "*{animation:none!important;transition:none!important;caret-color:transparent!important}" });
    await page.waitForTimeout(hasHang ? 1600 : 800);
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
