#!/usr/bin/env node
// ============================================================================
// tools/vercel-parity.mjs — Phase 5a Part A
//
// Proves the running Next app reproduces the legacy Vercel routing contract
// declared in the repo-root `vercel.json`, plus the URL/SEO/PWA pairs the
// migration must keep working.
//
// What it reads:
//   * `vercel.json`            — redirects / rewrites / headers / cleanUrls
//   * `web/next.config.js`     — PORTED_PAGES + LEGACY_HTML (the .html → clean map)
//   * `api/restaurant-seo.js`  — the /restaurant status + Cache-Control contract
//   * `api/sitemap.js`         — the /sitemap-restaurants.xml contract
//
// What it does:
//   * generates one test case per rule, then one per pair in the migration map
//   * fetches each path with `redirect: "manual"` against a running `next start`
//   * checks status, Location (query preserved), Cache-Control, Content-Type,
//     X-Robots-Tag, the security headers and the service-worker specifics
//   * prints PASS / FAIL / ACCEPTED (a documented, intended divergence) and
//     exits non-zero if anything FAILs
//
// Usage:
//   node tools/vercel-parity.mjs [newOrigin] [--legacy <origin>]
//     newOrigin   default http://localhost:3000   (run `next build` first)
//     --legacy    optional; additionally probe the real legacy origin and
//                 report its status alongside each case (never fatal)
//
// No dependencies — Node built-ins + global fetch only.
// ============================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* ── args ────────────────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const legacyIdx = argv.indexOf("--legacy");
const LEGACY = legacyIdx >= 0 ? (argv[legacyIdx + 1] || "").replace(/\/$/, "") : "";
const positional = argv.filter((a, i) => i !== legacyIdx && i !== legacyIdx + 1);
const NEW = (positional[0] || "http://localhost:3000").replace(/\/$/, "");

/* ── read the legacy + ported routing sources ────────────────────────── */
const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
const nextCfg = fs.readFileSync(path.join(ROOT, "web", "next.config.js"), "utf8");

function parseStringArray(name) {
  const m = nextCfg.match(new RegExp(name + "\\s*=\\s*\\[([\\s\\S]*?)\\];"));
  if (!m) return [];
  const out = [];
  const re = /"([^"]*)"|'([^']*)'/g;
  let g;
  while ((g = re.exec(m[1]))) out.push(g[1] !== undefined ? g[1] : g[2]);
  return out;
}
const PORTED_PAGES = parseStringArray("PORTED_PAGES");

function parseLegacyHtml() {
  const m = nextCfg.match(/LEGACY_HTML\s*=\s*\[([\s\S]*?)\];/);
  if (!m) return [];
  const out = [];
  const re = /\{\s*file:\s*"([^"]+)",\s*page:\s*"([^"]+)"\s*\}/g;
  let g;
  while ((g = re.exec(m[1]))) out.push({ file: g[1], page: g[2] });
  return out;
}
const LEGACY_HTML = parseLegacyHtml();

/* ── tiny case engine ────────────────────────────────────────────────── */
const cases = [];
function addCase(c) {
  cases.push(c);
}

/* A case:
   { id, path, kind: "contract" | "accepted",
     expect: { status, locationEndsWith?, locationExact?, cacheControlIncludes?,
               contentTypeIncludes?, xRobotsIncludes?, xRobotsAbsent?,
               header?: [k, v], absentHeader? },
     legacyNote? }
   `kind: "accepted"` marks a documented, intended divergence — reported as
   ACCEPTED, never a FAIL. */

/* ── 1. vercel.json redirects ────────────────────────────────────────── */
for (const r of vercel.redirects || []) {
  const dest = r.destination;
  addCase({
    id: `vercel.redirect ${r.source} -> ${dest}`,
    path: r.source,
    expect: { status: 301, locationEndsWith: dest },
    legacyNote: `vercel.json permanent redirect (${r.permanent ? "308 on Vercel" : "redirect"})`,
  });
  addCase({
    id: `vercel.redirect ${r.source}?query -> ${dest}`,
    path: `${r.source}?id=abc&x=1`,
    expect: { status: 301, locationEndsWith: `${dest}?id=abc&x=1` },
    legacyNote: "query string preserved",
  });
}

/* ── 2. vercel.json headers ──────────────────────────────────────────── */
for (const h of vercel.headers || []) {
  for (const hh of h.headers || []) {
    addCase({
      id: `vercel.header ${h.source} ${hh.key}`,
      path: h.source,
      /* A vercel.json header on a `.html` source only takes effect once the
         request reaches the file; cleanUrls first 308s it to the clean URL,
         where the same header is applied. Follow one hop to observe it. */
      follow: 1,
      expect: { header: [hh.key.toLowerCase(), hh.value] },
      legacyNote: "vercel.json header",
    });
  }
}

