// Phase 3c — ACCOUNT + ORDERS parity harness (T3 / T4 / T6 / T7).
//
// Usage: node scripts/account-parity.mjs [legacyBase] [newBase]
//   defaults: legacy http://localhost:8080  new http://localhost:3000
//
// NO REAL AUTH, EVER:
//   * the Firebase CDN is aborted and a fake `window.firebase` is injected
//     before any page script;
//   * every non-GET request is stubbed; the recorder keeps method + URL +
//     headers + exact body and FAILS on any unstubbed write (T4);
//   * fixtures use only fake names / phones / emails / addresses / tokens.
//
// For each case the harness runs legacy and new side by side with the same
// seed + stubs and compares, after every step:
//   * the DOM/state signature (visible text of the account-specific elements,
//     button label + disabled, storage keys, redirect target) — T3
//   * the recorded writes (method, path, exact body, content-type) — T4
//   * the GET request counts (boot-once) — T6
import { chromium } from "playwright";
import fs from "node:fs";
import {
  fakeFirebaseSource,
  fakeLeafletSource,
  installStubs,
  signature,
  normUrl,
} from "./lib/auth.mjs";

const [legacyBase = "http://localhost:8080", newBase = "http://localhost:3000"] =
  process.argv.slice(2);
const strip = (b) => b.replace(/\/$/, "");

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

const SEED_FN = (entries) => {
  for (const [k, v] of Object.entries(entries.local || {}))
    window.localStorage.setItem(k, v);
  for (const [k, v] of Object.entries(entries.session || {}))
    window.sessionStorage.setItem(k, v);
};

const writableWrites = (recorded) =>
  recorded.map((r) => ({
    method: r.method,
    path: r.path,
    body: r.body,
    contentType: (r.headers["content-type"] || "").split(";")[0],
  }));

const sortCounts = (counts) =>
  Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));

/* The account-specific part of the signature: everything the four pages
   render that is NOT already covered by auth.mjs `signature()`. */
const ACCOUNT_KEYS = [
  "nearbite_token",
  "token",
  "nearbite_user",
  "nearbite_address",
  "nearbite_selected_address_id",
  "nearbite_address_updated_at",
  "nb_hidden_orders",
  "eatswada_address_draft",
  "eatswada_address_modes_v1",
  "eatswada_recent_locations",
  "nearbite_onboarding_location",
  "nearbite_onboarding_geocode",
  "eatswada_device_location",
];

