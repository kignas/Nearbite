// Cart extras (C5) + complete-your-meal (C6) parity harness — Phase 2l.
//
// Usage: node scripts/cart-c5c6-parity.mjs [legacyUrl] [newUrl] [fixturesFile]
//   defaults: http://localhost:8080/cart.html  http://localhost:3000/cart
//             scripts/fixtures/cart-menu.json
//
// Both pages get the SAME localStorage seed and the SAME stubbed GET fixtures,
// then the harness drives the extras controls and the meal rail with real DOM
// events and deep-compares the resulting state + DOM + storage.
//
// Owner decision 1: cart keys are deterministic composites compared EXACTLY.
import { chromium } from "playwright";
import fs from "node:fs";

const [
  legacyUrl = "http://localhost:8080/cart.html",
  newUrl = "http://localhost:3000/cart",
  fixturesArg = "scripts/fixtures/cart-menu.json",
] = process.argv.slice(2);

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

const RID = "6ac8f95828669b5f4e30f0ba";
const CART_SEED = {
  "Masala Dosa": { name: "Masala Dosa", price: 80, originalPrice: 100, quantity: 2, resId: RID, restaurantName: "Foodie Dosa Restaurant", isVeg: true, image: "" },
};
const EXTRAS_SEED = { restaurantNote: "", restaurantNotes: {}, deliveryInstructions: "", tipAmount: 0 };

