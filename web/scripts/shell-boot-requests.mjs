// Phase 2h PART A2 — boot request counts for /restaurant-shell.
//
// Counts how many times each page asks for `/restaurants/:id` and
// `/restaurants/:id/menu` during a normal load. Legacy ran `loadRestaurantPage`
// from a DOMContentLoaded listener (exactly once); the Next port must match.
//
// Usage: node scripts/shell-boot-requests.mjs [legacyUrl] [newUrl]
import { chromium } from "playwright";
import fs from "node:fs";

const LEGACY = process.argv[2] || "http://localhost:8080/restaurant-shell.html";
const NEW = process.argv[3] || "http://localhost:3000/restaurant-shell";
const ID = "6ac8f95828669b5f4e30f0ba";

const home = JSON.parse(fs.readFileSync("scripts/fixtures/home.json", "utf8"));
const restaurant = home["/restaurants"].data.find((r) => r._id === ID);
const menuPayload = home[`/restaurants/${ID}/menu`];

function withId(url) {
  const u = new URL(url);
  u.searchParams.set("id", ID);
  return u.toString();
}

async function count(page, url) {
  const seen = { restaurant: 0, menu: 0 };
  await page.route("https://api.eatswada.com/**", (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    if (p === `/restaurants/${ID}`) seen.restaurant++;
    else if (p === `/restaurants/${ID}/menu`) seen.menu++;
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
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(4000);
  return seen;
}

const browser = await chromium.launch();
let fail = false;
try {
  const lctx = await browser.newContext();
  const lp = await lctx.newPage();
  const legacy = await count(lp, withId(LEGACY));

  const nctx = await browser.newContext();
  const np = await nctx.newPage();
  const modern = await count(np, withId(NEW));

  console.log("legacy:", JSON.stringify(legacy));
  console.log("new   :", JSON.stringify(modern));

  for (const route of ["restaurant", "menu"]) {
    const ok = legacy[route] === 1 && modern[route] === 1;
    if (!ok) fail = true;
    console.log(`${ok ? "PASS" : "FAIL"} ${route}: legacy=${legacy[route]} new=${modern[route]} (want 1/1)`);
  }
} finally {
  await browser.close();
}
console.log(fail ? "FAIL" : "ALL PASS");
process.exit(fail ? 1 : 0);