async function accountSignature(page) {
  return await page.evaluate((keys) => {
    /* Only report text the user can actually see: an element inside a
       `display:none` ancestor (e.g. #empty-orders while orders exist) is not
       visible, and its hidden DOM text can legitimately differ between two
       runs of the SAME code depending on whether the first render happened
       before or after the fetch resolved. */
    const visible = (el) => {
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (n.hidden || cs.display === "none" || cs.visibility === "hidden") return false;
      }
      return true;
    };
    const txt = (id) => {
      const el = document.getElementById(id);
      if (!el || !visible(el)) return null;
      return (el.textContent || "").replace(/\s+/g, " ").trim();
    };
    const html = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 400);
    };
    const out = {
      url: location.pathname + location.search,
      title: document.title,
      ids: {
        userName: txt("userName"),
        userPhone: txt("userPhone"),
        userEmail: txt("userEmail"),
        addressSummary: txt("addressSummary"),
        favCount: txt("favCount"),
        statusTitle: txt("status-title"),
        statusSub: txt("status-sub"),
        statusNote: txt("status-note"),
        etaTime: txt("eta-time"),
        otpDisplay: txt("otp-display"),
        displayTotal: txt("display-total"),
        paymentType: txt("payment-type"),
        payStatusPill: txt("pay-status-pill"),
        restaurantName: txt("restaurant-name"),
        addressText: txt("address-text"),
        receiverName: txt("receiver-name"),
        riderName: txt("rider-name"),
        completionTime: txt("completion-time"),
        milestoneText: txt("milestone-text"),
        codCalloutText: txt("cod-callout-text"),
        refundStatusText: txt("refund-status-text"),
        refundNote: txt("refund-note"),
        cancelReasonText: txt("cancel-reason-text"),
        formTitle: txt("formTitle"),
        headPrimary: txt("headPrimary"),
        headSecondary: txt("headSecondary"),
        changeLocText: txt("changeLocText"),
        accountLine: txt("accountLine"),
        toast: txt("toast"),
      },
      hidden: {
        statLive: document.getElementById("stat-live") ? getComputedStyle(document.getElementById("stat-live")).display : null,
        emptyOrders: document.getElementById("empty-orders") ? getComputedStyle(document.getElementById("empty-orders")).display : null,
        loadMoreWrap: document.getElementById("load-more-wrap") ? getComputedStyle(document.getElementById("load-more-wrap")).display : null,
        modal: document.getElementById("modal") ? document.getElementById("modal").className : null,
        invoiceOverlay: document.getElementById("invoice-overlay") ? document.getElementById("invoice-overlay").className : null,
        sheetModal: document.getElementById("sheet-modal") ? document.getElementById("sheet-modal").className : null,
        ratingCard: document.getElementById("rating-card") ? getComputedStyle(document.getElementById("rating-card")).display : null,
        timelineCard: document.getElementById("timeline") ? getComputedStyle(document.getElementById("timeline")).display : null,
        riderCard: document.getElementById("rider-card") ? getComputedStyle(document.getElementById("rider-card")).display : null,
        mapCard: document.getElementById("map-card") ? getComputedStyle(document.getElementById("map-card")).display : null,
        completion: document.getElementById("completion-screen") ? getComputedStyle(document.getElementById("completion-screen")).display : null,
        cancellationCard: document.getElementById("cancellation-card") ? getComputedStyle(document.getElementById("cancellation-card")).display : null,
        codCallout: document.getElementById("cod-callout") ? getComputedStyle(document.getElementById("cod-callout")).display : null,
        otpContainer: document.getElementById("otp-container") ? getComputedStyle(document.getElementById("otp-container")).display : null,
      },
      saveDisabled: document.getElementById("save") ? !!document.getElementById("save").disabled : null,
      ratingSubmitDisabled: document.getElementById("rating-submit") ? !!document.getElementById("rating-submit").disabled : null,
      liveCards: (document.getElementById("live-orders-container") || { children: [] }).children.length,
      pastCards: (document.getElementById("past-orders-container") || { children: [] }).children.length,
      addrItems: document.querySelectorAll("#list .ea-item, #list .ea-empty").length,
      selectItems: document.querySelectorAll("#lsSaved .ls-item, #lsSaved .ls-note").length,
      timelineSteps: document.querySelectorAll("#timeline-steps .tl-step").length,
      summary: html("#summary-items-list"),
      charges: html("#summary-charges"),
      timeline: html("#timeline-steps"),
      invoice: html("#invoice-content"),
      listHtml: html("#list"),
      lsSavedHtml: html("#lsSaved"),
      /* The empty-state strings, gated on visibility (see `visible`). */
      emptyText: [txt("empty-title"), txt("empty-desc")],
      local: {},
      session: {},
    };
    for (const k of keys) {
      const lv = localStorage.getItem(k);
      const sv = sessionStorage.getItem(k);
      if (lv !== null) out.local[k] = lv;
      if (sv !== null) out.session[k] = sv;
    }
    return out;
  }, ACCOUNT_KEYS);
}

/* Wait until `location.href` has been unchanged for 3 consecutive 100 ms ticks
   (max 2 s) so a pending client redirect cannot be caught mid-flight. */
async function settleUrl(page) {
  let prev = "";
  let stable = 0;
  for (let i = 0; i < 20 && stable < 3; i++) {
    const now = page.url();
    stable = now === prev ? stable + 1 : 0;
    prev = now;
    await page.waitForTimeout(100);
  }
}

async function runSide(browser, base, path, cfg) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  if (cfg.seed) await ctx.addInitScript(SEED_FN, cfg.seed);
  if (cfg.fb) await ctx.addInitScript(fakeFirebaseSource(cfg.fb));
  await ctx.addInitScript(fakeLeafletSource());
  /* Frozen clock: `nearbite_address_updated_at` and the cancel countdown are
     derived from Date.now(), which would otherwise differ by a few hundred ms
     between the two runs. Freezing it on BOTH sides keeps the comparison
     exact without touching either page. */
  await ctx.addInitScript(() => {
    const T = 1793000000000;
    Date.now = () => T;
  });
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.accept());
  const stub = await installStubs(page, cfg.fixtures || {}, { writes: cfg.writes || {} });
  await page.goto(strip(base) + path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(cfg.settle ?? 900);
  /* The logged-out pages redirect (`location.replace('login.html')`). Capture
     only once the URL has stopped changing, otherwise the two runs can catch
     the redirect at different points and the storage snapshot differs for a
     reason that has nothing to do with the port (same race as `empty-desc`). */
  await settleUrl(page);

  const sigs = [await accountSignature(page)];
  for (const step of cfg.steps || []) {
    await step(page);
    await page.waitForTimeout(cfg.stepWait ?? 500);
    await settleUrl(page);
    sigs.push(await accountSignature(page));
  }
  const out = {
    sigs,
    writes: writableWrites(stub.recorded),
    counts: stub.counts,
    unstubbed: stub.state.unstubbed,
    finalUrl: normUrl(page.url()),
  };
  await ctx.close();
  return out;
}

