// Phase 2 chunk 5 — side-by-side parity harness for /restaurant-shell.
//
// Drives the LEGACY page and the NEW page with the SAME restaurant / reviews
// payloads and the SAME direct function calls, then compares the rendered DOM
// byte-for-byte:
//   * Info tab swap (menu <-> info), aria-selected, indicator, pane animation class;
//   * hours / services / address / FSSAI markup inside #info-content;
//   * reviews: loaded ONCE with ?page=1&limit=5, "Load more" behaviour;
//   * share (navigator.share payload);
//   * closed restaurant (isOpen false) warning card;
//   * "New" pill when rating is 0, verified:false, freeDeliveryEnabled:false;
//   * dark mode.
//
// Usage: node scripts/shell-chunk5-parity.mjs [legacyUrl] [newUrl]
// Writes compare-out/shell-chunk5-parity.txt and exits non-zero on any FAIL.
import { chromium } from "playwright";
import fs from "node:fs";

const LEGACY = process.argv[2] || "http://localhost:8080/restaurant-shell.html";
const NEW = process.argv[3] || "http://localhost:3000/restaurant-shell";
const ID = "6ac8f95828669b5f4e30f0ba";

const home = JSON.parse(fs.readFileSync("scripts/fixtures/home.json", "utf8"));
const baseRestaurant = home["/restaurants"].data.find((r) => r._id === ID);
const menuPayload = home[`/restaurants/${ID}/menu`];
const reviewsReal = JSON.parse(fs.readFileSync("scripts/fixtures/restaurant-shell.json", "utf8"))[
  `/restaurants/${ID}/reviews`
];

/* A synthetic multi-page reviews payload, used ONLY to exercise the
   "Load more" path (the real recorded reviews payload is empty). Clearly
   labelled as synthetic in the output. */
const reviewsPaged = {
  success: true,
  summary: { rating: 4.5, ratingCount: 7, reviewCount: 7, breakdown: { 1: 0, 2: 0, 3: 1, 4: 1, 5: 5 } },
  page: 1,
  pages: 2,
  total: 7,
  data: [
    {
      _id: "rv1",
      score: 5,
      comment: "Best dosa in Maynaguri!",
      createdAt: "2026-02-01T10:00:00.000Z",
      verified: true,
      customer: { name: "Amit Das" },
      itemRatings: [{ itemName: "Masala Dosa", score: 5 }],
      vendorReply: { text: "Thank you!" },
    },
    {
      _id: "rv2",
      score: 4,
      comment: "Good, slightly spicy.",
      createdAt: "2026-01-20T10:00:00.000Z",
      verified: false,
      customer: { name: "Rina" },
      itemRatings: [],
    },
  ],
};
const reviewsPaged2 = {
  success: true,
  summary: reviewsPaged.summary,
  page: 2,
  pages: 2,
  total: 7,
  data: [
    {
      _id: "rv3",
      score: 3,
      comment: "Okay.",
      createdAt: "2026-01-05T10:00:00.000Z",
      verified: true,
      customer: { name: "Sam" },
      itemRatings: [{ itemName: "Plain Idli", score: 3 }],
    },
  ],
};

const lines = [];
const log = (...a) => {
  lines.push(a.join(" "));
  console.log(...a);
};

