// Phase 3d — T2 pixel compare for the partner + support / info pages, in every
// visible state legacy can show, phone (390x844) + desktop (1280x800).
//
// Usage: node scripts/3d-pages-compare.mjs [legacyBase] [newBase]
//   defaults: legacy http://localhost:8080  new http://localhost:3000
//
// Each state runs the SAME `setup(page)` on the legacy and the new page (a
// click / fill / evaluate) before the screenshot, so both render the same
// visible state. API requests are stubbed from fixtures; Firebase and the icon
// CDNs are stubbed/aborted so the compare is deterministic. FAILS if any state
// is >=1%.
//
// NO REAL BACKEND: the fake `window.firebase` is injected before any page
// script, every non-GET request is stubbed, and all fixtures use fake values.
import { chromium } from "playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import fs from "node:fs";
import { fakeFirebaseSource, install3dStubs } from "./lib/phase3d.mjs";

const [legacyBase = "http://localhost:8080", newBase = "http://localhost:3000"] =
  process.argv.slice(2);
const L = legacyBase.replace(/\/$/, "");
const N = newBase.replace(/\/$/, "");
const sizes = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } };
fs.mkdirSync("compare-out", { recursive: true });

const BASE = JSON.parse(fs.readFileSync("scripts/fixtures/3d-fixtures.json", "utf8"));
delete BASE._comment;

const TOKEN = { nearbite_token: "FAKE_SESSION_TOKEN" };
const SEED_FN = (entries) => {
  for (const [k, v] of Object.entries(entries || {}))
    window.localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
};

/* All non-GET requests are stubbed (recorder unused here) so the compare is
   deterministic; the icon CDNs are aborted. */
async function stubRoutes(page) {
  await page.route("**/cdnjs.cloudflare.com/**", (r) => r.abort());
  await page.route("**/fonts.googleapis.com/**", (r) => r.abort());
  await page.route("**/fonts.gstatic.com/**", (r) => r.abort());
  await install3dStubs(page, BASE, { writes: {} });
}

