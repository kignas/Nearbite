// Phase 2h — sitemap + PWA close-out checks.
//
//  1. GOLDEN: legacy `api/sitemap.js` (with a patched https.get) vs the ported
//     `sitemapUrls()` over the same fixtures, for several filter edge cases.
//  2. LIVE: the running /sitemap-restaurants.xml equals sitemapUrls(live API).
//  3. /sitemap.xml is the legacy file, byte for byte.
//  4. robots.txt has ONE User-agent block (the duplicated block is gone) and
//     lists both sitemaps.
//  5. sw.js does not precache the old `.html` shell and deletes old caches.
//  6. /manifest.webmanifest is name EatSwada, standalone, with the icons.
//
// Usage: node scripts/sitemap-pwa-parity.mjs [newUrl]
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript";

const require = createRequire(import.meta.url);
const NEW = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const ID = "6ac8f95828669b5f4e30f0ba";
const NEVER_ID = "6ac5cbd0933976c30865d23e";

let checks = 0, fails = 0;
const ok = (cond, label) => { checks++; if (!cond) { fails++; console.log("  FAIL " + label); } else console.log("  pass " + label); };

/* transpile the ported seo module */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sitemap-port-"));
for (const f of ["never-index-ids", "restaurant-seo"]) {
  const js = ts.transpileModule(fs.readFileSync(`lib/seo/${f}.ts`, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  fs.writeFileSync(path.join(tmp, f + ".js"), js);
}
const port = require(path.join(tmp, "restaurant-seo.js"));

/* patch https.get, then load the legacy sitemap handler */
const https = require("https");
const realGet = https.get;
let apiBody = "[]";
function fakeResponse(body) {
  const h = {};
  const res = { statusCode: 200, setEncoding() {}, on(ev, fn) { (h[ev] = h[ev] || []).push(fn); return res; } };
  setImmediate(() => { (h.data || []).forEach((f) => f(body)); (h.end || []).forEach((f) => f()); });
  return res;
}
https.get = function (url, a, b) {
  const cb = typeof a === "function" ? a : b;
  setImmediate(() => cb(fakeResponse(apiBody)));
  return { on() { return this; } };
};
const legacySitemap = require("../../api/sitemap.js");

async function runLegacy() {
  return await new Promise((resolve) => {
    const res = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(x) { resolve({ status: this.statusCode, body: x }); } };
    legacySitemap({}, res);
  });
}
const buildXml = (urls) =>
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map((u) => "  <url><loc>" + u.replace(/&/g, "&amp;") + "</loc></url>").join("\n") +
  "\n</urlset>\n";

const R = (id, extra = {}) => ({ _id: id, isActive: true, approvalStatus: "approved", ...extra });
const fixtures = [
  { name: "one keep + active false + pending + test id + short id", list: [R(ID), R("abc", {}), R("bbbbbbbb", { isActive: false }), R("cccccccc", { approvalStatus: "pending" }), R(NEVER_ID)] },
  { name: "approvalStatus absent kept", list: [R("dddddddd", { approvalStatus: undefined })] },
  { name: "wrapped in data.restaurants", wrap: true, list: [R(ID)] },
  { name: "empty", list: [] },
];

console.log("== golden sitemap ==");
for (const fx of fixtures) {
  const payload = fx.wrap ? { success: true, data: { restaurants: fx.list } } : fx.list;
  apiBody = JSON.stringify(payload);
  const legacy = await runLegacy();
  const urls = port.sitemapUrls(payload);
  const want = buildXml(urls);
  ok(legacy.status === 200, `${fx.name}: legacy 200`);
  ok(legacy.body === want, `${fx.name}: xml identical`);
}
/* error case → 502 */
https.get = function () { const em = { on(ev, fn) { if (ev === "error") setImmediate(() => fn(new Error("x"))); return em; } }; return em; };
{
  const legacy = await runLegacy();
  ok(legacy.status === 502, "upstream error: legacy 502");
  ok(legacy.body === "Sitemap temporarily unavailable", "upstream error: body");
}
https.get = realGet;

console.log("== live /sitemap-restaurants.xml ==");
try {
  const live = await (await fetch(`https://api.eatswada.com/api/restaurants`, { headers: { accept: "application/json" } })).json();
  const want = buildXml(port.sitemapUrls(live));
  const got = await (await fetch(`${NEW}/sitemap-restaurants.xml`)).text();
  ok(got === want, "live sitemap equals sitemapUrls(live API)");
  ok((await fetch(`${NEW}/sitemap-restaurants.xml`)).headers.get("content-type")?.includes("application/xml"), "content-type xml");
} catch (e) { ok(false, "live sitemap: " + e.message); }

console.log("== /sitemap.xml static ==");
{
  const legacyFile = fs.readFileSync("../sitemap.xml", "utf8");
  const got = await (await fetch(`${NEW}/sitemap.xml`)).text();
  ok(got === legacyFile, "/sitemap.xml byte-identical to legacy file");
}

console.log("== robots.txt ==");
{
  const robots = fs.readFileSync("public/robots.txt", "utf8");
  ok((robots.match(/User-agent:/g) || []).length === 1, "single User-agent block (duplicate removed)");
  ok(robots.includes("Sitemap: https://eatswada.com/sitemap.xml"), "lists sitemap.xml");
  ok(robots.includes("Sitemap: https://eatswada.com/sitemap-restaurants.xml"), "lists sitemap-restaurants.xml");
}

console.log("== sw.js ==");
{
  const sw = fs.readFileSync("public/sw.js", "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  ok(!/eatswada-shell-v8/.test(sw), "code never names the old cache (no precache of it)");
  ok(!/index\.html/.test(sw) && !/const SHELL/.test(sw), "no old .html precache list");
  ok(/caches\s*\.keys/.test(sw) && /caches\.delete/.test(sw), "activate deletes other caches");
  ok(!fs.existsSync("public/restaurant-shell.html"), "no legacy .html shell shipped");
}

console.log("== manifest ==");
{
  const res = await fetch(`${NEW}/manifest.webmanifest`);
  const m = await res.json();
  ok(m.name === "EatSwada", "name EatSwada");
  ok(m.display === "standalone", "display standalone");
  ok(!!m.theme_color, "has theme_color");
  ok(m.icons && m.icons.length === 2, "two icons");
  ok(m.icons.every((i) => i.type === "image/png"), "icons are png");
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${checks - fails}/${checks} checks PASS`);
process.exit(fails ? 1 : 0);