const variants = {
  base: () => JSON.parse(JSON.stringify(baseRestaurant)),
  closed: () => {
    const r = JSON.parse(JSON.stringify(baseRestaurant));
    r.isOpen = false;
    if (r.availability) r.availability.isOpen = false;
    return r;
  },
  unrated: () => {
    const r = JSON.parse(JSON.stringify(baseRestaurant));
    r.rating = 0;
    r.ratingCount = 0;
    return r;
  },
  unverified: () => {
    const r = JSON.parse(JSON.stringify(baseRestaurant));
    r.verified = false;
    return r;
  },
  nofree: () => {
    const r = JSON.parse(JSON.stringify(baseRestaurant));
    r.freeDeliveryEnabled = false;
    return r;
  },
  bigcount: () => {
    const r = JSON.parse(JSON.stringify(baseRestaurant));
    r.rating = 4.6;
    r.ratingCount = 1234;
    return r;
  },
  megacount: () => {
    const r = JSON.parse(JSON.stringify(baseRestaurant));
    r.rating = 3.9;
    r.ratingCount = 1500000;
    return r;
  },
  fssai: () => {
    const r = JSON.parse(JSON.stringify(baseRestaurant));
    r.fssaiLicenseNumber = "12345678901234";
    r.fssaiVerificationStatus = "verified";
    return r;
  },
  fssaiBad: () => {
    const r = JSON.parse(JSON.stringify(baseRestaurant));
    r.fssaiLicenseNumber = "12345";
    r.fssaiVerificationStatus = "pending";
    return r;
  },
  closedToday: () => {
    const r = JSON.parse(JSON.stringify(baseRestaurant));
    r.isOpen = false;
    r.availability = { isOpen: false, closedReason: "closed_today", opensAt: "17:30" };
    return r;
  },
  offer: () => {
    const r = JSON.parse(JSON.stringify(baseRestaurant));
    r.offer = "Flat 20% off above ₹199";
    return r;
  },
  riderBanner: () => {
    const r = JSON.parse(JSON.stringify(baseRestaurant));
    r.deliveryBannerImage = "https://cdn.eatswada.com/rider.png";
    return r;
  },
};

