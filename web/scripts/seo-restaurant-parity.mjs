// Phase 2h — golden SEO parity: legacy `api/restaurant-seo.js` vs the ported
// SEO layer (`web/lib/seo/restaurant-seo.ts`).
//
// The legacy handler hardcodes `https.get`; it is run here with a patched
// `https.get` that serves the restaurant JSON and a tiny shell HTML, and its
// generated <head> tags are extracted. The port's PURE functions are transpiled
// (typescript is already a dependency) and run over the SAME payload; the tags
// the page would render are rebuilt from them. The two are compared byte for
// byte.
//
// A final end-to-end case feeds the LIVE api payload to the legacy handler and
// compares with the RUNNING Next `/restaurant` page.
//
// Usage: node scripts/seo-restaurant-parity.mjs [newUrl]
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript";

const require = createRequire(import.meta.url);
const NEW = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const ID = "6ac8f95828669b5f4e30f0ba";
const NEVER_ID = "6ac5cbd0933976c30865d23e";

const SHELL_HTML =
  '<!doctype html><html lang="en"><head><title>Menu – EatSwada</title></head><body>x</body></html>';

/* ── transpile the port's TS SEO modules to a temp dir ────────────────── */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "seo-port-"));
for (const f of ["never-index-ids", "restaurant-seo"]) {
  const src = fs.readFileSync(`lib/seo/${f}.ts`, "utf8");
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  fs.writeFileSync(path.join(tmp, f + ".js"), js);
}
const port = require(path.join(tmp, "restaurant-seo.js"));

/* ── patch https.get, then load the legacy handler ────────────────────── */
const https = require("https");
const realGet = https.get;
let apiResponse = null;

function fakeResponse(statusCode, body) {
  const handlers = {};
  const res = {
    statusCode,
    setEncoding() {},
    on(ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); return res; },
  };
  setImmediate(() => {
    (handlers.data || []).forEach((fn) => fn(body));
    (handlers.end || []).forEach((fn) => fn());
  });
  return res;
}

https.get = function (url, a, b) {
  const cb = typeof a === "function" ? a : b;
  const u = String(url);
  if (u.includes("/restaurant-shell")) {
    setImmediate(() => cb(fakeResponse(200, SHELL_HTML)));
    return { on() { return this; } };
  }
  if (u.includes("/restaurants/")) {
    const r = apiResponse;
    if (r && r.networkError) {
      const em = { on(ev, fn) { if (ev === "error") setImmediate(() => fn(new Error("boom"))); return em; } };
      return em;
    }
    setImmediate(() => cb(fakeResponse(r.statusCode, r.body)));
    return { on() { return this; } };
  }
  throw new Error("unexpected https.get " + u);
};
const legacyHandler = require("../../api/restaurant-seo.js");

async function runLegacy(id) {
  return await new Promise((resolve) => {
    const req = { query: { id }, headers: { host: "eatswada.com", "x-forwarded-proto": "https" } };
    const res = {
      statusCode: 0,
      headers: {},
      setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
      end(body) { resolve({ status: this.statusCode, headers: this.headers, body }); },
    };
    legacyHandler(req, res);
  });
}

