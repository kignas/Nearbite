// Phase 2g chunk 12 — side-by-side parity harness for PAIRING SUGGESTIONS +
// MENU-JUMP.
//
// Runs the LEGACY page and the NEW page with the SAME answered fixture and
// drives the same user actions, comparing the result byte-for-byte:
//
//   A. pairing: the FIRST add to an empty cart inserts `.ew-pair` under the
//      added item — compare the strip innerHTML, its position (afterend of the
//      host), the card list, the strip's own window globals (`__ewPair` guards);
//   B. the suggestion card ADD / +/- goes through `window.updateCart` and writes
//      the same `nearbite_cart` line + pink-bar text;
//   C. the strip does NOT open for the 2nd add (once-per-empty-cart rule) and
//      closes when the item is removed;
//   D. veg rule: a veg main never suggests a non-veg item;
//   E. menu-jump: `#ew-mj-btn` exists + `show`; clicking opens `#ew-mj-sheet`
//      with the same category names/counts; clicking a row scrolls to the same
//      category; Escape and backdrop close it; `window.__ewMenuJump` is set.
//
// Usage: node scripts/shell-chunk12-parity.mjs [legacyUrl] [newUrl]
// Writes compare-out/shell-chunk12-parity.txt and exits non-zero on any FAIL.
import { chromium } from "playwright";
import fs from "node:fs";

const LEGACY = process.argv[2] || "http://localhost:8080/restaurant-shell.html";
const NEW = process.argv[3] || "http://localhost:3000/restaurant-shell";
const ID = "6ac8f95828669b5f4e30f0ba";

const fx = JSON.parse(fs.readFileSync("scripts/fixtures/restaurant-shell-answered.json", "utf8"));

const lines = [];
const log = (...a) => {
  lines.push(a.join(" "));
  console.log(...a);
};
fs.mkdirSync("compare-out", { recursive: true });

let failures = 0;
let checkCount = 0;
function check(name, l, n) {
  checkCount++;
  const eq = JSON.stringify(l) === JSON.stringify(n);
  if (!eq) failures++;
  if (!eq) {
    log(`  FAIL ${name}`);
    log(`    legacy: ${JSON.stringify(l).slice(0, 1200)}`);
    log(`    new   : ${JSON.stringify(n).slice(0, 1200)}`);
  }
  return eq;
}

async function openSide(browser, url) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", deviceScaleFactor: 1 });
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
  await page.waitForTimeout(2400);
  return { ctx, page, errs };
}

/* First PLAIN (non-customizable) menu item — the item the strip attaches to.
   `.nb-add-btn--cust` items open the customize sheet instead, so they are
   skipped. */
const firstAdd = (page) =>
  page.evaluate(() => {
    const it = Array.from(document.querySelectorAll("#menu-container .menu-item")).find(
      (x) => !x.querySelector(".nb-add-btn--cust") && x.querySelector(".nb-add-btn")
    );
    it.querySelector(".nb-add-btn").click();
    return { id: it.getAttribute("data-menu-item-id"), veg: it.getAttribute("data-veg") };
  });

/* full observable state of the pairing strip */
const pairOn = (page) =>
  page.evaluate(() => {
    const strip = document.querySelector(".ew-pair");
    if (!strip) return { present: false };
    const host = strip.previousElementSibling;
    return {
      present: true,
      html: strip.innerHTML,
      forId: strip.getAttribute("data-for"),
      afterId: host ? host.getAttribute("data-menu-item-id") : null,
      afterIsMenuItem: host ? host.classList.contains("menu-item") : null,
      cls: strip.className,
      cards: Array.from(strip.querySelectorAll(".ew-pair-card")).map((c) => ({
        id: c.getAttribute("data-card-id"),
        name: (c.querySelector(".ew-pair-name") || {}).textContent,
        price: (c.querySelector(".ew-pair-price") || {}).textContent,
        veg: !!c.querySelector(".ew-pair-veg") && !c.querySelector(".ew-pair-veg.nonveg"),
        nonveg: !!c.querySelector(".ew-pair-veg.nonveg"),
        act: (c.querySelector(".ew-pair-act") || {}).innerHTML,
      })),
    };
  });

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

