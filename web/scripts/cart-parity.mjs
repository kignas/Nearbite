// Cart-parity harness for the 99 Store page.
//
// Usage: node scripts/cart-parity.mjs [legacyUrl] [newUrl] [fixturesFile]
//   defaults: http://localhost:8080/under99.html  http://localhost:3000/under99
//             scripts/fixtures/under99.json
//
// Runs the SAME user sequence on the legacy page and the new page with the
// same fixtures installed on both, then asserts the cart storage is
// deep-equal after every step and prints a pass/fail table.
//
// Sequence (each step = one row):
//   1. add a plain item (no customizations)          -> direct add
//   2. increase quantity (stepper "+")
//   3. open the customize sheet, pick options, add
//   4. decrease to zero (stepper "-" twice)
//   5. add two items from different cards
//   6. clear the cart
//
// Compared after every step:
//   nearbite_cart, es_image_dict  (localStorage)  — deep-equal
//   cart bar text + pink-bar total (only for the pink mode this page uses)
//
// Anything the port genuinely cannot control is excluded from the diff and
// reported instead of being silently ignored:
//   * Owner decision 1: customized-line payload keys are deterministic
//     composites (no `Date.now()` discriminator), so `nearbite_cart` is
//     compared EXACTLY — no normalisation.
import { chromium } from "playwright";
import fs from "node:fs";

const [legacyUrl = "http://localhost:8080/under99.html", newUrl = "http://localhost:3000/under99", fixturesArg = "scripts/fixtures/under99.json"] =
  process.argv.slice(2);