async function run({ restaurant, reviews = reviewsReal, theme = null, reviewsPage2 = null, doShare = false, doLoadMore = false }) {
  const browser = await chromium.launch();
  const results = {};
  for (const [tag, url, isLegacy] of [
    ["legacy", LEGACY, true],
    ["new", NEW, false],
  ]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e).split("\n")[0]));
    const apiRequests = [];
    page.on("request", (r) => {
      if (r.url().includes("api.eatswada.com")) apiRequests.push(r.url().replace(/^https:\/\/api\.eatswada\.com\/api/, ""));
    });
    if (theme) await page.addInitScript((t) => { try { localStorage.setItem("eatswada_theme", t); } catch (e) {} }, theme);
    /* Capture navigator.share calls (headless has no share sheet). Also ask
       the NEW page to expose its test hooks so this harness can set the
       restaurant-open flag exactly as legacy's bare global does. */
    await page.addInitScript(() => {
      window.__EW_SHELL_TEST_HOOKS = true;
      window.__shared = [];
      try {
        Object.defineProperty(navigator, "share", {
          configurable: true,
          value: (d) => { window.__shared.push(d); return Promise.resolve(); },
        });
      } catch (e) {}
    });
    await page.route("https://api.eatswada.com/**", (route) => {
      const u = new URL(route.request().url());
      const p = u.pathname.replace(/^\/api/, "");
      let body;
      if (p === `/restaurants/${ID}`) body = restaurant;
      else if (p === `/restaurants/${ID}/menu`) body = menuPayload;
      else if (p === `/restaurants/${ID}/reviews`) {
        const page1 = u.searchParams.get("page");
        body = page1 === "2" && reviewsPage2 ? reviewsPage2 : reviews;
      }
      if (body === undefined)
        return route.fulfill({ status: 404, headers: { "access-control-allow-origin": "*" }, body: "{}" });
      return route.fulfill({
        status: 200,
        headers: { "access-control-allow-origin": "*", "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    });
    await page.goto(`${url}?id=${ID}`, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(1800);

    /* Drive both pages identically through the same public functions. */
    await page.evaluate(({ r, isLegacy }) => {
      if (r.isOpen === false) {
        /* Legacy exposes `isRestaurantOpen` as a mutable global lexical
           binding; the new page keeps it in `shellState` (exposed by the test
           hook). Set the matching one — never both. */
        if (isLegacy) isRestaurantOpen = false;
        else if (window.__ewShell) window.__ewShell.state.isRestaurantOpen = false;
      }
      window.renderRestaurantHeader(r);
      window.renderClosedWarning(r);
    }, { r: restaurant, isLegacy });
    await page.waitForTimeout(300);

    const header = await page.evaluate(() => {
      const disp = (id) => {
        const e = document.getElementById(id);
        return e ? getComputedStyle(e).display : null;
      };
      return {
        docTitle: document.title,
        resName: document.getElementById("res-name").innerText,
        resCuisine: document.getElementById("res-cuisine").innerText,
        resCuisineDisplay: disp("res-cuisine"),
        resDistance: document.getElementById("res-distance").innerText,
        resDistanceDisplay: disp("res-distance"),
        resTime: document.getElementById("res-time").innerText,
        resTimeDisplay: disp("res-time"),
        ratingNum: document.getElementById("res-rating-num").innerText,
        ratingPillDisplay: disp("res-rating-pill"),
        ratingTier: document.getElementById("res-rating-pill").dataset.tier,
        ratingCount: document.getElementById("res-rating-count").innerText,
        ratingCountDisplay: disp("res-rating-count"),
        verifiedDisplay: disp("res-verified"),
        offerText: document.getElementById("res-offer-text").innerText,
        offerDisplay: disp("res-offer-banner"),
        freeDeliveryHtml: document.getElementById("res-free-delivery").innerHTML,
        closedWarningHtml: document.querySelector(".closed-warning-card")
          ? document.querySelector(".closed-warning-card").outerHTML.replace(/\s+/g, " ").trim()
          : null,
        riderImageHidden: document.getElementById("delivery-rider-image").hidden,
        riderFallbackDisplay: disp("delivery-rider-fallback"),
        fssaiHidden: document.getElementById("rmf-fssai").hidden,
        /* `assets/fssai-logo.png` 404s on BOTH the legacy and the new site (it
           does not exist in the repo). Its `onerror="this.hidden=true"` fires
           at a different moment on each page, so the reflected `hidden=""`
           attribute is a race, not a port difference. Strip it before the
           byte-compare and report it. */
        fssaiHtml: document.getElementById("rmf-fssai").innerHTML.replace(/ hidden=""/g, ""),
      };
    });

    /* Info tab swap. */
    const tabBefore = await page.evaluate(() => ({
      menuHidden: document.getElementById("menu-pane").hidden,
      infoHidden: document.getElementById("info-pane").hidden,
      menuAria: document.getElementById("res-tab-menu").getAttribute("aria-selected"),
      infoAria: document.getElementById("res-tab-info").getAttribute("aria-selected"),
      menuActive: document.getElementById("res-tab-menu").classList.contains("active"),
      infoActive: document.getElementById("res-tab-info").classList.contains("active"),
      menuDisplay: getComputedStyle(document.getElementById("menu-pane")).display,
      infoDisplay: getComputedStyle(document.getElementById("info-pane")).display,
    }));
    await page.evaluate(() => window.switchResTab("info"));
    await page.waitForTimeout(1200);
    const tabAfter = await page.evaluate(() => ({
      menuHidden: document.getElementById("menu-pane").hidden,
      infoHidden: document.getElementById("info-pane").hidden,
      menuAria: document.getElementById("res-tab-menu").getAttribute("aria-selected"),
      infoAria: document.getElementById("res-tab-info").getAttribute("aria-selected"),
      menuActive: document.getElementById("res-tab-menu").classList.contains("active"),
      infoActive: document.getElementById("res-tab-info").classList.contains("active"),
      menuDisplay: getComputedStyle(document.getElementById("menu-pane")).display,
      infoDisplay: getComputedStyle(document.getElementById("info-pane")).display,
      infoContentHtml: document.getElementById("info-content").innerHTML.replace(/\s+/g, " ").trim(),
      infoContentDisplay: getComputedStyle(document.getElementById("info-content")).display,
      infoSkeletonDisplay: getComputedStyle(document.getElementById("info-skeleton")).display,
      reviewsStatus: document.getElementById("ew-customer-reviews-status").textContent,
      reviewsSummary: document.getElementById("ew-customer-reviews-summary").textContent,
      reviewsListHtml: document.getElementById("ew-customer-reviews-list").innerHTML.replace(/\s+/g, " ").trim(),
      moreHidden: document.getElementById("ew-customer-reviews-more").hidden,
      moreText: document.getElementById("ew-customer-reviews-more").textContent,
    }));

    let afterLoadMore = null;
    if (doLoadMore) {
      const before = apiRequests.length;
      await page.click("#ew-customer-reviews-more");
      await page.waitForTimeout(1000);
      afterLoadMore = await page.evaluate(() => ({
        reviewsListHtml: document.getElementById("ew-customer-reviews-list").innerHTML.replace(/\s+/g, " ").trim(),
        moreHidden: document.getElementById("ew-customer-reviews-more").hidden,
        moreText: document.getElementById("ew-customer-reviews-more").textContent,
        summary: document.getElementById("ew-customer-reviews-summary").textContent,
      }));
      afterLoadMore.newRequests = apiRequests.slice(before);
    }

    let share = null;
    if (doShare) {
      share = await page.evaluate(() => {
        const btn = document.querySelector("#info-content .inf-act button, #info-content button.inf-act");
        window.shareRestaurantInfo(btn || document.querySelector("#info-content .inf-act"));
        /* navigator.share is handed location.href; the two servers have
           different origins, and the legacy path carries the `.html` extension
           while the new app uses clean URLs. Normalise both so only the part
           the page actually computes is compared (the id query). */
        const norm = window.__shared.map((d) => ({
          title: d.title,
          url: (() => {
            try {
              const u = new URL(d.url);
              return u.pathname.replace(/\.html$/, "") + u.search;
            } catch (e) {
              return d.url;
            }
          })(),
        }));
        return { shared: norm, labelAfter: btn ? btn.querySelector("span")?.textContent : null };
      });
    }

    const themeStyles = theme
      ? await page.evaluate(() => {
          const pick = (sel) => {
            const e = document.querySelector(sel);
            if (!e) return null;
            const cs = getComputedStyle(e);
            return [cs.backgroundColor, cs.color].join("|");
          };
          return {
            theme: document.documentElement.dataset.ewTheme,
            infoContent: pick("#info-content"),
            infName: pick(".inf-name"),
            infSec: pick(".inf-sec"),
            reviews: pick(".ew-customer-reviews"),
            htmlBg: getComputedStyle(document.documentElement).backgroundColor,
            bodyBg: getComputedStyle(document.body).backgroundColor,
          };
        })
      : null;

    results[tag] = { header, tabBefore, tabAfter, afterLoadMore, share, themeStyles, apiRequests, errs };
    await ctx.close();
  }
  await browser.close();
  return results;
}

let failures = 0;
const rows = [];
function check(name, l, n) {
  const eq = JSON.stringify(l) === JSON.stringify(n);
  if (!eq) failures++;
  rows.push({ name, ok: eq, l, n });
  return eq;
}
function cmpGroup(prefix, L, N) {
  for (const k of Object.keys(L)) {
    const lv = L[k];
    const nv = N[k];
    const eq = JSON.stringify(lv) === JSON.stringify(nv);
    if (!eq) {
      failures++;
      log(`  FAIL ${prefix}.${k}`);
      log(`    legacy: ${JSON.stringify(lv).slice(0, 700)}`);
      log(`    new   : ${JSON.stringify(nv).slice(0, 700)}`);
    }
    rows.push({ name: `${prefix}.${k}`, ok: eq, l: lv, n: nv });
  }
}

log("## /restaurant-shell chunk 5 — side-by-side parity");
log("");
log(`legacy: ${LEGACY}?id=${ID}`);
log(`new   : ${NEW}?id=${ID}`);
log("");

/* ── A. base restaurant ───────────────────────────────────────────────── */
log("### A. Base restaurant (rating 4, ratingCount 0, verified, free delivery)");
{
  const r = await run({ restaurant: variants.base(), doShare: true });
  log("-- header");
  cmpGroup("header", r.legacy.header, r.new.header);
  log("-- tab swap");
  cmpGroup("tabBefore", r.legacy.tabBefore, r.new.tabBefore);
  cmpGroup("tabAfter", r.legacy.tabAfter, r.new.tabAfter);
  log("-- reviews requests");
  const lreq = r.legacy.apiRequests.filter((u) => u.includes("/reviews"));
  const nreq = r.new.apiRequests.filter((u) => u.includes("/reviews"));
  check("reviews: request URLs (once, page=1&limit=5)", lreq, nreq);
  log(`  legacy review requests: ${JSON.stringify(lreq)}`);
  log(`  new    review requests: ${JSON.stringify(nreq)}`);
  log("-- share");
  cmpGroup("share", r.legacy.share, r.new.share);
  log(`  legacy shared: ${JSON.stringify(r.legacy.share)}`);
  log(`  new    shared: ${JSON.stringify(r.new.share)}`);
  log(`  page errors: legacy ${JSON.stringify(r.legacy.errs)} new ${JSON.stringify(r.new.errs)}`);
}

/* ── B. reviews with more than one page ("Load more") ─────────────────── */
log("");
log("### B. Reviews with 2 pages — \"Load more\" (SYNTHETIC reviews payload)");
{
  const r = await run({ restaurant: variants.base(), reviews: reviewsPaged, reviewsPage2: reviewsPaged2, doLoadMore: true });
  cmpGroup("pagedTabAfter", r.legacy.tabAfter, r.new.tabAfter);
  cmpGroup("pagedAfterLoadMore", r.legacy.afterLoadMore, r.new.afterLoadMore);
  log(`  legacy requests: ${JSON.stringify(r.legacy.apiRequests.filter((u) => u.includes("/reviews")))}`);
  log(`  new    requests: ${JSON.stringify(r.new.apiRequests.filter((u) => u.includes("/reviews")))}`);
}

/* ── C. closed restaurant ─────────────────────────────────────────────── */
log("");
log("### C. Closed restaurant (isOpen false)");
{
  const r = await run({ restaurant: variants.closed() });
  cmpGroup("closedHeader", r.legacy.header, r.new.header);
  cmpGroup("closedTabAfter", r.legacy.tabAfter, r.new.tabAfter);
}

/* ── D. "New" pill when rating is 0 ───────────────────────────────────── */
log("");
log("### D. \"New\" pill when rating is 0");
{
  const r = await run({ restaurant: variants.unrated() });
  cmpGroup("unratedHeader", r.legacy.header, r.new.header);
}

/* ── E. verified:false ────────────────────────────────────────────────── */
log("");
log("### E. verified:false (badge hidden)");
{
  const r = await run({ restaurant: variants.unverified() });
  cmpGroup("unverifiedHeader", r.legacy.header, r.new.header);
}

/* ── F. freeDeliveryEnabled:false ─────────────────────────────────────── */
log("");
log("### F. freeDeliveryEnabled:false");
{
  const r = await run({ restaurant: variants.nofree() });
  cmpGroup("nofreeHeader", r.legacy.header, r.new.header);
  cmpGroup("nofreeTabAfter", r.legacy.tabAfter, r.new.tabAfter);
}

/* ── G. dark mode ─────────────────────────────────────────────────────── */
log("");
log("### G. Dark mode (eatswada_theme=dark)");
{
  const r = await run({ restaurant: variants.base(), theme: "dark" });
  cmpGroup("darkTheme", r.legacy.themeStyles, r.new.themeStyles);
  cmpGroup("darkTabAfter", r.legacy.tabAfter, r.new.tabAfter);
}

/* ── H. extra header variants (rating counts, FSSAI, closed_today, offer) ── */
log("");
log("### H. Extra header variants");
{
  for (const [label, make] of [
    ["ratingCount 1234 (compact K)", variants.bigcount],
    ["ratingCount 1500000 (compact M)", variants.megacount],
    ["FSSAI 14-digit verified", variants.fssai],
    ["FSSAI rejected (short/pending)", variants.fssaiBad],
    ["closed_today", variants.closedToday],
    ["offer banner text", variants.offer],
    ["delivery banner image", variants.riderBanner],
  ]) {
    const r = await run({ restaurant: make() });
    cmpGroup(`H[${label}].header`, r.legacy.header, r.new.header);
    log(`  ${label}: header compared`);
  }
}

/* ── table ────────────────────────────────────────────────────────────── */
log("");
log("### PASS / FAIL TABLE");
log("Normalised (reported, not silently ignored):");
log("  * navigator.share url: origin + `.html` extension differ by server (both send location.href).");
log("  * FSSAI logo `hidden=\"\"`: assets/fssai-logo.png 404s on BOTH sites; onerror timing is a race.");
const wName = Math.max(...rows.map((r) => r.name.length), 10);
log("CHECK".padEnd(wName) + " | RESULT");
log("-".repeat(wName + 9));
for (const r of rows) log(r.name.padEnd(wName) + " | " + (r.ok ? "PASS" : "FAIL"));
log("");
log(failures === 0 ? `CHUNK-5 PARITY: PASS (${rows.length} checks)` : `CHUNK-5 PARITY: FAIL (${failures}/${rows.length} checks differ)`);

fs.mkdirSync("compare-out", { recursive: true });
fs.writeFileSync("compare-out/shell-chunk5-parity.txt", lines.join("\n") + "\n");
console.log("\nwrote compare-out/shell-chunk5-parity.txt");
process.exit(failures === 0 ? 0 : 1);
