// Phase 3b — AUTH parity harness (login / forgot-password / reset-password /
// complete-profile / location-onboarding).
//
// Usage: node scripts/auth-parity.mjs [legacyBase] [newBase]
//   defaults: legacy http://localhost:8080  new http://localhost:3000
//
// NO REAL AUTH, EVER:
//   * the Firebase CDN is aborted and a fake `window.firebase` is injected
//     before any page script (records every call, returns scripted results);
//   * every non-GET request is stubbed; the recorder keeps method + URL +
//     headers + exact body and FAILS on any unstubbed write;
//   * fixtures use only fake emails / phones / tokens.
//
// For each scenario the harness runs legacy and new side by side with the same
// seed + stubs and compares, after every step:
//   * the DOM/state signature (steps, banners, button label + disabled, focus,
//     storage keys, extra element text) — T3
//   * the recorded writes (method, path, exact body, content-type) — T4
//   * the GET request counts (boot-once) — T6
import { chromium } from "playwright";
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
function note(msg) {
  console.log(`  · ${msg}`);
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

/* Boot-once (T6) compares the NUMBER of requests per endpoint, not their
   order — parallel boot fetches settle in a different order between the two
   servers. */
const sortCounts = (counts) =>
  Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));

async function runSide(browser, base, path, cfg) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  if (cfg.seed) await ctx.addInitScript(SEED_FN, cfg.seed);
  if (cfg.fb) await ctx.addInitScript(fakeFirebaseSource(cfg.fb));
  if (cfg.leaflet) await ctx.addInitScript(fakeLeafletSource());
  const page = await ctx.newPage();
  const stub = await installStubs(page, cfg.fixtures || {}, { writes: cfg.writes || {} });
  await page.goto(strip(base) + path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(cfg.settle ?? 900);

  const sigs = [await signature(page, cfg.extra)];
  for (const step of cfg.steps || []) {
    await step(page);
    await page.waitForTimeout(cfg.stepWait ?? 500);
    sigs.push(await signature(page, cfg.extra));
  }
  const out = {
    sigs,
    writes: writableWrites(stub.recorded),
    counts: stub.counts,
    unstubbed: stub.state.unstubbed,
    finalUrl: normUrl(page.url()),
    fbCalls: await page.evaluate(() => (window.__fb ? window.__fb.calls : [])).catch(() => []),
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
    a.url = normUrl(a.url);
    b.url = normUrl(b.url);
    check(`${name}: step ${i} url`, a.url, b.url);
    check(`${name}: step ${i} steps`, a.steps, b.steps);
    check(`${name}: step ${i} banners`, a.banners, b.banners);
    check(`${name}: step ${i} buttons`, a.buttons, b.buttons);
    check(`${name}: step ${i} focus`, a.active, b.active);
    check(`${name}: step ${i} storage`, { local: a.local, session: a.session }, { local: b.local, session: b.session });
    if (a.extra || b.extra) check(`${name}: step ${i} extra`, a.extra, b.extra);
    check(`${name}: step ${i} htmlClass`, a.htmlClass, b.htmlClass);
  }
  check(`${name}: writes`, legacy.writes, neu.writes);
  check(`${name}: final url`, legacy.finalUrl, neu.finalUrl);
  check(`${name}: GET boot counts`, sortCounts(legacy.counts), sortCounts(neu.counts));
  if (cfg.checkFb) check(`${name}: firebase calls`, legacy.fbCalls, neu.fbCalls);
}

const browser = await chromium.launch();