function resolveFixturesPath(p) {
  const candidates = [p, p.replace(/^web\//, ""), "web/" + p];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return p;
}
const fixtures = JSON.parse(fs.readFileSync(resolveFixturesPath(fixturesArg), "utf8"));

function fixtureFor(rawUrl) {
  const u = new URL(rawUrl);
  const path = u.pathname.replace(/^\/api/, "");
  const exact = path + u.search;
  if (fixtures[exact] !== undefined) return fixtures[exact];
  if (fixtures[path] !== undefined) return fixtures[path];
  return undefined;
}

async function installFixtures(page) {
  await page.route("https://api.eatswada.com/**", (route) => {
    const body = fixtureFor(route.request().url());
    if (body === undefined) {
      return route.fulfill({
        status: 404,
        headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
        body: JSON.stringify({ success: false, message: "Not found in fixtures" }),
      });
    }
    return route.fulfill({
      status: 200,
      headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  });
}

/* ------------------------------------------------------------------ */
/* Snapshot helpers                                                    */
/* ------------------------------------------------------------------ */

// Owner decision 1: payload keys are deterministic, so this is a pass-through
// that only prunes an undefined `originalPrice` before the exact comparison.
function normaliseCart(raw) {
  if (raw == null) return null;
  let obj = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  const notes = [];
  const out = {};
  for (const key of Object.keys(obj)) {
    let normKey = key;
    /* Owner decision 1: payload keys are deterministic composites and are
       compared EXACTLY — no Date.now() normalisation. */
    const entry = obj[key];
    const normEntry = { ...entry };
    if (normEntry.originalPrice === undefined) delete normEntry.originalPrice;
    out[normKey] = normEntry;
  }
  return { cart: out, notes };
}

async function snapshot(page) {
  return page.evaluate(() => {
    const ls = {};
    for (const k of ["nearbite_cart", "es_image_dict", "nearbite_checkout_key", "nearbite_checkout_fp", "nearbite_checkout_fp_ts"]) {
      ls[k] = localStorage.getItem(k);
    }
    const root = document.getElementById("white-cart-root");
    const countEl = document.getElementById("wc-item-count");
    return {
      ls,
      bar: {
        exists: !!root,
        pink: root ? root.classList.contains("wc-pink") : false,
        display: root ? getComputedStyle(root).display : null,
        count: countEl ? countEl.textContent : null,
      },
      // the pink bar total is rendered inside #wc-item-count as "<n> items · ₹<total>"
    };
  });
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/* ------------------------------------------------------------------ */
/* The user sequence                                                   */
/* ------------------------------------------------------------------ */

// Item ids taken from the fixture: two customizable and one plain item.
const PLAIN_ID = "6ace3058d2398604a092764e"; // Foodie Special Soup (Veg & Egg) — no customizations
const PLAIN_ID_2 = "6ace2f9dd2398604a09275e6"; // Hot & Sour Soup (Egg With Chicken) — no customizations
const CUSTOM_ID = "6ace2f29d2398604a0927549"; // Hot & Sour Soup (Veg) — required single group

async function control(page, mi) {
  return page.locator(`.u99-add-control[data-mi="${mi}"]`);
}

const STEPS = [
  {
    name: "1. add plain item (direct add)",
    async run(page) {
      await (await control(page, PLAIN_ID)).locator("[data-cart-add]").click();
      await page.waitForTimeout(450);
    },
  },
  {
    name: '2. increase quantity (stepper "+")',
    async run(page) {
      await (await control(page, PLAIN_ID)).locator("[data-cart-inc]").click();
      await page.waitForTimeout(450);
    },
  },
  {
    name: "3. customize sheet: pick option 2, add",
    async run(page) {
      await (await control(page, CUSTOM_ID)).locator("[data-cart-add]").click();
      await page.waitForTimeout(500);
      // sheet is open; choose the second option of the first group
      await page.locator("#u99-item-sheet .u99-choice").nth(1).click();
      await page.waitForTimeout(250);
      await page.locator('#u99-item-sheet [data-item-action="add"]').click();
      await page.waitForTimeout(600);
    },
  },
  {
    name: "4. decrease to zero (stepper \u2212 twice)",
    async run(page) {
      await (await control(page, PLAIN_ID)).locator("[data-cart-dec]").click();
      await page.waitForTimeout(350);
      await (await control(page, PLAIN_ID)).locator("[data-cart-dec]").click();
      await page.waitForTimeout(600);
    },
  },
  {
    name: "5. add two items from different cards",
    async run(page) {
      await (await control(page, PLAIN_ID)).locator("[data-cart-add]").click();
      await page.waitForTimeout(400);
      await (await control(page, PLAIN_ID_2)).locator("[data-cart-add]").click();
      await page.waitForTimeout(500);
    },
  },
  {
    name: "6. clear the cart",
    async run(page) {
      await page.evaluate(() => {
        localStorage.removeItem("nearbite_cart");
        document.dispatchEvent(new CustomEvent("eatswada:cart-updated", { detail: { source: "clearCart", cleared: true } }));
        if (typeof window.updateGlobalCart === "function") window.updateGlobalCart();
      });
      await page.waitForTimeout(450);
    },
  },
];

async function drive(url) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e).split("\n")[0]));
  await installFixtures(page);
  await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(1600); // let the grid + cart bar settle
  const results = [];
  results.push({ step: "0. initial", ...(await snapshot(page)) });
  for (const s of STEPS) {
    await s.run(page);
    results.push({ step: s.name, ...(await snapshot(page)) });
  }
  await browser.close();
  return { results, pageErrors };
}

/* ------------------------------------------------------------------ */
/* Run + compare                                                       */
/* ------------------------------------------------------------------ */

const legacy = await drive(legacyUrl);
const next = await drive(newUrl);

console.log("\nCart parity: 99 Store (pink bar)");
console.log("  legacy:", legacyUrl);
console.log("  new   :", newUrl);
console.log("  fixtures:", resolveFixturesPath(fixturesArg), "\n");

let failures = 0;
const rows = [];
const notes = [];

const n = Math.max(legacy.results.length, next.results.length);
for (let i = 0; i < n; i++) {
  const L = legacy.results[i];
  const N = next.results[i];
  const stepName = (L || N).step;

  const lc = normaliseCart(L.ls.nearbite_cart);
  const nc = normaliseCart(N.ls.nearbite_cart);
  if (lc && nc) {
    for (const note of [...lc.notes, ...nc.notes]) if (!notes.includes(note)) notes.push(note);
  }

  const checks = [
    ["nearbite_cart", deepEqual(lc ? lc.cart : null, nc ? nc.cart : null)],
    ["es_image_dict", deepEqual(L.ls.es_image_dict, N.ls.es_image_dict)],
    ["checkout keys", deepEqual(
      [L.ls.nearbite_checkout_key, L.ls.nearbite_checkout_fp, L.ls.nearbite_checkout_fp_ts],
      [N.ls.nearbite_checkout_key, N.ls.nearbite_checkout_fp, N.ls.nearbite_checkout_fp_ts]
    )],
    ["cart-bar mode", L.bar.pink === N.bar.pink && L.bar.exists === N.bar.exists],
    ["bar visible", L.bar.display === N.bar.display],
    ["cart-bar text", L.bar.count === N.bar.count],
  ];
  const ok = checks.every(([, v]) => v);
  if (!ok) failures++;
  rows.push({
    step: stepName,
    ok,
    checks,
    legacyCart: lc ? lc.cart : null,
    newCart: nc ? nc.cart : null,
    legacyText: L.bar.count,
    newText: N.bar.count,
    legacyDisplay: L.bar.display,
    newDisplay: N.bar.display,
  });
}

/* ---- print the table ---- */
const w = Math.max(...rows.map((r) => r.step.length), 12);
console.log("STEP".padEnd(w) + " | " + ["nearbite_cart", "es_image_dict", "checkout keys", "bar mode", "bar visible", "bar text"].map((s) => s.padEnd(13)).join(" | ") + " | RESULT");
console.log("-".repeat(w + 2 + 6 * 16 + 8));
for (const r of rows) {
  const cells = r.checks.map(([, v]) => (v ? "PASS" : "FAIL").padEnd(13)).join(" | ");
  console.log(r.step.padEnd(w) + " | " + cells + " | " + (r.ok ? "PASS" : "FAIL"));
}

console.log("\nCart-bar text / display per step (legacy -> new):");
for (const r of rows) console.log("  " + r.step.padEnd(w) + "  " + JSON.stringify(r.legacyText) + " -> " + JSON.stringify(r.newText) + "   display " + r.legacyDisplay + " -> " + r.newDisplay);

console.log("\nFinal cart bodies (normalised) — legacy vs new:");
const last = rows[rows.length - 1];
console.log("  legacy:", JSON.stringify(last.legacyCart));
console.log("  new   :", JSON.stringify(last.newCart));

// Show one full intermediate cart so the payload shape is visible.
const customStep = rows.find((r) => r.step.startsWith("3."));
if (customStep) {
  console.log("\nCart after step 3 (customized line), legacy:");
  console.log("  " + JSON.stringify(customStep.legacyCart));
  console.log("Cart after step 3, new:");
  console.log("  " + JSON.stringify(customStep.newCart));
}

if (notes.length) {
  console.log("\nExcluded / normalised (reported, not silently ignored):");
  for (const note of [...new Set(notes)]) console.log("  * " + note);
}

if (legacy.pageErrors.length || next.pageErrors.length) {
  console.log("\npageerrors: legacy", legacy.pageErrors, "new", next.pageErrors);
}

console.log("\n" + (failures === 0 ? "CART PARITY: PASS (" + rows.length + " steps, all checks equal)" : "CART PARITY: FAIL (" + failures + "/" + rows.length + " steps differ)"));
process.exit(failures === 0 ? 0 : 1);
