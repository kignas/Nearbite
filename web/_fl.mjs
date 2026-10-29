import { chromium } from "playwright";
const [url] = process.argv.slice(2);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
const p = await ctx.newPage();
await p.goto(url, { waitUntil: "networkidle", timeout: 45000 }).catch(()=>{});
await p.waitForTimeout(400);
const out = await p.evaluate(() => {
  const fl = document.querySelector('.footer-links');
  const s = getComputedStyle(fl);
  const kids = Array.from(fl.children).map(e => { const r=e.getBoundingClientRect(); const c=getComputedStyle(e); return { tag:e.tagName, cls:e.className, text:e.textContent, w:Math.round(r.width), h:Math.round(r.height), top:Math.round(r.top), left:Math.round(r.left), display:c.display, fontSize:c.fontSize, lineHeight:c.lineHeight, margin:c.margin }; });
  return { html: fl.outerHTML.slice(0,600), css:{display:s.display, fontSize:s.fontSize, lineHeight:s.lineHeight, textAlign:s.textAlign, padding:s.padding, flexWrap:s.flexWrap, gap:s.gap}, kids };
});
console.log(JSON.stringify(out,null,1));
await b.close();
