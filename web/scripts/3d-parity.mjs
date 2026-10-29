// Phase 3d — partner + support / info parity harness (T3 / T4 / T5 / T6 / T7).
//
// Usage: node scripts/3d-parity.mjs [legacyBase] [newBase]
//   defaults: legacy http://localhost:8080  new http://localhost:3000
//
// NO REAL BACKEND, EVER:
//   * the Firebase CDN is aborted and a fake `window.firebase` is injected
//     before any page script;
//   * every non-GET request is stubbed; the recorder keeps method + URL +
//     headers + exact body and FAILS on any unstubbed write (T4);
//   * fixtures use only fake names / phones / emails / addresses / tokens.
//
// For each case the harness runs legacy and new side by side with the same
// seed + stubs and compares, after every step:
//   * the DOM/state signature (visible text, control classes, disabled state,
//     panel visibility, storage keys, final URL) — T3
//   * the recorded writes (method, path, exact body, content-type) — T4
//   * pure functions called with identical inputs — T5
//   * the GET request counts (boot-once) — T6
//   * cross-page flows (order-help / order-support / rate-us reached from
//     /orders and /track-order; application-status after apply; the
//     restaurant-details redirect target from a restaurant card) — T7
import { chromium } from "playwright";
import fs from "node:fs";
import { fakeFirebaseSource, install3dStubs, signature3d, normUrl } from "./lib/phase3d.mjs";

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
  } else {
    fail++;
    failures.push(label);
    console.log(`  FAIL  ${label}`);
    console.log(`        legacy: ${sa}`);
    console.log(`        new:    ${sb}`);
  }
}

const BASE = JSON.parse(fs.readFileSync("scripts/fixtures/3d-fixtures.json", "utf8"));
delete BASE._comment;

const SEED_FN = (entries) => {
  for (const [k, v] of Object.entries((entries && entries.local) || {}))
    window.localStorage.setItem(k, v);
  for (const [k, v] of Object.entries((entries && entries.session) || {}))
    window.sessionStorage.setItem(k, v);
};
const TOKEN = { local: { nearbite_token: "FAKE_SESSION_TOKEN" }, session: {} };

/* Normalise a multipart body: drop the boundary string but keep every field
   name, filename, part content-type and the part sizes (T4 for file uploads). */
function multipartShape(body, contentType) {
  if (!body || !/multipart\/form-data/i.test(contentType || "")) return body;
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  const boundary = (m && (m[1] || m[2]) || "").trim();
  if (!boundary) return body;
  const parts = body.split("--" + boundary).slice(1, -1);
  return parts.map((p) => {
    const head = p.split("\r\n\r\n")[0].replace(/^\r\n/, "");
    const content = p.split("\r\n\r\n").slice(1).join("\r\n\r\n").replace(/\r\n$/, "");
    const name = /name="([^"]*)"/.exec(head);
    const file = /filename="([^"]*)"/.exec(head);
    const ct = /Content-Type:\s*([^\r\n]+)/i.exec(head);
    return {
      name: name ? name[1] : null,
      filename: file ? file[1] : null,
      contentType: ct ? ct[1].trim() : null,
      size: content.length,
    };
  });
}

const writableWrites = (recorded) =>
  recorded.map((r) => ({
    method: r.method,
    path: r.path,
    contentType: (r.headers["content-type"] || "").split(";")[0],
    body: multipartShape(r.body, r.headers["content-type"]),
  }));