/* ── fixtures (fake values only) ─────────────────────────────────────── */
const F = {
  "auth/firebase": { success: true, data: { token: "FAKE_SESSION_TOKEN", user: { _id: "u1", name: "Test User" } } },
  "auth/firebase?profile": { code: "PROFILE_REQUIRED", data: { profile: { name: "Google Tester", email: "test.google@example.com", avatar: "https://example.com/a.png" } } },
  "users/login": { success: true, data: { token: "FAKE_SESSION_TOKEN", user: { _id: "u1", name: "Test User" } } },
  "users/profile": { success: true, data: { _id: "u1", name: "Test User", email: "test@example.com", phone: "9876543210", adultConfirmedAt: null } },
  "users/forgot-password/email": { success: true },
  "users/forgot-password/email/verify": { success: true, data: { resetToken: "FAKE_RESET_TOKEN" } },
  "users/forgot-password/email/reset": { success: true },
  "users/forgot-password": { success: true },
  "users/forgot-password/verify": { success: true, data: { resetToken: "FAKE_RESET_TOKEN" } },
  "users/forgot-password/reset": { success: true },
  "restaurants/serviceability": { success: true, data: { serviceable: true, maxDeliveryDistanceKm: 10, nearestDistanceKm: 2.4 } },
  "restaurants/serviceability?outside": { success: true, data: { serviceable: false, maxDeliveryDistanceKm: 10, nearestDistanceKm: 24.7 } },
  "nominatim": { display_name: "Maynaguri, Jalpaiguri, West Bengal, 735224, India", address: { road: "Main Road", village: "Maynaguri", state: "West Bengal", postcode: "735224" } },
};

const T = (ms) => (p) => p.waitForTimeout(ms);

/* Fill a set of OTP boxes even when their container is hidden (the legacy
   pages switch steps by toggling `.active`/`.hidden`, and an inactive step is
   not "visible" to Playwright). Dispatching `input` is what a real keystroke
   does, so the legacy input listeners run exactly as they would for a user. */
async function fillOtp(page, selector, digits) {
  await page.evaluate(
    ({ selector, digits }) => {
      const boxes = Array.from(document.querySelectorAll(selector));
      boxes.forEach((box, i) => {
        if (digits[i] === undefined) return;
        box.value = digits[i];
        box.dispatchEvent(new Event("input", { bubbles: true }));
      });
    },
    { selector, digits }
  );
}


/* ══════════════════════════ LOGIN ══════════════════════════════ */
await runCase(browser, "login default", {
  legacyPath: "/login.html",
  newPath: "/login",
  fb: { enabled: true, authState: undefined },
  fixtures: F,
  writes: {},
  settle: 700,
});

await runCase(browser, "login show password form", {
  legacyPath: "/login.html",
  newPath: "/login",
  fb: { authState: undefined },
  fixtures: F,
  writes: {},
  steps: [async (p) => p.click("#showPasswordLoginBtn")],
});

await runCase(browser, "login password success", {
  legacyPath: "/login.html",
  newPath: "/login",
  fb: { authState: undefined },
  fixtures: F,
  writes: { "POST /users/login": { success: true, data: { token: "FAKE_SESSION_TOKEN", user: { _id: "u1", name: "Test User" } } } },
  steps: [
    async (p) => p.click("#showPasswordLoginBtn"),
    async (p) => p.fill("#loginIdentifierInput", "test@example.com"),
    async (p) => p.fill("#loginPasswordInput", "password123"),
    async (p) => p.click("#passwordLoginBtn"),
  ],
  stepWait: 700,
  checkFb: true,
});

await runCase(browser, "login password wrong", {
  legacyPath: "/login.html",
  newPath: "/login",
  fb: { authState: undefined },
  fixtures: F,
  writes: { "POST /users/login": { __status: 401, body: { success: false, message: "Invalid email/mobile number or password." } } },
  steps: [
    async (p) => p.click("#showPasswordLoginBtn"),
    async (p) => p.fill("#loginIdentifierInput", "test@example.com"),
    async (p) => p.fill("#loginPasswordInput", "wrongpassword"),
    async (p) => p.click("#passwordLoginBtn"),
  ],
  stepWait: 600,
});

