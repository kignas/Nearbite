import { chromium } from "playwright";
const [url] = process.argv.slice(2);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
const p = await ctx.newPage();
await p.goto(url, { waitUntil: "networkidle", timeout: 45000 }).catch(()=>{});
await p.waitForTimeout(500);
const out = await p.evaluate(() => {
  const c = document.querySelector('.container');
  const t = document.querySelector('#toast');
  const f = document.querySelector('.ew-site-footer');
  const fl = document.querySelector('.footer-links');
  const cs = (e)=>e?getComputedStyle(e):null;
  const rep = (e)=>{ if(!e) return null; const s=cs(e), r=e.getBoundingClientRect(); return {top:Math.round(r.top+scrollY), h:Math.round(r.height), marginBottom:s.marginBottom, marginTop:s.marginTop, paddingBottom:s.paddingBottom, paddingTop:s.paddingTop, display:s.display, position:s.position}; };
  return { container: rep(c), toast: rep(t), footer: rep(f), footerLinks: rep(fl),
    children: c ? Array.from(c.children).map(e=>e.className||e.tagName) : null };
});
console.log(JSON.stringify(out,null,1));
await b.close();