const sortCounts = (counts) =>
  Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));

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
  await ctx.addInitScript(fakeFirebaseSource({ currentUser: null }));
  /* Frozen clock: dates rendered by toLocaleDateString / toLocaleString would
     otherwise differ between the two runs (they run minutes apart). */
  await ctx.addInitScript(() => {
    Date.now = () => 1793000000000;
  });
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.accept());
  const stub = await install3dStubs(page, { ...BASE, ...(cfg.fixtures || {}) }, { writes: cfg.writes || {} });
  await page.goto(strip(base) + path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(cfg.settle ?? 900);
  await settleUrl(page);
  const sigs = [await signature3d(page, cfg.ids)];
  for (const step of cfg.steps || []) {
    await step(page);
    await page.waitForTimeout(cfg.stepWait ?? 500);
    await settleUrl(page);
    sigs.push(await signature3d(page, cfg.ids));
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
    check(`${name}: step ${i} bodyClass`, a.bodyClass, b.bodyClass);
    check(`${name}: step ${i} ids`, a.ids, b.ids);
    check(`${name}: step ${i} values`, a.values, b.values);
    check(`${name}: step ${i} classes`, a.classes, b.classes);
    check(`${name}: step ${i} hidden`, a.hidden, b.hidden);
    check(`${name}: step ${i} disabled`, a.disabled, b.disabled);
    check(`${name}: step ${i} step`, a.step, b.step);
    check(`${name}: step ${i} review`, a.review, b.review);
    check(`${name}: step ${i} remaining`, a.remaining, b.remaining);
    check(`${name}: step ${i} requestHistory`, a.requestHistory, b.requestHistory);
    check(`${name}: step ${i} statusPill`, a.statusPill, b.statusPill);
    check(`${name}: step ${i} details`, a.details, b.details);
    check(`${name}: step ${i} view`, a.view, b.view);
    check(`${name}: step ${i} contactGrid`, a.contactGrid, b.contactGrid);
    check(`${name}: step ${i} orderHelpCard`, a.orderHelpCard, b.orderHelpCard);
    check(`${name}: step ${i} out`, a.out, b.out);
    check(`${name}: step ${i} toast`, a.toast, b.toast);
    check(`${name}: step ${i} storage`, { local: a.local, session: a.session }, { local: b.local, session: b.session });
  }
  check(`${name}: writes`, legacy.writes, neu.writes);
  check(`${name}: final url`, legacy.finalUrl, neu.finalUrl);
  check(`${name}: GET boot counts`, sortCounts(legacy.counts), sortCounts(neu.counts));
}

/* ── fill helpers ─────────────────────────────────────────────────────── */
const fill = (id, v) => (p) => p.fill("#" + id, v);
/* longitude / latitude are `readonly` (auto-filled by geolocation), so set
   their value directly instead of using fill(). */
const setVal = (id, v) => (p) =>
  p.evaluate(([i, val]) => { const el = document.getElementById(i); el.value = val; el.dispatchEvent(new Event("input", { bubbles: true })); }, [id, v]);
const click = (sel) => (p) => p.evaluate((s) => document.querySelector(s).click(), sel);
const clickId = (id) => (p) => p.evaluate((s) => document.getElementById(s).click(), id);
const evalIn = (fn) => (p) => p.evaluate(fn);

/* 1x1 fake PNG — used to drive the multipart evidence-photo upload (T4). */
const FAKE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);
const setFile = (sel, name, mime, buf) => (p) =>
  p.setInputFiles(sel, { name, mimeType: mime, buffer: buf });

/* The full apply wizard, used to reach review + submit. */
async function fillApply(p) {
  await p.evaluate(() => {
    document.querySelector('#businessTypeChoices [data-value="restaurant"]').click();
    document.getElementById("nextBtn").click();
  });
  await p.waitForTimeout(120);
  await p.fill("#ownerName", "Test Owner");
  await p.fill("#phone", "9000000000");
  await p.fill("#email", "test@example.com");
  await p.fill("#restaurantName", "Test Kitchen");
  await p.evaluate(() => document.getElementById("nextBtn").click());
  await p.waitForTimeout(120);
  await p.fill("#cuisine", "Biryani");
  await p.fill("#address", "12 Main Road");
  await p.evaluate(() => { const lon = document.getElementById("longitude"); lon.value = "88.82"; const lat = document.getElementById("latitude"); lat.value = "26.56"; });
  await p.evaluate(() => document.getElementById("nextBtn").click());
  await p.waitForTimeout(120);
  await p.fill("#fssai", "12345678901234");
  await p.evaluate(() => document.getElementById("nextBtn").click());
  await p.waitForTimeout(120);
  await p.evaluate(() => document.querySelector('#deliveryChoices [data-value="eatswada"]').click());
  await p.evaluate(() => document.getElementById("nextBtn").click());
  await p.waitForTimeout(120);
  await p.evaluate(() => document.getElementById("nextBtn").click());
}

