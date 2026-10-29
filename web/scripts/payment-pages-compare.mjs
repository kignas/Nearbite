// Payment-result pages pixel compare — Phase 2n (chunk C10).
//
// Usage: node scripts/payment-pages-compare.mjs [legacyBase] [newBase]
//   defaults: legacy http://localhost:8080  new http://localhost:3000
//
// Runs scripts/compare.mjs (phone 390x844 + desktop 1280x800, unmasked) for
// each verdict state of payment-success / payment-failed / payment-pending and
// FAILS if any state is 1% or more different. The fixtures/seed files live in
// scripts/fixtures/ and are shared with payment-pages-parity.mjs.
//
// IMPORTANT: because these pages auto-redirect after their verdict (success
// after 3.6 s, pending/failed never), the capture must finish BEFORE the
// redirect fires. compare.mjs settles for ~0.8 s, which is well inside the
// 3.6 s window, so the result screenshots are stable.
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const [legacyBase = "http://localhost:8080", newBase = "http://localhost:3000"] =
  process.argv.slice(2);
const L = legacyBase.replace(/\/$/, "");
const N = newBase.replace(/\/$/, "");
const F = (f) => "scripts/fixtures/" + f;

const STATES = [
  ["pay-success-nocontext", `${L}/payment-success.html`, `${N}/payment-success`, F("payment-cmp-fx-empty.json"), F("s-success-nocontext.json")],
  ["pay-success-single", `${L}/payment-success.html`, `${N}/payment-success`, F("payment-cmp-fx-empty.json"), F("s-success-single.json")],
  ["pay-success-partialcod", `${L}/payment-success.html`, `${N}/payment-success`, F("payment-cmp-fx-empty.json"), F("s-success-partialcod.json")],
  ["pay-success-cod", `${L}/payment-success.html`, `${N}/payment-success`, F("payment-cmp-fx-empty.json"), F("s-success-cod.json")],
  ["pay-failed-nocontext", `${L}/payment-failed.html`, `${N}/payment-failed`, F("payment-cmp-fx-empty.json"), F("s-failed-nocontext.json")],
  ["pay-failed-ctx", `${L}/payment-failed.html`, `${N}/payment-failed`, F("payment-cmp-fx-empty.json"), F("s-failed-ctx.json")],
  ["pay-pending-ctx", `${L}/payment-pending.html`, `${N}/payment-pending`, F("payment-cmp-fx-pending.json"), F("s-pending-ctx.json")],
  ["pay-pending-nonum", `${L}/payment-pending.html`, `${N}/payment-pending`, F("payment-cmp-fx-pending.json"), F("s-pending-nonum.json")],
];

let pass = 0;
let fail = 0;
for (const [name, legacyUrl, newUrl, fx, seed] of STATES) {
  const out = spawnSync("node", ["scripts/compare.mjs", legacyUrl, newUrl, name, fx, seed], {
    encoding: "utf8",
  });
  const text = (out.stdout || "") + (out.stderr || "");
  const pcts = [...text.matchAll(/(\d+\.\d+)% different/g)].map((m) => parseFloat(m[1]));
  const worst = pcts.length ? Math.max(...pcts) : NaN;
  if (Number.isFinite(worst) && worst < 1) {
    pass++;
    console.log(`PASS  ${name}: ${pcts.map((p) => p.toFixed(2) + "%").join(" / ")}`);
  } else {
    fail++;
    console.log(`FAIL  ${name}: ${text.trim().split("\n").slice(-6).join(" | ")}`);
  }
}

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