async function runCase(browser, name, cfg) {
  console.log(`\n== ${name} ==`);
  const legacy = await runSide(browser, legacyBase, cfg.legacyPath, cfg);
  const neu = await runSide(browser, newBase, cfg.newPath, cfg);

  check(`${name}: no unstubbed write (legacy)`, legacy.unstubbed, null);
  check(`${name}: no unstubbed write (new)`, neu.unstubbed, null);

  const n = Math.max(legacy.sigs.length, neu.sigs.length);
  for (let i = 0; i < n; i++) {
    const a = legacy.sigs[i];
    const b = neu.sigs[i];
    if (!a || !b) {
      check(`${name}: step ${i} signature`, a, b);
      continue;
    }
    check(`${name}: step ${i} url`, normUrl(a.url), normUrl(b.url));
    check(`${name}: step ${i} title`, a.title, b.title);
    check(`${name}: step ${i} ids`, a.ids, b.ids);
    check(`${name}: step ${i} empty text`, a.emptyText, b.emptyText);
    check(`${name}: step ${i} hidden`, a.hidden, b.hidden);
    check(`${name}: step ${i} save/rating disabled`, [a.saveDisabled, a.ratingSubmitDisabled], [b.saveDisabled, b.ratingSubmitDisabled]);
    check(`${name}: step ${i} card counts`, [a.liveCards, a.pastCards, a.addrItems, a.selectItems, a.timelineSteps], [b.liveCards, b.pastCards, b.addrItems, b.selectItems, b.timelineSteps]);
    check(`${name}: step ${i} summary`, a.summary, b.summary);
    check(`${name}: step ${i} charges`, a.charges, b.charges);
    check(`${name}: step ${i} timeline`, a.timeline, b.timeline);
    check(`${name}: step ${i} invoice`, a.invoice, b.invoice);
    check(`${name}: step ${i} list`, a.listHtml, b.listHtml);
    check(`${name}: step ${i} select list`, a.lsSavedHtml, b.lsSavedHtml);
    {
      const sa = JSON.stringify({ local: a.local, session: a.session });
      const sb = JSON.stringify({ local: b.local, session: b.session });
      if (sa !== sb) console.log(`    STORAGE DIFF legacy=${sa} new=${sb}`);
    }
    check(`${name}: step ${i} storage`, { local: a.local, session: a.session }, { local: b.local, session: b.session });
  }
  check(`${name}: writes`, legacy.writes, neu.writes);
  check(`${name}: final url`, legacy.finalUrl, neu.finalUrl);
  check(`${name}: GET boot counts`, sortCounts(legacy.counts), sortCounts(neu.counts));
}

const browser = await chromium.launch();

/* ── fixtures (fake values only) ─────────────────────────────────────── */
const ORDERS = [
  {
    _id: "ord0000000000000000000001", orderNumber: "EW100001", status: "out_for_delivery",
    createdAt: "2026-10-20T10:05:00.000Z", total: 349, restaurantName: "Test Kitchen",
    restaurantPhone: "9876543210", deliveryOtp: "4321", paymentMethod: "cod", paymentStatus: "pending",
    deliveryFee: 25, subtotal: 324, estimatedDelivery: "2026-10-20T11:05:00.000Z",
    riderEtaMinutes: 9, riderStatus: "picked_up", riderLocation: { lat: 26.57, lng: 88.83 },
    rider: { name: "Test Rider", phone: "9000000000", rating: 4.8, vehicleNumber: "WB00XX0000" },
    deliveryAddress: { receiverName: "Test Receiver", receiverPhone: "9876543210", formatted: "12 Main Road", coordinates: [88.82, 26.56] },
    items: [{ name: "Chicken Biryani", quantity: 2, price: 120, isVeg: false, menuItem: "m1" }],
  },
  {
    _id: "ord0000000000000000000002", orderNumber: "EW100002", status: "preparing",
    createdAt: "2026-10-20T10:20:00.000Z", total: 199, restaurantName: "Test Cafe",
    paymentMethod: "upi", paymentStatus: "paid", prepMinutes: 18, prepStartedAt: "2026-10-20T10:22:00.000Z",
    deliveryFee: 0, originalDeliveryFee: 20, subtotal: 199,
    items: [{ name: "Masala Dosa", quantity: 1, price: 199, isVeg: true, menuItem: "m3" }],
  },
  {
    _id: "ord0000000000000000000003", orderNumber: "EW100003", status: "placed",
    createdAt: "2026-10-20T10:30:00.000Z", total: 149, restaurantName: "Test Diner",
    paymentMethod: "cod", paymentStatus: "pending", isCancellable: true,
    deliveryFee: 15, subtotal: 134,
    items: [{ name: "Egg Chowmein", quantity: 1, price: 149, menuItem: "m4" }],
  },
  {
    _id: "ord0000000000000000000004", orderNumber: "EW100004", status: "delivered",
    createdAt: "2026-10-10T09:00:00.000Z", total: 275, restaurantName: "Test Grill",
    restaurantId: "r-abc123", paymentMethod: "upi", paymentStatus: "paid", deliveryFee: 20, subtotal: 255,
    items: [{ name: "Paneer Tikka", quantity: 1, price: 150, isVeg: true }, { name: "Naan", quantity: 2, price: 40, isVeg: true }],
  },
  {
    _id: "ord0000000000000000000009", orderNumber: "EW100009", status: "cancelled",
    createdAt: "2026-09-20T12:00:00.000Z", total: 210, cancelReason: "rejected by restaurant: item unavailable",
    restaurantName: "Test Place", paymentMethod: "upi", paymentStatus: "refunded",
    refund: { status: "completed", amount: 210 }, deliveryFee: 10, subtotal: 200,
    items: [{ name: "Thali", quantity: 1, price: 210, isVeg: true }],
  },
];