/* Every state: [name, legacyUrl, newUrl, seed, setup, fixtures]. */
const STATES = [
  /* ── G1 partner ─────────────────────────────────────────── */
  ["partner-default", `${L}/partner-with-us.html`, `${N}/partner-with-us`, {}, null, {}],
  ["apply-step0", `${L}/apply.html`, `${N}/apply`, TOKEN, null, {}],
  ["apply-step0-error", `${L}/apply.html`, `${N}/apply`, TOKEN, (p) =>
    p.evaluate(() => document.getElementById("nextBtn").click()), {}],
  ["apply-step1-error", `${L}/apply.html`, `${N}/apply`, TOKEN, async (p) => {
    await p.evaluate(() => document.querySelector('#businessTypeChoices [data-value="restaurant"]').click());
    await p.evaluate(() => document.getElementById("nextBtn").click());
    await p.evaluate(() => document.getElementById("nextBtn").click());
  }, {}],
  ["apply-review", `${L}/apply.html`, `${N}/apply`, TOKEN, async (p) => {
    await p.evaluate(() => {
      document.querySelector('#businessTypeChoices [data-value="restaurant"]').click();
      document.getElementById("nextBtn").click();
      document.getElementById("ownerName").value = "Test Owner";
      document.getElementById("phone").value = "9000000000";
      document.getElementById("email").value = "test@example.com";
      document.getElementById("restaurantName").value = "Test Kitchen";
      document.getElementById("nextBtn").click();
      document.getElementById("cuisine").value = "Biryani";
      document.getElementById("address").value = "12 Main Road";
      document.getElementById("longitude").value = "88.82";
      document.getElementById("latitude").value = "26.56";
      document.getElementById("nextBtn").click();
      document.getElementById("fssai").value = "12345678901234";
      document.getElementById("nextBtn").click();
      document.querySelector('#deliveryChoices [data-value="eatswada"]').click();
      document.getElementById("nextBtn").click();
      document.getElementById("nextBtn").click();
    });
  }, {}],
  ["apply-needs-changes", `${L}/apply.html`, `${N}/apply`, TOKEN, null, {
    "/vendor-applications/mine": { success: true, data: { id: "app00000000000000000001", status: "needs_changes", changeRequest: "Update your opening hours.", businessType: "restaurant", deliveryMode: "self_delivery", ownerName: "Test Owner", restaurantName: "Test Kitchen", email: "test@example.com", phone: "9000000000", cuisine: "Biryani", address: "12 Main Road, Maynaguri", description: "A small kitchen", fssaiLicenseNumber: "12345678901234", location: { type: "Point", coordinates: [88.82, 26.56] }, openingHours: { monday: { closed: false, opensAt: "10:00", closesAt: "22:00" } }, createdAt: "2026-10-01T09:00:00.000Z" } },
  }],
  ["apply-logged-out", `${L}/apply.html`, `${N}/apply`, {}, null, {}],
  ["appstatus-pending", `${L}/application-status.html`, `${N}/application-status`, TOKEN, null, {
    "/vendor-applications/mine": { success: true, data: { id: "app00000000000000000001", status: "pending", businessType: "restaurant", deliveryMode: "eatswada_rider", ownerName: "Test Owner", restaurantName: "Test Kitchen", email: "test@example.com", phone: "9000000000", cuisine: ["Biryani"], createdAt: "2026-10-01T09:00:00.000Z" } },
  }],
  ["appstatus-review", `${L}/application-status.html`, `${N}/application-status`, TOKEN, null, {
    "/vendor-applications/mine": { success: true, data: { id: "app00000000000000000001", status: "under_review", businessType: "cloud_kitchen", deliveryMode: "self_delivery", ownerName: "Test Owner", restaurantName: "Test Kitchen", email: "test@example.com", phone: "9000000000", cuisine: "Biryani", createdAt: "2026-10-01T09:00:00.000Z" } },
  }],
  ["appstatus-changes", `${L}/application-status.html`, `${N}/application-status`, TOKEN, null, {
    "/vendor-applications/mine": { success: true, data: { id: "app00000000000000000001", status: "needs_changes", changeRequest: "Please upload a clearer FSSAI licence photo.", businessType: "restaurant", deliveryMode: "eatswada_rider", ownerName: "Test Owner", restaurantName: "Test Kitchen", email: "test@example.com", phone: "9000000000", cuisine: "Biryani", createdAt: "2026-10-01T09:00:00.000Z" } },
  }],
  ["appstatus-rejected", `${L}/application-status.html`, `${N}/application-status`, TOKEN, null, {
    "/vendor-applications/mine": { success: true, data: { id: "app00000000000000000001", status: "rejected", rejectionReason: "We are not onboarding new partners in this area right now.", businessType: "restaurant", deliveryMode: "eatswada_rider", ownerName: "Test Owner", restaurantName: "Test Kitchen", email: "test@example.com", phone: "9000000000", cuisine: "Biryani", createdAt: "2026-10-01T09:00:00.000Z" } },
  }],
  ["appstatus-approved", `${L}/application-status.html`, `${N}/application-status`, TOKEN, null, {
    "/vendor-applications/mine": { success: true, data: { id: "app00000000000000000001", status: "approved", businessType: "restaurant", deliveryMode: "eatswada_rider", ownerName: "Test Owner", restaurantName: "Test Kitchen", email: "test@example.com", phone: "9000000000", cuisine: "Biryani", createdAt: "2026-10-01T09:00:00.000Z" } },
  }],
  ["appstatus-empty", `${L}/application-status.html`, `${N}/application-status`, TOKEN, null, {
    "/vendor-applications/mine": { __status__: 404, __body__: { success: false, message: "Not found" } },
  }],
  ["appstatus-error", `${L}/application-status.html`, `${N}/application-status`, TOKEN, null, {
    "/vendor-applications/mine": { __status__: 500, __body__: { success: false, message: "Could not load" } },
  }],
  ["appstatus-logged-out", `${L}/application-status.html`, `${N}/application-status`, {}, null, {}],

  /* ── G2 support / info ──────────────────────────────────── */
  ["support-logged-out", `${L}/support.html`, `${N}/support`, {}, null, {}],
  ["support-logged-in", `${L}/support.html`, `${N}/support`, TOKEN, null, {}],
  ["order-help-default", `${L}/order-help.html`, `${N}/order-help`, {}, null, {}],
  ["order-support-home", `${L}/order-support.html?order=ord0000000000000000000001`, `${N}/order-support?order=ord0000000000000000000001`, TOKEN, null, {}],
  ["order-support-picker", `${L}/order-support.html`, `${N}/order-support`, TOKEN, null, {}],
  ["order-support-chat", `${L}/order-support.html?order=ord0000000000000000000001&view=chat`, `${N}/order-support?order=ord0000000000000000000001&view=chat`, TOKEN, null, {}],
  ["order-support-logged-out", `${L}/order-support.html?order=ord0000000000000000000001`, `${N}/order-support?order=ord0000000000000000000001`, {}, null, {}],
  ["order-support-no-orders", `${L}/order-support.html`, `${N}/order-support`, TOKEN, null, { "/orders": { success: true, data: [] } }],
  ["rate-us-default", `${L}/rate-us.html`, `${N}/rate-us`, TOKEN, null, {}],
  ["rate-us-empty", `${L}/rate-us.html`, `${N}/rate-us`, TOKEN, null, { "/ratings/me": { success: true, data: { used: 0, max: 3, ratings: [] } } }],
  ["rate-us-max", `${L}/rate-us.html`, `${N}/rate-us`, TOKEN, null, { "/ratings/me": { success: true, data: { used: 3, max: 3, ratings: [ { score: 5, comment: "Excellent", createdAt: "2026-10-12T09:00:00.000Z" } ] } } }],
  ["rate-us-selected", `${L}/rate-us.html`, `${N}/rate-us`, TOKEN, (p) =>
    p.evaluate(() => document.querySelector('.star[data-score="4"]').click()), {}],
  ["rate-us-logged-out", `${L}/rate-us.html`, `${N}/rate-us`, {}, null, {}],
  ["storage-check", `${L}/storage-check.html`, `${N}/storage-check`, {}, null, {}],
  ["privacy-data-default", `${L}/privacy-data.html`, `${N}/privacy-data`, TOKEN, null, {}],
  ["privacy-data-nonominee", `${L}/privacy-data.html`, `${N}/privacy-data`, TOKEN, null, {
    "/users/profile": { success: true, data: { user: { name: "Test User", email: "test@example.com" } } },
  }],
  ["privacy-data-requests", `${L}/privacy-data.html`, `${N}/privacy-data`, TOKEN, null, {
    "/privacy/requests": { success: true, data: [ { requestId: "REQ-0001", type: "correction", status: "in_review", createdAt: "2026-10-01T10:00:00.000Z" }, { requestId: "REQ-0002", type: "grievance", status: "resolved", createdAt: "2026-09-20T11:00:00.000Z" } ] },
  }],
  ["privacy-data-logged-out", `${L}/privacy-data.html`, `${N}/privacy-data`, {}, null, {}],
];