await runCase(browser, "login password too short", {
  legacyPath: "/login.html",
  newPath: "/login",
  fb: { authState: undefined },
  fixtures: F,
  writes: {},
  steps: [
    async (p) => p.click("#showPasswordLoginBtn"),
    async (p) => p.fill("#loginIdentifierInput", "test@example.com"),
    async (p) => p.fill("#loginPasswordInput", "short"),
    async (p) => p.click("#passwordLoginBtn"),
  ],
});

await runCase(browser, "login phone success (10-digit)", {
  legacyPath: "/login.html",
  newPath: "/login",
  fb: { authState: undefined },
  fixtures: F,
  writes: { "POST /users/login": { success: true, data: { token: "FAKE_SESSION_TOKEN", user: { _id: "u1" } } } },
  steps: [
    async (p) => p.click("#showPasswordLoginBtn"),
    async (p) => p.fill("#loginIdentifierInput", "9876543210"),
    async (p) => p.fill("#loginPasswordInput", "password123"),
    async (p) => p.click("#passwordLoginBtn"),
  ],
  stepWait: 700,
});

await runCase(browser, "login google popup existing user", {
  legacyPath: "/login.html",
  newPath: "/login",
  fb: { authState: undefined, popupUser: { uid: "g1", email: "test.google@example.com", idToken: "FAKE_ID_TOKEN" } },
  fixtures: F,
  writes: { "POST /auth/firebase": { success: true, data: { token: "FAKE_SESSION_TOKEN", user: { _id: "u1" } } } },
  steps: [async (p) => p.click("#googleSignInBtn")],
  stepWait: 900,
  checkFb: true,
});

await runCase(browser, "login google popup new user (PROFILE_REQUIRED)", {
  legacyPath: "/login.html",
  newPath: "/login",
  fb: { authState: undefined, popupUser: { uid: "g2", email: "test.new@example.com", idToken: "FAKE_ID_TOKEN" } },
  fixtures: F,
  writes: { "POST /auth/firebase": { code: "PROFILE_REQUIRED", data: { profile: { name: "Google Tester", email: "test.new@example.com", avatar: "" } } } },
  steps: [async (p) => p.click("#googleSignInBtn")],
  stepWait: 900,
});

await runCase(browser, "login google popup closed", {
  legacyPath: "/login.html",
  newPath: "/login",
  fb: { authState: undefined, popupError: { code: "auth/popup-closed-by-user", message: "closed" } },
  fixtures: F,
  writes: {},
  steps: [async (p) => p.click("#googleSignInBtn")],
  stepWait: 700,
});

await runCase(browser, "login google popup blocked -> redirect", {
  legacyPath: "/login.html",
  newPath: "/login",
  fb: { authState: undefined, popupError: { code: "auth/popup-blocked", message: "blocked" } },
  fixtures: F,
  writes: {},
  steps: [async (p) => p.click("#googleSignInBtn")],
  stepWait: 700,
  checkFb: true,
});

await runCase(browser, "login forgot password invalid email", {
  legacyPath: "/login.html",
  newPath: "/login",
  fb: { authState: undefined },
  fixtures: F,
  writes: {},
  steps: [
    async (p) => p.click("#showPasswordLoginBtn"),
    async (p) => p.click("#passwordLoginView .auth-link"),
    async (p) => p.fill("#forgotEmailInput", "not-an-email"),
    async (p) => p.click("#forgotSendBtn"),
  ],
});

await runCase(browser, "login forgot password -> otp step", {
  legacyPath: "/login.html",
  newPath: "/login",
  fb: { authState: undefined },
  fixtures: F,
  writes: { "POST /users/forgot-password/email": { success: true } },
  steps: [
    async (p) => p.click("#showPasswordLoginBtn"),
    async (p) => p.click("#passwordLoginView .auth-link"),
    async (p) => p.fill("#forgotEmailInput", "test@example.com"),
    async (p) => p.click("#forgotSendBtn"),
  ],
  stepWait: 700,
});