const ADDRESSES = [
  {
    _id: "aaaaaaaaaaaaaaaaaaaaaaaa", tag: "Home", house: "12", area: "Main Road", city: "Maynaguri",
    pincode: "735224", location: { type: "Point", coordinates: [88.82, 26.56] },
    receiverName: "Test", receiverPhone: "9876543210", isDefault: true,
  },
  {
    _id: "bbbbbbbbbbbbbbbbbbbbbbbb", tag: "Work", house: "5", area: "Station Rd", city: "Maynaguri",
    pincode: "735224", location: { type: "Point", coordinates: [88.83, 26.57] },
    receiverName: "Test Work", receiverPhone: "9888888888",
  },
];

const F = {
  "/orders": { success: true, data: ORDERS },
  "/users/profile": { success: true, data: { _id: "u1", name: "Test User", email: "test@example.com", phone: "9876543210" } },
  "/users/addresses": { success: true, data: ADDRESSES },
  "/restaurants": { success: true, data: [] },
  "restaurants/serviceability": { success: true, data: { serviceable: true, maxDeliveryDistanceKm: 10, nearestDistanceKm: 2.4 } },
};

/* A profile with no usable receiver details, so the receiver card stays
   visible and can be filled by the test (mirrors a real signup placeholder). */
const F_NOACCT = { ...F, "/users/profile": { success: true, data: { _id: "u1", name: "Eatswada User", email: "test@example.com", phone: "" } } };

/* A signed-out visitor: the real backend answers every authed GET with 401.
   Using 200s here let `loadAddresses()` (which legacy fires in parallel with the
   redirecting `loadProfile()`) win the race on some runs and write
   `nearbite_address` before the redirect landed — a legacy-internal race, not a
   port difference. 401 removes it. */
const F_LOGGED_OUT = {
  ...F,
  "/users/profile": { __status: 401, body: { success: false, message: "Unauthorized" } },
  "/users/addresses": { __status: 401, body: { success: false, message: "Unauthorized" } },
  "/orders": { __status: 401, body: { success: false, message: "Unauthorized" } },
};

const TOKEN = { local: { nearbite_token: "FAKE_SESSION_TOKEN" } };
const SEED_CART = { local: JSON.parse(fs.readFileSync("scripts/fixtures/seed-cart-plain.json", "utf8")) };
const MAP_SEED = {
  local: {
    nearbite_token: "FAKE_SESSION_TOKEN",
    nearbite_onboarding_location: JSON.stringify({ latitude: 26.56, longitude: 88.82, capturedAt: 1793000000000 }),
    nearbite_onboarding_geocode: JSON.stringify({ area: "Main Road", city: "Maynaguri", state: "West Bengal", pincode: "735224" }),
  },
};

/* ══════════════════════════ ORDERS ══════════════════════════ */
await runCase(browser, "orders logged out", {
  legacyPath: "/orders.html",
  newPath: "/orders",
  fixtures: F_LOGGED_OUT,
  writes: {},
  settle: 800,
});

await runCase(browser, "orders populated", {
  legacyPath: "/orders.html",
  newPath: "/orders",
  seed: TOKEN,
  fixtures: F,
  writes: {},
  settle: 900,
});

await runCase(browser, "orders search filter", {
  legacyPath: "/orders.html",
  newPath: "/orders",
  seed: TOKEN,
  fixtures: F,
  writes: {},
  steps: [
    async (p) => p.fill("#order-search", "Test"),
    async (p) => p.click("#search-clear"),
  ],
  stepWait: 500,
});

await runCase(browser, "orders three-dot menu + invoice", {
  legacyPath: "/orders.html",
  newPath: "/orders",
  seed: TOKEN,
  fixtures: F,
  writes: {},
  steps: [
    async (p) => p.evaluate(() => document.querySelector(".ord-menu-btn").click()),
    async (p) => p.evaluate(() => window.showInvoice("ord0000000000000000000004")),
    async (p) => p.evaluate(() => window.closeInvoice()),
  ],
  stepWait: 400,
});