const browser = await chromium.launch();

/* ══════════════════════════ G1 — PARTNER ══════════════════════════ */
await runCase(browser, "partner-with-us", {
  legacyPath: "/partner-with-us.html",
  newPath: "/partner-with-us",
  ids: ["contactGrid"],
});

await runCase(browser, "apply default + validation", {
  legacyPath: "/apply.html",
  newPath: "/apply",
  seed: TOKEN,
  ids: ["stepLabel"],
  steps: [
    clickId("nextBtn"), // step 0 -> "Choose Restaurant or Cloud Kitchen"
    evalIn(() => document.querySelector('#businessTypeChoices [data-value="cloud_kitchen"]').click()),
    clickId("nextBtn"),
    clickId("nextBtn"), // step 1 validation errors
    fill("ownerName", "Test Owner"),
    fill("phone", "123"), // invalid phone
    fill("email", "not-an-email"), // invalid email
    fill("restaurantName", "Test Kitchen"),
    clickId("nextBtn"),
  ],
  stepWait: 350,
});

await runCase(browser, "apply hours validation", {
  legacyPath: "/apply.html",
  newPath: "/apply",
  seed: TOKEN,
  ids: ["stepLabel"],
  steps: [
    evalIn(() => document.querySelector('#businessTypeChoices [data-value="restaurant"]').click()),
    clickId("nextBtn"),
    fill("ownerName", "Test Owner"),
    fill("phone", "9000000000"),
    fill("email", "test@example.com"),
    fill("restaurantName", "Test Kitchen"),
    clickId("nextBtn"),
    fill("cuisine", "Biryani"),
    fill("address", "12 Main Road"),
    setVal("longitude", "88.82"),
    setVal("latitude", "26.56"),
    clickId("nextBtn"),
    fill("fssai", "12345678901234"),
    clickId("nextBtn"),
    evalIn(() => document.querySelector('#deliveryChoices [data-value="self"]').click()),
    clickId("nextBtn"),
    // same opens/closes on Monday -> validation error
    evalIn(() => { const o = document.querySelector('[data-opens][data-day="monday"]'); o.value = "10:00"; document.querySelector('[data-closes][data-day="monday"]').value = "10:00"; }),
    clickId("nextBtn"),
    // mark Sunday closed
    evalIn(() => document.querySelector('[data-closed][data-day="sunday"]').click()),
    clickId("nextBtn"),
  ],
  stepWait: 350,
});

await runCase(browser, "apply review + submit (POST)", {
  legacyPath: "/apply.html",
  newPath: "/apply",
  seed: TOKEN,
  ids: ["stepLabel", "result"],
  writes: { "POST /vendor-applications": { success: true, data: { id: "app00000000000000000002" } } },
  steps: [fillApply, clickId("submitBtn")],
  stepWait: 600,
});

await runCase(browser, "apply needs-changes resubmit (PATCH)", {
  legacyPath: "/apply.html",
  newPath: "/apply",
  seed: TOKEN,
  ids: ["stepLabel", "result"],
  fixtures: {
    "/vendor-applications/mine": { success: true, data: { id: "app00000000000000000001", status: "needs_changes", changeRequest: "Update your opening hours.", businessType: "restaurant", deliveryMode: "self_delivery", ownerName: "Test Owner", restaurantName: "Test Kitchen", email: "test@example.com", phone: "9000000000", cuisine: "Biryani", address: "12 Main Road, Maynaguri", description: "A small kitchen", fssaiLicenseNumber: "12345678901234", location: { type: "Point", coordinates: [88.82, 26.56] }, openingHours: { monday: { closed: false, opensAt: "10:00", closesAt: "22:00" } }, createdAt: "2026-10-01T09:00:00.000Z" } },
  },
  writes: { "PATCH /vendor-applications/mine": { success: true, data: { id: "app00000000000000000001" } } },
  steps: [clickId("submitBtn")],
  stepWait: 600,
});