await runCase(browser, "login otp verify -> new password step", {
  legacyPath: "/login.html",
  newPath: "/login",
  fb: { authState: undefined },
  fixtures: F,
  writes: {
    "POST /users/forgot-password/email": { success: true },
    "POST /users/forgot-password/email/verify": { success: true, data: { resetToken: "FAKE_RESET_TOKEN" } },
  },
  steps: [
    async (p) => p.click("#showPasswordLoginBtn"),
    async (p) => p.click("#passwordLoginView .auth-link"),
    async (p) => p.fill("#forgotEmailInput", "test@example.com"),
    async (p) => p.click("#forgotSendBtn"),
    async (p) => fillOtp(p, "#resetOtpGrid .otp-box", ["1", "2", "3", "4", "5", "6"]),
    async (p) => p.click("#verifyResetOtpBtn"),
  ],
  stepWait: 700,
});

await runCase(browser, "login reset password mismatch then success", {
  legacyPath: "/login.html",
  newPath: "/login",
  fb: { authState: undefined },
  fixtures: F,
  writes: {
    "POST /users/forgot-password/email": { success: true },
    "POST /users/forgot-password/email/verify": { success: true, data: { resetToken: "FAKE_RESET_TOKEN" } },
    "POST /users/forgot-password/email/reset": { success: true },
  },
  steps: [
    async (p) => p.click("#showPasswordLoginBtn"),
    async (p) => p.click("#passwordLoginView .auth-link"),
    async (p) => p.fill("#forgotEmailInput", "test@example.com"),
    async (p) => p.click("#forgotSendBtn"),
    async (p) => fillOtp(p, "#resetOtpGrid .otp-box", ["1", "2", "3", "4", "5", "6"]),
    async (p) => p.click("#verifyResetOtpBtn"),
    async (p) => p.fill("#resetNewPasswordInput", "newpassword1"),
    async (p) => p.fill("#resetConfirmPasswordInput", "different1"),
    async (p) => p.click("#resetPasswordBtn"),
    async (p) => p.fill("#resetConfirmPasswordInput", "newpassword1"),
    async (p) => p.click("#resetPasswordBtn"),
  ],
  stepWait: 800,
});

/* ══════════════════════════ FORGOT PASSWORD ══════════════════════════════ */
await runCase(browser, "forgot-password default", {
  legacyPath: "/forgot-password.html",
  newPath: "/forgot-password",
  fixtures: F,
  writes: {},
});

await runCase(browser, "forgot-password invalid phone", {
  legacyPath: "/forgot-password.html",
  newPath: "/forgot-password",
  fixtures: F,
  writes: {},
  steps: [
    async (p) => p.fill("#phone", "12345"),
    async (p) => p.click("#sendBtn"),
  ],
});

await runCase(browser, "forgot-password send otp -> otp step", {
  legacyPath: "/forgot-password.html",
  newPath: "/forgot-password",
  fixtures: F,
  writes: { "POST /users/forgot-password": { success: true } },
  steps: [
    async (p) => p.fill("#phone", "9876543210"),
    async (p) => p.click("#sendBtn"),
  ],
  stepWait: 700,
});

await runCase(browser, "forgot-password verify otp -> password step", {
  legacyPath: "/forgot-password.html",
  newPath: "/forgot-password",
  fixtures: F,
  writes: {
    "POST /users/forgot-password": { success: true },
    "POST /users/forgot-password/verify": { success: true, data: { resetToken: "FAKE_RESET_TOKEN" } },
  },
  steps: [
    async (p) => p.fill("#phone", "9876543210"),
    async (p) => p.click("#sendBtn"),
    async (p) => fillOtp(p, "#otpStep .otp input", ["1", "2", "3", "4", "5", "6"]),
    async (p) => p.click("#verifyBtn"),
  ],
  stepWait: 700,
});

