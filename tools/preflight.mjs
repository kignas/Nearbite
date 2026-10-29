#!/usr/bin/env node
// ============================================================================
// tools/preflight.mjs — fast pre-delivery gate for the EatSwada migration.
//
// Usage:
//   node tools/preflight.mjs [--zip <path-to-final-zip>] [--update-shared]
//
// Prints one PASS/FAIL line per check plus a final summary, and writes the
// same text to preflight-report.txt at the repo root (which is included in
// the deliverable zip).
//
// Checks:
//   STRAY     no .env*, node_modules, .next, *.tsbuildinfo, compare-out, .git,
//             nohup.out, *.log, *.pid anywhere in the tree / zip.
//   SECRETS   no JWTs, rzp_live_ keys, real-looking emails (anything not
//             @example.com / @eatswada.com / test@... / the legacy placeholder
//             you@restaurant.com), 10-digit Indian phone numbers, Bearer tokens
//             or private keys anywhere in the payload (tree or zip). The public
//             Firebase web apiKey is allow-listed and listed explicitly in the
//             report.
//   SHARED    the frozen shared files (cart.ts, api.ts, safe-html.ts,
//             CartBar.tsx, Header.tsx, every file in web/styles/legacy and
//             web/public) hashed (sha256) against tools/frozen-hashes.json.
//             FAIL on any difference or missing file. `--update-shared`
//             rewrites the JSON from the current tree.
//   PORTED    prints the PORTED_PAGES list from web/next.config.js.
//   COVERAGE  runs tools/coverage.mjs: every legacy *.html is either ported or
//             an explained exception (FAIL on any unexplained file).
//   NOWRITE   greps web/app, web/components, web/lib for fetch calls with
//             method POST/PUT/PATCH/DELETE; every hit must be in a file on
//             the allow-list in tools/write-allowlist.json.
//   ZIPNAME   the zip's file name matches eatswada-web-phase-<id>.zip and the
//             file count is printed.
//   GIT       no git commands in tools/ or scripts/.
//   PROGRESS  the newest entry is at the TOP (below the title) and <= 60 lines.
//
// No dependencies — Node built-ins only.
// ============================================================================
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* ── args ────────────────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
function flag(name) {
  return argv.includes(name);
}
function argValue(name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
}
const ZIP_ARG = argValue("--zip");
const UPDATE_SHARED = flag("--update-shared");

/* ── tiny test-report collector ──────────────────────────────────────── */
const lines = [];
let failures = 0;
function line(s) {
  lines.push(s);
}
function result(name, ok, detail) {
  if (!ok) failures++;
  const tag = ok ? "PASS" : "FAIL";
  line(`${tag}  ${name}${detail ? "  — " + detail : ""}`);
  console.log(`${tag}  ${name}${detail ? "  — " + detail : ""}`);
}
function info(s) {
  line(s);
  console.log(s);
}

/* ── helpers ─────────────────────────────────────────────────────────── */
function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}
function readText(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch (e) {
    return null;
  }
}

/* Recursively list every file under `dir`, relative to `base`. Never follows
   symlinks (so a symlinked node_modules can't hide a stray). `prune` is a set
   of directory base-names to skip entirely. */
function walk(dir, base = dir, out = [], prune = null) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = path.relative(base, full).split(path.sep).join("/");
    if (e.isDirectory()) {
      if (prune && prune.has(e.name)) continue;
      walk(full, base, out, prune);
    } else if (e.isFile()) out.push(rel);
    else if (e.isSymbolicLink()) out.push(rel); // count the link itself
  }
  return out;
}

/* The delivery payload: exactly what the cumulative zip carries. The repo's
   own `.git` and the dev `node_modules`/`.next` are inherent to a working
   checkout and are excluded from delivery, so STRAY scans the payload (the
   zipped trees) rather than the whole checkout — inside those trees a
   `node_modules`/`.next` is pruned as a dependency/build dir, but `.env*`,
   `compare-out`, `*.tsbuildinfo` and a nested `.git` are still flagged. */
const PAYLOAD_DIRS = ["web", "tools", "notes"];
const PAYLOAD_ROOT_FILES = ["PROGRESS.md", "AGENTS.md", "preflight-report.txt"];
const PRUNE_DIRS = new Set(["node_modules", ".next"]);

/* ============================================================================
   STRAY — no .env*, node_modules, .next, *.tsbuildinfo, compare-out, .git,
   nohup.out, *.log, *.pid
   ============================================================================ */