await runCase(browser, "orders remove cancelled (hide locally)", {
  legacyPath: "/orders.html",
  newPath: "/orders",
  seed: TOKEN,
  fixtures: F,
  writes: {},
  steps: [
    async (p) => p.evaluate(() => window.deleteCancelledOrder("ord0000000000000000000009")),
  ],
  stepWait: 500,
});

await runCase(browser, "orders reorder (POST /cart/add)", {
  legacyPath: "/orders.html",
  newPath: "/orders",
  seed: TOKEN,
  fixtures: F,
  writes: { "POST /cart/add": { success: true } },
  steps: [
    async (p) => p.evaluate(() => window.reorder("ord0000000000000000000004")),
  ],
  stepWait: 400,
});

await runCase(browser, "orders 401 mid-session", {
  legacyPath: "/orders.html",
  newPath: "/orders",
  seed: TOKEN,
  fixtures: { ...F, "/orders": { __status: 401, __delay: 300, body: { success: false, message: "Unauthorized" } } },
  writes: {},
  settle: 900,
});

await runCase(browser, "orders empty", {
  legacyPath: "/orders.html",
  newPath: "/orders",
  seed: TOKEN,
  fixtures: { ...F, "/orders": { success: true, data: [] } },
  writes: {},
  settle: 900,
});

/* ══════════════════════════ PROFILE ══════════════════════════ */
await runCase(browser, "profile default", {
  legacyPath: "/profile.html",
  newPath: "/profile",
  seed: TOKEN,
  fixtures: F,
  writes: {},
  settle: 900,
});

await runCase(browser, "profile edit + save", {
  legacyPath: "/profile.html",
  newPath: "/profile",
  seed: TOKEN,
  fixtures: F,
  writes: { "PUT /users/profile": { success: true, data: { _id: "u1", name: "New Name", email: "new@example.com", phone: "9876543210" } } },
  steps: [
    async (p) => p.evaluate(() => document.getElementById("editProfileBtn").click()),
    async (p) => p.fill("#editName", "New Name"),
    async (p) => p.fill("#editEmail", "new@example.com"),
    async (p) => p.click("#saveEdit"),
  ],
  stepWait: 700,
});

await runCase(browser, "profile edit invalid name", {
  legacyPath: "/profile.html",
  newPath: "/profile",
  seed: TOKEN,
  fixtures: F,
  writes: {},
  steps: [
    async (p) => p.evaluate(() => document.getElementById("editProfileBtn").click()),
    async (p) => p.fill("#editName", "A"),
    async (p) => p.click("#saveEdit"),
  ],
  stepWait: 500,
});

await runCase(browser, "profile logout", {
  legacyPath: "/profile.html",
  newPath: "/profile",
  seed: TOKEN,
  fixtures: F,
  writes: {},
  steps: [async (p) => p.evaluate(() => document.getElementById("logoutBtn").click())],
  stepWait: 900,
});

await runCase(browser, "profile logged out", {
  legacyPath: "/profile.html",
  newPath: "/profile",
  fixtures: F_LOGGED_OUT,
  writes: {},
  settle: 900,
});

/* ══════════════════════════ ADDRESS ══════════════════════════ */
await runCase(browser, "address manage list", {
  legacyPath: "/address.html",
  newPath: "/address",
  seed: TOKEN,
  fixtures: F,
  writes: {},
  settle: 900,
});

await runCase(browser, "address select view", {
  legacyPath: "/address.html?view=select",
  newPath: "/address?view=select",
  seed: TOKEN,
  fixtures: F,
  writes: {},
  settle: 900,
});

await runCase(browser, "address add (POST /users/addresses)", {
  legacyPath: "/address.html?new=1",
  newPath: "/address?new=1",
  seed: MAP_SEED,
  fixtures: F_NOACCT,
  writes: { "POST /users/addresses": { success: true, data: { _id: "newaddr0000000000000000" } } },
  steps: [
    async (p) => p.evaluate(() => document.getElementById("useAccount").click()),
    async (p) => p.fill("#area", "Main Road"),
    async (p) => p.fill("#landmark", "Near the blue shop"),
    async (p) => p.fill("#receiverName", "Test Receiver"),
    async (p) => p.fill("#receiverPhone", "9876543210"),
    async (p) => p.click("#save"),
  ],
  stepWait: 600,
});

await runCase(browser, "address edit (PUT /users/addresses/:id)", {
  legacyPath: "/address.html",
  newPath: "/address",
  seed: TOKEN,
  fixtures: F,
  writes: { "PUT /users/addresses/aaaaaaaaaaaaaaaaaaaaaaaa": { success: true, data: { _id: "aaaaaaaaaaaaaaaaaaaaaaaa" } } },
  steps: [
    async (p) => p.evaluate(() => window.editAddress("aaaaaaaaaaaaaaaaaaaaaaaa")),
    async (p) => p.fill("#landmark", "Updated landmark"),
    async (p) => p.click("#save"),
  ],
  stepWait: 600,
});