await runCase(browser, "forgot-password reset success -> login", {
  legacyPath: "/forgot-password.html",
  newPath: "/forgot-password",
  fixtures: F,
  writes: {
    "POST /users/forgot-password": { success: true },
    "POST /users/forgot-password/verify": { success: true, data: { resetToken: "FAKE_RESET_TOKEN" } },
    "POST /users/forgot-password/reset": { success: true },
  },
  steps: [
    async (p) => p.fill("#phone", "9876543210"),
    async (p) => p.click("#sendBtn"),
    async (p) => fillOtp(p, "#otpStep .otp input", ["1", "2", "3", "4", "5", "6"]),
    async (p) => p.click("#verifyBtn"),
    async (p) => p.fill("#newPassword", "newpass1"),
    async (p) => p.fill("#confirmPassword", "newpass2"),
    async (p) => p.click("#resetBtn"),
    async (p) => p.fill("#confirmPassword", "newpass1"),
    async (p) => {
      p.on("dialog", (d) => d.accept());
      await p.click("#resetBtn");
    },
  ],
  stepWait: 900,
});

/* ══════════════════════════ RESET PASSWORD ══════════════════════════════ */
await runCase(browser, "reset-password redirect", {
  legacyPath: "/reset-password.html",
  newPath: "/reset-password",
  fixtures: F,
  writes: {},
  settle: 1200,
  stepWait: 900,
});

/* ══════════════════════════ COMPLETE PROFILE ══════════════════════════════ */
await runCase(browser, "complete-profile no token -> login", {
  legacyPath: "/complete-profile.html",
  newPath: "/complete-profile",
  fixtures: F,
  writes: {},
  settle: 1000,
});

await runCase(browser, "complete-profile token -> loads profile", {
  legacyPath: "/complete-profile.html",
  newPath: "/complete-profile",
  seed: { local: { nearbite_token: "FAKE_SESSION_TOKEN" } },
  fixtures: F,
  writes: {},
  settle: 1000,
  extra: { name: null, phone: null, email: null },
});

await runCase(browser, "complete-profile google mode paints profile", {
  legacyPath: "/complete-profile.html?google=1",
  newPath: "/complete-profile?google=1",
  seed: {
    session: {
      nearbite_google_pending_token: "FAKE_ID_TOKEN",
      nearbite_google_pending_profile: JSON.stringify({ name: "Google Tester", email: "test.google@example.com", avatar: "https://example.com/a.png" }),
    },
  },
  fb: { authState: undefined },
  fixtures: F,
  writes: {},
  settle: 1000,
});

await runCase(browser, "complete-profile validation errors", {
  legacyPath: "/complete-profile.html",
  newPath: "/complete-profile",
  seed: { local: { nearbite_token: "FAKE_SESSION_TOKEN" } },
  fixtures: F,
  writes: {},
  /* `saveBtn` stays disabled until every field is valid, so the validation
     branch is reached the way a user reaches it: the CTA enables only once the
     inputs are valid, then the function re-checks. Call the page's own global
     `completeProfile()` for each invalid combination — identical on both. */
  steps: [
    async (p) => p.evaluate(() => { document.getElementById("name").value = "A"; window.completeProfile(); }),
    async (p) => p.evaluate(() => { document.getElementById("name").value = "Valid Name"; document.getElementById("phone").value = "12345"; window.completeProfile(); }),
    async (p) => p.evaluate(() => { document.getElementById("phone").value = "9876543210"; document.getElementById("email").value = "bad"; window.completeProfile(); }),
    async (p) => p.evaluate(() => { document.getElementById("email").value = "test@example.com"; document.getElementById("password").value = "short"; window.completeProfile(); }),
    async (p) => p.evaluate(() => { document.getElementById("password").value = "password123"; document.getElementById("age18").checked = false; window.completeProfile(); }),
    async (p) => p.evaluate(() => { document.getElementById("age18").checked = true; document.getElementById("age18").dispatchEvent(new Event("change", { bubbles: true })); }),
  ],
  stepWait: 400,
  settle: 900,
  extra: { errorBox: null },
});

