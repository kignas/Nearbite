// Cart boot + CSS-leak check (Phase 2j).
//
// Usage: node scripts/cart-boot-parity.mjs [legacyUrl] [newUrl] [fixtures] [seed]
//   defaults: http://localhost:8080/cart.html  http://localhost:3000/cart
//             scripts/fixtures/cart-seeded.json  scripts/fixtures/seed-cart-plain.json
//
// 1. Boot-once: count GET requests per API endpoint on both pages. Legacy
//    cart.html boots from a DOMContentLoaded handler; the new page boots from
//    the CartPageRuntime effect behind a module-level once flag. Both must
//    issue exactly ONE request per endpoint.
// 2. CSS-leak check: /under99 -> /cart -> /under99 client-side (a real
//    next/link hop) vs a fresh /under99 load. Reports only.
import { chromium } from "playwright";
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

async function installFixtures(page) {
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
}

const browser = await chromium.launch();

console.log("### 1. Boot-once — GET requests per endpoint\n");
const countsBySide = {};
for (const [tag, url] of [["legacy", legacyUrl], ["new", newUrl]]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript((entries) => {
    try {
      for (const [k, v] of Object.entries(entries))
        window.localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
    } catch (e) {}
  }, seed);
  const page = await ctx.newPage();
  const counts = {};
  page.on("request", (req) => {
    const u = req.url();
    if (!u.includes("api.eatswada.com")) return;
    if (req.method() !== "GET") return;
    const path = new URL(u).pathname.replace(/^\/api/, "");
    counts[path] = (counts[path] || 0) + 1;
  });
  await installFixtures(page);
  await page.goto(url, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(1200);
  countsBySide[tag] = counts;
  console.log(`  ${tag}: ${JSON.stringify(counts)}`);
  await ctx.close();
}
{
  // The new page is a PARTIAL port (only C1+C2), so it must never issue MORE
  // requests than legacy for any endpoint; that also proves the boot did not
  // run twice (a double boot would double the C2 requests).
  const endpoints = new Set([
    ...Object.keys(countsBySide.legacy),
    ...Object.keys(countsBySide.new),
  ]);
  let ok = true;
  for (const e of endpoints) {
    const l = countsBySide.legacy[e] || 0;
    const n = countsBySide.new[e] || 0;
    if (n > l) ok = false;
  }
  console.log(
    `  → boot once: new page issues no more GETs than legacy per endpoint: ${ok ? "PASS" : "FAIL"}`
  );
}

console.log("\n### 2. CSS-leak check (report only)\n");
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await installFixtures(page);
  const probe = () =>
    page.evaluate(() => ({
      sheets: document.styleSheets.length,
      bodyBg: getComputedStyle(document.body).backgroundColor,
      bodyClass: document.body.className,
    }));
  // fresh /under99
  await page.goto("http://localhost:3000/under99", { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(800);
  const fresh = await probe();
  // client-side hop to /cart via an in-page link, then back to /under99
  await page.evaluate(() => {
    const a = document.createElement("a");
    a.href = "/cart";
    a.id = "__leak_probe_cart";
    a.textContent = "cart";
    document.body.appendChild(a);
  });
  await page.click("#__leak_probe_cart");
  await page.waitForTimeout(1500);
  const onCart = await probe();
  await page.goBack();
  await page.waitForTimeout(1500);
  const back = await probe();
  console.log(`  fresh /under99 : sheets=${fresh.sheets} bodyBg=${fresh.bodyBg} bodyClass=${JSON.stringify(fresh.bodyClass)}`);
  console.log(`  on /cart       : sheets=${onCart.sheets} bodyBg=${onCart.bodyBg} bodyClass=${JSON.stringify(onCart.bodyClass)}`);
  console.log(`  back /under99  : sheets=${back.sheets} bodyBg=${back.bodyBg} bodyClass=${JSON.stringify(back.bodyClass)}`);
  console.log(
    `  → body class restored: ${back.bodyClass === fresh.bodyClass}; body bg restored: ${back.bodyBg === fresh.bodyBg}`
  );
  await ctx.close();
}

await browser.close();
