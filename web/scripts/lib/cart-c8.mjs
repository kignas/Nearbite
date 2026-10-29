// Shared C8 (cart address + profile hydration + lifecycle) probes — Phase 2n.
//
// Used by BOTH scripts/cart-c8-parity.mjs and scripts/cart-money-parity.mjs so
// the C8 logic lives in one place (same pattern as lib/cart-c7c11.mjs).
//
// GET-only: every fixture is a GET response; no write endpoint is ever called.
import fs from "node:fs";

const HANG = "__hang__";
function resolve(p) {
  for (const c of [p, p.replace(/^web\//, ""), "web/" + p]) if (fs.existsSync(c)) return c;
  return p;
}

/* ── fixture / seed loading ──────────────────────────────────────────── */
function loadJSON(name) {
  return JSON.parse(fs.readFileSync(resolve("scripts/fixtures/" + name), "utf8"));
}
const SEEDS = {
  guest: loadJSON("seed-cart-c8-guest.json"),
  token: loadJSON("seed-cart-c8-token.json"),
  address: loadJSON("seed-cart-c8-address.json"),
};
const FIX = {
  addresses: loadJSON("cart-c8-addresses.json"),
  empty: loadJSON("cart-c8-empty.json"),
  noname: loadJSON("cart-c8-noname.json"),
  badcoords: loadJSON("cart-c8-badcoords.json"),
  e401: loadJSON("cart-c8-401.json"),
  hang: loadJSON("cart-c8-hang.json"),
};

function fixtureFor(fixtures, rawUrl) {
  const u = new URL(rawUrl);
  const path = u.pathname.replace(/^\/api/, "");
  const exact = path + u.search;
  if (fixtures[exact] !== undefined) return fixtures[exact];
  if (fixtures[path] !== undefined) return fixtures[path];
  return undefined;
}

/* Install fixtures + a request counter. `networkErrorPaths` abort those
   requests (simulating a dropped connection) so loadAddress/ctEnsureProfile
   take their catch branch. "__hang__" leaves the request pending forever. */
async function installFixtures(page, fixtures, opts = {}) {
  const counts = {};
  const aborted = new Set(opts.networkErrorPaths || []);
  page.on("request", (req) => {
    const u = req.url();
    if (!u.includes("api.eatswada.com")) return;
    if (req.method() !== "GET") return;
    const path = new URL(u).pathname.replace(/^\/api/, "");
    counts[path] = (counts[path] || 0) + 1;
  });
  await page.route("https://api.eatswada.com/**", (route) => {
    const u = new URL(route.request().url());
    const path = u.pathname.replace(/^\/api/, "");
    if (aborted.has(path)) return route.abort("failed");
    const body = fixtureFor(fixtures, route.request().url());
    if (body === undefined)
      return route.fulfill({
        status: 404,
        headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
        body: JSON.stringify({ success: false, message: "Not found in fixtures" }),
      });
    if (body === HANG) return; // never resolve
    if (body && body.__status && body.__status !== 200)
      return route.fulfill({
        status: body.__status,
        headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
        body: JSON.stringify(body.body ?? {}),
      });
    return route.fulfill({
      status: 200,
      headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  });
  return counts;
}

/* ── DOM snapshot: the C8-owned surface ──────────────────────────────── */
const C8_SNAP = () => {
  /* Tiny stable hash (page context — no Node helpers available here).
     Whitespace BETWEEN tags is normalised away: the legacy static HTML keeps
     the author's newlines between elements, JSX emits them compact, and that
     gap is not a design/behaviour difference. Everything else is exact. */
  const hash = (s) => {
    /* HTML comments are inert (legacy keeps the author's comments, the JSX
       port drops them) and whitespace between tags differs by formatter. */
    const norm = String(s).replace(/<!--[\s\S]*?-->/g, "").replace(/>\s+</g, "><").trim();
    let h = 0;
    for (let i = 0; i < norm.length; i++) h = (Math.imul(31, h) + norm.charCodeAt(i)) | 0;
    return (h >>> 0).toString(16);
  };
  const t = (id) => {
    const el = document.getElementById(id);
    return el ? (el.textContent || "").trim() : null;
  };
  const cls = (id) => {
    const el = document.getElementById(id);
    return el ? el.className : null;
  };
  const addrBlock = document.getElementById("address-block");
  const btn = document.getElementById("btn-checkout");
  const sheetHtml = (id) => {
    const el = document.getElementById(id);
    return el ? el.innerHTML : null;
  };
  const sheetHidden = (id) => document.getElementById(id)?.hasAttribute("hidden") ?? null;
  return {
    addrBlockHtmlHash: addrBlock ? hash(addrBlock.innerHTML) : null,
    addrTag: t("address-tag-label"),
    addrDisplay: t("address-display-text"),
    addrPrompt: document.getElementById("address-display-text")?.classList.contains("ct-prompt") ?? null,
    dhRestaurant: t("ct-dh-restaurant"),
    customerName: t("checkout-customer-name"),
    customerPhone: t("checkout-customer-phone"),
    ctaLabel: t("checkout-label"),
    ctaClass: cls("btn-checkout"),
    ctaAriaDisabled: btn ? btn.getAttribute("aria-disabled") : null,
    /* C8 storage keys (exact). */
    ls: {
      address: localStorage.getItem("nearbite_address"),
      selectedId: localStorage.getItem("nearbite_selected_address_id"),
      user: localStorage.getItem("nearbite_user"),
      cart: localStorage.getItem("nearbite_cart"),
      extras: localStorage.getItem("nearbite_cart_extras"),
      ck: localStorage.getItem("nearbite_checkout_key"),
      ckFp: localStorage.getItem("nearbite_checkout_fp"),
      ckFpTs: localStorage.getItem("nearbite_checkout_fp_ts"),
    },
    /* Sheets (C8's extras storage listener repaints inside the note sheet). */
    noteSheetHash: sheetHtml("ct-note-sheet") ? hash(sheetHtml("ct-note-sheet")) : null,
    noteSheetHidden: sheetHidden("ct-note-sheet"),
    tipSheetHash: sheetHtml("ct-tip-sheet") ? hash(sheetHtml("ct-tip-sheet")) : null,
    couponSheetHash: sheetHtml("ct-coupon-sheet") ? hash(sheetHtml("ct-coupon-sheet")) : null,
  };
};

async function openPage(browser, url, { fixtures, seed, networkErrorPaths = [], settle = 1500 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript((entries) => {
    window.__EW_CART_TEST_HOOKS = true;
    try {
      for (const [k, v] of Object.entries(entries))
        window.localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
    } catch (e) {}
  }, seed);
  const page = await ctx.newPage();
  const counts = await installFixtures(page, fixtures, { networkErrorPaths });
  const hasHang = JSON.stringify(fixtures).includes('"' + HANG + '"');
  await page
    .goto(url, { waitUntil: hasHang ? "domcontentloaded" : "networkidle", timeout: 45000 })
    .catch(() => {});
  await page.waitForTimeout(settle);
  return { ctx, page, counts };
}

export async function runPartA(browser, urls, check, note) {
/* ══════════════════════════════════════════════════════════════════════
   PART A — profile state matrix: address block DOM + CTA + storage
   ══════════════════════════════════════════════════════════════════════ */
console.log("### Part A — address/profile state matrix (DOM hash + CTA + storage)\n");
const STATES = [
  { label: "guest (no token, no address)", fixtures: FIX.addresses, seed: SEEDS.guest },
  { label: "token + saved addresses", fixtures: FIX.addresses, seed: SEEDS.token },
  { label: "token + local address already present", fixtures: FIX.addresses, seed: SEEDS.address },
  { label: "token + empty profile", fixtures: FIX.empty, seed: SEEDS.token },
  { label: "token + missing phone/name", fixtures: FIX.noname, seed: SEEDS.token },
  { label: "token + malformed coordinates", fixtures: FIX.badcoords, seed: SEEDS.token },
  { label: "token + 401", fixtures: FIX.e401, seed: SEEDS.token },
  { label: "token + network error", fixtures: FIX.addresses, seed: SEEDS.token, networkErrorPaths: ["/users/profile"] },
  { label: "token + profile held (__hang__)", fixtures: FIX.hang, seed: SEEDS.token },
];
const countsA = {};
for (const st of STATES) {
  console.log(`-- ${st.label}`);
  const L = await openPage(browser, urls.legacyUrl, st);
  const lSnap = await L.page.evaluate(C8_SNAP);
  const N = await openPage(browser, urls.newUrl, st);
  const nSnap = await N.page.evaluate(C8_SNAP);
  countsA[st.label] = { legacy: L.counts, new: N.counts };

  check(`${st.label}: address block innerHTML hash`, lSnap.addrBlockHtmlHash, nSnap.addrBlockHtmlHash);
  check(`${st.label}: address tag label`, lSnap.addrTag, nSnap.addrTag);
  check(`${st.label}: address display text`, lSnap.addrDisplay, nSnap.addrDisplay);
  check(`${st.label}: address prompt class`, lSnap.addrPrompt, nSnap.addrPrompt);
  check(`${st.label}: hidden restaurant name`, lSnap.dhRestaurant, nSnap.dhRestaurant);
  check(`${st.label}: customer name`, lSnap.customerName, nSnap.customerName);
  check(`${st.label}: customer phone`, lSnap.customerPhone, nSnap.customerPhone);
  check(`${st.label}: CTA label`, lSnap.ctaLabel, nSnap.ctaLabel);
  check(`${st.label}: CTA class`, lSnap.ctaClass, nSnap.ctaClass);
  check(`${st.label}: CTA aria-disabled`, lSnap.ctaAriaDisabled, nSnap.ctaAriaDisabled);
  check(`${st.label}: storage after load`, lSnap.ls, nSnap.ls);
  check(`${st.label}: note sheet hash`, lSnap.noteSheetHash, nSnap.noteSheetHash);
  check(`${st.label}: note sheet hidden`, lSnap.noteSheetHidden, nSnap.noteSheetHidden);
  check(`${st.label}: tip sheet hash`, lSnap.tipSheetHash, nSnap.tipSheetHash);
  check(`${st.label}: coupon sheet hash`, lSnap.couponSheetHash, nSnap.couponSheetHash);
  await L.ctx.close();
  await N.ctx.close();
  console.log("");
}
console.log("  · Part A GET counts:");
for (const k of Object.keys(countsA)) note(`${k}: legacy ${JSON.stringify(countsA[k].legacy)} vs new ${JSON.stringify(countsA[k].new)}`);
console.log("");

}

export async function runPartB(browser, urls, check, note) {
/* ══════════════════════════════════════════════════════════════════════
   PART B — direct C8 function parity (page.evaluate, identical inputs)
   ══════════════════════════════════════════════════════════════════════ */
console.log("### Part B — direct C8 function parity (page.evaluate)\n");
const C8_FN_PROBE = () => {
  const out = {};
  const st = (() => {
    try { if (typeof ctState !== "undefined") return ctState; } catch (e) {}
    return (window.__EW_CART_TEST_HOOKS && window.__ewCart && window.__ewCart.state) || null;
  })();
  const profile = (() => {
    try { if (typeof ctProfile !== "undefined") return ctProfile; } catch (e) {}
    return (window.__EW_CART_TEST_HOOKS && window.__ewCart && window.__ewCart.profile) || null;
  })();

  /* ctCaptureProfile: name/phone trimming + the "Nearbite User" guard. */
  const cap = [];
  const snapProfile = () => (profile ? { name: profile.name, phone: profile.phone, fetched: profile.fetched } : null);
  const cases = [
    { name: "  Alice  ", phone: " 9876543210 " },
    { name: "Nearbite User", phone: "1111111111" },
    { name: "", phone: "" },
    { name: 42, phone: null },
  ];
  for (const c of cases) {
    try {
      window.ctCaptureProfile(c);
      cap.push(snapProfile());
    } catch (e) {
      cap.push({ error: String(e).split("\n")[0] });
    }
  }
  out.captureProfile = cap;
  try { window.ctCaptureProfile(null); out.captureNull = snapProfile(); } catch (e) { out.captureNull = String(e); }

  /* Address-derived helpers on a synthetic address. */
  const ADDR = {
    _id: "zzzzzzzzzzzzzzzzzzzzzzzz", tag: "Work", house: "9", area: "Station Rd",
    landmark: "Near Park", city: "Maynaguri", pincode: "735224",
    location: { type: "Point", coordinates: [88.82, 26.56] },
    receiverName: "Receiver", receiverPhone: "9000000000",
  };
  const prev = localStorage.getItem("nearbite_address");
  try {
    localStorage.setItem("nearbite_address", JSON.stringify(ADDR));
    out.selectedAddress = window.ctSelectedAddress();
    out.customerContact = window.ctCustomerContact();
    out.addressTag = window.ctAddressTag();
    out.addressLine = window.ctAddressLine();
    out.hasAddress = window.hasAddress();
  } catch (e) {
    out.addressHelpers = "ERR:" + String(e).split("\n")[0];
  }
  /* receiver wins over profile; profile is the fallback. */
  try {
    localStorage.removeItem("nearbite_address");
    out.contactNoAddress = window.ctCustomerContact();
    out.hasAddressNoAddr = window.hasAddress();
    out.addressLineNoAddr = window.ctAddressLine();
    out.addressTagNoAddr = window.ctAddressTag();
  } catch (e) {
    out.addressNone = "ERR:" + String(e).split("\n")[0];
  }
  if (prev === null) localStorage.removeItem("nearbite_address");
  else localStorage.setItem("nearbite_address", prev);

  /* paintCheckoutDeliverySummary on the current DOM (address + contact nodes). */
  try {
    window.paintCheckoutDeliverySummary();
    out.paintSummary = {
      tag: document.getElementById("address-tag-label")?.textContent,
      display: document.getElementById("address-display-text")?.textContent,
      name: document.getElementById("checkout-customer-name")?.textContent,
      phone: document.getElementById("checkout-customer-phone")?.textContent,
      eta: document.getElementById("checkout-eta")?.textContent,
    };
  } catch (e) {
    out.paintSummary = "ERR:" + String(e).split("\n")[0];
  }
  out.stateAddressOk = st ? st.addressOk : null;
  out.stateLoggedIn = st ? st.loggedIn : null;
  return out;
};

{
  const L = await openPage(browser, urls.legacyUrl, { fixtures: FIX.addresses, seed: SEEDS.token });
  const N = await openPage(browser, urls.newUrl, { fixtures: FIX.addresses, seed: SEEDS.token });
  const a = await L.page.evaluate(C8_FN_PROBE);
  const b = await N.page.evaluate(C8_FN_PROBE);
  for (const k of Object.keys(a)) check(`fn ${k}`, a[k], b[k]);
  await L.ctx.close();
  await N.ctx.close();
  console.log("");
}

}

export async function runPartC(browser, urls, check, note) {
/* ══════════════════════════════════════════════════════════════════════
   PART C — lifecycle events (storage / pageshow / address-changed / resize)
   ══════════════════════════════════════════════════════════════════════ */
console.log("### Part C — lifecycle listeners (storage / pageshow / address-changed)\n");

/* Drive one event and capture the resulting address DOM + storage + counts. */
const LIFECYCLE_PROBE = async (which) => {
  const t = (id) => {
    const el = document.getElementById(id);
    return el ? (el.textContent || "").trim() : null;
  };
  const readState = () => ({
    tag: t("address-tag-label"),
    display: t("address-display-text"),
    name: t("checkout-customer-name"),
    phone: t("checkout-customer-phone"),
    cta: t("checkout-label"),
    address: localStorage.getItem("nearbite_address"),
    selectedId: localStorage.getItem("nearbite_selected_address_id"),
    ck: localStorage.getItem("nearbite_checkout_key"),
    noteSheet: (document.getElementById("ct-note-sheet") || {}).innerHTML ? "present" : "absent",
  });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  if (which === "storage-address") {
    /* A different address becomes selected (as address.html would write it). */
    const other = {
      _id: "bbbbbbbbbbbbbbbbbbbbbbbb", tag: "Work", house: "5", area: "Station Rd",
      city: "Maynaguri", pincode: "735224",
      location: { type: "Point", coordinates: [88.83, 26.57] },
      receiverName: "Second", receiverPhone: "9888888888",
    };
    localStorage.setItem("nearbite_address", JSON.stringify(other));
    localStorage.setItem("nearbite_selected_address_id", "bbbbbbbbbbbbbbbbbbbbbbbb");
    localStorage.setItem("nearbite_checkout_key", "old-key");
    window.dispatchEvent(new StorageEvent("storage", { key: "nearbite_address", newValue: JSON.stringify(other) }));
    await wait(2200);
    return readState();
  }
  if (which === "storage-extras") {
    const extras = { restaurantNote: "", restaurantNotes: {}, deliveryInstructions: "", tipAmount: 35 };
    localStorage.setItem("nearbite_cart_extras", JSON.stringify(extras));
    window.dispatchEvent(new StorageEvent("storage", { key: "nearbite_cart_extras", newValue: JSON.stringify(extras) }));
    await wait(600);
    return { ...readState(), tip: document.getElementById("bill-tip-val")?.textContent };
  }
  if (which === "pageshow-not-persisted") {
    const before = readState();
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: false }));
    await wait(600);
    return { before, after: readState() };
  }
  if (which === "pageshow-persisted") {
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    await wait(2200);
    return readState();
  }
  if (which === "address-changed") {
    const other = {
      _id: "cccccccccccccccccccccccc", tag: "Home2", house: "7", area: "College Rd",
      city: "Maynaguri", pincode: "735224",
      location: { type: "Point", coordinates: [88.84, 26.58] },
      receiverName: "Third", receiverPhone: "9777777777",
    };
    localStorage.setItem("nearbite_address", JSON.stringify(other));
    localStorage.setItem("nearbite_selected_address_id", "cccccccccccccccccccccccc");
    window.dispatchEvent(new CustomEvent("nearbite:address-changed"));
    await wait(2200);
    return readState();
  }
  if (which === "resize") {
    const before = document.getElementById("checkout-footer")?.style?.bottom ?? null;
    window.dispatchEvent(new Event("resize"));
    await wait(400);
    return { before, after: document.getElementById("checkout-footer")?.style?.bottom ?? null };
  }
  return { error: "unknown" };
};

for (const which of ["storage-address", "storage-extras", "pageshow-not-persisted", "pageshow-persisted", "address-changed", "resize"]) {
  const L = await openPage(browser, urls.legacyUrl, { fixtures: FIX.addresses, seed: SEEDS.address });
  const N = await openPage(browser, urls.newUrl, { fixtures: FIX.addresses, seed: SEEDS.address });
  const beforeL = JSON.stringify(L.counts);
  const beforeN = JSON.stringify(N.counts);
  const a = await L.page.evaluate(LIFECYCLE_PROBE, which);
  const b = await N.page.evaluate(LIFECYCLE_PROBE, which);
  check(`lifecycle[${which}]`, a, b);
  /* Request accounting. Both pages run the SAME periodic delivery/meal
     refresh cycles (restaurant + menu GETs), so those deltas race with the
     measurement window and are reported, not asserted. The C8-owned signal is
     `/users/profile`: ONLY the address listeners (loadAddress -> ctEnsureProfile)
     fetch it, so its delta isolates the C8 wiring exactly. */
  const delta = (before, after) => {
    const d = {};
    for (const k of new Set([...Object.keys(before), ...Object.keys(after)]))
      d[k] = (after[k] || 0) - (before[k] || 0);
    return d;
  };
  const dL = delta(JSON.parse(beforeL), L.counts);
  const dN = delta(JSON.parse(beforeN), N.counts);
  const profile = (d) => d["/users/profile"] || 0;
  /* Address events must re-hydrate the profile on BOTH pages; the extras and
     resize events must NOT fetch it on either page. */
  const expectProfile = which === "storage-address" || which === "pageshow-persisted" || which === "address-changed";
  check(`lifecycle[${which}] /users/profile fetched = ${expectProfile ? "yes" : "no"} (both)`,
    { legacy: profile(dL) > 0, new: profile(dN) > 0 },
    { legacy: expectProfile, new: expectProfile });
  note(`lifecycle[${which}] GET delta legacy ${JSON.stringify(dL)} vs new ${JSON.stringify(dN)}`);
  await L.ctx.close();
  await N.ctx.close();
}
console.log("");

}

export async function runPartD(browser, urls, check, note) {
/* ══════════════════════════════════════════════════════════════════════
   PART D — sheet DOM when opened
   ══════════════════════════════════════════════════════════════════════ */
console.log("### Part D — sheet DOM when opened (note/tip/coupon)\n");
const SHEET_PROBE = () => {
  const out = {};
  const sha = (s) => {
    /* Tiny stable hash inside the page (no crypto dependency needed).
       Whitespace between tags is normalised (JSX vs static HTML gap). */
    const norm = String(s).replace(/<!--[\s\S]*?-->/g, "").replace(/>\s+</g, "><").trim();
    let h = 0;
    for (let i = 0; i < norm.length; i++) h = (Math.imul(31, h) + norm.charCodeAt(i)) | 0;
    return (h >>> 0).toString(16);
  };
  for (const id of ["ct-note-sheet", "ct-tip-sheet", "ct-coupon-sheet"]) {
    try {
      if (typeof window.openSheet === "function") window.openSheet(id);
    } catch (e) {}
    const el = document.getElementById(id);
    out[id] = {
      hidden: el ? el.hasAttribute("hidden") : null,
      display: el ? getComputedStyle(el).display : null,
      htmlHash: el ? sha(el.innerHTML) : null,
      bodyClass: document.body.className,
    };
    try {
      if (typeof window.closeSheet === "function") window.closeSheet(true);
    } catch (e) {}
  }
  return out;
};
{
  const L = await openPage(browser, urls.legacyUrl, { fixtures: FIX.addresses, seed: SEEDS.address });
  const N = await openPage(browser, urls.newUrl, { fixtures: FIX.addresses, seed: SEEDS.address });
  const a = await L.page.evaluate(SHEET_PROBE);
  const b = await N.page.evaluate(SHEET_PROBE);
  check("sheet open: note/tip/coupon DOM", a, b);
  await L.ctx.close();
  await N.ctx.close();
  console.log("");
}

}

export async function runPartE(browser, urls, check, note) {
/* ══════════════════════════════════════════════════════════════════════
   PART E — boot-once GET counts (per endpoint, legacy vs new)
   ══════════════════════════════════════════════════════════════════════ */
console.log("### Part E — boot-once GET counts per endpoint\n");
{
  const L = await openPage(browser, urls.legacyUrl, { fixtures: FIX.addresses, seed: SEEDS.token, settle: 1800 });
  const N = await openPage(browser, urls.newUrl, { fixtures: FIX.addresses, seed: SEEDS.token, settle: 1800 });
  note(`legacy: ${JSON.stringify(L.counts)}`);
  note(`new:    ${JSON.stringify(N.counts)}`);
  const endpoints = new Set([...Object.keys(L.counts), ...Object.keys(N.counts)]);
  let noMore = true;
  for (const e of endpoints) if ((N.counts[e] || 0) > (L.counts[e] || 0)) noMore = false;
  check("boot: new issues no more GETs than legacy per endpoint", noMore, true);
  /* /users/profile must be requested at least once on both (the C8 hydration). */
  check("boot: legacy GET /users/profile >= 1", (L.counts["/users/profile"] || 0) >= 1, true);
  check("boot: new GET /users/profile >= 1", (N.counts["/users/profile"] || 0) >= 1, true);
  await L.ctx.close();
  await N.ctx.close();
  console.log("");
}


}