await runCase(browser, "complete-profile token save -> after_login redirect", {
  legacyPath: "/complete-profile.html",
  newPath: "/complete-profile",
  seed: { local: { nearbite_token: "FAKE_SESSION_TOKEN", nearbite_after_login: "cart.html" } },
  fixtures: F,
  writes: { "PUT /users/profile": { success: true, data: { token: "FAKE_SESSION_TOKEN2", user: { _id: "u1" } } } },
  steps: [
    async (p) => p.fill("#name", "Valid Name"),
    async (p) => p.fill("#phone", "9876543210"),
    async (p) => p.fill("#email", "test@example.com"),
    async (p) => p.fill("#password", "password123"),
    async (p) => p.check("#age18"),
    async (p) => p.click("#saveBtn"),
  ],
  stepWait: 900,
  settle: 900,
});

await runCase(browser, "complete-profile google save -> location-onboarding", {
  leaflet: true,
  legacyPath: "/complete-profile.html?google=1",
  newPath: "/complete-profile?google=1",
  seed: {
    session: {
      nearbite_google_pending_token: "FAKE_ID_TOKEN",
      nearbite_google_pending_profile: JSON.stringify({ name: "Google Tester", email: "test.google@example.com" }),
    },
  },
  fb: { authState: undefined },
  fixtures: F,
  writes: { "POST /auth/firebase/complete-profile": { success: true, data: { token: "FAKE_SESSION_TOKEN", user: { _id: "u1" } } } },
  steps: [
    async (p) => p.fill("#name", "Google Tester"),
    async (p) => p.fill("#phone", "9876543210"),
    async (p) => p.fill("#password", "password123"),
    async (p) => p.check("#age18"),
    async (p) => p.click("#saveBtn"),
  ],
  stepWait: 900,
  settle: 1000,
});

await runCase(browser, "complete-profile onboarding=1 token save -> location-onboarding", {
  leaflet: true,
  legacyPath: "/complete-profile.html?onboarding=1",
  newPath: "/complete-profile?onboarding=1",
  seed: { local: { nearbite_token: "FAKE_SESSION_TOKEN" } },
  fixtures: F,
  writes: { "PUT /users/profile": { success: true, data: { token: "FAKE_SESSION_TOKEN2", user: { _id: "u1" } } } },
  steps: [
    async (p) => p.fill("#name", "Valid Name"),
    async (p) => p.fill("#phone", "9876543210"),
    async (p) => p.fill("#email", "test@example.com"),
    async (p) => p.fill("#password", "password123"),
    async (p) => p.check("#age18"),
    async (p) => p.click("#saveBtn"),
  ],
  stepWait: 900,
  settle: 1000,
});

/* ══════════════════════════ LOCATION ONBOARDING ══════════════════════════════ */
const denyGeo = (p) =>
  p.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = function (s, e) {
      setTimeout(() => e && e({ code: 1, message: "denied" }), 10);
    };
    navigator.permissions = { query: () => Promise.resolve({ state: "prompt" }) };
  });

await runCase(browser, "location-onboarding default (gps denied)", {
  leaflet: true,
  legacyPath: "/location-onboarding.html",
  newPath: "/location-onboarding",
  fixtures: F,
  writes: {},
  extra: { address: null, "lg-title": null, confirm: null },
  steps: [],
  settle: 2200,
});

await runCase(browser, "location-onboarding preset point confirm (serviceable)", {
  leaflet: true,
  legacyPath: "/location-onboarding.html?from=select&lat=26.545&lng=88.82&title=Preset%20Point&sub=Somewhere",
  newPath: "/location-onboarding?from=select&lat=26.545&lng=88.82&title=Preset%20Point&sub=Somewhere",
  fixtures: F,
  writes: {},
  extra: { address: null, confirm: null },
  steps: [async (p) => p.click("#confirm")],
  stepWait: 900,
  settle: 2200,
});