await runCase(browser, "apply logged-out redirect", {
  legacyPath: "/apply.html",
  newPath: "/apply",
  ids: ["stepLabel"],
});

for (const [label, data] of [
  ["pending", { status: "pending", businessType: "restaurant", deliveryMode: "eatswada_rider", cuisine: ["Biryani"] }],
  ["under_review", { status: "under_review", businessType: "cloud_kitchen", deliveryMode: "self_delivery", cuisine: "Biryani" }],
  ["needs_changes", { status: "needs_changes", changeRequest: "Please upload a clearer FSSAI licence photo.", businessType: "restaurant", deliveryMode: "eatswada_rider", cuisine: "Biryani" }],
  ["rejected", { status: "rejected", rejectionReason: "We are not onboarding new partners in this area right now.", businessType: "restaurant", deliveryMode: "eatswada_rider", cuisine: "Biryani" }],
  ["approved", { status: "approved", businessType: "restaurant", deliveryMode: "eatswada_rider", cuisine: "Biryani" }],
]) {
  await runCase(browser, `application-status ${label}`, {
    legacyPath: "/application-status.html",
    newPath: "/application-status",
    seed: TOKEN,
    ids: ["stateTitle", "stateDesc", "statusPill", "errorText"],
    fixtures: {
      "/vendor-applications/mine": { success: true, data: { id: "app00000000000000000001", ownerName: "Test Owner", restaurantName: "Test Kitchen", email: "test@example.com", phone: "9000000000", createdAt: "2026-10-01T09:00:00.000Z", ...data } },
    },
  });
}

await runCase(browser, "application-status empty (404)", {
  legacyPath: "/application-status.html",
  newPath: "/application-status",
  seed: TOKEN,
  ids: ["stateTitle", "stateDesc"],
  fixtures: { "/vendor-applications/mine": { __status__: 404, __body__: { success: false, message: "Not found" } } },
});

await runCase(browser, "application-status error (500)", {
  legacyPath: "/application-status.html",
  newPath: "/application-status",
  seed: TOKEN,
  ids: ["errorText"],
  fixtures: { "/vendor-applications/mine": { __status__: 500, __body__: { success: false, message: "Could not load" } } },
});

await runCase(browser, "application-status logged-out redirect", {
  legacyPath: "/application-status.html",
  newPath: "/application-status",
  ids: ["stateTitle"],
});

/* ══════════════════════════ G2 — SUPPORT / INFO ══════════════════════════ */
await runCase(browser, "support logged-out", {
  legacyPath: "/support.html",
  newPath: "/support",
  ids: ["contactGrid", "orderHelpCard", "hoursNote"],
  steps: [click((".issue-btn"))],
});

await runCase(browser, "support logged-in", {
  legacyPath: "/support.html",
  newPath: "/support",
  seed: TOKEN,
  ids: ["contactGrid", "orderHelpCard", "hoursNote"],
  steps: [evalIn(() => window.reportIssue("Missing item"))],
});

await runCase(browser, "order-help", {
  legacyPath: "/order-help.html",
  newPath: "/order-help",
  ids: ["help", "report", "details", "contact"],
  steps: [
    evalIn(() => { const d = document.querySelector("details.oh-jump"); if (d) d.open = true; }),
    evalIn(() => { const d = document.querySelector("details.oh-jump"); if (d) d.open = false; }),
  ],
});

await runCase(browser, "order-support picker", {
  legacyPath: "/order-support.html",
  newPath: "/order-support",
  seed: TOKEN,
  ids: ["bar-title", "bar-sub"],
  steps: [click('[data-act="pick"]')],
});

