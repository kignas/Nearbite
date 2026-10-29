import { chromium } from "playwright";
const [url] = process.argv.slice(2);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
const p = await ctx.newPage();
await p.goto(url, { waitUntil: "networkidle", timeout: 45000 }).catch(()=>{});
await p.addStyleTag({ content: "*{animation:none!important;transition:none!important;caret-color:transparent!important}" });
await p.waitForTimeout(800);
const out = await p.evaluate(() => {
  const y = (sel) => { const e=document.querySelector(sel); return e? Math.round(e.getBoundingClientRect().top+scrollY): null; };
  const sels = ['.top-bar','.support-header','#contactGrid','#hoursNote','#orderHelpCard','.issue-grid','#grievance','.faq-chips','#faq-orders','#faq-payments','#faq-delivery','#faq-account','#faq-refunds','.footer-links','#toast','.ew-site-footer'];
  const o = {};
  for (const s of sels) o[s]=y(s);
  o.scroll = document.documentElement.scrollHeight;
  return o;
});
console.log(JSON.stringify(out));
await b.close();
