#!/usr/bin/env node
// ============================================================================
// tools/coverage.mjs — every legacy `*.html` in the repo root must be either
// ported (its clean route is in PORTED_PAGES) or listed below with a reason.
//
// Usage: node tools/coverage.mjs
//
// No dependencies — Node built-ins only.
// ============================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* Explicit exceptions: a legacy file with no ported route of its own. The
   reason must say what happens to the URL instead. */
const EXCEPTIONS = {
  "restaurant old.html": "superseded by restaurant-shell.html; served by the /restaurant server route (SEO shell)",
  "restaurant-info.html": "orphan page, replaced by the Info tab; 301 redirects to /restaurant",
  "restaurant-details.html": "orphan page, replaced by the Info tab; redirects to /restaurant",
  "track-order-10.html": "junk copy (NUL-filled file); the URL 301 redirects to /track-order",
};

function portedPages() {
  const src = fs.readFileSync(path.join(ROOT, "web", "next.config.js"), "utf8");
  const m = src.match(/^\s*const\s+PORTED_PAGES\s*=\s*\[([\s\S]*?)\];/m);
  if (!m) return null;
  const out = [];
  const re = /"([^"]*)"|'([^']*)'/g;
  let g;
  while ((g = re.exec(m[1]))) out.push(g[1] !== undefined ? g[1] : g[2]);
  return out;
}

/* Every legacy `*.html` and the clean URL it belongs to. The mapping is the
   same table web/next.config.js uses for its 301 redirects. */
const CLEAN = {
  "index.html": "/",
  "about.html": "/about",
  "address-new.html": "/address-new",
  "address.html": "/address",
  "application-status.html": "/application-status",
  "apply.html": "/apply",
  "cart.html": "/cart",
  "category.html": "/category",
  "complete-profile.html": "/complete-profile",
  "delivery-areas-and-charges.html": "/delivery-areas-and-charges",
  "faq.html": "/faq",
  "food-delivery-in-maynaguri.html": "/food-delivery-in-maynaguri",
  "forgot-password.html": "/forgot-password",
  "legal.html": "/legal",
  "location-onboarding.html": "/location-onboarding",
  "login.html": "/login",
  "order-help.html": "/order-help",
  "order-support.html": "/order-support",
  "orders.html": "/orders",
  "partner-rules.html": "/partner-rules",
  "partner-with-us.html": "/partner-with-us",
  "payment-failed.html": "/payment-failed",
  "payment-pending.html": "/payment-pending",
  "payment-success.html": "/payment-success",
  "privacy-data.html": "/privacy-data",
  "profile.html": "/profile",
  "rate-us.html": "/rate-us",
  "refund-policy.html": "/refund-policy",
  "reset-password.html": "/reset-password",
  "restaurant-shell.html": "/restaurant-shell",
  "search.html": "/search",
  "storage-check.html": "/storage-check",
  "support.html": "/support",
  "terms.html": "/terms",
  "track-order-10.html": "/track-order",
  "track-order.html": "/track-order",
  "under99.html": "/under99",
  /* The two orphan restaurant pages map to the shell route. */
  "restaurant-details.html": "/restaurant",
  "restaurant-info.html": "/restaurant",
};

const files = fs
  .readdirSync(ROOT)
  .filter((f) => f.toLowerCase().endsWith(".html"))
  .sort();

const ported = portedPages();
if (ported == null) {
  console.error("COVERAGE: could not read PORTED_PAGES from web/next.config.js");
  process.exit(2);
}

let unexplained = 0;
const rows = [];
for (const file of files) {
  const clean = CLEAN[file];
  if (EXCEPTIONS[file]) {
    rows.push([file, clean || "-", "EXCEPTION: " + EXCEPTIONS[file]]);
  } else if (clean && ported.includes(clean)) {
    rows.push([file, clean, "PORTED"]);
  } else {
    rows.push([file, clean || "-", "UNEXPLAINED"]);
    unexplained++;
  }
}

const w0 = Math.max(...files.map((f) => f.length), 10);
console.log("== legacy *.html coverage (" + files.length + " files) ==");
console.log(
  "  " + "FILE".padEnd(w0) + "  " + "CLEAN ROUTE".padEnd(32) + "  STATUS"
);
for (const [file, clean, status] of rows) {
  console.log("  " + file.padEnd(w0) + "  " + clean.padEnd(32) + "  " + status);
}

/* Every exception must still exist as a file (a stale entry is a bug). */
const staleExceptions = Object.keys(EXCEPTIONS).filter(
  (f) => !files.includes(f)
);
if (staleExceptions.length) {
  console.log("\n  stale exception(s) (no such legacy file): " + staleExceptions.join(", "));
  unexplained += staleExceptions.length;
}

const portedCount = rows.filter((r) => r[2] === "PORTED").length;
const exceptionCount = rows.length - portedCount;
console.log(
  `\nCOVERAGE: ${portedCount} ported, ${exceptionCount} explained exception(s), ${unexplained} unexplained`
);
process.exit(unexplained ? 1 : 0);
