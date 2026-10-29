// Cart C9 (place-order + idempotency + Razorpay) parity harness — Phase 2o.
//
// Usage: node scripts/cart-c9-parity.mjs [legacyUrl] [newUrl]
//   defaults: http://localhost:8080/cart.html  http://localhost:3000/cart
//
// Both pages get the SAME localStorage seed, the SAME GET fixtures and the SAME
// write stubs. EVERY non-GET request is intercepted and answered from a stub;
// the harness records method + URL + headers + exact body and FAILS if any write
// is not stubbed. The real backend is never reached; the real Razorpay SDK is
// never loaded (CDN aborted, a fake window.Razorpay installed first).
//
// The probes live in scripts/lib/cart-c9.mjs and are shared with
// cart-money-parity.mjs so both harnesses stay in lockstep:
//   A. verdict matrix: every placeOrder outcome (UPI paid / failed / pending,
//      COD complete / advance-open / advance-pending, network error, 503
//      maintenance, missing payment.orderId, Razorpay dismissed, Razorpay
//      payment.failed) — DOM hash, CTA state, toast, storage keys EXACTLY, and
//      the final redirect path+search (result-page navigations are intercepted
//      and fulfilled so page.url() reports the target).
//   B. guards: guest (no token) -> login.html, no address -> address.html.
//   C. the exact body and headers of the stubbed POST /orders (deep-equal) and
//      the Idempotency-Key bound to the payload fingerprint.
//   D. direct function parity (page.evaluate) for each C9-owned function.
//   E. boot-once GET counts per endpoint.
//   F. re-entrancy (double placeOrder -> one POST /orders, one Razorpay).
import { chromium } from "playwright";
import { runC9Probes } from "./lib/cart-c9.mjs";

const [
  legacyUrl = "http://localhost:8080/cart.html",
  newUrl = "http://localhost:3000/cart",
] = process.argv.slice(2);

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
await runC9Probes(browser, { legacyUrl, newUrl }, check, note);
await browser.close();

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
if (fail) {
  console.log("Failed checks:\n  " + failures.join("\n  "));
  process.exit(1);
}
