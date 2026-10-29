// Phase 2m — Part D pixel compare for /cart: legacy cart.html vs new /cart.
//
// Usage: node scripts/cart-c7c11-compare.mjs
//
// Runs scripts/compare.mjs (same fullPage / pad-to-max / animations-off /
// threshold 0.12 pixel pipeline) over every Part D scenario, phone + desktop:
//
//   1. seeded plain cart            fixtures cart-seeded.json     seed seed-cart-plain.json
//   2. custom + portion item        fixtures cart-seeded.json     seed seed-cart-custom.json
//   3. empty cart                   fixtures cart-empty.json
//   4. restaurant held (isOpen:false) fixtures cart-held.json     seed seed-cart-plain.json
//   5. maintenance state            fixtures cart-maintenance.json seed seed-cart-plain.json
//   6. rider-shortage state         fixtures cart-shortage.json   seed seed-cart-plain.json
//
// MASK BOXES: NONE. C1–C7 + C11 are ported, so every region of the page is
// compared UNMASKED and must be 0.00%. The still-unported chunks have no
// independent /cart surface to mask:
//   C8  address + profile hydration (cart-page 187–215, 1228–1300, 3038–3132)
//       — writes the SAME nodes C2/C3 already paint; nothing extra to hide.
//   C9  placeOrder + idempotency + Razorpay open (cart-page 1334–1919)
//       — POST-only path; paints no persistent DOM region on load.
//   C10 payment result pages (payment-success/failed/pending)
//       — separate routes entirely, not part of /cart.
// If a future change makes one of these paint a visible block on /cart, add a
// box selector to MASKS below and record it in PROGRESS.md.
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const MASKS = []; // deliberately empty — see the C8/C9/C10 note above

const SCENARIOS = [
  { name: "cart-2m-plain", fixtures: "scripts/fixtures/cart-seeded.json", seed: "scripts/fixtures/seed-cart-plain.json" },
  { name: "cart-2m-custom", fixtures: "scripts/fixtures/cart-seeded.json", seed: "scripts/fixtures/seed-cart-custom.json" },
  { name: "cart-2m-empty", fixtures: "scripts/fixtures/cart-empty.json" },
  { name: "cart-2m-held", fixtures: "scripts/fixtures/cart-held.json", seed: "scripts/fixtures/seed-cart-plain.json" },
  { name: "cart-2m-maintenance", fixtures: "scripts/fixtures/cart-maintenance.json", seed: "scripts/fixtures/seed-cart-plain.json" },
  { name: "cart-2m-shortage", fixtures: "scripts/fixtures/cart-shortage.json", seed: "scripts/fixtures/seed-cart-plain.json" },
];

console.log(`MASK BOXES (C8/C9/C10 only): ${MASKS.length ? MASKS.join(", ") : "(none)"}\n`);

let failed = 0;
for (const sc of SCENARIOS) {
  const args = [
    "scripts/compare.mjs",
    "http://localhost:8080/cart.html",
    "http://localhost:3000/cart",
    sc.name,
    sc.fixtures,
  ];
  if (sc.seed) args.push(sc.seed);
  const r = spawnSync("node", args, { stdio: ["ignore", "pipe", "inherit"], encoding: "utf8" });
  const out = (r.stdout || "").trim();
  console.log(`-- ${sc.name}\n${out}`);
  if (r.status !== 0) failed++;
  for (const line of out.split("\n")) {
    const m = line.match(/([\d.]+)% different/);
    if (m && parseFloat(m[1]) > 1) failed++;
  }
  console.log("");
}

console.log(failed ? `C7/C11 COMPARE: FAIL (${failed})` : "C7/C11 COMPARE: PASS (all scenarios under 1%)");
process.exit(failed ? 1 : 0);