await runCase(browser, "location-onboarding confirm outside delivery area", {
  leaflet: true,
  legacyPath: "/location-onboarding.html?from=select&lat=26.9&lng=89.5&title=Far%20Place",
  newPath: "/location-onboarding?from=select&lat=26.9&lng=89.5&title=Far%20Place",
  fixtures: {
    ...F,
    "restaurants/serviceability": { success: true, data: { serviceable: false, maxDeliveryDistanceKm: 10, nearestDistanceKm: 24.7 } },
  },
  writes: {},
  extra: { address: null, warn: null, confirm: null },
  steps: [async (p) => p.click("#confirm")],
  stepWait: 900,
  settle: 2200,
});

/* ══════════════════════════ T5 — pure functions ══════════════════════════
   Each validator / normaliser / redirect builder is called with the same
   inputs on legacy and new and the return values must deep-equal. */
{
  console.log("\n== T5 pure functions (legacy vs new) ==");
  const fns = [
    {
      path: "/complete-profile.html",
      newPath: "/complete-profile",
      seed: { local: { nearbite_token: "FAKE_SESSION_TOKEN" } },
      calls: [
        ["formatPhone('+91 98765-43210')", "window.formatPhone('+91 98765-43210')"],
        ["formatPhone('98765432109876')", "window.formatPhone('98765432109876')"],
        ["formatPhone('abc')", "window.formatPhone('abc')"],
        ["formatPhone(null)", "window.formatPhone(null)"],
      ],
    },
    {
      path: "/location-onboarding.html",
      newPath: "/location-onboarding",
      leaflet: true,
      calls: [
        ["safeAppPath('address.html?x=1')", "window.safeAppPath('address.html?x=1')"],
        ["safeAppPath('/etc/passwd')", "window.safeAppPath('/etc/passwd')"],
        ["safeAppPath('http://evil.com')", "window.safeAppPath('http://evil.com')"],
        ["safeAppPath('javascript:alert(1)')", "window.safeAppPath('javascript:alert(1)')"],
        ["safeAppPath('//host/path')", "window.safeAppPath('//host/path')"],
        ["safeAppPath('a b.html')", "window.safeAppPath('a b.html')"],
        ["safeAppPath('%2Fetc')", "window.safeAppPath('%2Fetc')"],
        ["safeAppPath('login.html')", "window.safeAppPath('login.html')"],
        ["safeAppPath('')", "window.safeAppPath('')"],
        ["safeDecode('a%2520b')", "window.safeDecode('a%2520b')"],
        ["safeDecode('plain')", "window.safeDecode('plain')"],
      ],
    },
  ];
  for (const fn of fns) {
    const out = {};
    for (const [tag, base, path] of [["legacy", legacyBase, fn.path], ["new", newBase, fn.newPath]]) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      if (fn.seed) await ctx.addInitScript(SEED_FN, fn.seed);
      if (fn.leaflet) await ctx.addInitScript(fakeLeafletSource());
      const page = await ctx.newPage();
      await installStubs(page, F, { writes: {} });
      await page.goto(strip(base) + path, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(fn.settle ?? 900);
      out[tag] = await page.evaluate((exprs) => {
        const res = {};
        for (const [label, expr] of exprs) {
          try {
            // eslint-disable-next-line no-eval
            res[label] = String(eval(expr));
          } catch (e) {
            res[label] = "THREW:" + e.name;
          }
        }
        return res;
      }, fn.calls);
      await ctx.close();
    }
    for (const [label] of fn.calls) {
      check(`T5 ${fn.newPath}: ${label}`, out.legacy[label], out.new[label]);
    }
  }
}

