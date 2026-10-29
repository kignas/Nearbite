// Cart C7 (payment selector + fee preview, `window.CtX`) + C11 (CTA blocking,
// maintenance / shortage banners) parity harness — Phase 2m.
//
// Usage: node scripts/cart-c7c11-parity.mjs [legacyUrl] [newUrl]
//   defaults: http://localhost:8080/cart.html  http://localhost:3000/cart
//
// Both pages get the SAME localStorage seed and the SAME stubbed GET fixtures,
// then the harness drives the payment selector / cutlery toggle with real DOM
// events and deep-compares the resulting state + DOM + storage. The probes
// live in scripts/lib/cart-c7c11.mjs and are shared with cart-money-parity.mjs
// (Parts A–C), so both harnesses stay in lockstep.
//
// GET-only: every fixture is a GET response; no write endpoint is ever called.
// Owner decision 1: cart keys are deterministic composites compared EXACTLY.
import { chromium } from "playwright";
import { runPartA, runPartB, runPartC, runPartD, runPartE } from "./lib/cart-c7c11.mjs";

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

const urls = { legacyUrl, newUrl };
const browser = await chromium.launch();
await runPartA(browser, urls, check);
await runPartB(browser, urls, check);
await runPartC(browser, urls, check);
await runPartD(browser, urls, check);
await runPartE(browser, urls, check);
await browser.close();

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
if (fail) {
  console.log("Failed checks:\n  " + failures.join("\n  "));
  process.exit(1);
}