async function shot(browser, url, viewport, seed, setup, fixtures, tag) {
  const ctx = await browser.newContext({ viewport, reducedMotion: "reduce" });
  if (seed && Object.keys(seed).length) await ctx.addInitScript(SEED_FN, seed);
  await ctx.addInitScript(fakeFirebaseSource({ currentUser: null }));
  const page = await ctx.newPage();
  await page.route("**/cdnjs.cloudflare.com/**", (r) => r.abort());
  await page.route("**/fonts.googleapis.com/**", (r) => r.abort());
  await page.route("**/fonts.gstatic.com/**", (r) => r.abort());
  await install3dStubs(page, { ...BASE, ...fixtures }, { writes: {} });
  await page.goto(url, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(800);
  if (setup) {
    await setup(page);
    await page.waitForTimeout(800);
  }
  await page.addStyleTag({
    content: "*{animation:none!important;transition:none!important;caret-color:transparent!important}",
  });
  const file = `compare-out/3d-${tag}.png`;
  await page.screenshot({ path: file, fullPage: true });
  await ctx.close();
  return file;
}

function diffPct(a, b) {
  const imgA = PNG.sync.read(fs.readFileSync(a));
  const imgB = PNG.sync.read(fs.readFileSync(b));
  const w = Math.max(imgA.width, imgB.width);
  const h = Math.max(imgA.height, imgB.height);
  const pad = (img) => {
    if (img.width === w && img.height === h) return img;
    const out = new PNG({ width: w, height: h });
    PNG.bitblt(img, out, 0, 0, img.width, img.height, 0, 0);
    for (let i = 0; i < out.data.length; i += 4)
      if (out.data[i + 3] === 0) {
        out.data[i] = 255; out.data[i + 1] = 255; out.data[i + 2] = 255; out.data[i + 3] = 255;
      }
    return out;
  };
  const A = pad(imgA);
  const B = pad(imgB);
  const out = new PNG({ width: w, height: h });
  const n = pixelmatch(A.data, B.data, out.data, w, h, { threshold: 0.12 });
  return (n / (w * h)) * 100;
}

const browser = await chromium.launch();
let worst = 0;
let failed = 0;
for (const [name, legacyUrl, newUrl, seed, setup, fixtures] of STATES) {
  const line = [];
  for (const [label, viewport] of Object.entries(sizes)) {
    const a = await shot(browser, legacyUrl, viewport, seed, setup, fixtures, `${name}-${label}-legacy`);
    const b = await shot(browser, newUrl, viewport, seed, setup, fixtures, `${name}-${label}-new`);
    const pct = diffPct(a, b);
    worst = Math.max(worst, pct);
    if (pct >= 1) failed++;
    line.push(`${label} ${pct.toFixed(2)}%`);
  }
  console.log(`${name.padEnd(26)} ${line.join("  /  ")}`);
}
await browser.close();
console.log(`\nworst ${worst.toFixed(2)}%  (states >=1%: ${failed})`);
process.exit(failed === 0 ? 0 : 1);