/* ══════════════════════════ T7 — cross-page flow ═════════════════════════
   /cart (guest) → /login → back to /cart. The cart's Order button seeds
   `nearbite_after_login='cart.html'` then navigates to login.html; after a
   successful password login `routeAfterAuthentication` must send the user
   back to the requested page (legacy `cart.html` → clean `/cart`). */
{
  console.log("\n== T7 cross-page flow: /cart (guest) -> login -> back to cart ==");
  const flow = async (base, cartPath, loginPath) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await installStubs(page, F, { writes: {} });
    await page.route("**/gstatic.com/firebasejs/**", (r) => r.abort());
    await page.goto(strip(base) + cartPath, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(900);
    const before = await page.evaluate(() => ({
      after: localStorage.getItem("nearbite_after_login"),
      token: localStorage.getItem("nearbite_token"),
    }));
    // Guest cart -> press the checkout button to trigger the login redirect.
    await page.evaluate(() => {
      const b = document.getElementById("btn-checkout");
      if (b) b.click();
    });
    await page.waitForTimeout(1200);
    const landed = normUrl(page.url());
    // Now log in on the login page with a fake backend token.
    if (landed.startsWith(loginPath.replace(".html", "")) || landed.startsWith(loginPath)) {
      await page.click("#showPasswordLoginBtn");
      await page.fill("#loginIdentifierInput", "test@example.com");
      await page.fill("#loginPasswordInput", "password123");
      await page.click("#passwordLoginBtn");
      await page.waitForTimeout(1600);
    }
    const after = await page.evaluate(() => ({
      after: localStorage.getItem("nearbite_after_login"),
      token: localStorage.getItem("nearbite_token"),
    }));
    const finalUrl = normUrl(page.url());
    await ctx.close();
    return { before, landed, after, finalUrl };
  };
  const legacy = await flow(legacyBase, "/cart.html", "/login.html");
  const neu = await flow(newBase, "/cart", "/login");
  check("T7 cart guest: after_login seeded", legacy.before.after, neu.before.after);
  check("T7 cart guest: redirected to login", legacy.landed, neu.landed);
  check("T7 login success: token stored", legacy.after.token, neu.after.token);
  check("T7 login success: after_login cleared", legacy.after.after, neu.after.after);
  check("T7 login success: returned to cart", legacy.finalUrl, neu.finalUrl);
}

/* ══════════════════════════ T7b — already-logged-in header state ═════════
   With a token in localStorage the shared Header must render the same
   logged-in state on the new pages as legacy. */
{
  console.log("\n== T7b shared Header logged-in state ==");
  const headerSig = async (base, path) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.addInitScript(
      (s) => {
        for (const [k, v] of Object.entries(s.local)) window.localStorage.setItem(k, v);
      },
      { local: { nearbite_token: "FAKE_SESSION_TOKEN", nearbite_user: JSON.stringify({ name: "Test User" }) } }
    );
    const page = await ctx.newPage();
    await installStubs(page, F, { writes: {} });
    await page.goto(strip(base) + path, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    const sig = await page.evaluate(() => {
      const h = document.querySelector("header, .header, #site-header");
      if (!h) return null;
      return {
        html: h.innerHTML.replace(/\s+/g, " ").trim().slice(0, 400),
        loggedIn: /logout|sign out|account|profile|my orders/i.test(h.textContent || ""),
      };
    });
    await ctx.close();
    return sig;
  };
  // The shared header only renders on the layout shell pages; check the home
  // page (both sides) with a token, which is where the logged-in header shows.
  const legacy = await headerSig(legacyBase, "/index.html");
  const neu = await headerSig(newBase, "/");
  check("T7b header loggedIn flag", legacy && legacy.loggedIn, neu && neu.loggedIn);
}

await browser.close();

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
if (fail) {
  console.log("Failed checks:\n  " + failures.join("\n  "));
  process.exit(1);
}