const STRAY_RE =
  /(^|\/)(\.env[^/]*|node_modules|\.next|compare-out|\.git)(\/|$)|\.tsbuildinfo$|(^|\/)nohup\.out$|\.log$|\.pid$/;

function strayInTree() {
  const hits = [];
  for (const d of PAYLOAD_DIRS) {
    const abs = path.join(ROOT, d);
    if (!fs.existsSync(abs)) continue;
    for (const r of walk(abs, ROOT, [], PRUNE_DIRS)) {
      if (STRAY_RE.test(r)) hits.push(r);
    }
  }
  for (const f of PAYLOAD_ROOT_FILES) {
    if (fs.existsSync(path.join(ROOT, f)) && STRAY_RE.test(f)) hits.push(f);
  }
  return hits;
}

/* ============================================================================
   SECRETS — JWTs, rzp_live_ keys, real-looking emails, 10-digit Indian phone
   numbers, Bearer tokens and private keys anywhere in the payload.

   Scanned over the same payload as STRAY (the trees the zip carries) plus,
   when `--zip` is passed, every text entry inside the zip. The public Firebase
   web apiKey is allow-listed (it is public by design — it ships in the legacy
   `config.js` and is guarded by Firebase security rules / authorized domains);
   it is listed explicitly in the report.

   Allow-listed values:
     - public Firebase web apiKey  AIzaSyA0bqVE3RCmiJORcufx-v6Gew16GMCfFp0
       (legacy config.js FIREBASE.apiKey + web/public/firebase-messaging-sw.js)
   ============================================================================ */
const SECRET_FIREBASE_APIKEY = "AIzaSyA0bqVE3RCmiJORcufx-v6Gew16GMCfFp0";
const SECRETS_ALLOWLIST = [SECRET_FIREBASE_APIKEY];

/* The public Firebase web apiKey is 39 chars after "AIza"; only these exact
   allow-listed values may appear. Any other AIza… string is a failure. */
const RE_FIREBASE_KEY = /\bAIza[0-9A-Za-z_-]{20,}\b/g;
const RE_JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/g;
const RE_RZP_LIVE = /\brzp_live_[A-Za-z0-9]{6,}\b/g;
const RE_BEARER = /\bBearer\s+[A-Za-z0-9._~+/-]{24,}={0,2}/g;
const RE_PRIVATE_KEY = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/g;
const RE_EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
/* 10-digit Indian mobile number. The boundaries exclude hex neighbours so
   sha256 digests in tools/frozen-hashes.json do not match. */
const RE_PHONE_IN = /(?<![0-9A-Fa-f])(?:\+91[-\s]?)?([6-9]\d{9})(?![0-9A-Fa-f])/g;

const EMAIL_ALLOW_SUFFIXES = ["@example.com", "@eatswada.com"];
/* Verbatim placeholder strings copied from the legacy markup (never a real
   address): apply.html L184 `placeholder="you@restaurant.com"`. */
const EMAIL_ALLOW_EXACT = ["you@restaurant.com"];
function emailAllowed(addr) {
  const lower = addr.toLowerCase();
  if (EMAIL_ALLOW_EXACT.includes(lower)) return true;
  if (EMAIL_ALLOW_SUFFIXES.some((s) => lower.endsWith(s))) return true;
  if (lower.startsWith("test@") || lower.startsWith("test.") || lower.includes("+test@")) return true;
  return false;
}

/* Phone allow-list: obvious fake / placeholder patterns only. Anything with a
   real-looking shape (>=4 distinct digits and not all-but-one repeated) is a
   failure, so a genuine customer number can never slip into the deliverable. */
const PHONE_ALLOW = new Set([
  "9000000000", "9777777777", "9876543210", "9888888888", "9999999999",
  "7000000000", "1111111111", "6789012345",
]);
function phoneAllowed(n) {
  if (PHONE_ALLOW.has(n)) return true;
  // all-same-digit or a single leading digit then all 9s (e.g. 6000000000).
  if (/^(\d)\1{9}$/.test(n)) return true;
  if (/^[6-9]0{9}$/.test(n)) return true;
  return false;
}

