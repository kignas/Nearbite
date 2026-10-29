// Phase 2f chunk 11 — side-by-side parity harness for the CUSTOMIZATION SHEET.
//
// Runs the LEGACY page and the NEW page with the SAME answered fixture (a menu
// containing a customizable item with a required group, a maxSelect>1 group and
// a pricingMode:'portion' group), drives the same user actions, and compares the
// result byte-for-byte:
//
//   A. open the sheet from the menu ADD button (innerHTML + pixel diff)
//   B. required-group gating, maxSelect disabling, portion pricing (labels/total)
//   C. cart write — pick options, qty 3, Add → nearbite_cart + pink bar; then the
//      menu-card minus; then a second variant (two cart lines)
//   D. close paths — backdrop tap; and (documented) NO popstate/Escape handler
//   E. the dish sheet ADD on a customizable dish opens the customize sheet
//   F. money states folded into section C
//
// Usage: node scripts/shell-chunk11-parity.mjs [legacyUrl] [newUrl]
// Writes compare-out/shell-chunk11-parity.txt + compare-out/ewcs-*.png,
// compare-out/ewcs-diff-*.png and exits non-zero on any FAIL.
import { chromium } from "playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import fs from "node:fs";

const LEGACY = process.argv[2] || "http://localhost:8080/restaurant-shell.html";
const NEW = process.argv[3] || "http://localhost:3000/restaurant-shell";
const ID = "6ac8f95828669b5f4e30f0ba";
const CUST_ID = "6acec0a1d2398604a0927f01";

const fx = JSON.parse(fs.readFileSync("scripts/fixtures/restaurant-shell-customize.json", "utf8"));

const lines = [];
const log = (...a) => {
  lines.push(a.join(" "));
  console.log(...a);
};
fs.mkdirSync("compare-out", { recursive: true });

let failures = 0;
const rows = [];
function check(name, l, n) {
  const eq = JSON.stringify(l) === JSON.stringify(n);
  if (!eq) failures++;
  rows.push({ name, ok: eq });
  if (!eq) {
    log(`  FAIL ${name}`);
    log(`    legacy: ${JSON.stringify(l).slice(0, 900)}`);
    log(`    new   : ${JSON.stringify(n).slice(0, 900)}`);
  }
  return eq;
}

/* ── pixel diff of the sheet (whole-page clip of the open sheet) ──────── */
function diffPng(a, b, label) {
  if (!a || !b) return { ok: false, pct: 100, reason: "missing screenshot" };
  const A = PNG.sync.read(a);
  const B = PNG.sync.read(b);
  if (A.width !== B.width || A.height !== B.height)
    return { ok: false, pct: 100, reason: `size ${A.width}x${A.height} vs ${B.width}x${B.height}` };
  const out = new PNG({ width: A.width, height: A.height });
  const n = pixelmatch(A.data, B.data, out.data, A.width, A.height, { threshold: 0.1 });
  const pct = (n / (A.width * A.height)) * 100;
  fs.writeFileSync(`compare-out/ewcs-${label}-legacy.png`, a);
  fs.writeFileSync(`compare-out/ewcs-${label}-new.png`, b);
  fs.writeFileSync(`compare-out/ewcs-diff-${label}.png`, PNG.sync.write(out));
  return { ok: pct < 1, pct, reason: "" };
}