await runCase(browser, "address set default (PATCH)", {
  legacyPath: "/address.html",
  newPath: "/address",
  seed: TOKEN,
  fixtures: F,
  writes: { "PATCH /users/addresses/bbbbbbbbbbbbbbbbbbbbbbbb/default": { success: true } },
  steps: [
    async (p) => p.evaluate(() => window.setDefault("bbbbbbbbbbbbbbbbbbbbbbbb")),
  ],
  stepWait: 600,
});

await runCase(browser, "address delete (DELETE)", {
  legacyPath: "/address.html",
  newPath: "/address",
  seed: TOKEN,
  fixtures: F,
  writes: { "DELETE /users/addresses/bbbbbbbbbbbbbbbbbbbbbbbb": { success: true } },
  steps: [
    async (p) => p.evaluate(() => window.deleteAddress("bbbbbbbbbbbbbbbbbbbbbbbb")),
  ],
  stepWait: 700,
});

await runCase(browser, "address select one (redirect)", {
  legacyPath: "/address.html?view=select",
  newPath: "/address?view=select",
  seed: TOKEN,
  fixtures: F,
  writes: {},
  steps: [
    async (p) => p.evaluate(() => window.useAddressById("bbbbbbbbbbbbbbbbbbbbbbbb")),
  ],
  stepWait: 700,
});

await runCase(browser, "address 401 mid-session", {
  legacyPath: "/address.html",
  newPath: "/address",
  seed: TOKEN,
  fixtures: { ...F, "/users/addresses": { __status: 401, body: { success: false, message: "Unauthorized" } } },
  writes: {},
  settle: 900,
});

/* ══════════════════════════ ADDRESS-NEW ══════════════════════════ */
await runCase(browser, "address-new editor", {
  legacyPath: "/address-new.html",
  newPath: "/address-new",
  seed: MAP_SEED,
  fixtures: F,
  writes: {},
  settle: 900,
});

await runCase(browser, "address-new save", {
  /* address-new.html forces #receiverSec{display:none!important} — its
     receiver details always come from the account (MODE 1 setup). The fixture
     therefore supplies a usable account. */
  legacyPath: "/address-new.html",
  newPath: "/address-new",
  seed: MAP_SEED,
  fixtures: F,
  writes: { "POST /users/addresses": { success: true, data: { _id: "newaddr0000000000000000" } } },
  steps: [
    async (p) => p.fill("#house", "12"),
    async (p) => p.fill("#area", "Main Road"),
    async (p) => p.click("#save"),
  ],
  stepWait: 600,
});

/* ══════════════════════════ TRACK ORDER ══════════════════════════ */
for (const [label, id] of [
  ["out for delivery", "ord0000000000000000000001"],
  ["preparing", "ord0000000000000000000002"],
  ["placed", "ord0000000000000000000003"],
  ["delivered", "ord0000000000000000000004"],
  ["cancelled", "ord0000000000000000000009"],
]) {
  await runCase(browser, `track ${label}`, {
    legacyPath: `/track-order.html?id=${id}`,
    newPath: `/track-order?id=${id}`,
    seed: TOKEN,
    fixtures: F,
    writes: {},
    settle: 1000,
  });
}

await runCase(browser, "track cancel (PUT /orders/:id/cancel)", {
  legacyPath: "/track-order.html?id=ord0000000000000000000003",
  newPath: "/track-order?id=ord0000000000000000000003",
  seed: TOKEN,
  fixtures: F,
  writes: { "PUT /orders/ord0000000000000000000003/cancel": { success: true } },
  steps: [
    async (p) => p.evaluate(() => document.getElementById("help-cancel").click()),
    async (p) => p.fill("#cancel-reason-input", "Changed my mind"),
    async (p) => p.evaluate(() => document.getElementById("confirm-cancel-btn").click()),
  ],
  stepWait: 700,
});

await runCase(browser, "track invoice sheet", {
  legacyPath: "/track-order.html?id=ord0000000000000000000004",
  newPath: "/track-order?id=ord0000000000000000000004",
  seed: TOKEN,
  fixtures: F,
  writes: {},
  steps: [async (p) => p.evaluate(() => document.getElementById("invoice-btn").click())],
  stepWait: 400,
});

await runCase(browser, "track review submit (POST /orders/:id/review)", {
  legacyPath: "/track-order.html?id=ord0000000000000000000004",
  newPath: "/track-order?id=ord0000000000000000000004",
  seed: TOKEN,
  fixtures: { ...F, "/orders/ord0000000000000000000004/review": { success: true } },
  writes: { "POST /orders/ord0000000000000000000004/review": { success: true } },
  steps: [
    async (p) => p.evaluate(() => document.querySelector("#food-rating-stars i[data-value='5']").click()),
    async (p) => p.evaluate(() => document.querySelector("#rider-rating-stars i[data-value='4']").click()),
    async (p) => p.fill("#review-text", "Great food, quick delivery"),
    async (p) => p.evaluate(() => document.getElementById("rating-submit").click()),
  ],
  stepWait: 700,
});

