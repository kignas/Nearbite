// Payment-result pages (payment-success / payment-failed / payment-pending)
// parity harness — Phase 2n (chunk C10).
//
// Usage: node scripts/payment-pages-parity.mjs [legacyBase] [newBase]
//   defaults: legacy http://localhost:8080  new http://localhost:3000
//
// Both pages get the SAME localStorage seed and the SAME stubbed responses.
// EVERY non-GET request is intercepted and answered from a stub; the harness
// records method + URL + headers + exact body and FAILS if any write is not
// stubbed. The real backend is never reached; the real Razorpay SDK is never
// loaded (CDN aborted, a fake window.Razorpay installed first).
//
// Probes live in scripts/lib/payment-pages.mjs.
import { chromium } from "playwright";
import { runPaymentParity } from "./lib/payment-pages.mjs";

const [legacyBase = "http://localhost:8080", newBase = "http://localhost:3000"] =
  process.argv.slice(2);
const strip = (b) => b.replace(/\/$/, "");

const urls = {
  legacySuccess: strip(legacyBase) + "/payment-success.html",
  newSuccess: strip(newBase) + "/payment-success",
  legacyFailed: strip(legacyBase) + "/payment-failed.html",
  newFailed: strip(newBase) + "/payment-failed",
  legacyPending: strip(legacyBase) + "/payment-pending.html",
  newPending: strip(newBase) + "/payment-pending",
};

let pass = 0;
let fail = 0;
const failures = [];
function check(label, a, b) {
  const sa = JSON.stringify(a);
  const sb = JSON.stringify(b);
  if (sa === sb) {
    pass++;
    console.log(`  PASS  ${label}`);
  } else {
    fail++;
    failures.push(label);
    console.log(`  FAIL  ${label}`);
    console.log(`        legacy: ${sa}`);
    console.log(`        new:    ${sb}`);
  }
}
function note(msg) {
  console.log(`  · ${msg}`);
}

const browser = await chromium.launch();
await runPaymentParity(browser, urls, check, note);
await browser.close();

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
if (fail) {
  console.log("Failed checks:\n  " + failures.join("\n  "));
  process.exit(1);
}