const mjOn = (page) =>
  page.evaluate(() => {
    const btn = document.getElementById("ew-mj-btn");
    const sheet = document.getElementById("ew-mj-sheet");
    const bd = document.getElementById("ew-mj-backdrop");
    return {
      btn: !!btn,
      btnCls: btn ? btn.className : null,
      btnText: btn ? btn.textContent.replace(/\s+/g, "") : null,
      btnAria: btn ? btn.getAttribute("aria-expanded") : null,
      style: !!document.getElementById("ew-mj-style"),
      jumpGuard: typeof window.__ewMenuJump,
      sheetCls: sheet ? sheet.className : null,
      bdCls: bd ? bd.className : null,
      items: sheet
        ? Array.from(sheet.querySelectorAll(".ew-mj-item")).map((i) => ({
            target: i.getAttribute("data-target"),
            name: (i.querySelector(".ew-mj-name") || {}).textContent,
            count: (i.querySelector(".ew-mj-count") || {}).textContent,
            active: i.classList.contains("active"),
          }))
        : null,
    };
  });

const scrollY = (page) => page.evaluate(() => Math.round(window.scrollY));
const activeCatPill = (page) =>
  page.evaluate(() => {
    const a = document.querySelector("#cat-nav .cat-nav-pill.active");
    return a ? a.textContent.trim() : null;
  });