await runCase(browser, "track no id (redirect)", {
  legacyPath: "/track-order.html",
  newPath: "/track-order",
  seed: TOKEN,
  fixtures: F,
  writes: {},
  settle: 800,
});

await runCase(browser, "track 401 mid-session", {
  legacyPath: "/track-order.html?id=ord0000000000000000000001",
  newPath: "/track-order?id=ord0000000000000000000001",
  seed: TOKEN,
  fixtures: { ...F, "/orders": { __status: 401, body: { success: false } } },
  writes: {},
  settle: 900,
});

/* ══════════════════════════ T5 — pure functions ══════════════════════════
   Every formatter / status mapper / phone masker is called with the same inputs
   on the legacy page and its port; the return values must deep-equal. All the
   functions live on `window.EatswadaOrderStatus` (order-status.js) plus the
   page-local helpers each page promotes to `window`. */
{
  console.log("\n== T5 pure functions (legacy vs new) ==");
  const ORDER = {
    _id: "ord0000000000000000000001", orderNumber: "EW100001", status: "out_for_delivery",
    createdAt: "2026-10-20T09:00:00.000Z", updatedAt: "2026-10-20T09:20:00.000Z",
    total: 412.5, subtotal: 380, deliveryFee: 25, paymentMethod: "cod", paymentStatus: "pending",
    restaurantName: "Test Grill", riderName: "Test Rider", riderPhone: "9000000000",
    restaurantPhone: "9876543210", estimatedDeliveryTime: "2026-10-20T09:45:00.000Z",
    statusHistory: [{ status: "placed", at: "2026-10-20T09:00:00.000Z" }],
  };
  const PAID = { ...ORDER, paymentMethod: "upi", paymentStatus: "paid", status: "delivered" };
  const CANC = { ...ORDER, status: "cancelled", refundStatus: "refunded" };
  const cases = [
    ["norm('  OuT_FoR_Delivery ')", "window.EatswadaOrderStatus.norm('  OuT_FoR_Delivery ')"],
    ["info(ORDER).label", "window.EatswadaOrderStatus.info(" + JSON.stringify(ORDER) + ").label"],
    ["isActive(ORDER)", "window.EatswadaOrderStatus.isActive(" + JSON.stringify(ORDER) + ")"],
    ["isRefunded(CANC)", "window.EatswadaOrderStatus.isRefunded(" + JSON.stringify(CANC) + ")"],
    ["riderAssigned(ORDER)", "window.EatswadaOrderStatus.riderAssigned(" + JSON.stringify(ORDER) + ")"],
    ["payment(PAID).label", "window.EatswadaOrderStatus.payment(" + JSON.stringify(PAID) + ").label"],
    ["payment(ORDER).short", "window.EatswadaOrderStatus.payment(" + JSON.stringify(ORDER) + ").short"],
    ["inr(412.5)", "window.EatswadaOrderStatus.inr(412.5)"],
    ["inr(null)", "window.EatswadaOrderStatus.inr(null)"],
    ["methodLabel(ORDER)", "window.EatswadaOrderStatus.methodLabel(" + JSON.stringify(ORDER) + ")"],
    ["headline(ORDER)", "window.EatswadaOrderStatus.headline(" + JSON.stringify(ORDER) + ")"],
    ["restaurantPhone(ORDER)", "window.EatswadaOrderStatus.restaurantPhone(" + JSON.stringify(ORDER) + ")"],
    ["riderPhone(ORDER)", "window.EatswadaOrderStatus.riderPhone(" + JSON.stringify(ORDER) + ")"],
    ["fmtTime('2026-10-20T09:20:00.000Z')", "window.EatswadaOrderStatus.fmtTime('2026-10-20T09:20:00.000Z')"],
    ["partialCod(ORDER)", "JSON.stringify(window.EatswadaOrderStatus.partialCod(" + JSON.stringify(ORDER) + "))"],
    ["timeline(ORDER).length", "window.EatswadaOrderStatus.timeline(" + JSON.stringify(ORDER) + ").length"],
  ];
  const out = {};
  for (const [tag, base, path] of [["legacy", legacyBase, "/track-order.html?id=ord0000000000000000000001"], ["new", newBase, "/track-order?id=ord0000000000000000000001"]]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(SEED_FN, TOKEN);
    await ctx.addInitScript(fakeLeafletSource());
    const page = await ctx.newPage();
    await installStubs(page, F, { writes: {} });
    await page.goto(strip(base) + path, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    out[tag] = await page.evaluate((exprs) => {
      const res = {};
      for (const [label, expr] of exprs) {
        try { res[label] = String(eval(expr)); } catch (e) { res[label] = "THREW:" + e.name; }
      }
      return res;
    }, cases);
    await ctx.close();
  }
  for (const [label] of cases) check(`T5 track-order: ${label}`, out.legacy[label], out.new[label]);

  /* Address normalisers / distance / ETA helpers. */
  const addrCases = [
    ["EatswadaAddressModel.normalizeList", "JSON.stringify(window.EatswadaAddressModel.normalizeList({data:[{_id:'a',house:'1',area:'X'}]}))"],
    ["addressLines", "JSON.stringify((window.EatswadaAddressModel.addressLines||function(){return null})({house:'12',area:'Main Road',city:'Maynaguri',pincode:'735224'}))"],
  ];
  const aout = {};
  for (const [tag, base, path] of [["legacy", legacyBase, "/address.html"], ["new", newBase, "/address"]]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(SEED_FN, TOKEN);
    await ctx.addInitScript(fakeLeafletSource());
    const page = await ctx.newPage();
    await installStubs(page, F, { writes: {} });
    await page.goto(strip(base) + path, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(900);
    aout[tag] = await page.evaluate((exprs) => {
      const res = {};
      for (const [label, expr] of exprs) {
        try { res[label] = String(eval(expr)); } catch (e) { res[label] = "THREW:" + e.name; }
      }
      return res;
    }, addrCases);
    await ctx.close();
  }
  for (const [label] of addrCases) check(`T5 address: ${label}`, aout.legacy[label], aout.new[label]);
}

/* ══════════════════════════ T7 — cross-page flows ══════════════════════════
   The three flows the brief calls out, each run end-to-end on both sides and
   compared at the end:
     a) /cart -> address -> back to cart  (selected address + delivery fee)
     b) order placed -> /orders shows it
     c) /payment-success -> /track-order?id=…  (the tracking link target)
   All writes are stubbed; the comparison is the resulting localStorage + the
   final URL, which is what the next page reads. */
{
  console.log("\n== T7 cross-page flows ==");

  /* a) cart -> address (select) -> back to cart */
  const cartFlow = async (base, cartPath, addrPath) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(SEED_FN, { local: { ...TOKEN.local, ...SEED_CART.local } });
    await ctx.addInitScript(fakeFirebaseSource());
    await ctx.addInitScript(fakeLeafletSource());
    const page = await ctx.newPage();
    await installStubs(page, F, { writes: {} });
    await page.goto(strip(base) + addrPath, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(900);
    await page.evaluate(() => window.useAddressById("bbbbbbbbbbbbbbbbbbbbbbbb"));
    await page.waitForTimeout(700);
    const store = await page.evaluate(() => {
      const out = {};
      for (const k of ["nearbite_address", "nearbite_selected_address_id", "nearbite_cart", "nearbite_delivery_fee"]) out[k] = localStorage.getItem(k);
      return out;
    });
    await ctx.close();
    return store;
  };
  const cartStore = { legacy: await cartFlow(legacyBase, "/cart.html", "/address.html?return=cart"), new: await cartFlow(newBase, "/cart", "/address?return=cart") };
  for (const k of ["nearbite_address", "nearbite_selected_address_id", "nearbite_delivery_fee"]) check(`T7a cart->address: ${k}`, cartStore.legacy[k], cartStore.new[k]);

  /* b) order placed state -> /orders shows it (fixture supplies the placed order) */
  const ordersSeen = async (base, path) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(SEED_FN, TOKEN);
    await ctx.addInitScript(fakeLeafletSource());
    const page = await ctx.newPage();
    await installStubs(page, F, { writes: {} });
    await page.goto(strip(base) + path, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    const seen = await page.evaluate(() => {
      const ids = [...document.querySelectorAll("[data-order-id]")].map((e) => e.getAttribute("data-order-id"));
      const stat = document.getElementById("stat-total");
      return { ids, stat: stat ? stat.innerText : null };
    });
    await ctx.close();
    return seen;
  };
  const seen = { legacy: await ordersSeen(legacyBase, "/orders.html"), new: await ordersSeen(newBase, "/orders") };
  check("T7b placed order appears in /orders", seen.legacy, seen.new);

  /* c) /payment-success -> /track-order?id=… link target */
  const trackLink = async (base, successPath) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(SEED_FN, TOKEN);
    await ctx.addInitScript(fakeLeafletSource());
    const page = await ctx.newPage();
    await installStubs(page, F, { writes: {} });
    await page.goto(strip(base) + successPath, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(900);
    const links = await page.evaluate(() =>
      [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")).filter((h) => /track-order/.test(h)).map((h) => h.replace(/\.html/, ""))
    );
    await ctx.close();
    return links;
  };
  const links = { legacy: await trackLink(legacyBase, "/payment-success.html"), new: await trackLink(newBase, "/payment-success") };
  check("T7c payment-success -> /track-order link", links.legacy, links.new);
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) {
  console.log("failures:");
  for (const f of failures) console.log("  - " + f);
}
process.exit(fail === 0 ? 0 : 1);