await runCase(browser, "order-support home", {
  legacyPath: "/order-support.html?order=ord0000000000000000000001",
  newPath: "/order-support?order=ord0000000000000000000001",
  seed: TOKEN,
  ids: ["bar-title", "bar-sub"],
  steps: [click('[data-act="cat"][data-id="missing_wrong"]')],
});

await runCase(browser, "order-support detail + note + chat (POST ticket)", {
  legacyPath: "/order-support.html?order=ord0000000000000000000001",
  newPath: "/order-support?order=ord0000000000000000000001",
  seed: TOKEN,
  ids: ["bar-title", "bar-sub"],
  writes: { "POST /support/tickets": { success: true, data: { _id: "TKT-0001", messages: [] } } },
  steps: [
    click('[data-act="cat"][data-id="missing_wrong"]'),
    click('input[name="sub"][value="missing_items"]'),
    click('input[data-item="0"]'),
    evalIn(() => { const n = document.getElementById("note"); n.value = "One item was missing"; n.dispatchEvent(new Event("input", { bubbles: true })); }),
    click("#cta"),
  ],
  stepWait: 600,
});

await runCase(browser, "order-support chat send (POST message)", {
  legacyPath: "/order-support.html?order=ord0000000000000000000001&ticketId=TKT-0001",
  newPath: "/order-support?order=ord0000000000000000000001&ticketId=TKT-0001",
  seed: TOKEN,
  ids: ["bar-title", "bar-sub"],
  fixtures: { "/support/tickets": { success: true, data: [ { _id: "TKT-0001", orderId: "ord0000000000000000000001", status: "open", createdAt: "2026-10-20T11:00:00.000Z", messages: [] } ] } },
  writes: { "POST /support/tickets/TKT-0001/messages": { success: true, data: { _id: "TKT-0001", messages: [] } } },
  steps: [
    evalIn(() => { const t = document.getElementById("msg"); t.value = "Please help with my order"; t.dispatchEvent(new Event("input", { bubbles: true })); }),
    clickId("send"),
  ],
  stepWait: 600,
});

await runCase(browser, "order-support no orders", {
  legacyPath: "/order-support.html",
  newPath: "/order-support",
  seed: TOKEN,
  ids: ["bar-title"],
  fixtures: { "/orders": { success: true, data: [] } },
});

/* T4 — multipart evidence-photo upload. The detail screen for a photo-required
   issue shows a file picker; choosing a tiny fake PNG drives
   `window.EWUpload.image()` -> `POST /upload/customer-media` (multipart field
   "images", filename "photo.jpg"). The harness compares the part names,
   filenames, content-types and sizes (boundary ignored). */
await runCase(browser, "order-support evidence photo upload (multipart POST)", {
  legacyPath: "/order-support.html?order=ord0000000000000000000001",
  newPath: "/order-support?order=ord0000000000000000000001",
  seed: TOKEN,
  ids: ["bar-title", "bar-sub"],
  writes: {
    "POST /upload/customer-media": {
      success: true,
      data: { urls: ["https://res.cloudinary.com/txwuv4bz/image/upload/fake/photo.jpg"] },
    },
  },
  steps: [
    click('[data-act="cat"][data-id="missing_wrong"]'),
    click('input[name="sub"][value="missing_items"]'),
    setFile("#ph-input", "photo.jpg", "image/png", FAKE_PNG),
  ],
  stepWait: 700,
});

await runCase(browser, "order-support logged-out redirect", {
  legacyPath: "/order-support.html?order=ord0000000000000000000001",
  newPath: "/order-support?order=ord0000000000000000000001",
  ids: ["bar-title"],
});

await runCase(browser, "rate-us default + select + submit (POST)", {
  legacyPath: "/rate-us.html",
  newPath: "/rate-us",
  seed: TOKEN,
  ids: ["remaining", "message", "history", "count"],
  writes: { "POST /ratings": { success: true, data: { used: 2, remaining: 1 } } },
  steps: [
    click('.star[data-score="5"]'),
    evalIn(() => { const c = document.getElementById("comment"); c.value = "Great food and quick delivery"; c.dispatchEvent(new Event("input", { bubbles: true })); }),
    clickId("submit"),
  ],
  stepWait: 600,
});