function scanSecretsText(rel, text, hits) {
  const push = (kind, value) => hits.push({ file: rel, kind, value: String(value).slice(0, 80) });

  for (const m of text.matchAll(RE_JWT)) push("JWT", m[0]);
  for (const m of text.matchAll(RE_RZP_LIVE)) push("rzp_live key", m[0]);
  for (const m of text.matchAll(RE_PRIVATE_KEY)) push("private key", m[0]);
  for (const m of text.matchAll(RE_BEARER)) push("Bearer token", m[0]);
  for (const m of text.matchAll(RE_FIREBASE_KEY)) {
    if (!SECRETS_ALLOWLIST.includes(m[0])) push("Firebase apiKey (not allow-listed)", m[0]);
  }
  for (const m of text.matchAll(RE_EMAIL)) {
    if (!emailAllowed(m[0])) push("email", m[0]);
  }
  for (const m of text.matchAll(RE_PHONE_IN)) {
    if (!phoneAllowed(m[1])) push("phone", m[0]);
  }
}

function secretsInTree() {
  const hits = [];
  const scanFile = (rel) => {
    const abs = path.join(ROOT, rel);
    let buf;
    try {
      buf = fs.readFileSync(abs);
    } catch (e) {
      return;
    }
    // Skip binary-ish files quickly (NUL byte in the first 4 KiB).
    const head = buf.subarray(0, 4096);
    if (head.includes(0)) return;
    scanSecretsText(rel, buf.toString("utf8"), hits);
  };
  for (const d of PAYLOAD_DIRS) {
    const abs = path.join(ROOT, d);
    if (!fs.existsSync(abs)) continue;
    for (const rel of walk(abs, ROOT, [], PRUNE_DIRS)) scanFile(rel);
  }
  for (const f of PAYLOAD_ROOT_FILES) {
    if (fs.existsSync(path.join(ROOT, f))) scanFile(f);
  }
  return hits;
}

function secretsInZip(zipPath) {
  const hits = [];
  if (!fs.existsSync(zipPath)) return hits;
  const buf = fs.readFileSync(zipPath);
  const names = zipEntryNames(buf);
  for (const name of names) {
    const data = zipEntryData(buf, name);
    if (!data) continue;
    const head = data.subarray(0, 4096);
    if (head.includes(0)) continue;
    scanSecretsText(name, data.toString("utf8"), hits);
  }
  return hits;
}

/* ============================================================================
   SHARED — sha256 of frozen files vs tools/frozen-hashes.json
   ============================================================================ */
const FROZEN_JSON = path.join(ROOT, "tools", "frozen-hashes.json");

/* The frozen set: five named files plus every file in web/styles/legacy and
   web/public. Keys are repo-relative POSIX paths. */
const FROZEN_NAMED = [
  "web/lib/cart.ts",
  "web/lib/api.ts",
  "web/lib/safe-html.ts",
  "web/components/CartBar.tsx",
  "web/components/Header.tsx",
];
const FROZEN_DIRS = ["web/styles/legacy", "web/public"];

function frozenSet() {
  const set = new Set(FROZEN_NAMED);
  for (const d of FROZEN_DIRS) {
    const abs = path.join(ROOT, d);
    if (!fs.existsSync(abs)) continue;
    for (const rel of walk(abs, ROOT, [], PRUNE_DIRS)) set.add(rel);
  }
  return [...set].sort();
}

function hashOf(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return null;
  return sha256(fs.readFileSync(abs));
}

/* ============================================================================
   PORTED — read PORTED_PAGES out of web/next.config.js (no import; the file is
   CommonJS but pulling it in would need a loader — a text scan is enough and
   keeps this script dependency-free).
   ============================================================================ */
function portedPages() {
  const src = readText(path.join(ROOT, "web", "next.config.js"));
  if (src == null) return null;
  const m = src.match(/^\s*const\s+PORTED_PAGES\s*=\s*\[([\s\S]*?)\];/m);
  if (!m) return null;
  const body = m[1];
  const out = [];
  const re = /"([^"]*)"|'([^']*)'/g;
  let g;
  while ((g = re.exec(body))) out.push(g[1] !== undefined ? g[1] : g[2]);
  return out;
}

/* ============================================================================
   NOWRITE — fetch(...{method:'POST'|...}) in web/{app,components,lib}
   ============================================================================ */