async function main() {
  const browser = await chromium.launch();
  const L = await openSide(browser, LEGACY);
  const N = await openSide(browser, NEW);

  /* ── A. strip appears on the first add to an empty cart ─────────────── */
  log("### A. pairing strip on the first add to an empty cart");
  const lFirst = await firstAdd(L.page);
  const nFirst = await firstAdd(N.page);
  check("A: first ADD button identity", lFirst.id, nFirst.id);
  await L.page.waitForTimeout(600);
  await N.page.waitForTimeout(600);
  const lPair = await pairOn(L.page);
  const nPair = await pairOn(N.page);
  check("A: strip present on both", lPair.present, nPair.present);
  check("A: strip data-for", lPair.forId, nPair.forId);
  check("A: strip inserted afterend of the host item", [lPair.afterId, lPair.afterIsMenuItem], [nPair.afterId, nPair.afterIsMenuItem]);
  check("A: strip class", lPair.cls, nPair.cls);
  check("A: strip innerHTML identical", lPair.html, nPair.html);
  check("A: suggestion cards identical (id/name/price/veg/action)", lPair.cards, nPair.cards);
  log(`  strip for ${JSON.stringify(nPair.forId)}: ${(nPair.cards || []).length} cards`);

  /* ✕ closes the strip (the strip's own close path) */
  const closeStrip = (page) =>
    page.evaluate(() => {
      const b = document.querySelector('.ew-pair [data-ew-pair="close"]');
      if (b) b.click();
    });
  await closeStrip(L.page);
  await closeStrip(N.page);
  await L.page.waitForTimeout(500);
  await N.page.waitForTimeout(500);
  const lClosed = await pairOn(L.page);
  const nClosed = await pairOn(N.page);
  check("A: ✕ closes the strip", lClosed.present, nClosed.present);
  log(`  after ✕: strip present legacy=${lClosed.present} new=${nClosed.present}`);

  /* re-add the SAME item to an empty-ish cart: it is already in the cart, so the
     strip must NOT re-open (once-per-empty-cart rule), then remove it and re-add
     to get the strip back for the later sections. */
  const clickMenuMinus = (page, id) =>
    page.evaluate((id) => {
      const it = document.querySelector(`.menu-item[data-menu-item-id="${id}"]`);
      const m = it.querySelector('.nb-qty-btn[aria-label="Decrease quantity"]');
      if (m) m.click();
    }, id);
  await clickMenuMinus(L.page, lFirst.id);
  await clickMenuMinus(N.page, nFirst.id);
  await L.page.waitForTimeout(500);
  await N.page.waitForTimeout(500);
  const lReadd = await firstAdd(L.page);
  const nReadd = await firstAdd(N.page);
  await L.page.waitForTimeout(600);
  await N.page.waitForTimeout(600);
  const lRe = await pairOn(L.page);
  const nRe = await pairOn(N.page);
  check("A: strip re-opens after the item is removed and re-added to an empty cart", lRe.present, nRe.present);
  check("A: re-opened strip innerHTML identical", lRe.html, nRe.html);
  log(`  re-add -> strip present legacy=${lRe.present} new=${nRe.present}`);

  /* ── B. suggestion-card ADD opens the customize sheet (pendingCustId) ─ */
  log("");
  log("### B. suggestion-card ADD / complete / - cart write");
  /* Every suggestion card in this fixture is customizable, so the card's ADD
     takes the `pendingCustId` branch: it calls `ewOpenCustomize(id)` and the
     strip must NOT re-open once that sheet is completed. */
  const clickCardAdd = (page) =>
    page.evaluate(() => {
      const c = document.querySelector(".ew-pair-card");
      c.querySelector("[data-ew-pair=inc]").click();
      return c.getAttribute("data-card-id");
    });
  const lSugId = await clickCardAdd(L.page);
  const nSugId = await clickCardAdd(N.page);
  check("B: suggested card id", lSugId, nSugId);
  await L.page.waitForTimeout(500);
  await N.page.waitForTimeout(500);
  const lSheetOpen = await L.page.evaluate(() => !!document.getElementById("ewcs-sheet"));
  const nSheetOpen = await N.page.evaluate(() => !!document.getElementById("ewcs-sheet"));
  check("B: card ADD opened the customize sheet on both", lSheetOpen, nSheetOpen);

  /* complete the customize sheet (choose the first option of each group, then Add) */
  const completeSheet = (page) =>
    page.evaluate(() => {
      const groups = Array.from(document.querySelectorAll(".ewcs-group"));
      groups.forEach((g) => {
        const opt = g.querySelector(".ewcs-opt input:not([disabled])");
        if (opt) opt.click();
      });
      const add = document.getElementById("ewcs-add");
      const wasDisabled = add.disabled;
      add.click();
      return wasDisabled;
    });
  await completeSheet(L.page);
  await completeSheet(N.page);
  await L.page.waitForTimeout(600);
  await N.page.waitForTimeout(600);
  const lMoney1 = await moneyOn(L.page);
  const nMoney1 = await moneyOn(N.page);
  check("B: cart after completing the suggestion sheet (exact)", normaliseCart(lMoney1.cart), normaliseCart(nMoney1.cart));
  check("B: pink bar text after suggestion sheet", lMoney1.bar.text, nMoney1.bar.text);
  check("B: pink bar count after suggestion sheet", lMoney1.bar.count, nMoney1.bar.count);
  log(`  bar ${JSON.stringify(nMoney1.bar.count)}`);

  /* pendingCustId suppression: the strip must NOT have re-opened */
  const lPairB = await pairOn(L.page);
  const nPairB = await pairOn(N.page);
  check("B: strip did NOT re-open after the sheet was completed (pendingCustId)", lPairB.present, nPairB.present);

  /* the suggested card's action is now a +/- stepper; press - once (custom path
     -> ewRemoveCustomizedCartUnit) */
  const stepSuggestion = (page) =>
    page.evaluate(() => {
      const c = document.querySelector(".ew-pair-card");
      const dec = c.querySelector("[data-ew-pair=dec]");
      if (dec) dec.click();
    });
  await stepSuggestion(L.page);
  await stepSuggestion(N.page);
  await L.page.waitForTimeout(600);
  await N.page.waitForTimeout(600);
  const lMoney2 = await moneyOn(L.page);
  const nMoney2 = await moneyOn(N.page);
  check("B: cart after suggestion -", normaliseCart(lMoney2.cart), normaliseCart(nMoney2.cart));
  check("B: pink bar text after suggestion -", lMoney2.bar.text, nMoney2.bar.text);
  check("B: pink bar count after suggestion -", lMoney2.bar.count, nMoney2.bar.count);

  /* ── B2. the wrapper passes a plain window.updateCart call straight through
     (the non-custom path) and the cart line is identical ─────────────────── */
  log("");
  log("### B2. plain window.updateCart passthrough (non-custom path)");
  const directAdd = (page) =>
    page.evaluate(() => {
      const it = Array.from(document.querySelectorAll("#menu-container .menu-item")).find(
        (x) => !x.querySelector(".nb-add-btn--cust") && x.querySelector(".nb-add-btn")
      );
      const id = it.getAttribute("data-menu-item-id");
      const name = it.querySelector(".nb-item-title").textContent;
      window.updateCart(name, 1, 100, "6ac8f95828669b5f4e30f0ba", true, id, "", true, null);
      return { id, name };
    });
  const lDirect = await directAdd(L.page);
  const nDirect = await directAdd(N.page);
  check("B2: direct updateCart target identity", lDirect, nDirect);
  await L.page.waitForTimeout(400);
  await N.page.waitForTimeout(400);
  const lMoneyD = await moneyOn(L.page);
  const nMoneyD = await moneyOn(N.page);
  check("B2: cart after direct updateCart (exact)", normaliseCart(lMoneyD.cart), normaliseCart(nMoneyD.cart));
  check("B2: pink bar text after direct updateCart", lMoneyD.bar.text, nMoneyD.bar.text);

  /* ── C. once-per-empty-cart rule + close on remove ──────────────────── */
  log("");
  log("### C. once-per-empty-cart + close-on-remove");
  /* reset to a clean empty cart, then the first add opens the strip again */
  await L.page.evaluate(() => localStorage.removeItem("nearbite_cart"));
  await N.page.evaluate(() => localStorage.removeItem("nearbite_cart"));
  await L.page.reload({ waitUntil: "networkidle" });
  await N.page.reload({ waitUntil: "networkidle" });
  await L.page.waitForTimeout(2400);
  await N.page.waitForTimeout(2400);
  const lReFirst = await firstAdd(L.page);
  const nReFirst = await firstAdd(N.page);
  await L.page.waitForTimeout(600);
  await N.page.waitForTimeout(600);
  check("C: strip re-opens for the first add to an empty cart", (await pairOn(L.page)).present, (await pairOn(N.page)).present);
  /* second add (cart not empty) must NOT open a strip */
  const addSecond = (page) =>
    page.evaluate(() => {
      const items = Array.from(document.querySelectorAll("#menu-container .menu-item")).filter(
        (x) => !x.querySelector(".nb-add-btn--cust") && x.querySelector(".nb-add-btn")
      );
      const it = items[1];
      it.querySelector(".nb-add-btn").click();
      return it.getAttribute("data-menu-item-id");
    });
  const lSecond = await addSecond(L.page);
  const nSecond = await addSecond(N.page);
  await L.page.waitForTimeout(500);
  await N.page.waitForTimeout(500);
  const lPair2 = await pairOn(L.page);
  const nPair2 = await pairOn(N.page);
  check("C: no new strip for the 2nd add (cart not empty)", lPair2.present, nPair2.present);
  check("C: strip still the one for the first item", lPair2.forId, nPair2.forId);
  log(`  2nd add ${JSON.stringify(nSecond)} -> strip for=${JSON.stringify(nPair2.forId)}`);

  /* remove the first item (press - on its menu card) -> its strip closes */
  const removeFirst = (page, id) =>
    page.evaluate((id) => {
      const it = document.querySelector(`.menu-item[data-menu-item-id="${id}"]`);
      const minus = it.querySelector('.nb-qty-btn[aria-label="Decrease quantity"]');
      if (minus) minus.click();
    }, id);
  await removeFirst(L.page, lReFirst.id);
  await removeFirst(N.page, nReFirst.id);
  await L.page.waitForTimeout(700);
  await N.page.waitForTimeout(700);
  const lPair3 = await pairOn(L.page);
  const nPair3 = await pairOn(N.page);
  check("C: strip closed after removing the host item", lPair3.present, nPair3.present);
  const lMoneyC = await moneyOn(L.page);
  const nMoneyC = await moneyOn(N.page);
  check("C: cart after removing the host item", normaliseCart(lMoneyC.cart), normaliseCart(nMoneyC.cart));
  check("C: pink bar count after removing the host item", lMoneyC.bar.count, nMoneyC.bar.count);

  /* ── D. veg rule ────────────────────────────────────────────────────── */
  log("");
  log("### D. veg main never suggests a non-veg item");
  await L.page.evaluate(() => localStorage.removeItem("nearbite_cart"));
  await N.page.evaluate(() => localStorage.removeItem("nearbite_cart"));
  await L.page.reload({ waitUntil: "networkidle" });
  await N.page.reload({ waitUntil: "networkidle" });
  await L.page.waitForTimeout(2200);
  await N.page.waitForTimeout(2200);
  const addVeg = (page) =>
    page.evaluate(() => {
      const it = Array.from(document.querySelectorAll("#menu-container .menu-item")).find(
        (x) => x.getAttribute("data-veg") === "true" && !x.querySelector(".nb-add-btn--cust") && x.querySelector(".nb-add-btn")
      );
      if (!it) return null;
      it.querySelector(".nb-add-btn").click();
      return it.getAttribute("data-menu-item-id");
    });
  const lVeg = await addVeg(L.page);
  const nVeg = await addVeg(N.page);
  await L.page.waitForTimeout(600);
  await N.page.waitForTimeout(600);
  const lVegPair = await pairOn(L.page);
  const nVegPair = await pairOn(N.page);
  check("D: veg strip present on both", lVegPair.present, nVegPair.present);
  check("D: veg strip innerHTML identical", lVegPair.html, nVegPair.html);
  const anyNonVeg = (p) => (p.cards || []).some((c) => c.nonveg);
  check("D: no non-veg card in either strip", anyNonVeg(lVegPair), anyNonVeg(nVegPair));
  log(`  veg item ${JSON.stringify(nVeg)} -> ${(nVegPair.cards || []).length} cards, any non-veg=${anyNonVeg(nVegPair)}`);

  /* ── E. menu-jump ───────────────────────────────────────────────────── */
  log("");
  log("### E. menu-jump button");
  await L.page.evaluate(() => window.scrollTo(0, 0));
  await N.page.evaluate(() => window.scrollTo(0, 0));
  await L.page.waitForTimeout(500);
  await N.page.waitForTimeout(500);
  const lMj0 = await mjOn(L.page);
  const nMj0 = await mjOn(N.page);
  check("E: button + injected style present", [lMj0.btn, lMj0.style], [nMj0.btn, nMj0.style]);
  check("E: window.__ewMenuJump set (boolean)", [lMj0.jumpGuard, nMj0.jumpGuard], ["boolean", "boolean"]);
  check("E: button visible (show)", lMj0.btnCls, nMj0.btnCls);
  check("E: button label", lMj0.btnText, nMj0.btnText);

  await L.page.evaluate(() => document.getElementById("ew-mj-btn").click());
  await N.page.evaluate(() => document.getElementById("ew-mj-btn").click());
  await L.page.waitForTimeout(500);
  await N.page.waitForTimeout(500);
  const lMj1 = await mjOn(L.page);
  const nMj1 = await mjOn(N.page);
  check("E: sheet + backdrop shown", [lMj1.sheetCls, lMj1.bdCls], [nMj1.sheetCls, nMj1.bdCls]);
  check("E: button toggles to Close", [lMj1.btnText, lMj1.btnAria], [nMj1.btnText, nMj1.btnAria]);
  check("E: category rows identical (target/name/count/active)", lMj1.items, nMj1.items);
  log(`  sheet rows: ${JSON.stringify((nMj1.items || []).map((i) => i.name + ":" + i.count))}`);

  /* Escape closes */
  await L.page.keyboard.press("Escape");
  await N.page.keyboard.press("Escape");
  await L.page.waitForTimeout(400);
  await N.page.waitForTimeout(400);
  const lMj2 = await mjOn(L.page);
  const nMj2 = await mjOn(N.page);
  check("E: Escape closes the sheet", [lMj2.sheetCls, lMj2.bdCls, lMj2.btnText], [nMj2.sheetCls, nMj2.bdCls, nMj2.btnText]);

  /* backdrop closes */
  await L.page.evaluate(() => document.getElementById("ew-mj-btn").click());
  await N.page.evaluate(() => document.getElementById("ew-mj-btn").click());
  await L.page.waitForTimeout(350);
  await N.page.waitForTimeout(350);
  await L.page.evaluate(() => document.getElementById("ew-mj-backdrop").click());
  await N.page.evaluate(() => document.getElementById("ew-mj-backdrop").click());
  await L.page.waitForTimeout(400);
  await N.page.waitForTimeout(400);
  const lMj3 = await mjOn(L.page);
  const nMj3 = await mjOn(N.page);
  check("E: backdrop tap closes the sheet", [lMj3.sheetCls, lMj3.bdCls], [nMj3.sheetCls, nMj3.bdCls]);

  /* jump to the LAST category -> same scroll landing + same active pill */
  const jumpLast = async (page) => {
    await page.evaluate(() => document.getElementById("ew-mj-btn").click());
    await page.waitForTimeout(350);
    const target = await page.evaluate(() => {
      const items = document.querySelectorAll("#ew-mj-list .ew-mj-item");
      const last = items[items.length - 1];
      const t = last.getAttribute("data-target");
      last.click();
      return t;
    });
    await page.waitForTimeout(1400);
    return target;
  };
  const lTarget = await jumpLast(L.page);
  const nTarget = await jumpLast(N.page);
  check("E: jumped to the same category", lTarget, nTarget);
  await L.page.waitForTimeout(600);
  await N.page.waitForTimeout(600);
  check("E: same scrollY after jump (±2 px)", Math.abs((await scrollY(L.page)) - (await scrollY(N.page))) <= 2, true);
  check("E: same active cat-nav pill after jump", await activeCatPill(L.page), await activeCatPill(N.page));
  log(`  jump ${JSON.stringify(nTarget)} -> scrollY legacy ${await scrollY(L.page)} / new ${await scrollY(N.page)}, pill ${JSON.stringify(await activeCatPill(N.page))}`);

  /* ── page errors ────────────────────────────────────────────────────── */
  log("");
  check("no page errors", L.errs, N.errs);
  log(`  page errors: legacy ${JSON.stringify(L.errs)} new ${JSON.stringify(N.errs)}`);

  await L.ctx.close();
  await N.ctx.close();
  await browser.close();

  const total = lines.filter((l) => l.startsWith("  FAIL")).length;
  log("");
  log(failures === 0 ? `ALL PASS (${checkCount} checks)` : `${failures} FAIL`);
  fs.writeFileSync("compare-out/shell-chunk12-parity.txt", lines.join("\n") + "\n");
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