await runCase(browser, "rate-us maxed out", {
  legacyPath: "/rate-us.html",
  newPath: "/rate-us",
  seed: TOKEN,
  ids: ["remaining", "message"],
  fixtures: { "/ratings/me": { success: true, data: { used: 3, max: 3, ratings: [ { score: 5, comment: "Excellent", createdAt: "2026-10-12T09:00:00.000Z" } ] } } },
});

await runCase(browser, "rate-us logged-out redirect", {
  legacyPath: "/rate-us.html",
  newPath: "/rate-us",
  ids: ["remaining"],
});

await runCase(browser, "storage-check", {
  legacyPath: "/storage-check.html",
  newPath: "/storage-check",
  ids: ["out"],
  settle: 1200,
});

await runCase(browser, "privacy-data default (nominee + history)", {
  legacyPath: "/privacy-data.html",
  newPath: "/privacy-data",
  seed: TOKEN,
  ids: ["nomineeName", "nomineeEmail", "nomineePhone", "nomineeRelationship", "requestHistory", "exportStatus"],
});

await runCase(browser, "privacy-data correction request (POST)", {
  legacyPath: "/privacy-data.html",
  newPath: "/privacy-data",
  seed: TOKEN,
  ids: ["correctionStatus", "correctionMessage"],
  writes: { "POST /privacy/requests": { success: true, data: { requestId: "REQ-0001" } } },
  steps: [
    evalIn(() => { document.getElementById("correctionMessage").value = "Please correct my phone number"; }),
    clickId("correctionBtn"),
  ],
  stepWait: 500,
});

await runCase(browser, "privacy-data grievance too short", {
  legacyPath: "/privacy-data.html",
  newPath: "/privacy-data",
  seed: TOKEN,
  ids: ["grievanceStatus"],
  steps: [
    evalIn(() => { document.getElementById("grievanceMessage").value = "hi"; }),
    clickId("grievanceBtn"),
  ],
  stepWait: 400,
});

await runCase(browser, "privacy-data save nominee (PUT)", {
  legacyPath: "/privacy-data.html",
  newPath: "/privacy-data",
  seed: TOKEN,
  ids: ["nomineeStatus"],
  writes: { "PUT /privacy/me/nominee": { success: true, data: {} } },
  steps: [
    fill("nomineeName", "Test Nominee"),
    fill("nomineeEmail", "nominee@example.com"),
    fill("nomineePhone", "9777777777"),
    fill("nomineeRelationship", "Sibling"),
    clickId("saveNomineeBtn"),
  ],
  stepWait: 500,
});

await runCase(browser, "privacy-data clear nominee (DELETE)", {
  legacyPath: "/privacy-data.html",
  newPath: "/privacy-data",
  seed: TOKEN,
  ids: ["nomineeStatus"],
  writes: { "DELETE /privacy/me/nominee": { success: true, data: {} } },
  steps: [clickId("clearNomineeBtn")],
  stepWait: 500,
});

await runCase(browser, "privacy-data export (GET)", {
  legacyPath: "/privacy-data.html",
  newPath: "/privacy-data",
  seed: TOKEN,
  ids: ["exportStatus"],
  steps: [clickId("exportBtn")],
  stepWait: 500,
});

await runCase(browser, "privacy-data delete guards", {
  legacyPath: "/privacy-data.html",
  newPath: "/privacy-data",
  seed: TOKEN,
  ids: ["deleteStatus"],
  steps: [
    clickId("deleteBtn"), // unchecked confirm
    evalIn(() => { document.getElementById("deleteConfirm").checked = true; }),
    clickId("deleteBtn"), // wrong phrase
    fill("deletePhrase", "DELETE ME"),
    clickId("deleteBtn"), // wrong phrase again
  ],
  stepWait: 400,
});