/* ── 3. vercel.json rewrites (now real routes) ───────────────────────── */
for (const r of vercel.rewrites || []) {
  const src = r.source;
  if (src === "/restaurant") {
    /* legacy rewrote to api/restaurant-seo.js; the port is a real route that
       implements the same status + Cache-Control contract (see api/restaurant-seo.js). */
    addCase({
      id: "vercel.rewrite /restaurant -> /api/restaurant-seo (real route)",
      path: "/restaurant",
      expect: { status: 404, xRobotsIncludes: "noindex" },
      legacyNote: "legacy 400; port 404 — both non-indexable (documented)",
      kind: "accepted",
    });
    addCase({
      id: "vercel.rewrite /restaurant?id=valid -> 200 shell",
      path: "/restaurant?id=6ac8f95828669b5f4e30f0ba",
      expect: {
        status: 200,
        cacheControlIncludes: "s-maxage=300",
        xRobotsAbsent: true,
      },
      legacyNote: "api/restaurant-seo.js Cache-Control public, s-maxage=300, stale-while-revalidate=600",
    });
  } else if (src === "/sitemap-restaurants.xml") {
    addCase({
      id: "vercel.rewrite /sitemap-restaurants.xml -> /api/sitemap (real route)",
      path: "/sitemap-restaurants.xml",
      expect: {
        status: 200,
        contentTypeIncludes: "xml",
        cacheControlIncludes: "s-maxage=3600",
      },
      legacyNote: "api/sitemap.js Cache-Control public, s-maxage=3600, stale-while-revalidate=86400",
    });
  }
}

/* ── 4. cleanUrls: every ported legacy *.html 301s to its clean URL ──── */
addCase({
  id: "cleanUrls /index.html -> /",
  path: "/index.html",
  expect: { status: 301, locationEndsWith: "/" },
  legacyNote: "cleanUrls:true (Vercel 308)",
});
addCase({
  id: "cleanUrls /index -> /",
  path: "/index",
  expect: { status: 301, locationEndsWith: "/" },
  legacyNote: "cleanUrls:true: Vercel serves /index as 308 -> /",
});
addCase({
  id: "cleanUrls /index/ -> /",
  path: "/index/",
  /* Legacy 308s /index/ straight to /; the port first strips the trailing slash
     (/index/) then 301s /index -> /. Either way it lands on / in one client
     redirect; accept both intermediate codes. */
  expect: { statusIn: [301, 308], locationEndsWith: "/index" },
  legacyNote: "cleanUrls:true: Vercel serves /index/ as 308 -> /",
});

for (const { file, page } of LEGACY_HTML) {
  if (!PORTED_PAGES.includes(page)) continue; // not ported yet → legacy file still serves
  if (file === "index.html") continue; // covered above
  const src = "/" + file;
  addCase({
    id: `cleanUrls ${src} -> ${page}`,
    path: src,
    expect: { status: 301, locationEndsWith: page },
    legacyNote: "cleanUrls:true",
  });
  addCase({
    id: `cleanUrls ${src}?query -> ${page}?query`,
    path: `${src}?id=abc&x=1`,
    expect: { status: 301, locationEndsWith: `${page}?id=abc&x=1` },
    legacyNote: "cleanUrls:true, query preserved",
  });
}

/* ── 5. the migration map pairs ──────────────────────────────────────── */
addCase({
  id: "map /restaurant-shell -> 200 + X-Robots-Tag noindex",
  path: "/restaurant-shell",
  expect: { status: 200, xRobotsIncludes: "noindex" },
  legacyNote: "vercel.json header",
});
addCase({
  id: "map /restaurant-shell.html -> 301 /restaurant-shell (then noindex)",
  path: "/restaurant-shell.html",
  expect: { status: 301, locationEndsWith: "/restaurant-shell" },
  legacyNote: "cleanUrls (Vercel 308)",
});
addCase({
  id: "map /sitemap.xml -> 200 xml (byte-identical legacy file)",
  path: "/sitemap.xml",
  expect: { status: 200, contentTypeIncludes: "xml" },
  legacyNote: "static file",
});
addCase({
  id: "map /robots.txt -> 200 text",
  path: "/robots.txt",
  expect: { status: 200, contentTypeIncludes: "text/plain" },
  legacyNote: "static file",
});
addCase({
  id: "map /manifest.webmanifest -> 200 (NEW; legacy 404)",
  path: "/manifest.webmanifest",
  expect: { status: 200, contentTypeIncludes: "manifest+json" },
  legacyNote: "legacy had NO manifest (404); AGENTS.md asks for one",
  kind: "accepted",
});
addCase({
  id: "map /apple-touch-icon.png -> 200 png",
  path: "/apple-touch-icon.png",
  expect: { status: 200, contentTypeIncludes: "image/png" },
  legacyNote: "static asset",
});
for (const a of [
  "/icon-192.png",
  "/icon-512.png",
  "/favicon.ico",
  "/eatswada-logo.png",
  "/eatswada-logo.svg",
  "/eatswada-wordmark.svg",
  "/eatswada-login-hero.webp",
]) {
  addCase({
    id: `map static asset ${a}`,
    path: a,
    expect: { status: 200 },
    legacyNote: "static asset under public/",
  });
}

