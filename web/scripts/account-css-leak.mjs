// Phase 3c — CSS-leak check (report only): client-side hops into and out of the
// account + orders pages must not change how a previously rendered page looks.
//
// Requires the temporary probe route app/leakprobe/page.tsx (see cart-css-leak.mjs).
// Sequence: hard-load /under99 baseline, then client-side nav /leakprobe -> /profile,
// /orders, /address, /track-order -> back to /under99; compare the second /under99
// against the fresh one. Also checks each account page does not leak back the other
// way by comparing /under99 computed styles before/after every hop.
//
// Usage: node scripts/account-css-leak.mjs [origin]
import { chromium } from "playwright";

const ORIGIN = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const SELECTORS = ["body", ".u99-header", ".u99-hero", ".u99-chip", ".u99-page", ".u99-card", ".u99-price", "#white-cart-root"];
const HOPS = [
  ["/profile", "to-profile"],
  ["/orders", "to-orders"],
  ["/address", "to-address"],
  ["/track-order", "to-track-order"],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
const page = await ctx.newPage();

const probe = () =>
  page.evaluate((sels) => {
    const out = { sheets: document.styleSheets.length, bodyBg: getComputedStyle(document.body).backgroundColor, bodyClass: document.body.className };
    for (const s of sels) {
      const el = document.querySelector(s);
      out[s] = el ? getComputedStyle(el).backgroundColor + "|" + getComputedStyle(el).fontSize : "MISSING";
    }
    return out;
  }, SELECTORS);

await page.goto(`${ORIGIN}/under99`, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
await page.waitForTimeout(800);
const fresh = await probe();
console.log(`  fresh /under99 : sheets=${fresh.sheets} bodyBg=${fresh.bodyBg} bodyClass=${JSON.stringify(fresh.bodyClass)}`);

let totalDiffs = 0;
for (const [path, id] of HOPS) {
  await page.goto(`${ORIGIN}/leakprobe`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await page.click("#" + id);
  await page.waitForURL("**" + path, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const on = await probe();
  await page.goto(`${ORIGIN}/leakprobe`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await page.click("#to-under99");
  await page.waitForURL("**/under99", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const back = await probe();
  const diffs = Object.keys(fresh).filter((k) => fresh[k] !== back[k]);
  totalDiffs += diffs.length;
  console.log(`  -> ${path.padEnd(14)} on: sheets=${on.sheets} | back /under99 diffs: ${diffs.length}${diffs.length ? " -> " + diffs.join(", ") : ""}`);
  for (const k of diffs) console.log(`      ${k}: fresh=${fresh[k]} back=${back[k]}`);
}
console.log(`  TOTAL computed-style diffs on return: ${totalDiffs}`);
await browser.close();
