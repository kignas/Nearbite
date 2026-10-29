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
const out = await p.evaluate(() => {
  const r = (sel) => { const e=document.querySelector(sel); return e? Math.round(e.getBoundingClientRect().height): null; };
  return {
    scroll: document.documentElement.scrollHeight,
    topbar: r('.top-bar'), container: r('.container'), contactGrid: r('#contactGrid'),
    orderHelp: r('#orderHelpCard'), issueGrid: r('.issue-grid'), grievance: r('#grievance'),
    faqChips: r('.faq-chips'), footerLinks: r('.footer-links'), toast: r('#toast'),
    footer: r('.ew-site-footer'),
  };
});
console.log(JSON.stringify(out,null,1));
await b.close();
