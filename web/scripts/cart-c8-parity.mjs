// Cart C8 (address + profile hydration + lifecycle) parity harness — Phase 2n.
//
// Usage: node scripts/cart-c8-parity.mjs [legacyUrl] [newUrl]
//   defaults: http://localhost:8080/cart.html  http://localhost:3000/cart
//
// Both pages get the SAME localStorage seed and the SAME stubbed GET fixtures.
// The C8 functions (loadAddress, ctEnsureProfile, paintCheckoutDeliverySummary,
// ctSelectedAddress, ctCustomerContact, ctAddressTag, ctAddressLine, hasAddress,
// ctCaptureProfile, hydrateCachedCustomer) were ported by C2/C3; C8 adds the
// legacy lifecycle wiring (pageshow / storage / nearbite:address-changed /
// resize, cart-page.js L3309–3346).
//
// The probes live in scripts/lib/cart-c8.mjs and are shared with
// cart-money-parity.mjs so both harnesses stay in lockstep:
//   A. profile state matrix (saved / empty / missing name+phone / malformed
//      coords / 401 / network error / "__hang__"): address block innerHTML
//      hash, tag, display text, prompt class, CTA label+class+aria, storage
//      keys (EXACT), sheet DOM hashes.
//   B. direct page.evaluate parity for each C8-owned function.
//   C. lifecycle events (storage address/extras, pageshow persisted/not,
//      nearbite:address-changed, resize): resulting DOM + storage + the
//      C8-owned /users/profile fetch signal.
//   D. sheet DOM when opened (note/tip/coupon).
//   E. boot-once GET counts per endpoint.
//
// GET-only: every fixture is a GET response; no write endpoint is ever called.
import { chromium } from "playwright";
import { runPartA, runPartB, runPartC, runPartD, runPartE } from "./lib/cart-c8.mjs";

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

const urls = { legacyUrl, newUrl };
const browser = await chromium.launch();
await runPartA(browser, urls, check, note);
await runPartB(browser, urls, check, note);
await runPartC(browser, urls, check, note);
await runPartD(browser, urls, check, note);
await runPartE(browser, urls, check, note);
await browser.close();

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
if (fail) {
  console.log("Failed checks:\n  " + failures.join("\n  "));
  process.exit(1);
}
