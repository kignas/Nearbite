// Phase 2j — CSS-leak check (report only): /under99 -> /cart -> /under99.
//
// A genuine CLIENT-SIDE hop needs next/link (every real internal link in the
// app is a plain <a>, which is a full reload and cannot leak CSS). This harness
// therefore REQUIRES a temporary probe route at app/leakprobe/page.tsx holding
// two next/link anchors with ids `to-cart` and `to-under99`:
//
//   "use client"; import Link from "next/link";
//   export default function LeakProbe(){return (<div>
//     <Link href="/cart" id="to-cart">cart</Link>
//     <Link href="/under99" id="to-under99">under99</Link></div>);}
//
// Create it, `npm run build`, run this script, then DELETE the route again — it
// is a test scaffold and must not ship as a public page. Sequence:
//   1. hard-load /under99                    -> computed styles baseline
//   2. client-side nav /leakprobe -> /cart   (CSS stays in <head>)
//   3. client-side nav back to /under99
//   4. compare the second /under99 against the fresh one.
//
// Usage: node scripts/cart-css-leak.mjs [origin]
import { chromium } from "playwright";
import fs from "node:fs";

const ORIGIN = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");

const SELECTORS = [
  "body", ".u99-header", ".u99-hero", ".u99-chip", ".u99-page", ".u99-card",
  ".u99-price", "#white-cart-root",
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

await page.goto(`${ORIGIN}/under99`, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
await page.waitForTimeout(800);
const fresh = await probe();

await page.goto(`${ORIGIN}/leakprobe`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(400);
await page.click("#to-cart");
await page.waitForURL("**/cart", { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(1500);
const onCart = await probe();

await page.goto(`${ORIGIN}/leakprobe`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(400);
await page.click("#to-under99");
await page.waitForURL("**/under99", { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(1500);
const back = await probe();

const diffs = Object.keys(fresh).filter((k) => fresh[k] !== back[k]);
console.log(`  fresh /under99 : sheets=${fresh.sheets} bodyBg=${fresh.bodyBg} bodyClass=${JSON.stringify(fresh.bodyClass)}`);
console.log(`  on /cart       : sheets=${onCart.sheets} bodyBg=${onCart.bodyBg} bodyClass=${JSON.stringify(onCart.bodyClass)}`);
console.log(`  back /under99  : sheets=${back.sheets} bodyBg=${back.bodyBg} bodyClass=${JSON.stringify(back.bodyClass)}`);
console.log(`  → computed-style diffs on return: ${diffs.length}${diffs.length ? " -> " + diffs.join(", ") : ""}`);
for (const k of diffs) console.log(`      ${k}: fresh=${fresh[k]} back=${back[k]}`);

await browser.close();