const WRITE_ALLOWLIST_JSON = path.join(ROOT, "tools", "write-allowlist.json");
const WRITE_METHOD_RE = /method\s*:\s*["'`](POST|PUT|PATCH|DELETE)["'`]/i;

function scanWriteCalls() {
  const dirs = ["web/app", "web/components", "web/lib"];
  const hits = [];
  for (const d of dirs) {
    const abs = path.join(ROOT, d);
    if (!fs.existsSync(abs)) continue;
    for (const rel of walk(abs, ROOT)) {
      if (!/\.(ts|tsx|js|jsx|mjs)$/.test(rel)) continue;
      const src = readText(path.join(ROOT, rel));
      if (src == null) continue;
      const srcLines = src.split("\n");
      srcLines.forEach((ln, i) => {
        if (WRITE_METHOD_RE.test(ln)) {
          const method = WRITE_METHOD_RE.exec(ln)[1].toUpperCase();
          hits.push({ file: rel, line: i + 1, method, text: ln.trim() });
        }
      });
    }
  }
  return hits;
}

/* ============================================================================
   GIT — no git commands in tools/ or scripts/ (tools/ at root + web/scripts/).
   ============================================================================ */
const GIT_CMD_RE = /(^|[^\w.])git\s+(add|commit|push|pull|fetch|clone|checkout|branch|merge|rebase|stash|reset|remote|tag|log|diff|status)\b/;

function scanGitCommands() {
  const dirs = ["tools", "web/scripts"];
  const hits = [];
  for (const d of dirs) {
    const abs = path.join(ROOT, d);
    if (!fs.existsSync(abs)) continue;
    for (const rel of walk(abs, ROOT)) {
      if (!/\.(mjs|js|ts|tsx|sh)$/.test(rel)) continue;
      const src = readText(path.join(ROOT, rel));
      if (src == null) continue;
      src.split("\n").forEach((ln, i) => {
        // Ignore the word inside a comment-only mention is NOT wanted: the rule
        // is "no git commands", so any literal invocation counts. We skip the
        // line only when `git` is part of a longer identifier.
        if (GIT_CMD_RE.test(ln)) hits.push({ file: rel, line: i + 1, text: ln.trim() });
      });
    }
  }
  return hits;
}

/* ============================================================================
   PROGRESS — newest entry at the TOP (below the title) and <= 60 lines.
   ============================================================================ */
function checkProgress() {
  const src = readText(path.join(ROOT, "PROGRESS.md"));
  if (src == null) return { ok: false, detail: "PROGRESS.md missing" };
  const all = src.split("\n");
  // Title = first non-empty line (expected "# EatSwada migration — PROGRESS").
  let titleIdx = all.findIndex((l) => l.trim() !== "");
  if (titleIdx < 0) return { ok: false, detail: "PROGRESS.md is empty" };

  // Entry headings: "## <date> Task: <name>".
  const entryIdx = [];
  for (let i = 0; i < all.length; i++) {
    if (/^##\s+\S/.test(all[i])) entryIdx.push(i);
  }
  if (entryIdx.length === 0)
    return { ok: false, detail: "no '## <date> Task:' entry found" };

  const first = entryIdx[0];
  // Everything between the title and the first entry heading must be blank
  // (so the newest entry really is directly below the title).
  const between = all.slice(titleIdx + 1, first);
  const strayNonBlank = between.filter((l) => l.trim() !== "");
  if (strayNonBlank.length > 0)
    return {
      ok: false,
      detail: `text between title and first entry: ${JSON.stringify(
        strayNonBlank[0]
      ).slice(0, 60)}`,
    };

  const next = entryIdx.length > 1 ? entryIdx[1] : all.length;
  const entryLines = all.slice(first, next);
  // Trim a single trailing blank line that separates entries.
  while (entryLines.length && entryLines[entryLines.length - 1].trim() === "")
    entryLines.pop();

  const n = entryLines.length;
  const ok = n <= 60;
  return {
    ok,
    detail: `newest entry "${all[first].slice(0, 60)}" is ${n} lines (limit 60)`,
  };
}

/* ============================================================================
   ZIP — name + file count + STRAY inside the zip
   ============================================================================ */
function checkZip(zipPath) {
  if (!fs.existsSync(zipPath)) {
    return { nameOk: false, count: 0, strays: [], detail: "zip not found" };
  }
  const base = path.basename(zipPath);
  const nameOk = /^eatswada-web-phase-.+\.zip$/.test(base);
  // Minimal central-directory reader (no deps): find EOCD, then walk the
  // central directory entries and read each file name.
  const buf = fs.readFileSync(zipPath);
  const names = zipEntryNames(buf);
  const strays = names.filter((n) => STRAY_RE.test(n));
  return { nameOk, count: names.length, strays, detail: base };
}

/* Parse the zip central directory to list entry names. */
function zipEntryNames(buf) {
  // Locate End Of Central Directory (EOCD) signature 0x06054b50, scanning back.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 66000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return [];
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const names = [];
  for (let e = 0; e < count; e++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break;
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const name = buf.toString("utf8", off + 46, off + 46 + nameLen);
    names.push(name);
    off += 46 + nameLen + extraLen + commentLen;
  }
  return names;
}

/* Return the raw (decompressed) bytes of one zip entry, or null. Supports the
   two methods Python's zipfile uses by default: stored (0) and deflate (8). */
function zipEntryData(buf, name) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 66000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  for (let e = 0; e < count; e++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break;
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const entryName = buf.toString("utf8", off + 46, off + 46 + nameLen);
    if (entryName === name) {
      // Local header: 30 bytes + local name/extra lengths.
      const lNameLen = buf.readUInt16LE(localOff + 26);
      const lExtraLen = buf.readUInt16LE(localOff + 28);
      const dataStart = localOff + 30 + lNameLen + lExtraLen;
      const raw = buf.subarray(dataStart, dataStart + compSize);
      if (method === 0) return raw;
      if (method === 8) {
        try {
          return zlib.inflateRawSync(raw);
        } catch (err) {
          return null;
        }
      }
      return null;
    }
    off += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

/* ============================================================================
   RUN
   ============================================================================ */
info(`EatSwada preflight — ${new Date().toISOString()}`);
info(`repo root: ${ROOT}`);
info(`zip: ${ZIP_ARG || "(none passed)"}`);
info("");

/* ── STRAY ───────────────────────────────────────────────────────────── */
const treeStrays = strayInTree();
result(
  "STRAY (tree)",
  treeStrays.length === 0,
  treeStrays.length
    ? `${treeStrays.length} stray path(s): ${treeStrays.slice(0, 8).join(", ")}${
        treeStrays.length > 8 ? ", …" : ""
      }`
    : "clean"
);

/* ── SECRETS ─────────────────────────────────────────────────────────── */
info(`SECRETS allow-list: public Firebase web apiKey ${SECRET_FIREBASE_APIKEY}`);
const secretTreeHits = secretsInTree();
const secretZipHits = ZIP_ARG ? secretsInZip(ZIP_ARG) : [];
const secretHits = [...secretTreeHits, ...secretZipHits];
if (secretHits.length === 0) {
  result("SECRETS", true, `no JWTs / rzp_live keys / real emails / phones / Bearer tokens / private keys${ZIP_ARG ? " (tree + zip)" : " (tree)"}`);
} else {
  for (const h of secretHits.slice(0, 20)) {
    info(`      ${h.kind}: ${h.file}  ${h.value}`);
  }
  result(
    "SECRETS",
    false,
    `${secretHits.length} hit(s)${secretHits.length > 20 ? " (first 20 shown)" : ""}`
  );
}

/* ── SHARED ──────────────────────────────────────────────────────────── */
const frozen = frozenSet();
if (UPDATE_SHARED) {
  const map = {};
  for (const rel of frozen) {
    const h = hashOf(rel);
    if (h) map[rel] = h;
  }
  fs.writeFileSync(FROZEN_JSON, JSON.stringify(map, null, 2) + "\n");
  result("SHARED (--update-shared)", true, `wrote ${Object.keys(map).length} hashes to tools/frozen-hashes.json`);
} else {
  const baseline = readText(FROZEN_JSON);
  if (baseline == null) {
    result("SHARED", false, "tools/frozen-hashes.json missing — run with --update-shared once");
  } else {
    let expected;
    try {
      expected = JSON.parse(baseline);
    } catch (e) {
      expected = null;
    }
    if (!expected) {
      result("SHARED", false, "tools/frozen-hashes.json is not valid JSON");
    } else {
      const missing = [];
      const changed = [];
      for (const [rel, want] of Object.entries(expected)) {
        const got = hashOf(rel);
        if (got == null) missing.push(rel);
        else if (got !== want) changed.push(rel);
      }
      // Any frozen file present in the tree but absent from the baseline is a
      // NEW frozen file — also a failure (the baseline must cover them all).
      const added = frozen.filter((r) => !(r in expected));
      const ok = missing.length === 0 && changed.length === 0 && added.length === 0;
      const bits = [];
      if (missing.length) bits.push(`${missing.length} missing (${missing.slice(0, 4).join(", ")})`);
      if (changed.length) bits.push(`${changed.length} changed (${changed.slice(0, 4).join(", ")})`);
      if (added.length) bits.push(`${added.length} untracked new (${added.slice(0, 4).join(", ")})`);
      result(
        "SHARED",
        ok,
        ok ? `${Object.keys(expected).length} files byte-identical` : bits.join("; ")
      );
    }
  }
}

/* ── PORTED ──────────────────────────────────────────────────────────── */
const ported = portedPages();
if (ported == null) {
  result("PORTED", false, "could not read PORTED_PAGES from web/next.config.js");
} else {
  result("PORTED", true, `PORTED_PAGES = [${ported.map((p) => JSON.stringify(p)).join(", ")}]`);
}

/* ── COVERAGE ────────────────────────────────────────────────────────── */
{
  let out = "";
  let status = 1;
  try {
    const r = spawnSync(process.execPath, [path.join(ROOT, "tools", "coverage.mjs")], {
      cwd: ROOT,
      encoding: "utf8",
    });
    out = (r.stdout || "") + (r.stderr || "");
    status = r.status == null ? 1 : r.status;
  } catch (e) {
    out = String(e && e.message);
  }
  const summaryLine = (out.split("\n").filter((l) => l.startsWith("COVERAGE:")).pop() || "").trim();
  result("COVERAGE", status === 0, summaryLine || "tools/coverage.mjs failed to run");
  if (status !== 0) {
    for (const l of out.split("\n").filter((l) => /UNEXPLAINED|stale exception/.test(l))) {
      info("      " + l.trim());
    }
  }
}

/* ── NOWRITE ─────────────────────────────────────────────────────────── */
let allow = [];
const allowRaw = readText(WRITE_ALLOWLIST_JSON);
if (allowRaw) {
  try {
    const parsed = JSON.parse(allowRaw);
    allow = Array.isArray(parsed) ? parsed : parsed.files || [];
  } catch (e) {
    allow = [];
  }
}
const writeHits = scanWriteCalls();
const notAllowed = writeHits.filter((h) => !allow.includes(h.file));
if (writeHits.length === 0) {
  result("NOWRITE", true, "no POST/PUT/PATCH/DELETE fetch calls found");
} else {
  for (const h of writeHits) {
    info(`      ${h.method} ${h.file}:${h.line}  ${h.text.slice(0, 90)}`);
  }
  result(
    "NOWRITE",
    notAllowed.length === 0,
    notAllowed.length === 0
      ? `${writeHits.length} write call(s), all on the allow-list`
      : `${notAllowed.length} write call(s) NOT on tools/write-allowlist.json`
  );
}

/* ── ZIPNAME ─────────────────────────────────────────────────────────── */
if (!ZIP_ARG) {
  /* Informational until the final gate: the zip does not exist yet during the
     Part-1 run, so this is PASS with a note (never a hard fail on a missing
     --zip). It becomes a real check the moment --zip is passed. */
  result("ZIPNAME", true, "no --zip passed yet (informational; run again with --zip for the final gate)");
} else {
  const z = checkZip(ZIP_ARG);
  result(
    "ZIPNAME",
    z.nameOk && z.strays.length === 0,
    `${z.detail}: ${z.count} files${z.nameOk ? "" : " — name must match eatswada-web-phase-<id>.zip"}${
      z.strays.length ? `; STRAY inside zip: ${z.strays.slice(0, 6).join(", ")}` : ""
    }`
  );
}

/* ── GIT ─────────────────────────────────────────────────────────────── */
const gitHits = scanGitCommands();
result(
  "GIT",
  gitHits.length === 0,
  gitHits.length === 0
    ? "no git commands in tools/ or scripts/"
    : `${gitHits.length} hit(s): ${gitHits
        .slice(0, 5)
        .map((h) => `${h.file}:${h.line}`)
        .join(", ")}`
);

/* ── PROGRESS ────────────────────────────────────────────────────────── */
const prog = checkProgress();
result("PROGRESS", prog.ok, prog.detail);

/* ── summary ─────────────────────────────────────────────────────────── */
line("");
const total = 9;
const passed = total - failures;
const summary = failures === 0 ? `ALL ${total} CHECKS PASS` : `${failures} of ${total} CHECKS FAILED`;
line(`SUMMARY: ${summary}`);
console.log("");
console.log(`SUMMARY: ${summary}`);

/* Write the report next to the repo root (included in the zip). */
fs.writeFileSync(path.join(ROOT, "preflight-report.txt"), lines.join("\n") + "\n");

process.exit(failures === 0 ? 0 : 2);