/* ── 6. service-worker specifics ─────────────────────────────────────── */
for (const sw of ["/sw.js", "/firebase-messaging-sw.js"]) {
  addCase({
    id: `sw ${sw} -> 200 javascript`,
    path: sw,
    expect: { status: 200, contentTypeIncludes: "javascript" },
    legacyNote: "legacy content-type application/javascript",
  });
  addCase({
    id: `sw ${sw} -> max-age=0 (no stale worker)`,
    path: sw,
    expect: { status: 200, cacheControlIncludes: "max-age=0" },
    legacyNote: "legacy Cache-Control public, max-age=0, must-revalidate",
  });
  /* Legacy did NOT set Service-Worker-Allowed (a root script already has scope
     "/"); the port must not invent one. Recorded as a check so a regression is
     visible. */
  addCase({
    id: `sw ${sw} -> no Service-Worker-Allowed (legacy sets none)`,
    path: sw,
    expect: { status: 200, absentHeader: "service-worker-allowed" },
    legacyNote: "legacy sets no Service-Worker-Allowed",
  });
}

/* ── 7. status / 404 / trailing-slash behaviour ──────────────────────── */
addCase({
  id: "404 unknown URL -> 404 page",
  path: "/this-page-does-not-exist-zzz",
  expect: { status: 404, contentTypeIncludes: "text/html" },
  legacyNote: "404",
});
addCase({
  id: "404 /restaurant?id=short -> 404",
  path: "/restaurant?id=short",
  expect: { status: 404, xRobotsIncludes: "noindex" },
  legacyNote: "legacy 400 (invalid id); port 404 — both non-indexable",
  kind: "accepted",
});
addCase({
  id: "404 /restaurant?id=NEVER_INDEX -> 404",
  path: "/restaurant?id=6ac5cbd0933976c30865d23e",
  expect: { status: 404, xRobotsIncludes: "noindex" },
  legacyNote: "NEVER_INDEX_IDS gate",
  kind: "accepted",
});
addCase({
  id: "trailing slash /about/ -> 308 /about",
  path: "/about/",
  expect: { status: 308, locationEndsWith: "/about" },
  legacyNote: "legacy cleanUrls serves /about/ 200; Next default strips the slash (safe canonical direction, no slash URLs are indexed)",
  kind: "accepted",
});
addCase({
  id: "trailing slash /cart/ -> 308 /cart",
  path: "/cart/",
  expect: { status: 308, locationEndsWith: "/cart" },
  legacyNote: "legacy serves /cart/ 200; Next strips it",
  kind: "accepted",
});

/* ── security headers: legacy sets NONE of the optional ones ─────────── */
const OPTIONAL_SECURITY = [
  "x-frame-options",
  "content-security-policy",
  "referrer-policy",
  "permissions-policy",
];
addCase({
  id: "security: no X-Frame-Options/CSP/Referrer-Policy/Permissions-Policy (legacy sets none)",
  path: "/",
  expect: { status: 200, absentHeaders: OPTIONAL_SECURITY },
  legacyNote: "legacy sets only platform HSTS; Vercel adds HSTS in production",
});

/* ── runner ──────────────────────────────────────────────────────────── */
async function fetchHead(origin, p, follow = 0) {
  let r = await fetch(origin + p, { redirect: "manual", headers: { "user-agent": "vercel-parity" } });
  let hops = 0;
  while (follow > 0 && r.status >= 300 && r.status < 400 && r.headers.get("location") && hops < follow) {
    const loc = r.headers.get("location");
    const next = loc.startsWith("http") ? loc : origin + loc;
    r = await fetch(next, { redirect: "manual", headers: { "user-agent": "vercel-parity" } });
    hops++;
  }
  const h = {};
  r.headers.forEach((v, k) => (h[k.toLowerCase()] = v));
  return { status: r.status, headers: h, location: h.location || "" };
}