function tag(html, re) {
  const m = html.match(re);
  /* Next serialises void elements self-closed (`/>`); legacy writes `>`.
     Normalise that one difference so the tag strings compare equal. */
  return m ? m[0].replace(/"\s*\/>/g, '">') : null;
}
const extract = (html) => ({
  title: tag(html, /<title[^>]*>[\s\S]*?<\/title>/i),
  description: tag(html, /<meta name="description" content="[^"]*"\s*\/?>/i),
  robots: tag(html, /<meta name="robots" content="[^"]*"\s*\/?>/i),
  canonical: tag(html, /<link rel="canonical" href="[^"]*"\s*\/?>/i),
  ogType: tag(html, /<meta property="og:type" content="[^"]*"\s*\/?>/i),
  ogSite: tag(html, /<meta property="og:site_name" content="[^"]*"\s*\/?>/i),
  ogTitle: tag(html, /<meta property="og:title" content="[^"]*"\s*\/?>/i),
  ogDesc: tag(html, /<meta property="og:description" content="[^"]*"\s*\/?>/i),
  ogUrl: tag(html, /<meta property="og:url" content="[^"]*"\s*\/?>/i),
  ogImage: tag(html, /<meta property="og:image" content="[^"]*"\s*\/?>/i),
  jsonld: tag(html, /<script type="application\/ld\+json">[\s\S]*?<\/script>/i),
});

/* Rebuild the tags the Next page renders from the port's pure values. */
function portTags(result, id) {
  if (!result || !port.isEligible(result)) return { notFound: true };
  const s = port.seoFor(result.data, id);
  const e = port.esc;
  const jsonld =
    '<script type="application/ld+json">' +
    JSON.stringify(s.schema).replace(/</g, "\\u003c") +
    "</script>";
  return {
    title: "<title>" + e(s.title) + "</title>",
    description: '<meta name="description" content="' + e(s.desc) + '">',
    robots: '<meta name="robots" content="' + s.robots + '">',
    canonical: '<link rel="canonical" href="' + e(s.canonical) + '">',
    ogType: '<meta property="og:type" content="restaurant">',
    ogSite: '<meta property="og:site_name" content="EatSwada">',
    ogTitle: '<meta property="og:title" content="' + e(s.name + " | EatSwada") + '">',
    ogDesc: '<meta property="og:description" content="' + e(s.desc) + '">',
    ogUrl: '<meta property="og:url" content="' + e(s.canonical) + '">',
    ogImage: s.image ? '<meta property="og:image" content="' + e(s.image) + '">' : null,
    jsonld,
  };
}

const okRestaurant = {
  success: true,
  data: {
    _id: ID, name: "Foodie Dosa Restaurant", cuisine: ["Dosa. Chinese"],
    cuisineDisplay: "Dosa. Chinese", image: "", address: "Maynaguri Darivija",
    isActive: true, approvalStatus: "approved",
  },
};

const cases = [
  { name: "valid approved indexable", id: ID, api: { statusCode: 200, body: JSON.stringify(okRestaurant) }, want: 200 },
  { name: "NEVER_INDEX id", id: NEVER_ID, api: { statusCode: 200, body: JSON.stringify({ success: true, data: { ...okRestaurant.data, _id: NEVER_ID } }) }, want: 200 },
  { name: "isActive:false", id: ID, api: { statusCode: 200, body: JSON.stringify({ success: true, data: { ...okRestaurant.data, isActive: false } }) }, want: 404 },
  { name: "approvalStatus:pending", id: ID, api: { statusCode: 200, body: JSON.stringify({ success: true, data: { ...okRestaurant.data, approvalStatus: "pending" } }) }, want: 404 },
  { name: "success:false", id: ID, api: { statusCode: 200, body: JSON.stringify({ success: false, data: okRestaurant.data }) }, want: 404 },
  { name: "upstream 404", id: ID, api: { statusCode: 404, body: "{}" }, want: 404 },
  { name: "upstream 500", id: ID, api: { statusCode: 500, body: "{}" }, want: 502 },
  { name: "invalid id", id: "short", api: { statusCode: 200, body: "{}" }, want: 400 },
  { name: "cloudinary og:image", id: ID, api: { statusCode: 200, body: JSON.stringify({ success: true, data: { ...okRestaurant.data, image: "https://res.cloudinary.com/demo/image/upload/v1/r.jpg" } }) }, want: 200 },
  { name: "non-cloudinary image dropped", id: ID, api: { statusCode: 200, body: JSON.stringify({ success: true, data: { ...okRestaurant.data, image: "https://example.com/a.jpg" } }) }, want: 200 },
  { name: "eatswada-prefixed name", id: ID, api: { statusCode: 200, body: JSON.stringify({ success: true, data: { ...okRestaurant.data, name: "Eatswada 2" } }) }, want: 200 },
  { name: "special chars escaped", id: ID, api: { statusCode: 200, body: JSON.stringify({ success: true, data: { ...okRestaurant.data, name: 'A & B <C> "D"' } }) }, want: 200 },
];

let fail = false;
const lines = [];
for (const c of cases) {
  apiResponse = c.api;
  const legacy = await runLegacy(c.id);
  const lh = extract(legacy.body);
  const ok2xx = c.api.statusCode >= 200 && c.api.statusCode < 300;
  const pt = portTags(ok2xx ? JSON.parse(c.api.body) : null, c.id);

  let caseOk = legacy.status === c.want;
  const diffs = [];
  if (legacy.status === 200) {
    if (pt.notFound) { caseOk = false; diffs.push("port says notFound but legacy 200"); }
    else for (const k of Object.keys(lh)) {
      if (lh[k] !== pt[k]) { caseOk = false; diffs.push(`${k}\n      legacy: ${lh[k]}\n      port  : ${pt[k]}`); }
    }
  } else if (legacy.status !== 400) {
    if (!pt.notFound) { caseOk = false; diffs.push("port says ok but legacy non-200"); }
  }
  if (!caseOk) fail = true;
  const head = `### ${c.name}  legacy=${legacy.status} (want ${c.want})  ${caseOk ? "PASS" : "FAIL"}`;
  lines.push(head); console.log(head);
  diffs.forEach((d) => { const l = "    FAIL " + d; lines.push(l); console.log(l); });
}

/* ── Part 1d: proxy hardening (forged header / oversized payload) ─────────
   The proxy forwards the restaurant it fetched in `x-ew-restaurant`. These
   checks run against a SEPARATE Next server whose upstream API base points at a
   local stub, so the "upstream 500" case can be reproduced for real.

   The server is started with the env var the proxy reads at request time
   (`EW_API_BASE_URL`); the harness itself picks a free port and a temp build
   dir is NOT used (the app is already built by the caller). If the server
   cannot be started (e.g. no build), the section is skipped and reported. */
const HB_ID = "6ac8f95828669b5f4e30f0ba"; // healthy in the stub
const HB_500 = "6ac8f95828669b5f4e30f0bb"; // upstream 500 in the stub
const HB_BIG = "6ac8f95828669b5f4e30f0bc"; // ~12 KB payload in the stub
const FORGED = Buffer.from(
  JSON.stringify({
    success: true,
    data: { _id: "FORGED", name: "FORGED HACKED NAME", cuisine: ["X"], isActive: true, approvalStatus: "approved" },
  })
).toString("base64");

function startStub(port) {
  const ok = (id, extra = {}) => ({
    success: true,
    data: {
      _id: id, name: "Stub Restaurant " + id.slice(-2), cuisine: ["Dosa"],
      cuisineDisplay: "Dosa", image: "", address: "Maynaguri",
      isActive: true, approvalStatus: "approved", ...extra,
    },
  });
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    res.setHeader("content-type", "application/json");
    const m = u.pathname.match(/\/restaurants\/([^/]+)$/);
    if (!m) { res.statusCode = 404; return res.end("{}"); }
    if (m[1] === HB_500) { res.statusCode = 500; return res.end("{}"); }
    if (m[1] === HB_BIG) {
      return res.end(JSON.stringify(ok(m[1], { name: "Big Payload Restaurant", about: "x".repeat(12000) })));
    }
    res.end(JSON.stringify(ok(m[1])));
  });
  return new Promise((resolve) => srv.listen(port, () => resolve(srv)));
}