async function openSide(browser, url, viewport) {
  const ctx = await browser.newContext({ viewport, reducedMotion: "reduce", deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e).split("\n")[0]));
  await page.addInitScript(() => {
    window.__EW_SHELL_TEST_HOOKS = true;
    try {
      localStorage.removeItem("nearbite_cart");
    } catch (e) {}
  });
  await page.route("https://api.eatswada.com/**", (route) => {
    const u = new URL(route.request().url());
    const p = u.pathname.replace(/^\/api/, "");
    const body = fx[p + u.search] !== undefined ? fx[p + u.search] : fx[p];
    if (body === undefined)
      return route.fulfill({ status: 404, headers: { "access-control-allow-origin": "*" }, body: "{}" });
    return route.fulfill({
      status: 200,
      headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  });
  await page.goto(`${url}?id=${ID}`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(2200);
  /* Wait for the chunk-9 sticky bar to settle so `body.className` is stable
     before we compare it (it is a scroll-driven class owned by chunk 9, not by
     the customize sheet). */
  try {
    await page.waitForFunction(
      () => document.body.classList.contains("ew-tsb-on") || !!document.getElementById("ew-sticky-search"),
      { timeout: 6000 }
    );
  } catch (e) {}
  await page.waitForTimeout(400);
  return { ctx, page, errs };
}

const normaliseCart = (raw) => {
  if (raw == null) return null;
  let obj = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  const out = {};
  for (const key of Object.keys(obj)) {
    let normKey = key;
    /* Owner decision 1: payload keys are deterministic composites and are
       compared EXACTLY — no Date.now() normalisation. */
    out[normKey] = obj[key];
  }
  return out;
};

const moneyOn = (page) =>
  page.evaluate(() => {
    const root = document.getElementById("white-cart-root");
    const countEl = document.getElementById("wc-item-count");
    return {
      cart: localStorage.getItem("nearbite_cart"),
      bar: {
        count: countEl ? countEl.textContent : null,
        text: (root ? root.textContent : "").replace(/\s+/g, ""),
      },
    };
  });

/* full sheet state: innerHTML + every observable the gating depends on */
const sheetOn = (page) =>
  page.evaluate(() => {
    const sheet = document.getElementById("ewcs-sheet");
    const groups = Array.from(document.querySelectorAll(".ewcs-group"));
    return {
      sheet: !!sheet,
      html: sheet ? sheet.innerHTML : null,
      bodyCls: document.body.className,
      title: (document.getElementById("ewcs-title") || {}).textContent,
      qty: (document.getElementById("ewcs-qty") || {}).textContent,
      addDisabled: (document.getElementById("ewcs-add") || {}).disabled,
      addText: (document.getElementById("ewcs-add") || {}).textContent,
      cartRootDisplay: (document.getElementById("white-cart-root") || { style: {} }).style.display,
      groups: groups.map((g) => ({
        title: g.getAttribute("data-title"),
        max: g.getAttribute("data-max"),
        required: g.getAttribute("data-required"),
        multi: g.getAttribute("data-multi"),
        pricingMode: g.getAttribute("data-pricing-mode"),
        rule: (g.querySelector(".ewcs-grule") || {}).textContent,
        opts: Array.from(g.querySelectorAll(".ewcs-opt")).map((o) => ({
          lbl: (o.querySelector(".lbl") || {}).textContent,
          pr: o.querySelector(".pr") ? o.querySelector(".pr").textContent : null,
          prFree: o.querySelector(".pr") ? o.querySelector(".pr").className : null,
          type: (o.querySelector("input") || {}).type,
          checked: (o.querySelector("input") || {}).checked,
          disabled: (o.querySelector("input") || {}).disabled,
          extra: (o.querySelector("input") || {}).getAttribute("data-extra"),
        })),
      })),
    };
  });

/* click the input inside the Nth option of the Nth group (by value) */
const pick = (page, gi, val) =>
  page.evaluate(
    ({ gi, val }) => {
      const grp = document.querySelectorAll(".ewcs-group")[gi];
      const input = grp.querySelector(`input[value="${val}"]`);
      input.click();
    },
    { gi, val }
  );

const qtyStep = (page, id, times) =>
  page.evaluate(
    ({ id, times }) => {
      for (let i = 0; i < times; i++) document.getElementById(id).click();
    },
    { id, times }
  );

async function openSheet(page) {
  await page.evaluate((cid) => {
    document.querySelector(`.nb-add-btn--cust[data-menu-item-id="${cid}"]`).click();
  }, CUST_ID);
  await page.waitForTimeout(450);
}

/* ══════════════════════════════════════════════════════════════════════ */
const browser = await chromium.launch();

for (const [label, viewport] of [
  ["phone", { width: 390, height: 844 }],
  ["desktop", { width: 1280, height: 800 }],
]) {
  log(`\n═══ ${label} ${viewport.width}x${viewport.height} ═══`);
  const L = await openSide(browser, LEGACY, viewport);
  const N = await openSide(browser, NEW, viewport);

  /* ── A. open the sheet ─────────────────────────────────────────────── */
  await openSheet(L.page);
  await openSheet(N.page);
  const lA = await sheetOn(L.page);
  const nA = await sheetOn(N.page);
  check(`A ${label}: sheet innerHTML`, lA.html, nA.html);
  check(`A ${label}: body class + cart-root hidden`, [lA.bodyCls, lA.cartRootDisplay], [nA.bodyCls, nA.cartRootDisplay]);
  check(`A ${label}: title + qty + add state`, [lA.title, lA.qty, lA.addDisabled, lA.addText], [nA.title, nA.qty, nA.addDisabled, nA.addText]);
  check(`A ${label}: group metadata (max/required/multi/pricingMode/rule)`, lA.groups.map((g) => [g.title, g.max, g.required, g.multi, g.pricingMode, g.rule]), nA.groups.map((g) => [g.title, g.max, g.required, g.multi, g.pricingMode, g.rule]));
  check(`A ${label}: option rows (lbl/pr/type/checked/disabled/extra)`, lA.groups.map((g) => g.opts), nA.groups.map((g) => g.opts));

  const shotA = async (p) => {
    const el = await p.$("#ewcs-sheet");
    return el ? el.screenshot() : null;
  };
  const dA = diffPng(await shotA(L.page), await shotA(N.page), `A-${label}`);
  check(`A ${label}: sheet pixel diff < 1% (${dA.pct.toFixed(3)}% ${dA.reason})`, true, dA.ok);

  /* ── B. required-group gating + maxSelect + portion ────────────────── */
  // The sheet opens with the FIRST option of the required single-select "Pick a
  // dip" group checked, but the required multi group "Choose add-ons" (max 3)
  // and the required portion group "Portion" are empty → Add disabled.
  const gating = async (p) => {
    const snap = async (name) => {
      const s = await sheetOn(p);
      return { name, disabled: s.addDisabled, text: s.addText, qty: s.qty };
    };
    const out = [];
    out.push(await snap("initial"));
    // check a maxSelect option in group 0 (multi, max 3)
    await pick(p, 0, "0");
    out.push(await snap("g0 pick Cheese"));
    await pick(p, 0, "1"); // Chicken Bits (non-veg)
    out.push(await snap("g0 pick Chicken Bits"));
    await pick(p, 0, "2"); // Olives
    out.push(await snap("g0 pick Olives (3/3)"));
    // group 0 is now full: unchecked boxes must be disabled
    const fullState = await p.evaluate(() => {
      const grp = document.querySelectorAll(".ewcs-group")[0];
      return Array.from(grp.querySelectorAll("input[type=checkbox]")).map((c) => ({ v: c.value, checked: c.checked, disabled: c.disabled }));
    });
    // required portion group still empty → Add disabled
    // pick the portion option "Half" (value 0 of group 2)
    await pick(p, 2, "0");
    out.push(await snap("g2 portion Half"));
    // portion group with 2 checked would be invalid — check both
    await pick(p, 2, "1");
    const portionBoth = await p.evaluate(() => {
      const grp = document.querySelectorAll(".ewcs-group")[2];
      return Array.from(grp.querySelectorAll("input")).map((c) => ({ v: c.value, checked: c.checked }));
    });
    out.push(await snap("g2 portion Full selected (radio switch)"));
    // Group 2 is a single-select group, so its inputs are radios: the two
    // clicks above just switch the selection Half -> Full (never two checked).
    // Reset it explicitly to Half for section C's deterministic math:
    await p.evaluate(() => {
      const grp = document.querySelectorAll(".ewcs-group")[2];
      grp.querySelector('input[value="0"]').click();
    });
    out.push(await snap("g2 portion Half re-selected"));
    /* The "portion forbids multi-select" guard: a portion group with maxSelect>1
       renders CHECKBOXES, so two can be checked — which must make the group
       invalid and disable Add (even with every required group satisfied). */
    await pick(p, 3, "0"); // Regular (portion)
    await pick(p, 3, "1"); // Large (portion)
    out.push(await snap("g3 portion multi 2 checked (invalid)"));
    const g3State = await p.evaluate(() => {
      const grp = document.querySelectorAll(".ewcs-group")[3];
      return Array.from(grp.querySelectorAll("input")).map((c) => ({ v: c.value, type: c.type, checked: c.checked, disabled: c.disabled }));
    });
    // restore group 3 to empty so section C's math is deterministic
    await pick(p, 3, "1");
    await pick(p, 3, "0");
    out.push(await snap("g3 restored empty"));
    return { out, fullState, portionBoth, g3State };
  };
  const lG = await gating(L.page);
  const nG = await gating(N.page);
  check(`B ${label}: gating sequence (disabled/label/qty at each step)`, lG.out, nG.out);
  check(`B ${label}: maxSelect 3/3 disables the unchecked boxes`, lG.fullState, nG.fullState);
  check(`B ${label}: portion single-select group uses radios (never 2 checked)`, lG.portionBoth, nG.portionBoth);
  check(`B ${label}: portion maxSelect>1 group = checkboxes, 2 checked disables Add`, lG.g3State, nG.g3State);
  log(`  B ${label} legacy seq: ${JSON.stringify(lG.out)}`);
  log(`  B ${label} new    seq: ${JSON.stringify(nG.out)}`);
  /* Pin the expected values too (not just legacy==new), so a shared regression
     cannot pass silently. */
  const expected = [
    ["initial", true],
    ["g0 pick Cheese", false],
    ["g0 pick Chicken Bits", false],
    ["g0 pick Olives (3/3)", false],
    ["g2 portion Half", false],
    ["g2 portion Full selected (radio switch)", false], // group 2 is radios: clicking Full just switches it
    ["g2 portion Half re-selected", false],
    ["g3 portion multi 2 checked (invalid)", true],
    ["g3 restored empty", false],
  ];
  check(
    `B ${label}: Add-disabled follows the expected gating`,
    expected.map(([n]) => nG.out.find((o) => o.name === n).disabled),
    expected.map(([, d]) => d)
  );

  /* ── C. cart write — qty 3, Add, then minus, then a second variant ─── */
  // Now: group0 = Cheese+Chicken Bits+Olives (extra 20+45+15=80), group2 = Half (portion 100)
  //       group1 (Pick a dip) still has "Ketchup" checked (default first option, extra 0)
  //       group3 (Combo size, portion multi max2) empty
  // unit = portionPrice(100) + 80 = 180
  await qtyStep(L.page, "ewcs-plus", 2);
  await qtyStep(N.page, "ewcs-plus", 2);
  check(`C ${label}: qty after ++ (3)`, (await sheetOn(L.page)).qty, (await sheetOn(N.page)).qty);
  check(`C ${label}: add label with qty 3`, (await sheetOn(L.page)).addText, (await sheetOn(N.page)).addText);
  await L.page.evaluate(() => document.getElementById("ewcs-add").click());
  await N.page.evaluate(() => document.getElementById("ewcs-add").click());
  await L.page.waitForTimeout(500);
  await N.page.waitForTimeout(500);
  const lC1 = await moneyOn(L.page);
  const nC1 = await moneyOn(N.page);
  check(`C ${label}: after Add — nearbite_cart`, normaliseCart(lC1.cart), normaliseCart(nC1.cart));
  check(`C ${label}: after Add — pink bar text`, lC1.bar.text, nC1.bar.text);
  check(`C ${label}: after Add — pink bar count`, lC1.bar.count, nC1.bar.count);
  log(`  C ${label} after Add: bar ${JSON.stringify(nC1.bar)}`);
  log(`  C ${label} cart: ${nC1.cart}`);

  // menu card now shows the customized control; press − on it
  const minusCard = (p) => p.evaluate((cid) => {
    const row = document.querySelector(`.menu-item[data-menu-item-id="${cid}"]`);
    const btn = row.querySelector(".nb-custom-remove");
    btn.click();
  }, CUST_ID);
  await minusCard(L.page);
  await minusCard(N.page);
  await L.page.waitForTimeout(400);
  await N.page.waitForTimeout(400);
  const lC2 = await moneyOn(L.page);
  const nC2 = await moneyOn(N.page);
  check(`C ${label}: after menu-card − — nearbite_cart`, normaliseCart(lC2.cart), normaliseCart(nC2.cart));
  check(`C ${label}: after menu-card − — pink bar text`, lC2.bar.text, nC2.bar.text);
  check(`C ${label}: after menu-card − — pink bar count`, lC2.bar.count, nC2.bar.count);

  // second variant with different options → a SECOND cart line
  await openSheet(L.page);
  await openSheet(N.page);
  await pick(L.page, 0, "3"); // Extra Sauce (free) — group0 required satisfied
  await pick(N.page, 0, "3");
  await pick(L.page, 2, "1"); // Full (portion 180)
  await pick(N.page, 2, "1");
  await L.page.evaluate(() => document.getElementById("ewcs-add").click());
  await N.page.evaluate(() => document.getElementById("ewcs-add").click());
  await L.page.waitForTimeout(500);
  await N.page.waitForTimeout(500);
  const lC3 = await moneyOn(L.page);
  const nC3 = await moneyOn(N.page);
  const lc3 = normaliseCart(lC3.cart);
  const nc3 = normaliseCart(nC3.cart);
  check(`C ${label}: two cart lines — nearbite_cart`, lc3, nc3);
  check(`C ${label}: two cart lines — line count`, Object.keys(lc3 || {}).length, Object.keys(nc3 || {}).length);
  check(`C ${label}: two cart lines — pink bar text`, lC3.bar.text, nC3.bar.text);
  log(`  C ${label} two lines: ${nC3.cart}`);

  /* ── D. close paths ────────────────────────────────────────────────── */
  // backdrop tap
  await openSheet(L.page);
  await openSheet(N.page);
  await L.page.evaluate(() => document.getElementById("ewcs-backdrop").click());
  await N.page.evaluate(() => document.getElementById("ewcs-backdrop").click());
  await L.page.waitForTimeout(300);
  await N.page.waitForTimeout(300);
  const lD = await L.page.evaluate(() => ({
    sheetShown: document.getElementById("ewcs-sheet").classList.contains("show"),
    bdShown: document.getElementById("ewcs-backdrop").classList.contains("show"),
    bodyCls: document.body.className,
  }));
  const nD = await N.page.evaluate(() => ({
    sheetShown: document.getElementById("ewcs-sheet").classList.contains("show"),
    bdShown: document.getElementById("ewcs-backdrop").classList.contains("show"),
    bodyCls: document.body.className,
  }));
  check(`D ${label}: backdrop tap closes (show classes + body)`, lD, nD);

  // history.length must be unchanged by opening/closing the sheet (no popstate push)
  await openSheet(L.page);
  await openSheet(N.page);
  const histOpen = [
    await L.page.evaluate(() => history.length),
    await N.page.evaluate(() => history.length),
  ];
  check(`D ${label}: opening the sheet does NOT push history`, histOpen[0], histOpen[1]);

  // Escape while the sheet is open must NOT close it (legacy registers no keydown handler)
  await L.page.keyboard.press("Escape");
  await N.page.keyboard.press("Escape");
  await L.page.waitForTimeout(300);
  await N.page.waitForTimeout(300);
  const lEsc = await L.page.evaluate(() => document.getElementById("ewcs-sheet").classList.contains("show"));
  const nEsc = await N.page.evaluate(() => document.getElementById("ewcs-sheet").classList.contains("show"));
  check(`D ${label}: Escape does NOT close the sheet (quirk)`, lEsc, nEsc);
  check(`D ${label}: Escape leaves it open on both`, lEsc, true);

  /* ── E. dish sheet → customize sheet ───────────────────────────────── */
  // Close any open sheet, then open the dish sheet on the customizable item and
  // click its CTA. The dish sheet must step aside and the customize sheet open.
  await L.page.evaluate(() => { const s = document.getElementById("ewcs-sheet"); if (s) document.getElementById("ewcs-backdrop").click(); });
  await N.page.evaluate(() => { const s = document.getElementById("ewcs-sheet"); if (s) document.getElementById("ewcs-backdrop").click(); });
  await L.page.waitForTimeout(300);
  await N.page.waitForTimeout(300);
  const openDish = (p) =>
    p.evaluate((cid) => {
      const row = document.querySelector(`.menu-item[data-menu-item-id="${cid}"]`);
      (row.querySelector(".nb-item-title") || row).click();
    }, CUST_ID);
  await openDish(L.page);
  await openDish(N.page);
  await L.page.waitForTimeout(600);
  await N.page.waitForTimeout(600);
  const lE0 = await L.page.evaluate(() => ({ open: document.body.classList.contains("ew-dish-open"), cta: !!document.querySelector("#ds-root .ds-cta .nb-add-btn--cust") }));
  const nE0 = await N.page.evaluate(() => ({ open: document.body.classList.contains("ew-dish-open"), cta: !!document.querySelector("#ds-root .ds-cta .nb-add-btn--cust") }));
  check(`E ${label}: dish sheet open with custom CTA`, lE0, nE0);
  await L.page.evaluate(() => document.querySelector("#ds-root .ds-cta .nb-add-btn--cust").click());
  await N.page.evaluate(() => document.querySelector("#ds-root .ds-cta .nb-add-btn--cust").click());
  await L.page.waitForTimeout(700);
  await N.page.waitForTimeout(700);
  const lE1 = await L.page.evaluate(() => ({
    dishOpen: document.body.classList.contains("ew-dish-open"),
    custSheet: !!document.getElementById("ewcs-sheet"),
    custTitle: (document.getElementById("ewcs-title") || {}).textContent,
  }));
  const nE1 = await N.page.evaluate(() => ({
    dishOpen: document.body.classList.contains("ew-dish-open"),
    custSheet: !!document.getElementById("ewcs-sheet"),
    custTitle: (document.getElementById("ewcs-title") || {}).textContent,
  }));
  check(`E ${label}: dish ADD opens the customize sheet (dish steps aside)`, lE1, nE1);

  /* ── errors ────────────────────────────────────────────────────────── */
  check(`* ${label}: no page errors`, L.errs, N.errs);
  log(`  errors: legacy ${JSON.stringify(L.errs)} new ${JSON.stringify(N.errs)}`);

  await L.ctx.close();
  await N.ctx.close();
}

await browser.close();

log("");
log(`CHUNK 11 PARITY: ${failures === 0 ? "PASS" : "FAIL"} (${rows.length} checks)`);
fs.writeFileSync("compare-out/shell-chunk11-parity.txt", lines.join("\n"));
process.exit(failures === 0 ? 0 : 1);