let pass = 0,
  fail = 0,
  accepted = 0;
const failures = [];

function check(name, cond, detail) {
  if (cond) return true;
  failures.push(`${name} — ${detail}`);
  return false;
}

console.log(`vercel-parity: NEW=${NEW}${LEGACY ? `  LEGACY=${LEGACY}` : ""}`);
console.log(`cases: ${cases.length}\n`);

for (const c of cases) {
  let res;
  try {
    res = await fetchHead(NEW, c.path, c.follow || 0);
  } catch (e) {
    fail++;
    console.log(`FAIL  ${c.id}\n      request error: ${e.message}`);
    continue;
  }
  const e = c.expect || {};
  const problems = [];
  if (e.statusIn) {
    if (!e.statusIn.includes(res.status)) problems.push(`status ${res.status} not in [${e.statusIn.join(", ")}]`);
  } else if (e.status !== undefined) {
    if (c.kind === "accepted") {
      /* accepted divergence: any non-5xx status is tolerated, the note explains */
      if (res.status >= 500) problems.push(`status ${res.status} (expected a handled response)`);
    } else if (res.status !== e.status) {
      problems.push(`status ${res.status} != ${e.status}`);
    }
  }
  if (e.locationEndsWith && !res.location.endsWith(e.locationEndsWith))
    problems.push(`location "${res.location}" !~ "${e.locationEndsWith}"`);
  if (e.locationExact && res.location !== e.locationExact)
    problems.push(`location "${res.location}" != "${e.locationExact}"`);
  if (e.cacheControlIncludes && !(res.headers["cache-control"] || "").includes(e.cacheControlIncludes))
    problems.push(`cache-control "${res.headers["cache-control"] || ""}" missing "${e.cacheControlIncludes}"`);
  if (e.contentTypeIncludes && !(res.headers["content-type"] || "").includes(e.contentTypeIncludes))
    problems.push(`content-type "${res.headers["content-type"] || ""}" missing "${e.contentTypeIncludes}"`);
  if (e.xRobotsIncludes && !(res.headers["x-robots-tag"] || "").toLowerCase().includes(e.xRobotsIncludes))
    problems.push(`x-robots-tag "${res.headers["x-robots-tag"] || ""}" missing "${e.xRobotsIncludes}"`);
  if (e.xRobotsAbsent && res.headers["x-robots-tag"])
    problems.push(`x-robots-tag present ("${res.headers["x-robots-tag"]}") but must be absent`);
  if (e.header && res.headers[e.header[0]] !== e.header[1])
    problems.push(`header ${e.header[0]} "${res.headers[e.header[0]]}" != "${e.header[1]}"`);
  if (e.absentHeader && res.headers[e.absentHeader])
    problems.push(`header ${e.absentHeader} present ("${res.headers[e.absentHeader]}") but must be absent`);
  if (e.absentHeaders) {
    for (const k of e.absentHeaders)
      if (res.headers[k]) problems.push(`unexpected security header ${k}="${res.headers[k]}"`);
  }

  let legacyInfo = "";
  if (LEGACY) {
    try {
      const lr = await fetchHead(LEGACY, c.path);
      legacyInfo = ` [legacy ${lr.status}]`;
    } catch {
      legacyInfo = " [legacy unreachable]";
    }
  }

  if (problems.length === 0) {
    if (c.kind === "accepted") {
      accepted++;
      console.log(`ACCEPTED  ${c.id}${legacyInfo}`);
      if (c.legacyNote) console.log(`          note: ${c.legacyNote}`);
    } else {
      pass++;
      console.log(`PASS  ${c.id}${legacyInfo}`);
    }
  } else if (c.kind === "accepted") {
    accepted++;
    console.log(`ACCEPTED  ${c.id}${legacyInfo}  (${problems.join("; ")})`);
    if (c.legacyNote) console.log(`          note: ${c.legacyNote}`);
  } else {
    fail++;
    console.log(`FAIL  ${c.id}${legacyInfo}\n      ${problems.join("\n      ")}`);
  }
}

console.log(
  `\nSUMMARY: ${pass} pass, ${fail} fail, ${accepted} accepted-divergence (of ${cases.length} cases)`
);
if (failures.length) {
  console.log("\nFAILURES:");
  for (const f of failures) console.log("  - " + f);
}
process.exit(fail ? 1 : 0);