async function waitReady(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url, { redirect: "manual" }); if (r.status) return true; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function hardeningSection() {
  let stubPort = 0;
  for (let p = 9111; p < 9151; p++) { try { await new Promise((res, rej) => { const s = http.createServer(); s.once("error", rej); s.listen(p, () => { s.close(() => res()); }); }); stubPort = p; break; } catch {} }
  let srvPort = 0;
  for (let p = 3111; p < 3151; p++) { try { await new Promise((res, rej) => { const s = http.createServer(); s.once("error", rej); s.listen(p, () => { s.close(() => res()); }); }); srvPort = p; break; } catch {} }
  if (!stubPort || !srvPort) { console.log("### Part 1d SKIPPED: no free port"); return null; }

  const stub = await startStub(stubPort);
  const child = spawn("npx", ["next", "start", "-p", String(srvPort)], {
    cwd: process.cwd(),
    env: { ...process.env, EW_API_BASE_URL: `http://localhost:${stubPort}/api` },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const log = [];
  child.stdout.on("data", (d) => log.push(String(d)));
  child.stderr.on("data", (d) => log.push(String(d)));
  const base = `http://localhost:${srvPort}`;
  const ready = await waitReady(`${base}/restaurant?id=${HB_ID}`);
  if (!ready) {
    child.kill("SIGKILL"); stub.close();
    console.log("### Part 1d SKIPPED: next start did not become ready\n" + log.join("").slice(0, 500));
    return null;
  }

  const out = { checks: 0, fails: 0, lines: [] };
  const ok = (cond, label) => {
    out.checks++; if (!cond) out.fails++;
    const l = `  ${cond ? "pass" : "FAIL"} ${label}`;
    out.lines.push(l); console.log(l);
  };

  /* (i) forged header while the upstream is 500 → page must NOT show the forged name. */
  const r1 = await fetch(`${base}/restaurant?id=${HB_500}`, { headers: { "x-ew-restaurant": FORGED } });
  const b1 = await r1.text();
  ok(r1.status === 200, `(i) forged header + upstream 500 -> 200 (temporary-unavailable page) [got ${r1.status}]`);
  ok(!b1.includes("FORGED HACKED NAME"), "(i) forged name does NOT appear in the HTML");
  ok(!b1.includes('"name":"FORGED HACKED NAME"'), "(i) forged name does NOT appear in JSON-LD");

  /* (ii) forged header with a mismatched id on a healthy upstream → real data wins. */
  const r2 = await fetch(`${base}/restaurant?id=${HB_ID}`, { headers: { "x-ew-restaurant": FORGED } });
  const b2 = await r2.text();
  ok(r2.status === 200, `(ii) forged header + healthy upstream -> 200 [got ${r2.status}]`);
  ok(!b2.includes("FORGED HACKED NAME"), "(ii) forged name is ignored (real data wins)");
  ok(/Stub Restaurant ba/.test(b2), "(ii) real restaurant name is rendered");

  /* (iii) ~12 KB payload (encoded > 6000 chars) → 200 and correct metadata. */
  const r3 = await fetch(`${base}/restaurant?id=${HB_BIG}`);
  const b3 = await r3.text();
  const title = (b3.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "";
  const ogTitle = (b3.match(/<meta property="og:title" content="([^"]*)"/i) || [])[1] || "";
  const ld = (b3.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i) || [])[1] || "";
  let ldName = "";
  try { ldName = JSON.parse(ld).name; } catch {}
  ok(r3.status === 200, `(iii) oversized payload -> 200 [got ${r3.status}]`);
  ok(title.includes("Big Payload Restaurant"), `(iii) <title> is correct ("${title.trim()}")`);
  ok(ogTitle === "Big Payload Restaurant | EatSwada", `(iii) og:title is correct ("${ogTitle}")`);
  ok(ldName === "Big Payload Restaurant", `(iii) JSON-LD name is correct ("${ldName}")`);

  child.kill("SIGKILL");
  stub.close();
  return out;
}

let hard = null;
try {
  hard = await hardeningSection();
} catch (e) {
  console.log("### Part 1d SKIPPED: " + e.message);
}
if (hard && hard.fails) fail = true;

/* ── end-to-end: LIVE api payload → legacy vs the RUNNING Next page ───── */
try {
  const liveRes = await fetch(`https://api.eatswada.com/api/restaurants/${ID}`, { headers: { accept: "application/json" } });
  const live = await liveRes.json();
  apiResponse = { statusCode: 200, body: JSON.stringify(live) };
  const legacy = await runLegacy(ID);
  const lh = extract(legacy.body);
  const nextBody = await (await fetch(`${NEW}/restaurant?id=${ID}`)).text();
  const nh = extract(nextBody);
  let ok = legacy.status === 200;
  const diffs = [];
  for (const k of Object.keys(lh)) if (lh[k] !== nh[k]) { ok = false; diffs.push(`${k}\n      legacy: ${lh[k]}\n      next  : ${nh[k]}`); }
  if (!ok) fail = true;
  const head = `### E2E live payload  legacy=${legacy.status}  ${ok ? "PASS" : "FAIL"}`;
  lines.push(head); console.log(head);
  diffs.forEach((d) => { const l = "    FAIL " + d; lines.push(l); console.log(l); });
} catch (e) {
  lines.push("E2E SKIPPED: " + e.message);
  console.log("E2E SKIPPED: " + e.message);
}

fs.mkdirSync("compare-out", { recursive: true });
const summary = hard
  ? `Part 1d hardening: ${hard.checks - hard.fails}/${hard.checks} PASS`
  : "Part 1d hardening: SKIPPED";
lines.push(summary); console.log(summary);
fs.writeFileSync("compare-out/seo-restaurant-parity.txt", lines.join("\n") + "\n");
https.get = realGet;
fs.rmSync(tmp, { recursive: true, force: true });
console.log(fail ? "FAIL" : "ALL PASS");
process.exit(fail ? 1 : 0);
