import { chromium } from "playwright";
const [url] = process.argv.slice(2);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
const p = await ctx.newPage();
await p.route("**/*", async (route) => {
  const u = route.request().url();
  if (/gstatic\.com|cdn\.jsdelivr|cdnjs\.cloudflare|fonts\.googleapis|fonts\.gstatic/.test(u)) return route.abort();
  return route.continue();
});
await p.goto(url, { waitUntil: "load", timeout: 30000 }).catch(()=>{});
await p.waitForTimeout(1500);
const html = await p.evaluate(() => document.body.outerHTML);
console.log(html);
await b.close();