await runCase(browser, "privacy-data delete account (DELETE)", {
  legacyPath: "/privacy-data.html",
  newPath: "/privacy-data",
  seed: TOKEN,
  ids: ["deleteStatus"],
  writes: { "DELETE /privacy/me": { success: true, data: {} } },
  steps: [
    evalIn(() => { document.getElementById("deleteConfirm").checked = true; }),
    fill("deletePhrase", "DELETE MY ACCOUNT"),
    clickId("deleteBtn"),
  ],
  stepWait: 400,
});

await runCase(browser, "privacy-data logged-out redirect", {
  legacyPath: "/privacy-data.html",
  newPath: "/privacy-data",
  ids: ["exportStatus"],
});

/* ══════════════════════════ T5 — pure functions ══════════════════════════ */
{
  console.log("\n== T5 pure functions (legacy vs new) ==");
  const cases = {
    "support reportIssue (no contact configured)": "typeof window.reportIssue",
    "support goToLogin": "typeof window.goToLogin",
    "EatswadaOrderStatus.norm(' Out_For_Delivery ')": "window.EatswadaOrderStatus.norm(' Out_For_Delivery ')",
    "EatswadaOrderStatus.inr(349)": "window.EatswadaOrderStatus.inr(349)",
    "EatswadaOrderStatus.inr(null)": "window.EatswadaOrderStatus.inr(null)",
    "EatswadaOrderStatus.fmtTime('2026-10-20T09:20:00.000Z')": "window.EatswadaOrderStatus.fmtTime('2026-10-20T09:20:00.000Z')",
    "esc('<a>&')": "window.esc('<a>&')",
  };
  const out = {};
  for (const [tag, base, path] of [["legacy", legacyBase, "/order-support.html?order=ord0000000000000000000001"], ["new", newBase, "/order-support?order=ord0000000000000000000001"]]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(SEED_FN, TOKEN);
    await ctx.addInitScript(fakeFirebaseSource({}));
    const page = await ctx.newPage();
    await install3dStubs(page, BASE, { writes: {} });
    await page.goto(strip(base) + path, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    out[tag] = await page.evaluate((exprs) => {
      const res = {};
      for (const [label, expr] of Object.entries(exprs)) {
        try { res[label] = String(eval(expr)); } catch (e) { res[label] = "THREW:" + e.name; }
      }
      return res;
    }, cases);
    await ctx.close();
  }
  for (const label of Object.keys(cases)) check(`T5 order-support: ${label}`, out.legacy[label], out.new[label]);
}

/* ══════════════════════════ T7 — cross-page flows ══════════════════════════ */
{
  console.log("\n== T7 cross-page flows ==");

  /* a) /orders -> order-support?order=…  (the support button target) */
  const supportFromOrders = async (base, ordersPath) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(SEED_FN, TOKEN);
    await ctx.addInitScript(fakeFirebaseSource({}));
    const page = await ctx.newPage();
    await install3dStubs(page, BASE, { writes: {} });
    await page.goto(strip(base) + ordersPath, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    const links = await page.evaluate(() => {
      /* /orders puts the support URL inside onclick="window.location.href='…'"
         (and inside the order-menu handler), not in an href — collect both. */
      const out = new Set();
      for (const el of document.querySelectorAll("a[href],[onclick]")) {
        const s = (el.getAttribute("href") || "") + " " + (el.getAttribute("onclick") || "");
        const m = s.match(/order-support(?:\.html)?\?[^'"\s)]*/g);
        if (m) for (const h of m) out.add(h.replace(/\.html/, ""));
      }
      return [...out].sort();
    });
    await ctx.close();
    return links;
  };
  const fromOrders = {
    legacy: await supportFromOrders(legacyBase, "/orders.html"),
    new: await supportFromOrders(newBase, "/orders"),
  };
  check("T7a /orders -> order-support link (non-empty)", fromOrders.legacy.length > 0, true);
  check("T7a /orders -> order-support link", fromOrders.legacy, fromOrders.new);

  /* b) /track-order -> order-support links (header + help) */
  const supportFromTrack = async (base, trackPath) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(SEED_FN, TOKEN);
    await ctx.addInitScript(fakeFirebaseSource({}));
    const page = await ctx.newPage();
    await install3dStubs(page, BASE, { writes: {} });
    await page.goto(strip(base) + trackPath, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1400);
    const links = await page.evaluate(() =>
      [...document.querySelectorAll("a[href]")]
        .map((a) => a.getAttribute("href"))
        .filter((h) => /order-support/.test(h))
        .map((h) => h.replace(/\.html/, ""))
    );
    await ctx.close();
    return links;
  };
  const fromTrack = {
    legacy: await supportFromTrack(legacyBase, "/track-order.html?id=ord0000000000000000000001"),
    new: await supportFromTrack(newBase, "/track-order?id=ord0000000000000000000001"),
  };
  check("T7b /track-order -> order-support links (non-empty)", fromTrack.legacy.length > 0, true);
  check("T7b /track-order -> order-support links", fromTrack.legacy, fromTrack.new);

  /* c) apply success -> application-status link target */
  const applyResultLink = async (base, applyPath) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(SEED_FN, TOKEN);
    await ctx.addInitScript(fakeFirebaseSource({}));
    const page = await ctx.newPage();
    await install3dStubs(page, { ...BASE, "/vendor-applications": { success: true, data: { id: "app00000000000000000002" } } }, { writes: { "POST /vendor-applications": { success: true, data: { id: "app00000000000000000002" } } } });
    await page.goto(strip(base) + applyPath, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(900);
    await fillApply(page);
    await page.evaluate(() => document.getElementById("submitBtn").click());
    await page.waitForTimeout(800);
    const out = await page.evaluate(() => {
      const links = [...document.querySelectorAll("#result a[href]")].map((a) => a.getAttribute("href").replace(/\.html/, ""));
      return { links, stored: sessionStorage.getItem("eatswada_customer_application_id") };
    });
    await ctx.close();
    return out;
  };
  const applyOut = {
    legacy: await applyResultLink(legacyBase, "/apply.html"),
    new: await applyResultLink(newBase, "/apply"),
  };
  check("T7c apply -> application-status link (non-empty)", applyOut.legacy.links.length > 0, true);
  check("T7c apply -> application-status link + session id", applyOut.legacy, applyOut.new);

  /* d) restaurant card link target (the restaurant-details redirect source) */
  const cardLink = async (base, catPath) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(fakeFirebaseSource({}));
    const page = await ctx.newPage();
    await page.route("https://api.eatswada.com/**", (r) => {
      const u = new URL(r.request().url());
      const p = u.pathname.replace(/^\/api/, "");
      const fx = JSON.parse(fs.readFileSync("scripts/fixtures/category.json", "utf8"));
      const body = fx[p] !== undefined ? fx[p] : (fx["/restaurants"] !== undefined ? fx["/restaurants"] : { success: true, data: [] });
      return r.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: JSON.stringify(body) });
    });
    await page.route("**/cdnjs.cloudflare.com/**", (r) => r.abort());
    await page.route("**/gstatic.com/firebasejs/**", (r) => r.abort());
    await page.goto(strip(base) + catPath, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    const links = await page.evaluate(() =>
      [...document.querySelectorAll("a.res-card[href]")].map((a) => a.getAttribute("href").replace(/\.html/, ""))
    );
    await ctx.close();
    return links;
  };
  const cards = { legacy: await cardLink(legacyBase, "/category.html"), new: await cardLink(newBase, "/category") };
  check("T7d category restaurant card link (non-empty)", cards.legacy.length > 0, true);
  check("T7d category restaurant card link", cards.legacy, cards.new);
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) {
  console.log("failures:");
  for (const f of failures) console.log("  - " + f);
}
process.exit(fail === 0 ? 0 : 1);