async function open(browser, url, seed, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript((entries) => {
    window.__EW_CART_TEST_HOOKS = true;
    try {
      for (const [k, v] of Object.entries(entries))
        window.localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
    } catch (e) {}
  }, seed);
  const page = await ctx.newPage();
  await installFixtures(page);
  /* A customisable meal card navigates to restaurant.html; abort that so the
     harness can compare the attempt without losing the execution context. */
  await page.route("**/restaurant.html*", (route) => route.abort());
  await page.goto(url, { waitUntil: opts.waitUntil || "networkidle", timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(opts.settle ?? 1500);
  return { ctx, page };
}

/* ── C5 probes ───────────────────────────────────────────────────────── */
const NOTE_SHEET_SNAP = (RID) => {
  window.openNoteSheet("restaurantNote:" + RID);
  return new Promise((resolve) =>
    setTimeout(() => {
      const t = (id) => {
        const el = document.getElementById(id);
        return el ? (el.textContent || "").trim() : null;
      };
      resolve({
        rootHidden: document.getElementById("ct-note-sheet")?.hidden ?? null,
        rootOpen: document.getElementById("ct-note-sheet")?.classList.contains("is-open") ?? null,
        bodySheetOpen: document.body.classList.contains("ct-sheet-open"),
        title: t("note-sheet-title"),
        fieldLabel: t("note-field-label"),
        help: t("note-help"),
        saveLabel: t("note-save"),
        removeLabel: t("note-remove"),
        removeHidden: document.getElementById("note-remove")?.hidden ?? null,
        inputValue: document.getElementById("note-input")?.value ?? null,
        inputMax: document.getElementById("note-input")?.getAttribute("maxlength") ?? null,
        count: t("note-count"),
        suggestionsHtml: document.getElementById("note-suggestions")?.innerHTML ?? null,
        bgAriaHidden: document.querySelector("#checkout-footer")?.getAttribute("aria-hidden") ?? null,
      });
    }, 350)
  );
};

const NOTE_SAVE_SNAP = (text) => {
  const input = document.getElementById("note-input");
  input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  const count = (document.getElementById("note-count") || {}).textContent;
  window.saveNoteSheet();
  return new Promise((resolve) =>
    setTimeout(() => {
      const st = (() => { try { if (typeof ctState !== "undefined") return ctState; } catch (e) {} return (window.__EW_CART_TEST_HOOKS && window.__ewCart && window.__ewCart.state) || null; })();
      resolve({
        count,
        stateNote: st ? st.restaurantNote : null,
        extras: localStorage.getItem("nearbite_cart_extras"),
        btnText: (document.querySelector(".ct-restaurant-note-btn .ct-note-btn-text") || {}).textContent ?? null,
        btnIsSet: document.querySelector(".ct-restaurant-note-btn")?.classList.contains("is-set") ?? null,
        preview: (document.querySelector(".ct-restaurant-note-preview") || {}).textContent ?? null,
        toastText: (document.getElementById("addr-toast-text") || {}).textContent ?? null,
        toastShown: document.getElementById("addr-toast")?.classList.contains("show") ?? null,
        sheetHidden: document.getElementById("ct-note-sheet")?.hidden ?? null,
      });
    }, 400)
  );
};

const NOTE_REMOVE_SNAP = () => {
  window.removeNoteSheet();
  return new Promise((resolve) =>
    setTimeout(() => {
      const st = (() => { try { if (typeof ctState !== "undefined") return ctState; } catch (e) {} return (window.__EW_CART_TEST_HOOKS && window.__ewCart && window.__ewCart.state) || null; })();
      resolve({
        stateNote: st ? st.restaurantNote : null,
        extras: localStorage.getItem("nearbite_cart_extras"),
        btnIsSet: document.querySelector(".ct-restaurant-note-btn")?.classList.contains("is-set") ?? null,
        preview: (document.querySelector(".ct-restaurant-note-preview") || {}).textContent ?? null,
        toastText: (document.getElementById("addr-toast-text") || {}).textContent ?? null,
      });
    }, 400)
  );
};

const TIP_CHIP_SNAP = () => {
  const chip = document.querySelector('#tip-options .ct-chip[data-tip="20"]');
  chip.click();
  return new Promise((resolve) =>
    setTimeout(() => {
      const st = (() => { try { if (typeof ctState !== "undefined") return ctState; } catch (e) {} return (window.__EW_CART_TEST_HOOKS && window.__ewCart && window.__ewCart.state) || null; })();
      const pressed = Array.from(document.querySelectorAll("#tip-options .ct-chip")).map(
        (c) => c.dataset.tip + "=" + c.getAttribute("aria-pressed")
      );
      resolve({
        tipAmount: st ? st.tipAmount : null,
        extras: localStorage.getItem("nearbite_cart_extras"),
        chipPressed: pressed,
        billTipVal: (document.getElementById("bill-tip-val") || {}).textContent ?? null,
        billTipDisplay: getComputedStyle(document.getElementById("bill-tip-row")).display,
        toastText: (document.getElementById("addr-toast-text") || {}).textContent ?? null,
      });
    }, 400)
  );
};

const CUSTOM_TIP_SNAP = () => {
  document.querySelector('#tip-options .ct-chip[data-tip="custom"]').click();
  return new Promise((resolve) =>
    setTimeout(() => {
      const sheetOpen = !document.getElementById("ct-tip-sheet")?.hidden;
      const input = document.getElementById("tip-input");
      input.value = "55";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      window.saveTipSheet();
      setTimeout(() => {
        const st = (() => { try { if (typeof ctState !== "undefined") return ctState; } catch (e) {} return (window.__EW_CART_TEST_HOOKS && window.__ewCart && window.__ewCart.state) || null; })();
        const customChip = document.querySelector("#tip-custom-chip .ct-chip-amt");
        resolve({
          sheetOpen,
          tipAmount: st ? st.tipAmount : null,
          extras: localStorage.getItem("nearbite_cart_extras"),
          customAmt: customChip ? customChip.textContent : null,
          customPressed: document.getElementById("tip-custom-chip")?.getAttribute("aria-pressed") ?? null,
          sheetHidden: document.getElementById("ct-tip-sheet")?.hidden ?? null,
          billTipVal: (document.getElementById("bill-tip-val") || {}).textContent ?? null,
        });
      }, 400);
    }, 350)
  );
};

const DI_PILL_SNAP = () => {
  const pill = document.querySelector('#ct-di-pills .ct-di-pill[data-di="Leave at the door"]');
  pill.click();
  return new Promise((resolve) =>
    setTimeout(() => {
      const st = (() => { try { if (typeof ctState !== "undefined") return ctState; } catch (e) {} return (window.__EW_CART_TEST_HOOKS && window.__ewCart && window.__ewCart.state) || null; })();
      const pressed = Array.from(document.querySelectorAll("#ct-di-pills .ct-di-pill")).map(
        (p) => p.dataset.di + "=" + p.getAttribute("aria-pressed")
      );
      resolve({
        di: st ? st.deliveryInstructions : null,
        extras: localStorage.getItem("nearbite_cart_extras"),
        pillPressed: pressed,
        count: (document.getElementById("ct-di-count") || {}).textContent ?? null,
        countHidden: document.getElementById("ct-di-count")?.hidden ?? null,
        pillsHtml: document.getElementById("ct-di-pills")?.innerHTML ?? null,
      });
    }, 400)
  );
};

const TAB_SWITCH_SNAP = () => {
  const diTab = document.querySelector('#ct-di-group [data-ct-tab="di"]');
  diTab.click();
  return new Promise((resolve) =>
    setTimeout(() => {
      const tabs = Array.from(document.querySelectorAll("#ct-di-group [data-ct-tab]")).map(
        (t) => t.getAttribute("data-ct-tab") + "=" + t.classList.contains("is-active") + "/" + t.getAttribute("aria-selected")
      );
      resolve({
        tabs,
        tipPanelHidden: document.getElementById("ct-tip-panel")?.hidden ?? null,
        diPanelHidden: document.getElementById("ct-di-body")?.hidden ?? null,
      });
    }, 250)
  );
};

const ESC_SNAP = () => {
  window.openSheet("ct-note-sheet");
  return new Promise((resolve) =>
    setTimeout(() => {
      const before = !document.getElementById("ct-note-sheet")?.hidden;
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      setTimeout(() => {
        resolve({
          openedBefore: before,
          bodyOpen: document.body.classList.contains("ct-sheet-open"),
        });
      }, 350);
    }, 250)
  );
};

/* ── C6 probes ───────────────────────────────────────────────────────── */
const RAIL_SNAP = () => {
  const t = (id) => {
    const el = document.getElementById(id);
    return el ? (el.textContent || "").trim() : null;
  };
  return {
    sectionHidden: document.getElementById("ct-meal")?.hidden ?? null,
    sectionLoading: document.getElementById("ct-meal")?.classList.contains("is-loading") ?? null,
    tabsHidden: document.getElementById("ct-cym-tabs")?.hidden ?? null,
    tabsHtml: (document.getElementById("ct-cym-tabs")?.innerHTML ?? null)?.replace(
      /<span class="ct-cym-ind"[^>]*>/,
      '<span class="ct-cym-ind">'
    ) ?? null,
    trackHtml: document.getElementById("ct-meal-row")?.innerHTML ?? null,
    from: t("ct-cym-from"),
    fromHidden: document.getElementById("ct-cym-from")?.hidden ?? null,
    cardCount: document.querySelectorAll("#ct-meal-row .ct-cym-card").length,
  };
};

const MEAL_TAB_SNAP = () => {
  const tabs = Array.from(document.querySelectorAll("#ct-cym-tabs [data-cym-tab]"));
  if (tabs.length < 2) return { skipped: "fewer than 2 tabs" };
  const key = tabs[1].getAttribute("data-cym-tab");
  tabs[1].click();
  return new Promise((resolve) =>
    setTimeout(() => {
      resolve({
        activeKey: (document.querySelector("#ct-cym-tabs .ct-cym-tab.is-active") || {}).getAttribute?.("data-cym-tab") ?? null,
        trackHtml: document.getElementById("ct-meal-row")?.innerHTML ?? null,
        ariaSelected: tabs.map((t) => t.getAttribute("data-cym-tab") + "=" + t.getAttribute("aria-selected")),
        tabKey: key,
      });
    }, 500)
  );
};

const MEAL_ADD_SNAP = async () => {
  /* Walk the capsules until a plain ("Add …") card is found; a customisable
     card would navigate away instead of adding. */
  const tabs = Array.from(document.querySelectorAll("#ct-cym-tabs [data-cym-tab]"));
  const scan = async (tab) => {
    if (tab) {
      tab.click();
      await new Promise((r) => setTimeout(r, 450));
    }
    const btns = Array.from(document.querySelectorAll("#ct-meal-row .ct-cym-add"));
    return btns.find((b) => (b.getAttribute("aria-label") || "").indexOf("Add ") === 0) || null;
  };
  let btn = await scan(null);
  for (const t of tabs) {
    if (btn) break;
    btn = await scan(t);
  }
  if (!btn) return { skipped: "no plain add button" };
  const name = btn.closest(".ct-cym-card").querySelector(".ct-cym-name span")?.textContent ?? null;
  const label = btn.getAttribute("aria-label");
  btn.click();
  await new Promise((r) => setTimeout(r, 900));
  return {
    cart: localStorage.getItem("nearbite_cart"),
    name,
    label,
    toastText: (document.getElementById("addr-toast-text") || {}).textContent ?? null,
  };
};

/* ── direct C6 function parity ───────────────────────────────────────── */
const C6_FN_PROBE = () => {
  const out = {};
  const groups = [
    { category: "Beverages", items: [{ _id: "a1", name: "Cola", price: 40 }] },
    { category: "Starters", items: [{ _id: "a2", name: "Momo", price: 90, isVeg: true }] },
  ];
  out.menuGroups = window.ctMenuGroups(groups);
  out.menuGroupsMap = window.ctMenuGroups({ A: [{ name: "x", price: 1 }], B: [{ name: "y", price: 2 }] });
  out.menuGroupsFlat = window.ctMenuGroups([{ name: "p", price: 5, category: "C1" }, { name: "q", price: 6, category: "C1" }]);
  out.menuGroupsFromRestaurant = window.ctMenuGroupsFromRestaurant({
    menu: groups,
    cuisine: ["Indian", "Chinese"],
  });
  out.mealItemFrom = [
    window.ctMealItemFrom({ _id: "m1", name: "  Dosa  ", price: 80, originalPrice: 100, isVeg: true, rating: 4.5, isBestseller: true, customizations: [{ options: [{ label: "L" }] }] }, "South"),
    window.ctMealItemFrom({ _id: "m2", name: "X", price: 0 }, "C"),
    window.ctMealItemFrom({ name: "NoId", price: 50 }, "C"),
    window.ctMealItemFrom({ _id: "m3", name: "OOS", price: 50, inStock: false }, "C"),
    window.ctMealItemFrom({ _id: "m4", name: "S", price: "₹120", rating: 9 }, "C"),
    window.ctMealItemFrom(null, "C"),
  ];
  out.extractMenu = window.ctExtractMenu({ menu: groups });
  out.pairWeight = [
    window.ctPairWeight("Cold Beverages"), window.ctPairWeight("Desserts"),
    window.ctPairWeight("Sides"), window.ctPairWeight("Starters"), window.ctPairWeight("Random"),
  ];
  out.parseMenuPrice = [
    window.ctParseMenuPrice(12.5), window.ctParseMenuPrice("₹1,299.50"),
    window.ctParseMenuPrice("abc"), window.ctParseMenuPrice(null), window.ctParseMenuPrice(NaN),
  ];
  out.pricesMatch = [
    window.ctPricesMatch(100, 100.005), window.ctPricesMatch(100, 100.02),
    window.ctPricesMatch(NaN, 1), window.ctPricesMatch(0, 0),
  ];
  out.menuOriginal = [
    window.ctMenuOriginalForCartEntry(
      { price: 100 },
      { price: 100, originalPrice: 150 }
    ),
    window.ctMenuOriginalForCartEntry(
      { price: 140, customizations: [{ pricingMode: "portion", label: "Large", title: "Size" }, { pricingMode: "addon", extraPrice: 20 }] },
      { price: 100, originalPrice: 150, customizations: [{ pricingMode: "portion", title: "Size", options: [{ label: "Large", extraPrice: 120, originalPrice: 170 }] }] }
    ),
    window.ctMenuOriginalForCartEntry({ price: 100 }, { price: 90, originalPrice: 150 }),
    window.ctMenuOriginalForCartEntry(null, null),
  ];
  out.mealCardHtml = window.ctMealCardHtml(
    { name: "Dosa", price: 80, originalPrice: 100, image: "", isVeg: true, rating: 4.5, badge: "Bestseller", category: "South", customizable: false, resName: "R" },
    3, false
  );
  out.mealCardHtmlMulti = window.ctMealCardHtml(
    { name: "Idli", price: 40, originalPrice: 0, image: "x.jpg", isVeg: false, rating: 0, badge: "", category: "South", customizable: true, resName: "R" },
    0, true
  );
  return out;
};

/* ────────────────────────────────────────────────────────────────────── */
const browser = await chromium.launch();

console.log("### Part C5-1 — note sheet open (restaurantNote)\n");
{
  const seed = { nearbite_cart: JSON.stringify(CART_SEED), nearbite_cart_extras: JSON.stringify({ ...EXTRAS_SEED, restaurantNote: "Extra spicy please" }) };
  const L = await open(browser, legacyUrl, seed);
  const N = await open(browser, newUrl, seed);
  const a = await L.page.evaluate(NOTE_SHEET_SNAP, RID);
  const b = await N.page.evaluate(NOTE_SHEET_SNAP, RID);
  for (const k of Object.keys(a)) check(`C5 note-sheet ${k}`, a[k], b[k]);
  await L.ctx.close();
  await N.ctx.close();
  console.log("");
}

console.log("### Part C5-2 — note sheet save + remove\n");
{
  const seed = { nearbite_cart: JSON.stringify(CART_SEED), nearbite_cart_extras: JSON.stringify(EXTRAS_SEED) };
  const L = await open(browser, legacyUrl, seed);
  const N = await open(browser, newUrl, seed);
  await L.page.evaluate(NOTE_SHEET_SNAP, RID);
  await N.page.evaluate(NOTE_SHEET_SNAP, RID);
  const a = await L.page.evaluate(NOTE_SAVE_SNAP, "No onion please");
  const b = await N.page.evaluate(NOTE_SAVE_SNAP, "No onion please");
  for (const k of Object.keys(a)) check(`C5 note-save ${k}`, a[k], b[k]);
  const c = await L.page.evaluate(NOTE_REMOVE_SNAP);
  const d = await N.page.evaluate(NOTE_REMOVE_SNAP);
  for (const k of Object.keys(c)) check(`C5 note-remove ${k}`, c[k], d[k]);
  await L.ctx.close();
  await N.ctx.close();
  console.log("");
}

console.log("### Part C5-3 — tip preset chip + custom tip sheet\n");
{
  const seed = { nearbite_cart: JSON.stringify(CART_SEED), nearbite_cart_extras: JSON.stringify(EXTRAS_SEED) };
  const L = await open(browser, legacyUrl, seed);
  const N = await open(browser, newUrl, seed);
  const a = await L.page.evaluate(TIP_CHIP_SNAP);
  const b = await N.page.evaluate(TIP_CHIP_SNAP);
  for (const k of Object.keys(a)) check(`C5 tip-chip ${k}`, a[k], b[k]);
  const c = await L.page.evaluate(CUSTOM_TIP_SNAP);
  const d = await N.page.evaluate(CUSTOM_TIP_SNAP);
  for (const k of Object.keys(c)) check(`C5 custom-tip ${k}`, c[k], d[k]);
  await L.ctx.close();
  await N.ctx.close();
  console.log("");
}

console.log("### Part C5-4 — delivery-instruction pills + tip/DI tab switch + Escape\n");
{
  const seed = { nearbite_cart: JSON.stringify(CART_SEED), nearbite_cart_extras: JSON.stringify(EXTRAS_SEED) };
  const L = await open(browser, legacyUrl, seed);
  const N = await open(browser, newUrl, seed);
  const a = await L.page.evaluate(DI_PILL_SNAP);
  const b = await N.page.evaluate(DI_PILL_SNAP);
  for (const k of Object.keys(a)) check(`C5 di-pill ${k}`, a[k], b[k]);
  const c = await L.page.evaluate(TAB_SWITCH_SNAP);
  const d = await N.page.evaluate(TAB_SWITCH_SNAP);
  for (const k of Object.keys(c)) check(`C5 tab-switch ${k}`, c[k], d[k]);
  const e = await L.page.evaluate(ESC_SNAP);
  const f = await N.page.evaluate(ESC_SNAP);
  for (const k of Object.keys(e)) check(`C5 escape ${k}`, e[k], f[k]);
  await L.ctx.close();
  await N.ctx.close();
  console.log("");
}

console.log("### Part C6-1 — complete-your-meal rail (menu fixture)\n");
{
  const seed = { nearbite_cart: JSON.stringify(CART_SEED), nearbite_cart_extras: JSON.stringify(EXTRAS_SEED) };
  const L = await open(browser, legacyUrl, seed, { settle: 2600 });
  const N = await open(browser, newUrl, seed, { settle: 2600 });
  const a = await L.page.evaluate(RAIL_SNAP);
  const b = await N.page.evaluate(RAIL_SNAP);
  for (const k of Object.keys(a)) check(`C6 rail ${k}`, a[k], b[k]);
  const c = await L.page.evaluate(MEAL_TAB_SNAP);
  const d = await N.page.evaluate(MEAL_TAB_SNAP);
  for (const k of Object.keys(c)) check(`C6 meal-tab ${k}`, c[k], d[k]);
  const e = await L.page.evaluate(MEAL_ADD_SNAP);
  const f = await N.page.evaluate(MEAL_ADD_SNAP);
  for (const k of Object.keys(e)) check(`C6 meal-add ${k}`, e[k], f[k]);
  await L.ctx.close();
  await N.ctx.close();
  console.log("");
}

console.log("### Part C6-2 — direct C6 function parity (page.evaluate)\n");
{
  const seed = { nearbite_cart: JSON.stringify(CART_SEED), nearbite_cart_extras: JSON.stringify(EXTRAS_SEED) };
  const L = await open(browser, legacyUrl, seed, { settle: 1800 });
  const N = await open(browser, newUrl, seed, { settle: 1800 });
  const a = await L.page.evaluate(C6_FN_PROBE);
  const b = await N.page.evaluate(C6_FN_PROBE);
  for (const k of Object.keys(a)) check(`C6 fn ${k}`, a[k], b[k]);
  await L.ctx.close();
  await N.ctx.close();
  console.log("");
}

console.log("### Part C6-3 — originalPrice hydration (MRP recovery)\n");
{
  /* A cart line with NO originalPrice but a matching menu record that has one. */
  const plain = {
    "Chicken Chilli Dry": { name: "Chicken Chilli Dry", price: 91, quantity: 1, resId: RID, restaurantName: "Foodie Dosa Restaurant", menuItem: "6ace2842d2398604a0926f7b" },
  };
  const seed = { nearbite_cart: JSON.stringify(plain), nearbite_cart_extras: JSON.stringify(EXTRAS_SEED) };
  const L = await open(browser, legacyUrl, seed, { settle: 3000 });
  const N = await open(browser, newUrl, seed, { settle: 3000 });
  const a = await L.page.evaluate(() => localStorage.getItem("nearbite_cart"));
  const b = await N.page.evaluate(() => localStorage.getItem("nearbite_cart"));
  check("C6 MRP hydration storage", a, b);
  await L.ctx.close();
  await N.ctx.close();
  console.log("");
}

await browser.close();
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
if (fail) {
  console.log("Failed checks:\n  " + failures.join("\n  "));
  process.exit(2);
}
