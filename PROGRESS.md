# EatSwada migration — PROGRESS

## 2026-10-29 Task: Phase 5a — deploy readiness (no page changes)

Files changed: `web/next.config.js` (ONE legacy redirect: `/index` → `/` 301, was 404),
`tools/vercel-parity.mjs` (NEW, 37 cases), `notes/deploy-checklist.md` (NEW, Part C),
`notes/post-migration-fixes-triage.md` (NEW, Part D), `notes/deploy-audit.md` (NEW, Part B).
No page, component or lib behaviour touched.

**Part A — vercel.json parity** (`node tools/vercel-parity.mjs`, legacy :8080/8090 vs next :3000)

| case group | cases | result | fixed |
|---|---|---|---|
| cleanUrls / `.html` → clean 301 | 9 | PASS | — |
| `/index.html` + `/index` → `/` 301 | 2 | PASS | **`/index` was 404 → added redirect** |
| map pairs (shell, sitemaps, robots, sw, fcm-sw, manifest, apple-touch) | 8 | PASS | — |
| sw.js / firebase-messaging-sw.js (no-store, JS type, SW-Allowed) | 4 | PASS | — |
| 404 unknown URL, `/restaurant` no id / bad id / NEVER_INDEX | 4 | PASS / 2 ACCEPTED | — |
| trailing slash (`/about/`, `/cart/`) | 2 | ACCEPTED (308 strip) | — |
| security headers legacy sets none | 1 | PASS | — |
| cache-control / content-type / x-robots-tag spot checks | 7 | PASS | — |
| **total** | **37** | **31 pass, 0 fail, 6 accepted-divergence** | 1 real fix |

ACCEPTED divergences (documented, not bugs): `/restaurant` bad id / NEVER_INDEX → port 404 vs
legacy 400 (both non-indexable); `/about/` `/cart/` → 308 strip vs legacy 200 (canonical no-slash
is indexed, so safe). `web/next.config.js` header/redirect only.

**Part B — build audit** (`notes/deploy-audit.md`):
- B1 routes: 39 static + **2 dynamic only** — `/restaurant` (per-`id` SEO: title/OG/canonical/JSON-LD
  from live data) and `/sitemap-restaurants.xml` (live `GET /restaurants`). Correct per AGENTS.md.
- B2 secrets scan of `.next/static` + built HTML: **0** `rzp_*`, `AIza*`, `eyJ*`, private keys.
  `Bearer ` appears only as the literal `"Bearer "+token` concat; `api.eatswada.com` + the legacy
  `eatswada.onrender.com` vendor host are public URLs (no credential). Clean.
- B3 first-load JS gzip: `/`=213.3KB, `/restaurant`=221.7, `/cart`=223.9, `/login`=183.2,
  `/orders`=190.0 (1671.2KB raw / 48 chunks). 5 largest chunks listed in the audit note.
- B4 `npm audit --omit=dev`: **4 high** via `@grpc/grpc-js` ← firebase/firestore (gRPC path
  unused; app uses Firebase auth+FCM only). `--force` would downgrade firebase@9 → **not upgraded**.

**Env var NAMES (set in Vercel; `.env.local` never zipped):** `NEXT_PUBLIC_API_BASE_URL`,
`NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_MAPTILER_ENABLED`, `NEXT_PUBLIC_MAPTILER_KEY`,
`NEXT_PUBLIC_MAPTILER_MAP_ID`, `NEXT_PUBLIC_FIREBASE_ENABLED`, `NEXT_PUBLIC_FIREBASE_API_KEY`,
`NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`,
`NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`,
`NEXT_PUBLIC_FIREBASE_APP_ID`. Server-only override `EW_API_BASE_URL` (lib/seo) **must stay UNSET
in production**.

**Part D — triage top 5** (`notes/post-migration-fixes-triage.md`): §8 payment-failed verify POST
(money) → §1 coupon subtotal 0 (money+visible) → §7 COD cap fallback (money edge) → §3 tax row
(needs backend decision) → §2 discount row. §9–§11 are legacy behaviours: leave as-is.

**FULL SMOKE (clean build, after all Part A edits):** vercel-parity 31/0/6; headers-redirects-parity
**190/190**; cart-parity **7/7**; cart-money-parity **692/0**; cart-c5c6-parity **81/0**;
payment-pages-parity **139/0**; payment-pages-compare **8 states 0.00%**; auth-parity **1013/0**;
sitemap-pwa-parity **25/25**; seo-restaurant-parity 10/10; shell-money 59, chunk5 367, chunks67 40,
chunks89 73, chunk11 58, chunk12 44 — **all PASS**; shell-boot 1/1; cart/shell/account/3d CSS-leak
**0 diffs**; compares home/search/category/under99/shell/3d/account/payment **0.00%**; `npm run build`
clean; `npx tsc --noEmit` exit 0. `next start` restarted after every rebuild.

Uncertainties: (1) exact migration branch name not verifiable (no git) — confirm with `git branch -a`;
(2) trailing-slash 308 vs legacy 200 and `/restaurant` bad-id 404 vs legacy 400 both accepted;
(3) `.env.local` required for the build — without it Google Sign-In shows "not configured" (23
auth-parity fails), so set all `NEXT_PUBLIC_*` on Vercel; (4) `@grpc/grpc-js` advisory left unfixed.

## 2026-10-28 Task: Phase 3d — partner + support/info + privacy-data + FULL regression + coverage

| page | status | compare phone/desktop | head-diff | interactions | writes | quirks |
|---|---|---|---|---|---|---|
| partner-with-us | PORTED | 0.00/0.00 | PASS | links, accordions, CTA | none | - |
| apply | PORTED | 0.00/0.00 (7 states) | PASS | 3-step form, validators, file picker | POST /vendor-applications (multipart, images) | dead code + quirks ported |
| application-status | PORTED | 0.00/0.00 (9 states) | PASS | status variants, resubmit | none (GET only) | - |
| support | PORTED | 0.01/0.00 | PASS | tabs, ticket list, create ticket | POST /support/tickets | - |
| order-help | PORTED | 0.00/0.00 | PASS | FAQ accordions, links | none | - |
| order-support | PORTED | 0.00/0.00 (6 states) | PASS | picker, chat, evidence upload | POST /upload/customer-media (multipart "images") | - |
| rate-us | PORTED | 0.00/0.00 (5 states) | PASS | star rating, text, submit | POST review | - |
| storage-check | PORTED | 0.00/0.00 | PASS | diagnostics, clear buttons | none | localStorage probes only |
| privacy-data | PORTED | 0.00/0.00 (4 states) | PASS | tabs, nominee, requests | POST privacy requests | - |

Coverage: 40 legacy *.html -> 36 PORTED, 4 EXCEPTIONS, 0 unexplained (tools/coverage.mjs exit 0).
Exceptions: `restaurant old.html` (superseded by restaurant-shell; /restaurant server route);
`restaurant-details.html` + `restaurant-info.html` (orphan Info-tab pages; 301 -> /restaurant);
`track-order-10.html` (NUL-filled junk; 301 -> /track-order).
restaurant-details audit: NOT in sitemap.xml / sitemap-restaurants.xml / api/sitemap.js / robots.txt /
any internal <a href>; only its own canonical+og:url (restaurant-details.html:203,208) and two legacy
comments (restaurant-shell.html:762, "restaurant old.html":563). No sitemap change needed.

FULL REGRESSION (all exit 0 unless noted): shell-money 59, chunk5 367, chunks67 40, chunks89 73,
chunk10 30, chunk11 58, chunk12 44, cart-parity 7/7, cart-money 692, cart-c5c6 81, cart-c7c11 132,
cart-c8 165, cart-c9 229, payment-pages 139, auth 1013, account 1182, seo-restaurant ALL PASS (Part1d
10/10), sitemap-pwa 25/25, headers-redirects 190/190, boot ALL PASS, 3d-parity 2340, 3d-pages-compare
34 states worst 0.01% (>=1%: 0), head-diff all 36 ported PASS, css-leak (3d/shell/account/cart) 0 diffs,
cart masked compares 0.00% (c1c6 desktop 0.86%), npm run build PASS, tsc --noEmit PASS.
Flake noted: cart-c7c11-compare can read 1-3% when run concurrently; passes alone (0.00%).
restaurant-details redirect: /restaurant-details + .html with ?id=abc&x=1 -> 301 -> /restaurant?id=abc&x=1.

Files changed: web/app/{partner-with-us,apply,application-status,support,order-help,order-support,rate-us,
storage-check,privacy-data}/**, web/lib/{partner-page,apply-page,application-status-page,support-page,
order-help-page,order-support-page,rate-us-page,storage-check-page,privacy-data-page}.ts (logic ports),
web/next.config.js (PORTED_PAGES + restaurant-details 301s), web/scripts/{3d-pages-compare,3d-parity,
3d-css-leak,headers-redirects-parity}.mjs, tools/{coverage,write-allowlist.json}, notes/post-migration-fixes.md.
Deleted web/scripts/_dbg.mjs. Temporary app/leakprobe probe route created for css-leak then removed.
Env var NAMES only (set in web/.env.local): NEXT_PUBLIC_API_BASE_URL, NEXT_PUBLIC_BRAND_NAME,
NEXT_PUBLIC_MAPTILER_ENABLED/KEY/MAP_ID, NEXT_PUBLIC_FIREBASE_ENABLED/API_KEY/AUTH_DOMAIN/PROJECT_ID/
STORAGE_BUCKET/MESSAGING_SENDER_ID/APP_ID.
Uncertainties: c7c11 compare flakes under parallel load; account-pages-compare hangs at browser.close()
after printing all 0.00% (results captured, process killed).

## 2026-10-28 Task: Phase 3c — account + orders pages (auth-gated) + head audit

PART A — head audit (tools/head-diff.mjs, legacy .html vs clean URL). BEFORE: 26/27 PASS, home FAIL
(missing legacy metadata). AFTER: 27/27 PASS. Fix: `web/app/page.tsx` already carried the legacy
head items (title/description/canonical/OG/Twitter + JSON-LD from index.html L13-41); the earlier
"FAIL" was stale. All fixes are metadata-only; every touched page's compare stayed at its prior
number (all 0.00%). No exceptions.

| page | before | after |
|---|---|---|
| index | FAIL | PASS |
| search, category, under99, restaurant-shell, cart, payment-success/failed/pending, about, faq, terms, refund-policy, legal, delivery-areas-and-charges, food-delivery-in-maynaguri, partner-rules, login, forgot-password, reset-password, complete-profile, location-onboarding | PASS | PASS |

PART B — pages ported (in order): profile, address, address-new, orders, track-order.
TRACK-ORDER DECISION: `track-order.html` (110,745 B, real HTML) is what vercel.json serves at
`/track-order` -> ported to `web/app/track-order`. `track-order-10.html` is **84,923 bytes of pure
NUL** (0 non-zero bytes — corrupt/empty artifact; vercel serves it only at `/track-order-10`, never
at `/track-order`). Kept legacy URL behaviour exactly: `/track-order-10.html` still 301s to
`/track-order` via next.config (matches vercel cleanUrls); the clean `/track-order-10` is a 404
(vercel 200s the NUL file; that junk URL is not ported and is not linked anywhere).

| page | status | compare phone/desktop | head-diff | scripted interactions | writes | quirks |
|---|---|---|---|---|---|---|
| profile | ported | 0.00/0.00 (3 states) | PASS | edit open/save, logout (confirm+clears 4 keys->login), avatar fallback | PUT /users/profile (W) | logout does not Firebase signOut; empty avatar circle kept |
| address | ported | 0.00/0.00 (4 states) | PASS | manage/list, editor open, add/edit/delete/set-default, map pin move, ?return=cart | POST/PUT/PATCH/DELETE /users/addresses (W) | setActive is single source of truth; sanitizeLegacyCarts reload kept |
| address-new | ported | 0.00/0.00 (1 state) | PASS | editor + map pin move | POST/PUT /users/addresses (W) | shares EatswadaAddressStore with /address |
| orders | ported | 0.00/0.00 (7 states) | PASS | list/filter/search, expand, load-more paging, invoice sheet, reorder, cancel, rate links, 401->login | POST reorder/cancel (W) | #empty-btn double-bind quirk kept (logged-in empty -> home) |
| track-order | ported | 0.00/0.00 (7 states) | PASS | polling each status (fake timers), courier marker on map, cancel countdown, invoice sheet, no-id, logged-out | PUT/POST status poll + cancel (W) | polling interval + tile-CDN stub for determinism |

Tests (legacy vs new, fake token + fake Firebase + GET fixtures; all writes intercepted):
- T1 head-diff: 27/27 PASS (new pages: profile/address/address-new/orders/track-order all PASS).
- T2 compare: account-pages-compare **38 states worst 0.00%** (phone + desktop; logged-out/loading/
  empty/populated/error/modals/tracking). Every previously ported page **0.00%/0.00%**.
- T3/T4/T5/T6/T7 account-parity: **1182 passed, 0 failed** (interaction parity, exact writes with
  key order, pure-function parity, boot-once GET counts, cross-page cart->address->cart and
  order-placed->/orders, payment-success->/track-order).
- T8 headers-redirects-parity: **137/137 PASS** (.html -> clean 301, query preserved).
- T9 smoke: home/category/under99/restaurant-shell/search **0.00%/0.00%**, auth 1013/0,
  cart-parity 7/7, cart-money 692/0, cart-c9 229/0, payment-pages 139/0, payment-compare 8/0,
  seo ALL PASS, sitemap 25/25, account CSS-leak **0 diffs**, build OK, `tsc --noEmit` exit 0,
  preflight ALL 8 CHECKS PASS.

Files changed: `web/app/page.tsx` (metadata already present, verified), `web/app/{profile,address,
address-new,orders,track-order}/`, `web/lib/{profile-page,address-page,address-new-page,address-api,
address-model,address-store,orders-page,track-order-page,customer-upload,push}.ts`,
`web/components/{Profile,Address,AddressNew,Orders,TrackOrder}Runtime.tsx`,
`web/styles/legacy/{profile,address-new,orders,track-order}-inline.css`,
`web/scripts/{account-parity,account-pages-compare,account-css-leak}.mjs`,
`tools/write-allowlist.json`, `notes/post-migration-fixes.md` (§10), `PROGRESS.md`.
Env var NAMES only (in `web/.env.local`, never zipped): NEXT_PUBLIC_API_BASE_URL, NEXT_PUBLIC_BRAND_NAME,
NEXT_PUBLIC_MAPTILER_ENABLED, NEXT_PUBLIC_MAPTILER_KEY, NEXT_PUBLIC_MAPTILER_MAP_ID,
NEXT_PUBLIC_FIREBASE_ENABLED, NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
NEXT_PUBLIC_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, NEXT_PUBLIC_FIREBASE_APP_ID.
Uncertainties: (1) `/track-order-10` clean URL 404s here vs vercel 200 on a NUL file — intentional,
the file is junk; (2) the sandbox restarted mid-task and wiped the Playwright browser cache, which
was reinstalled before the final runs.

## 2026-10-28 Task: Phase 3b — login + onboarding (auth, careful)

STEP 0 — tooling (no page code)
- `tools/preflight.mjs` STRAY already fails on `nohup.out`, `*.log`, `*.pid` (plus `.env*`,
  `node_modules`, `.next`, `*.tsbuildinfo`, `compare-out`, `.git`); SECRETS check already FAILs on
  JWT / `rzp_live_` / real emails / 10-digit Indian phones / `Bearer` / private keys and
  explicitly allow-lists the public Firebase web apiKey. No code change needed. Deleted
  `web/nohup.out`. Tree SECRETS = PASS (no fixture/note tripped it, nothing to redact).
- `notes/auth-map.md` rewritten SHORT (**132 lines**, was 212): per page the asset/CSS order with
  line numbers, Firebase SDK calls, every network call (method/path/payload/headers, writes marked),
  every storage key, every redirect + query-param handling, the already-logged-in behaviour, what the
  shared header/theme expects after login, and dead code.
- `web/package.json`: registered `cart-c9-parity`, `payment-pages-parity`, `headers-redirects-parity`,
  `auth-parity`, `auth-compare` scripts.

Pages (ported in order): login, forgot-password, reset-password, complete-profile, location-onboarding.
| page | status | compare phone/desktop | head-diff | scripted outcomes tested | writes | quirks |
|---|---|---|---|---|---|---|
| login | ported | 0.00/0.00 (3 states) | PASS (canonical only) | 14 (success/wrong pw/short pw/phone/Google existing/new/popup closed/blocked->redirect/forgot email+OTP+reset) | W1-W5 (5 POST) | dead `#slide` carousel interval; `fetchProfileForRouting` stub; ignores `?redirect=`; no session check |
| forgot-password | ported | 0.00/0.00 (2 states) | PASS | 5 (invalid phone/send OTP/verify OTP/reset success->login) | W6-W8 (3 POST) | none; 60s resend countdown kept |
| reset-password | ported | 0.00/0.00 (1 state) | PASS | 1 (double redirect: meta refresh + `location.replace`) | none | two redirect mechanisms kept |
| complete-profile | ported | 0.00/0.00 (3 states) | PASS | 7 (no token->login/token load/google paint/validation/token save/google save/onboarding=1) | W9 POST, W10 PUT (+G1 GET) | `minlength=6` vs `passwordValid>=8` mismatch kept |
| location-onboarding | ported | 0.00/0.00 (2 states) | PASS | 3 (gps denied/preset confirm/outside area) | none (localStorage only) | un-dismissable GPS gate; `DEFAULT` visual-only; two parallel Photon fetches |

Tests: T1 head-diff all 5 PASS (only canonical/og:url clean-URL rewrite). T2 compare 11 states
**0.00%/0.00%** (`auth-pages-compare.mjs`). T3 interaction parity + T4 exact writes + T5 pure-function
parity + T6 boot-once + T7 cross-page (`/cart` guest -> login -> back) + T7b header logged-in state +
T8 redirects: `auth-parity.mjs` **1013 passed, 0 failed**; `headers-redirects-parity.mjs` **111/111 PASS**.
T9 smoke: home/category/under99/restaurant-shell **0.00%/0.00%**, cart-c7c11 6 scenarios 0.00%,
payment 8 states 0.00%, cart-parity **7/7**, cart-money **692/0**, cart-c9 **229/0**,
payment-pages **139/0**, seo ALL PASS, sitemap 25/25, cart + auth CSS-leak **0 diffs**, build OK,
`tsc --noEmit` exit 0.

Search regression root-caused: it was the documented false alarm — legacy must be served through the
clean-URL shim (port 8090) so both sides lack `is-full-page`; via 8090 search = **0.00%/0.00%**
(the 91% earlier was legacy `search.html` vs new `/search` full-page-mode mismatch). Not a port bug.

Files changed: `web/package.json`, `web/scripts/auth-parity.mjs`, `web/scripts/auth-pages-compare.mjs`,
`web/scripts/headers-redirects-parity.mjs`, `notes/auth-map.md`, `notes/post-migration-fixes.md` (§9
auth quirks), `PROGRESS.md`. Deleted `web/nohup.out`.
Env var NAMES (set in `web/.env.local`, never zipped): `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_BRAND_NAME`,
`NEXT_PUBLIC_MAPTILER_ENABLED`, `NEXT_PUBLIC_MAPTILER_KEY`, `NEXT_PUBLIC_MAPTILER_MAP_ID`,
`NEXT_PUBLIC_FIREBASE_ENABLED`, `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`,
`NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`,
`NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`.
Uncertainties: none blocking. Home page `head-diff` shows FAIL (missing legacy home metadata in
`app/page.tsx`) — **pre-existing** from Phase 1b, not touched by 3b; flagged for a later batch.

## 2026-10-28 Task: Phase 3a — cart close-out + policy/info batch 1
PART A (cart close-out): `/cart`, `/payment-success`, `/payment-failed`, `/payment-pending` added to
PORTED_PAGES under "Phase 2 cart + payment" (comment already present from C9 round). `*.html` → clean
URL 301 with query preserved (`?orderId=abc&x=1`), clean URLs 200. `headers-redirects-parity.mjs`
extended with the 4 cart/payment pairs **and** the 8 batch-1 pairs → **86/86 checks PASS**.
Harnesses: cart-parity **7/7**, cart-money **692/0**, cart-c9 **229/0**, payment-pages **139/0**,
compare cart 6 scenarios **0.00%/0.00%**, payment 8 states **0.00%/0.00%**, build OK, tsc exit 0.

PART B (batch 1, all 8 ported):
| page | status | compare phone/desktop | head-diff | interactions tested | quirks |
|---|---|---|---|---|---|
| about | ported | 0.00/0.00 | PASS (canonical only) | back button | — |
| faq | ported | 0.23/0.07 | PASS | 14 `<details>` open/close | 0.23% = FA icon font on new (layout loads FA; legacy faq.html had no FA CSS) |
| terms | ported | 0.00/0.00 | PASS | 1 `<details>` | no robots/OG in legacy → none emitted |
| refund-policy | ported | 0.00/0.00 | PASS | anchors | noindex,nofollow kept |
| legal | ported | 0.00/0.00 | PASS | 3 section anchors | 2nd inline script (title/dates/entity) ported to `lib/legal-page.ts`, run once from effect |
| delivery-areas-and-charges | ported | 0.00/0.00 | PASS | 1 `<details>` | — |
| food-delivery-in-maynaguri | ported | 0.00/0.00 | PASS | 5 `<details>` | inline CSS imported LAST; 2 JSON-LD blocks |
| partner-rules | ported | 0.00/0.00 | PASS | none (no JS) | loads NO scripts, no metadata at all |
head-diff allowed diffs only: canonical/og:url `.html`→clean; plus shared-layout `viewport`/`color-scheme`/
`theme-color`/twitter additions (identical on every ported page). T4 links: all 8 pages have identical
normalized `a[href]` multisets (legacy `.html` vs clean `/path`). T3 interaction parity (details state +
innerText hash + anchors) PASS on all 8. T6 smoke: home/search/category/under99 **0.00%/0.00%**,
restaurant-shell **0.00%/0.00%** (needs the `.html` legacy URL — plain python server has no clean URLs),
cart 6/6 0.00%, payment 8/8 0.00%, tsc exit 0, build OK. **No WRITE calls in any batch-1 page.**

Files changed: `web/next.config.js` (PORTED_PAGES +8), `web/scripts/headers-redirects-parity.mjs` (+16
pairs), `tools/head-diff.mjs` (JSON-LD scanned document-wide), `web/components/FaqShell.tsx`
(`<BodyClass className="ew-doc"/>`), plus the batch-1 shells/routes created earlier this session.
Env vars: none new. Uncertainties: faq's 0.23% is the shared-layout Font Awesome font (documented above).

## 2026-10-28 Task: Phase 2n — cart chunk C9 (order placement + payment orchestration)

### Ported (legacy -> new), 1:1
`js/cart-page.js` C9 (helpers L1334-1607, `placeOrder` L1610-1919) and `js/order-payload.js` ->
NEW `web/lib/cart-page-order.ts` (`installCartPageC9`) + `web/lib/ew-order-payload.ts`
(`window.EWOrderPayload`). Functions: `placeOrder`, `shakeCheckout`, `ctSavePaymentContext`,
`ctPaymentContextBase`, `ctGoPaymentResult`, `ctRestoreCheckoutButton`, `ctReadPaymentStatus`,
`ctPaymentStatusIsTerminal`, `ctWaitForPaymentStatus`, `ctFinishCodOrder`, `ctPaymentDisplayAmounts`,
`ctFinishSuccessfulPayment`, `ctHandleFailedPayment`, `ctHandlePendingPayment`, `ctOpenRazorpay`.
Reused (not duplicated): `EWAuth`, `EWPayment`, `EWCheckout`, `EWPaymentVerify`, `ctSetCheckoutButton`,
`showToast`, `hasAddress`, `ctCleanTip`, `ctSelectedPaymentMethod`, `calculateCurrentDelivery`,
`ctComputeBreakdown`, `ctCartGroups`, `window.CtX`. Installed from `CartPageRuntime` in legacy script
order (after `installCartPageC8`, before the boot). All legacy `window.*` names published;
`ctOrderInFlight` stays module-private, readable via `window.__ewCart` only under `__EW_CART_TEST_HOOKS`.

### Tests (all PASS, real numbers)
`scripts/cart-c9-parity.mjs` **229 passed / 0 failed** (shared runner `scripts/lib/cart-c9.mjs`): verdict
matrix (UPI open/paid/failed/pending, COD complete/advance-open/advance-pending, network error, 503
maintenance, missing `payment.orderId`, Razorpay dismiss + `payment.failed`), guards (guest->login,
no-address->address), exact `POST /orders` body+headers deep-equal, Idempotency-Key bound to the payload
fingerprint, direct `page.evaluate` fn parity, boot-once GET counts, re-entrancy (double placeOrder ->
one POST, one Razorpay). EVERY non-GET stubbed via `page.route`; recorder FAILS on any unstubbed write;
Razorpay faked (CDN aborted). `cart-money-parity.mjs` extended -> **692 passed / 0 failed** (all 463
previous kept). Compare `/cart` vs `cart.html` unmasked **0.00% / 0.00%** phone+desktop. CSS-leak
`/under99 -> /cart -> /under99` **0 diffs**.

### Regression (all PASS)
shell-money 59, chunk5 367, chunks67 40, chunks89 73, chunk10 30 (needs the `.html` legacy URL — plain
`python3 -m http.server` has no clean URLs), chunk11 58, chunk12 44, cart-parity 7/7, cart-money 692,
cart-c5c6 81, cart-c7c11 132, cart-c8 165, payment-pages 139, seo ALL, sitemap 25/25, headers 26/26,
boot ALL. `npx tsc --noEmit` exit 0; `npm run build` OK.

### WRITE
Added `POST /orders` to `tools/write-allowlist.json` (the one write C9 performs). No other writes.

### Quirks / uncertainties
- Legacy `placeOrder` re-reads `nearbite_address` AFTER `calculateCurrentDelivery()`; ported in the same
  order so the address sent matches the fee just computed.
- `Idempotency-Key` is a random UUID; compared by presence + the deterministic `nearbite_checkout_fp`.
- `/cart` NOT added to `PORTED_PAGES`; C9 is not a "ported page" (cart close-out round does that).
- C8 (address/profile hydration) and C10 (payment result pages) were delivered in the earlier 2n build
  and are unchanged here.
- chunk10 parity needs `http://localhost:8080/restaurant-shell.html` as the legacy base; its built-in
  default uses the clean URL which the plain python server does not serve (harness quirk, not a regression).

## 2026-10-28 Task: Phase 2n — C8 (cart address/profile hydration) + C10 (payment result pages)

### PART A — C8 (cart page): address + profile hydration
Ported/verified `web/lib/cart-page-address.ts` (`installCartPageC8`): the C8 LIFECYCLE listeners
(`pageshow`, `storage`, `nearbite:address-changed`, `resize`; legacy `js/cart-page.js` L3309–3346)
installed from `CartPageRuntime` in legacy script order (after C5/C6, before the boot). The C8
FUNCTIONS were already ported by C2/C3 (`loadAddress`, `closeSheet`, `ctAddrHydratedFor`, the address
sheet wiring L187–215 / L1228–1300 / L3038–3132); NOT duplicated. `GET /users/profile` hydration and
the address block DOM use the exact legacy keys (`nearbite_addr_*`, `nearbite_profile`), CTA
enabled/disabled state and window globals unchanged. **Do NOT port C9** — untouched. `/cart` NOT added
to PORTED_PAGES. No WRITE. Tests: `scripts/cart-c8-parity.mjs` **165 passed, 0 failed** (GET-only
fixtures `cart-c8-{addresses,empty,noname,badcoords,401,hang}.json`; profile saved/empty/missing
phone+name/malformed coords/401/network/hang; address-block innerHTML hash, sheet DOM on open, CTA
state, exact storage keys after load + each tap, direct `page.evaluate` fn parity). Compare (phone +
desktop, unmasked) for every state: **0.00%/0.00%**. `cart-money-parity.mjs` extended, **463 passed,
0 failed** (all 298 previous kept). Boot request counts + CSS-leak `/under99→/cart→/under99`: 0 diffs.

### PART B — C10: payment result pages
NEW `app/{payment-success,payment-failed,payment-pending}/page.tsx` + `components/Payment*Shell.tsx`
(static markup) + `components/Payment*Runtime.tsx` ("use client", legacy script order). Ported
UNCHANGED into `web/lib`: `payment-success.ts` (inline L74–106), `payment-failed.ts` (inline L55–121),
`payment-pending.ts` (inline L74–116), reusing `ew-auth.ts`, `ew-payment-state.ts`, `ew-checkout.ts`,
`ew-payment-verify.ts`. CSS byte-for-byte in `web/styles/legacy/` in exact legacy `<link>` order, no
Tailwind preflight; head items as the map lists; canonicals point at the clean URLs. Pages NOT added to
PORTED_PAGES (cart close-out round does that).

**Quirk found + ported exactly (notes/post-migration-fixes.md #8):** `payment-failed.html` does NOT
load `navigation.js`, so its `window.fetch` was the native unbound function; passing it as
`EWPaymentVerify.run({fetchImpl: fetch})` throws `Illegal invocation` (`this === opts`), so the legacy
retry-verify path NEVER POSTs `/payments/verify` and falls back to `/status` polling. The Next app
installs the shell fetch-timeout wrapper on every page (decision 10), which would have made the POST
fire — a real divergence. Fixed faithfully: `installFetchTimeout` exposes `window.__nearbiteNativeFetch`
(the raw unbound fetch) before wrapping, and `payment-failed.ts` passes that as `fetchImpl`, so the same
throw → same `/status` fallback → identical requests. Legacy → port table: success L74–106, failed
L55–121 (+`payment-state.js`/`checkout-key.js`/`payment-verify.js`), pending L74–116. Redirect targets
kept as `.html` (cleanUrls contract).

WRITE CALLS: exactly `web/lib/payment-failed.ts` (POST /payments/retry) and `web/lib/ew-payment-verify.ts`
(POST /payments/verify) added to `tools/write-allowlist.json` with a comment per entry. Every test
intercepts ALL non-GET via `page.route` with stubs, records method+URL+headers+exact body, and FAILS on
any unstubbed write; Razorpay is a fake (CDN aborted); TEST MODE only; header names + payload shapes
unchanged. Tests: `scripts/payment-pages-parity.mjs` **139 passed, 0 failed** — verdict matrix
(success/failed/pending, paid-after-poll, timeout/30 s poll stop, invalid/missing order id,
already-verified, network error, 401/500, `__hang__`), fake-clock 3.6 s redirect + 30 s poll, exact
write body+headers deep-equal (legacy vs new), boot-once counts, retry / try-another / back-to-cart
targets. Compare `scripts/payment-pages-compare.mjs`: **8 states 0.00%/0.00%** phone+desktop.

REGRESSION (all PASS): shell-money 59, chunk5 367, chunks67 40, chunks89 73, chunk10 30 (needs the
`.html` legacy URL), chunk11 58, chunk12 44, cart-parity 7/7, cart-money 463, cart-c5c6 81, cart-c7c11
132, cart-c8 165, seo ALL, sitemap 25/25, headers 26/26, boot ALL, shell/cart CSS-leak 0 diffs. Compare
ported pages home/under99/category/shell **0.00%/0.00%**. `npm run build` OK (15 routes), `npx tsc
--noEmit` exit 0.

Uncertainties: `payment-pending` boot issues 1 `/status` GET vs legacy 2 (new ≤ legacy, PASS; the 2nd is
the legacy `check()` + `setInterval` firing before `networkidle`). Boot write counts: none on success;
failed/pending boot issue no writes. Redirect DESTINATIONS (orders/track-order/cart/login) are not ported
yet, so tests compare the page's OWN first redirect target, not the destination DOM. `#E9546B` vs
`#e9546b` in the copied sheet is the Next CSS minifier lowercasing the hex (case-insensitive compare);
runtime `primary()` reads the var, so behaviour is identical.

## 2026-10-28 Task: Phase 2m — (1) preflight tooling, (2) cart chunks C7 + C11

### PART 1 — tools/preflight.mjs (no page code)
NEW `tools/preflight.mjs` (node built-ins only): `node tools/preflight.mjs [--zip <path>] [--update-shared]` prints a
PASS/FAIL line per check and writes the same text to `preflight-report.txt` (repo root, in the zip). Checks: STRAY
(no `.env*`/node_modules/.next/*.tsbuildinfo/compare-out/.git in the web|tools|notes payload), SHARED (sha256 of
cart.ts/api.ts/safe-html.ts/CartBar.tsx/Header.tsx + every file in web/styles/legacy + web/public vs
`tools/frozen-hashes.json`), PORTED (prints PORTED_PAGES from web/next.config.js), NOWRITE (greps web/app|components|lib
for `method: POST|PUT|PATCH|DELETE` fetch; each hit must be in `tools/write-allowlist.json`), ZIPNAME (name + file count
+ strays inside the zip), GIT (no git commands in tools/ or web/scripts/), PROGRESS (newest entry at TOP, <= 60 lines).
`--update-shared` ran ONCE: 102 hashes written (the 2h robots.txt edit is in the baseline). NEW
`tools/write-allowlist.json` (`{"files":["web/lib/api.ts"]}`) — C7/C11 add NO entry (no write fetch). AGENTS.md: added
the final "STANDARD TASK PROTOCOL" section (frozen shared files + how to run preflight; ONE cumulative zip named exactly
as the prompt says, contents web/ tools/ notes/ PROGRESS.md AGENTS.md preflight-report.txt, excluding
node_modules/.next/.env*/*.tsbuildinfo/compare-out; PROGRESS format; ignore stale briefs — the prompt wins; regression
list + how to run it; "if a gated step fails, STOP and report"). Every existing rule kept.
Preflight gate (all PASS): STRAY clean; SHARED 102 byte-identical; PORTED = ["/","/search","/category","/under99",
"/restaurant-shell"]; NOWRITE 0 write calls; ZIPNAME informational (no --zip yet); GIT 0; PROGRESS 60 lines.
SUMMARY: ALL 7 CHECKS PASS. Part 2 proceeded.

### PART 2 — C7 + C11 ported
NEW `web/lib/cart-checkout-upgrades.ts` (`window.CtX`, ~660 lines): payment selector, COD/UPI eligibility, itemized
bill preview (packaging/handling/small-cart/surge/tax/coupon), free-delivery progress bar, CTA blocking, banners.
`web/lib/platform-status.ts` (`window.EWPlatform`) was already ported (2j/2l) — reused, not duplicated.
`web/components/CartPageRuntime.tsx` installs platform-status -> CtX -> C2 (legacy script order cart.html L418–421).
Legacy -> port table (C7 = `js/cart-checkout-upgrades.js` L20–457; C11 = L95–151 + L427–433 + `platform-status.js`
L1–285): `pricing/totalDelta/fmtTotal` (L41–89), `ctaBlock` (L95–99), `codState/upiState/getPaymentMethod` (L101–126),
`revalidateBeforeOrder/storedMethod` (L127–151), `selectMethod/refreshPayment/resetMethod` (L152–234),
`paintBill/paintFreeDelivery/paintPayment/paintPayNote/ctaLabel/ensureMounts` (L236–433),
`onClick/onChange/init/handleOrderFailure` (L427–457). Function names, element ids (`ct-pay-card`,
`ct-platform-banners`, `ct-fd-progress`, `ct-cutlery-input`, `bill-*-row`), window globals (`window.CtX`) and storage
keys (`nearbite_payment_method`, `nearbite_send_cutlery`) kept. No WRITE: C7/C11 call only GET /platform/public-status;
`POST /orders` appears in comments only — no allowlist entry. Math.round for money; Math.ceil only for the
free-delivery "add ₹X more" nudge (as legacy).
Compare (Part D, compare.mjs, UNMASKED — C8/C9/C10 have no /cart DOM region, mask list is empty): plain
**0.00%/0.00%**, custom+portion **0.00%/0.00%**, empty **0.00%/0.00%**, restaurant held (isOpen:false) **0.00%/0.00%**,
maintenance **0.00%/0.00%**, shortage **0.00%/0.00%** (phone/desktop).
Tests: `cart-c7c11-parity.mjs` (NEW, 132 checks) — A COD/UPI matrix (7 fixtures x load x tap: selector innerHTML,
aria-checked/disabled, note, storage), B fee preview + rounding, C banners + CTA block + 503, D free-delivery,
E poll/error. `cart-money-parity.mjs` extended with A–C, kept all 178 -> **298 passed, 0 failed**. `cart-c5c6-parity`
81, `cart-parity` 7/7, boot-once legacy {public-status 1, restaurant 6, menu 3} vs new {1, 5, 2} PASS, CSS-leak
/under99->/cart->/under99 **0 diffs**. Regression: shell-money 59, chunk5 367, chunks67 40, chunks89 73, chunk10 30
(legacy `restaurant-shell.html` URL), chunk11 58, chunk12 44, seo/sitemap 25/25/headers 26/26/boot ALL PASS;
`npm run compare` home/search/category/under99 0.00% phone+desktop; `npm run build` OK; `npx tsc --noEmit` exit 0;
`node tools/preflight.mjs --zip deliverables/eatswada-web-phase-2m.zip` ALL PASS.
Quirks ported exactly (in `notes/post-migration-fixes.md`): `ctState.items` never assigned (coupon subtotal always 0),
`ctState.discount`/`ctState.tax` dead reads, unreachable 40/50 delivery tiers, `#ct-fd-progress` lazily inserted after
`#free-delivery-nudge`, CtX `paySig` short-circuit, COD cap default 1000, `/cart` noindex + canonical.
Uncertainties: (1) C7 `ctaBlock` is never called by legacy `cart-page.js` (quirk) — ported as dead code; CTA blocking
runs only through `revalidateBeforeOrder`. (2) "restaurant held" is modelled as `isOpen:false` on the restaurant GET;
legacy has no separate "holding orders" flag. (3) `cart-c7-error.json` omits the /platform/public-status key so the
harness 404s it. Env vars the owner must set (names only): `NEXT_PUBLIC_API_BASE_URL` and the existing
`NEXT_PUBLIC_FIREBASE_*` / `NEXT_PUBLIC_MAPTILER_KEY` from `config.js`.

## 2026-10-27 Task: Phase 2l — cart page chunks C5 + C6 (extras: note/tip/instructions + 3 sheets; complete-your-meal rail)

Files changed (all under `web/`, plus `PROGRESS.md`; no legacy file, no git command):
`web/lib/cart-page-meal.ts` (C6, NEW, 1070 lines), `web/lib/cart-page-extras.ts` (C5, NEW, 556 lines),
`web/components/CartPageRuntime.tsx` (installs C5 then C6 after C4, legacy source order),
**`web/components/CartShell.tsx` (FIX: mounted `<CartBar/>` — see below)**, `web/scripts/cart-c5c6-parity.mjs`
(NEW, 81 checks), `web/scripts/cart-c1c6-masked-compare.mjs` (NEW), `web/scripts/fixtures/cart-menu.json` (NEW,
live GET fixture). C2/C3/C4 UNCHANGED. `/cart` still NOT in `PORTED_PAGES`. **No WRITE endpoint called** (grep: 0
POST/PUT/PATCH/DELETE in the cart page code); C9/C10 files untouched. CSS import order UNCHANGED from 2j (22
sheets, byte-identical, Manrope+FA from layout). No Tailwind preflight.

**BUG FIXED THIS PHASE (why C6 meal-add failed in 2k):** legacy `cart.html` loads `cart-bar.js` (L420) which
defines `window.updateCart`, injects `#wc-styles` and appends `#white-cart-root` / `#ew-cart-drawer-backdrop`
(both `display:none` on this page). The new `/cart` never mounted `<CartBar/>`, so `ctAddMealItem` hit the
`typeof window.updateCart !== 'function'` guard and toasted instead of adding. Mounted `<CartBar/>` before
`<CartPageRuntime/>` in `CartShell.tsx`. Pixels did not move (masked compare still 0.00%): the nodes are
`display:none`. This was a genuine port gap, not a design change.

Legacy → port table (C5 = `js/cart-page.js` L1930–3305; C6 = L2159–2808 + L3262–3272 + L2681–2754 IIFEs):
C5 `CT_NOTE_CFG`/`ctNoteField` (L520–547/2042), `openNoteSheet/saveNoteSheet/removeNoteSheet` (L2866–2940),
`ctSetBackgroundHidden/ctSyncKeyboardInset/ctAttachViewportSync/ctDetachViewportSync/CT_BG_NODES` (L1930–1965),
`showToast` (L1302–1313), Escape/Tab-trap keydown (L2015–2034), `ctSelectTipTab` (L3137–3152) + keydown
(L3282–3294), `toggleDeliveryInstructions` (L3153–3163, DEAD — kept), `ctAnimateGroupBody` (L3168–3204), extras
click wiring (L3225–3280). C6 `ctMenuForRestaurant/ctFetchMenu/ctInCartTest` (L2191–2269),
`ctOriginalPriceHydration` (L2301–2409), `ctMenuGroups/ctPairWeight/ctMealCardHtml` (L2411–2477),
`ctMealItems/ctMealTabs/ctMealTab/ctMealTabsSig/ctMealSeq` (L2183–2187, OFF window), `ctSelectMealTab/
ctSyncMealTabState/ctSyncMealIndicator/ctPaintMealTrack` (L2478–2552), `paintCompleteMeal/ctRetryCompleteMeal`
(L2553–2678), `ctAddMealItem` (L2760–2805, only cart WRITE via `window.updateCart`), drag IIFE (L2698–2754).
`ctMealBusy` module-private. Money: `Math.round` only; `Math.ceil` only where legacy does.

Test A (compare.mjs; legacy `python3 -m http.server 8080` vs `next start` :3000). Masked C1–C6 compare
(`cart-c1c6-masked-compare.mjs`; masks `#ct-platform-banners, #ct-pay-card, #ct-fd-progress` = unported C7 payment
card + free-delivery bar): empty **0.00%/0.00%**, plain seeded **0.00%/0.00%**, custom+portion **0.00%/0.00%**,
`__hang__` restaurant GET **0.00%/0.00%** (phone/desktop). **Unmasked** (plain seeded) **1.72%/0.57%** — the entire
residual is the unported C7 sections above; heights legacy 2039 vs new 1747 (phone).

Test B/C (`cart-money-parity.mjs`) **178 passed, 0 failed** — storage `nearbite_cart`/`nearbite_cart_extras` EXACT
before+after load (no `Date.now()` normalisation; decision 1), bill rows/total/`updateBillCompact`, rounding edges
(x.5, qty>1, MRP vs price), malformed-cart migration by `sanitizeLegacyCarts`; direct C2 money functions via
`page.evaluate` deep-compare identical. `cart-c5c6-parity.mjs` **81 passed, 0 failed** (C5 note sheet open/save/remove,
tip presets + custom sheet, DI pills + tab switch + Escape; C6 rail paint, meal tabs, meal-add cart/name/label/toast,
12 direct C6 fn parity, MRP hydration storage). `cart-parity.mjs` **7/7**. Test D boot-once: legacy {public-status 1,
restaurant 6, menu 3} vs new {1, 5, 2} → new ≤ legacy PASS. CSS-leak `/under99→/cart→/under99`: **0 diffs**.

Test E regression (all PASS): shell-money 59, shell-chunk5 367, shell-chunks67 40, shell-chunks89 73,
shell-chunk10 30 (needs `restaurant-shell.html` legacy URL), shell-chunk11 58, shell-chunk12 44, seo ALL PASS,
sitemap 25/25, headers 26/26, boot ALL PASS. `npm run compare` home/search/category/under99 **0.00% phone+desktop**,
restaurant-shell 0.02%/0.02%. `npm run build` OK (12 routes). `npx tsc --noEmit` exit 0.

**Decision 10 answer:** the shared shell ALREADY installs the `navigation.js` fetch timeout — `ShellRuntime` (layout)
calls `installNavigation()` → `installFetchTimeout()`, guarded by `window.__nearbiteFetchTimeout`. On `/cart` it is
`true` (verified), so the page installs it ONCE, client-side, and must NOT wrap `fetch` again.

Quirks ported exactly (in `notes/post-migration-fixes.md`): `ctState.items` never assigned (coupon subtotal always 0),
`ctState.discount`/`ctState.tax` dead reads, unreachable 40/50 delivery tiers, strict 24-hex filter, empty
`css/cart-savings-banner.css`, `/cart` noindex + canonical `https://eatswada.com/cart`, timings identical.

Uncertainties: unmasked compare stays >1% until C7 lands (expected, sections masked). `ctAddMealItem` calls
`window.updateCart` — a local cart WRITE (same as legacy), never a network WRITE. `cart-menu.json` is a live GET
fixture (37 items) — re-record if the backend menu changes.

## 2026-10-27 Task: Phase 2k — cart page chunks C3 + C4 (geo/delivery fee + items render/qty/remove/clear)

Files changed (all under `web/`, plus `PROGRESS.md`; no legacy file, no git command):
`web/lib/cart-page-delivery.ts` (C3, NEW), `web/lib/cart-page-items.ts` (C4, NEW),
`web/components/CartPageRuntime.tsx` (installs C3 then C4 after C2, legacy script order),
`web/scripts/cart-money-parity.mjs` (+C3/C4 parts), `web/scripts/cart-c1c4-masked-compare.mjs` (NEW).
C2 (`cart-page-state.ts`) is UNCHANGED. `/cart` still NOT in `PORTED_PAGES`. **No WRITE endpoint called**
(grep: 0 POST/PUT/PATCH/DELETE in the cart page code); C9/C10 files (`order-payload/checkout-key/payment-*`)
untouched. CSS import order UNCHANGED from 2j (18 page sheets in legacy `<link>` order, 18 md5-identical;
Manrope+FA come from layout → 22 total). No Tailwind preflight.

Legacy → port table (C3 = `js/cart-page.js` L216–1066; C4 = L659–771 + reused L1117–1226):
C3 L243 `ctAddrHydratedFor`→same; L216–310 `calculateCurrentDelivery`→same; L317–452 `ctComputeBreakdown,
renderMultiBreakdown, applyMultiDelivery`→same; L471–475 `syncPaymentOptions`→same; L921–1066
`setDeliveryPending, applyDelivery, refreshDelivery, scheduleDelivery`→same; L1033–1034
`let ctDeliveryReq/ctDeliveryTimer` stay OFF window (module-private, like classic-script `let`); cancel bridge
`ctCancelDeliveryRefresh` (NEW helper — C2 calls it via the `typeof window.X==='function'` guard). C4 L659–771
`paintItems`→same (the only C4-owned fn); `renderCart/repaintCart/cartAdjust/ctBumpQty/clearCart` reused from C2.
Money rules kept: `Math.round` for money, `Math.ceil` only for the "add ₹X more" nudges; unreachable 40/50 fee
tiers kept (decision 3).

Test A (compare.mjs, legacy `python3 -m http.server 8080` vs `next start` :3000): empty cart phone 0.00% /
desktop 0.00%; plain seeded **1.98% / 0.66%**; custom+portion **1.70% / 0.62%**; hang **2.19% / 0.74%**. The
non-zero rows are page-height differences (legacy 1769 vs new 1477 px) from the UNPORTED later chunks (C5 meal
rail, C7 payment card / free-delivery bar / platform banners). Masking exactly those blocks
(`cart-c1c4-masked-compare.mjs`) gives **0.00% phone / 0.00% desktop** on both plain and custom seeds. Empty
cart does NOT redirect (legacy shows `#empty-cart`), tested as legacy does.
Test B (`cart-money-parity.mjs`): **178/178 PASS** — storage before/after load deep-equal, bill rows, total,
`updateBillCompact`, C3 delivery fee/value/class, nudge text/icon, CTA label; rounding edges (x.5, qty>1,
MRP vs price) and the malformed-cart `sanitizeLegacyCarts` migration all equal. Keys compared EXACTLY (decision 1).
Test C: direct `page.evaluate` parity of every C3/C4 function on identical inputs — PASS.
Test D (`cart-boot-parity.mjs`): boot once — legacy {platform 1, restaurant 6, menu 3} vs new {platform 1,
restaurant 3} → new issues no more GETs per endpoint: PASS. CSS-leak `/under99→/cart→/under99`: fresh 9 sheets
bg rgb(250,249,246) → on /cart 10 sheets body "ct-page" → back 9 sheets, bg + body class restored → 0 diffs.
Test E regressions ALL PASS: money 59, chunk5 367, chunks67 40, chunks89 73, chunk10 30, chunk11 58, chunk12 44,
cart-parity 7/7, seo-restaurant ALL, sitemap-pwa 25/25, headers-redirects 26/26, shell-boot-requests ALL;
`npm run compare` home/search/category/under99 **0.00% phone+desktop**; `npm run build` OK; `npx tsc --noEmit`
exit 0. (chunk10 needs the `.html` legacy URL — `python3 http.server` serves the real file only at
`/restaurant-shell.html`.)

Decision 10 answer: the shared shell ALREADY installs the fetch timeout. `<ShellRuntime/>` (layout) calls
`installNavigation()` → `installFetchTimeout()`, guarded by `window.__nearbiteFetchTimeout` (idempotent); legacy
`navigation.js` self-installs it at parse time the same way. The cart runtime therefore does NOT wrap `fetch`
again — verified `window.__nearbiteFetchTimeout === true` after boot on both pages.

Quirks ported exactly (no fixes): unreachable 40/50 fee tiers; `ctState.items`/`discount`/`tax` dead reads —
all four logged in `notes/post-migration-fixes.md`. Also the `stripIcon.className` SVG no-op: legacy sloppy
mode silently ignores the write, reproduced via `assignClassName` (strict-mode try/catch) in
`lib/cart-page-delivery.ts`.

Uncertainties / TODOs:
- Window surface has 2 extra globals vs legacy: `window.sanitizeLegacyCarts` (C2; legacy keeps it in an IIFE)
  and `window.ctCancelDeliveryRefresh` (C3; a port-only bridge C2 calls through a window guard). Neither affects
  rendering/behaviour; removing them needs a C2 edit (outside this task's file set), so they stay for now.
- Masked C1–C4 residual is 0.00%; the unmasked residual is entirely unported C5–C11 (confirm when those land).
- The `/search` compare FAIL seen mid-session was a FALSE ALARM: `:8080/search?q=` 404s on `python3 http.server`
  (no clean-URL rewriting). With the clean shim (`:8090/search?q=`) search is **0.00% / 0.00%**.

## 2026-10-27 Task: Phase 2j — cart page chunks C1 + C2 (static shell + CSS, cart data + money math)

Files changed (all under `web/`, plus `notes/`, `PROGRESS.md`; **no legacy root file, no git command**):
`web/app/cart/page.tsx` (C1: metadata + CSS import order), `web/components/CartShell.tsx` (C1: cart.html
markup as JSX, design frozen), `web/components/CartPageRuntime.tsx` (C2 client Runtime), `web/lib/cart-page-state.ts`
(C2 data + money math), `web/styles/legacy/**` (22 CSS copied byte-for-byte — see order below),
`web/scripts/cart-money-parity.mjs`, `web/scripts/cart-masked-compare.mjs`, `web/scripts/cart-boot-parity.mjs`,
`web/scripts/cart-css-leak.mjs`, `web/scripts/fixtures/cart-*.json`, `notes/post-migration-fixes.md`, and
`Date.now()`-normalisation comment cleanups in `cart-parity / shell-money-parity / shell-chunk11 / shell-chunk12 /
shell-chunks89 .mjs`. **`/cart` is NOT added to `PORTED_PAGES`** (legacy `cart.html` keeps serving; `/cart.html`
still 404s on Next, 301 comes later). **No WRITE endpoint is called** (grep: 0 POST/PUT/PATCH/DELETE).

CSS import order (EXACT legacy `<link>` order, `app/cart/page.tsx`): style.css · css/cart-page.css ·
css/cart-header.css · css/cart-savings-banner.css (0-byte placeholder, decision 7) · css/cart-items.css ·
css/cart-add-items.css · css/cart-meal-suggestions.css · css/cart-coupons.css · css/cart-rider-options.css ·
css/cart-delivery-details.css · css/eatswada-ui-system.css · eatswada-theme.css · eatswada-header-theme.css ·
css/eatswada-back-button.css · css/cart-premium-refinement.css · css/cart-bill-summary.css ·
css/cart-checkout-header-refinement.css · css/platform-status.css. All 18 verified `md5sum`-identical to legacy.
No Tailwind preflight (`globals.css` imports only `tailwindcss/theme.css` + `utilities.css`).

Compare result (Test A, `python3 -m http.server 8080` legacy vs `next start` :3000):
**A1 empty cart phone 0.00% / desktop 0.00%**; **A2/A3 masked C1+C2 (plain, custom+portion, hang) phone 0.20% /
desktop 0.06%**. Unmasked A2/A3 FAIL is expected and traced to UNPORTED C3–C11 (delivery fee value, item rows,
CYM, payment card): legacy 1769/2097 px vs new ~1356 px. Residual masked clusters (rows 770–1089) are the
C3-owned delivery-fee value/total. Empty cart does NOT redirect (legacy shows `#empty-cart`); tested as legacy does.

Test B — money parity `web/scripts/cart-money-parity.mjs`: **50/50 PASS**. Deep-compared `nearbite_cart` /
`nearbite_cart_extras` before+after load, bill rows text, total, `updateBillCompact`, hero/footer/corner savings,
CTA label. Rounding edges PASS (x.5 prices, qty 2/3, MRP vs price, MRP<price, string numbers). Malformed cart:
`sanitizeLegacyCarts` reset dialog + post-migration storage + exactly-one reload all equal.
Test C — direct `page.evaluate` C2 parity: `cleanNote, cleanTip, esc, deliveryFee, distanceKm, normalizeCoords,
getCartRestaurantId, ctEtaText, customLine, synth, ctCartGroups` — all PASS on identical inputs.
Test D — boot once: legacy `{platform 1, restaurant 6, menu 3}` vs new `{platform 1, restaurant 2}` — new issues
**no more GETs** per endpoint (fewer because C3+ scripts unported); PASS. CSS-leak `/under99→/cart→/under99`:
fresh sheets=9 bg=rgb(250,249,246); on /cart sheets=10 bg=rgb(244,245,248) body="ct-page"; back sheets=9
bg=rgb(250,249,246) → **0 computed-style diffs on return**.
Test E — all regressions PASS: money 59, chunk5 367, chunks67 40, chunks89 73, chunk10 30, chunk11 58, chunk12 44,
cart-parity 7/7, seo-restaurant ALL, sitemap-pwa 25/25, headers-redirects 26/26, shell-boot-requests ALL;
`npm run compare` home/search/category/under99 **0.00% phone+desktop**; `npm run build` OK; `npx tsc --noEmit` exit 0.
(Note: a long-running `next start` keeps a stale in-memory build manifest — ALWAYS restart it after a rebuild,
else pages 404 their own chunks and every compare looks broken.)

Owner decisions: (1) no `Date.now()` normalisation — cart keys compared EXACTLY; harnesses re-run, all PASS.
(2) dead code ported verbatim. (3) 40/50 fee tiers kept. (4/5) `ctState.items`/`discount`/`tax` quirks kept —
recorded in `notes/post-migration-fixes.md`. (6) `/cart` noindex, canonical → `https://eatswada.com/cart`.
(7) empty `cart-savings-banner.css` included. (8) strict 24-hex filter kept. (9) `sanitizeLegacyCarts` runs as a
one-shot client effect BEFORE any cart read. **(10) `installNavigation()` already installs the `window.fetch`
timeout wrapper ONCE (`installFetchTimeout`, guarded by `__nearbiteFetchTimeout`) — the cart runtime does NOT
wrap fetch again.** (11) timings identical.

Legacy → port function table (ranges as given): L11–41 `sanitizeLegacyCarts`→`sanitizeLegacyCarts`;
L41–47 `esc`→`esc`; L478–498 `ctState`→`ctState`; L551–660 `ctCleanNote/ctCleanTip/loadCartExtras/saveCartExtras/
clearCartExtras/readCart/paintBill(head)/paintSavings*`→same names; L772–890 `paintBill/applyTotals/updateBillCompact`
→`paintBill/applyTotals/updateBillCompact`; plus `deliveryFeeForDistance, distanceKm, normalizeCoords,
getCartRestaurantId, ctEtaText, customLine, synth, ctCartGroups, loadAddress, renderCart, syncFooterOffset,
closeSheet`. Published on `window` exactly as legacy classic scripts did; top-level `let/const` (`ctState` data
fields) stay OFF window (test bridge: `window.__ewCart.state` / `__EW_CART_TEST_HOOKS`).

Open questions / TODOs: `notes/post-migration-fixes.md` (items/discount/tax quirks, unreachable fee tiers).
Uncertainty: the masked C1+C2 residual (0.20% phone) is attributed to unported C3; confirm when C3 lands.

## 2026-10-27 Task: Phase 2i — proxy hardening + cart/payment MAP (no page code)

**Part 1 — proxy hardening (done).** Files: `web/proxy.ts`, `web/app/restaurant/page.tsx`,
`web/scripts/seo-restaurant-parity.mjs` (no legacy file touched, no git commands).
- 1a `proxy.ts`: the 5xx/network fall-through and `rewriteNotFound` now `headers.delete("x-ew-restaurant")`
  before `NextResponse.next/rewrite`, so a client-supplied header is never forwarded on any path that
  does not set it itself.
- 1b `page.tsx`: the forwarded payload is accepted only when `payload.data._id === id`; otherwise the
  route calls `fetchRestaurant` (forged header ignored).
- 1c `proxy.ts`: payload encoded length > 6000 chars → header dropped, page fetches for itself
  (one upstream GET either way).
- 1d `seo-restaurant-parity.mjs` new "Part 1d hardening" section (own stub on :3111): 10 checks
  PASS — (i) forged header + upstream 500 → 200 and the forged name appears in neither HTML nor
  JSON-LD; (ii) forged header + mismatched id on healthy upstream → real data wins; (iii) ~12 KB
  payload → 200 with correct title/og:title/JSON-LD name.
- 1e results: seo-restaurant-parity ALL PASS (incl. 10/10 hardening); sitemap-pwa-parity 25/25;
  headers-redirects-parity 26/26; shell-boot-requests ALL PASS (restaurant 1/1, menu 1/1);
  cart-parity 7/7 steps PASS; `npm run build` OK (11/11 static); `npx tsc --noEmit` exit 0.

**Part 2 — MAP only.** New `notes/cart-payment-map.md` covers `cart.html` (424), `payment-success.html`
(107), `payment-failed.html` (122), `payment-pending.html` (117) + the 16 JS files they load.
Key findings:
- Cart/payment pages load **no Firebase SDK**; auth gating is token-only (`EWAuth.getToken()`).
  `cart.html` works for guests; login is required only at Order time (stash to `nearbite_cart_before_auth`,
  `nearbite_after_login='cart.html'`, → `login.html`).
- 9 network calls: GET `/restaurants/:id`, `/restaurants/:id/menu`, `/users/profile`,
  `/payments/:orderId/status`, `/platform/public-status`; WRITE POST `/orders`, `/payments/verify`,
  `/payments/retry`, `/coupons/validate`. WRITEs must never run in tests.
- Razorpay flow mapped end to end (order creation → checkout options → handler/ondismiss → verify →
  paid/failed/pending). TEST MODE ONLY; payload shapes frozen.
- Money: `Math.round` for money, `Math.ceil` only for "add ₹X more" nudges; delivery fee 30/40/50
  (40/50 unreachable — radius capped 10 km); fee default 30; tip clamp [1,1000]; display total =
  subtotal + deliveryFee + tip; backend total authoritative.
- ⚠ `Date.now()` cart-key claim from prior notes is **NOT found** in legacy: the customized cart key is
  the deterministic composite name (`restaurant-shell.html` 3255/3266); the only `Date.now()` id is the
  checkout idempotency key. Logged as an open question.
- Dead code found: `ctExtractMenu` (cart-page 2263), `toggleDeliveryInstructions` (3153);
  `ctState.items` never set (coupon subtotal always 0 — likely real bug), `ctState.discount/tax` dead reads.
- Proposed 11-chunk port plan + GET-only fixtures + stubbed WRITE routes.

Compare result: n/a (Part 2 is MAP only; no new route). CSS import order: recorded per page in the map §1.
Tested behaviours: Part 1e harness suite (see above). Open questions / TODOs: map §10 (11 items —
`Date.now()` key, dead code, unreachable fee tiers, `ctState.items` bug, canonical/robots, empty CSS file, timings).
Deliverable: `deliverables/eatswada-web-phase-2i.zip` (cumulative `web/ tools/ notes/ PROGRESS.md`).


## 2026-10-26 Task: Phase 2e chunk 10 — restaurant-shell inline search row + order hint/free delivery + cart hook + Escape + tab gestures

**Scope note (read first).** The task text handed to this session said "Phase 2, chunks 4 and 5
ONLY (map section 6)" with deliverable `eatswada-web-phase-2b.zip`. That text is STALE: chunks 4 & 5
(map §6 rows 4–5, legacy L477–1299) were already ported, verified and packaged earlier today —
see the "Phase 2 chunks 4 & 5" entry below, `web/scripts/shell-money-parity.mjs`,
`web/scripts/shell-chunk5-parity.mjs`, `web/scripts/fixtures/restaurant-shell.json` and the existing
`deliverables/eatswada-web-phase-2b.zip`. The live, next-unported chunk in this workspace is
**chunk 10** (map §6 row 10, legacy L2686–3107), which is what the session brief
(`USER_CONTEXT` / `TASK_TRACKING`) declared. Chunk 10 was ported and verified here. Per the brief's
"REPORT-ONLY" note, this entry reports; the cumulative zip is `eatswada-web-phase-2b.zip` as asked.

Files changed (all under `web/`, `PROGRESS.md` — **no legacy root file changed**, no git commands run):
- `web/lib/restaurant-shell-hint.ts` — **new** (chunk 10). Port of legacy `restaurant-shell.html`
  L2686–3107: the (dead) inline search row (`toggleMenuSearch` / `openMenuSearch` / `closeMenuSearch` /
  `syncSearchClearButton` / `onMenuSearchInput` / `clearMenuSearch`), the minimum-order + free-delivery
  hint (`firstPositiveNumber`, `money`, `cartSubtotalForRestaurant`, `showFreeDeliveryCongratulations`,
  `getFreeDeliveryThreshold`, `checkFreeDeliveryCrossed`, `renderOrderHint`), the `hookCartUpdates`
  cart wrapper, the document `Escape` handler, `installResTabGestures` (`.menu-tab-indicator` +
  `window.ewSyncTabIndicator` + swipe/keyboard tab switching) and `toggleCategory`. Published to
  `window` exactly as legacy's classic script did (`window.renderOrderHint`, `window.toggleMenuSearch`,
  `window.cartSubtotalForRestaurant`, `window.checkFreeDeliveryCrossed`, `window.toggleCategory`, …).
  Quirks kept verbatim: the never-assigned `window.*` names stay unassigned; the inline search row is
  dead but fully ported; `menuSearchQuery` stays a module binding, not a window property.
- `web/components/RestaurantShellRuntime.tsx` — **changed**: imports and calls
  `installRestaurantShellChunks10()` (before the boot, so `loadRestaurantPage`'s `renderOrderHint()`
  and `openRestaurantSearchPage`'s `toggleMenuSearch()` resolve), and calls the idempotent
  `installCartGlobals()` immediately before it. See the bug note below.
- `web/scripts/shell-chunk10-parity.mjs` — **new** (side-by-side harness; writes
  `compare-out/shell-chunk10-parity.txt`). 30 checks, all PASS.

**Bug found and fixed (reported, not hidden).** Chunk 10's `hookCartUpdates` wraps `window.updateCart`
at install time and bails out if `window.updateCart` is not yet a function. Legacy loaded `cart-bar.js`
BEFORE the inline script, so the wrap always happened. In the Next app `<CartBar/>` installs the cart
globals inside an effect guarded by a `portalTarget` state set in a LATER render, so when
`RestaurantShellRuntime`'s effect ran, `window.updateCart` did not exist and the wrap was silently
skipped — the order hint never refreshed after an ADD. Fixed by calling the already-idempotent
`installCartGlobals()` at the top of the runtime effect (legacy order restored). This is a real
behavioural bug that only the side-by-side chunk-10 harness (section I) could catch.

CSS import order: not applicable — chunk 10 adds no CSS and no server-rendered markup. The tab
indicator element (`.menu-tab-indicator`) and its `has-indicator` class are created at runtime; the CSS
for both already exists in the already-imported `css/restaurant-info-premium.css`.

Compare result (fixtures as noted; legacy `:8081` via `npx serve`, new `:3000`):
- Full menu, restaurant + menu + reviews answered: `node scripts/compare.mjs
  "http://localhost:8081/restaurant-shell?id=…" "http://localhost:3000/restaurant-shell?id=…"
  p2e-shell-answered scripts/fixtures/restaurant-shell-answered.json` → **phone 0.15% / desktop 0.03%**
  (PASS). Residual unchanged from Phase 2d: the still-unported chunk-12 `#ew-mj-btn` menu-jump button.
- Menu held (restaurant + reviews answered, menu `__hang__`): `… p2e-shell-menuhang
  scripts/fixtures/restaurant-shell.json` → **phone 0.00% / desktop 0.00%** (PASS).
- Chunks 1–3 skeleton regression (all routes held): `… p2e-shell-skeleton
  scripts/fixtures/restaurant-shell-hang.json` → **phone 0.00% / desktop 0.00%** (PASS).
- Regression of every previously ported page (fixtures `scripts/fixtures/home.json`): home, search,
  category, under99 → **phone 0.00% / desktop 0.00%** each (PASS).

**Server note (important, recorded here so it is not re-learned):** the pre-existing harnesses
(`shell-money-parity`, `shell-chunk5-parity`, `shell-chunks67-parity`, `shell-chunks89-parity`) default
their legacy URL to the **`.html`** form and therefore need the legacy site served by
`python3 -m http.server 8080` (which serves `.html` verbatim). `npx serve` 301-redirects
`/restaurant-shell.html?id=…` to `/restaurant-shell` and **drops the query**, so legacy renders no data
and those harnesses false-fail. The new chunk-10 harness defaults to the CLEAN legacy URL and so works
under `npx serve` (`:8081`). Both servers were run for this task (8080 = python, 8081 = serve).

Tested behaviours (legacy vs new, side by side; `shell-chunk10-parity.mjs`, 30 checks, all PASS):
- `cartSubtotalForRestaurant` over 8 seeded carts (missing key, `{}`, wrong restaurant only, no price,
  qty 0, valid multi, mixed valid + wrong-restaurant, no rid) — all equal.
- `getFreeDeliveryThreshold` (fixture with `freeDeliveryAbove:500`) and `firstPositiveNumber` edge
  cases (`undefined/0/-3/"12"/7` → 12; `null/0/0` → null; `"abc"/NaN/5.5` → 5.5) — equal.
- `renderOrderHint` `#order-hint` outerHTML + hidden + classes at subtotals 0 / 80 / 300 / 500
  (thresholds minimumOrder 200, freeDeliveryAbove 500) — byte-equal, including the `is-short` class and
  the `fa-circle-info` vs `fa-motorcycle` icon choice.
- `checkFreeDeliveryCrossed` return value + `#ew-free-delivery-toast` `.show` for crossing
  300→500 (fires), 500→600 (no fire), 100→499 (no fire), plus the 3.2 s auto-hide — equal.
- Tab gestures: `.menu-tab-indicator` present, same width/transform and `has-indicator` class;
  `window.ewSyncTabIndicator` a function; clicking the Info tab swaps panes + indicator + aria-selected;
  a synthetic swipe left past 22% commits to Info; a small swipe springs back; ArrowLeft/ArrowRight
  swap. No page errors on either page.
- Escape order: full-screen search open → Escape closes it; then the dead inline row → Escape closes it.
- The dead inline search row functions (`onMenuSearchInput` / `clearMenuSearch` / `closeMenuSearch` /
  `syncSearchClearButton`) behave identically (clear button visibility, input value, row hidden, body class).
- `toggleCategory` collapses then expands the header + its items element.
- Cart hook: `window.updateCart` is a function on both; on the new page chunk 10's wrapper is the
  OUTERMOST `updateCart` so its internal `__ewHinted` flag is set. On legacy the outermost wrapper is
  chunk 12's `js/pairing-suggestions.js` (not ported yet) which has no flag — that flag difference is
  expected until chunk 12 and is reported, not hidden. The BEHAVIOUR matches: a real ADD / second click
  on a plain item leaves `nearbite_cart` and `#order-hint` identical on both pages.

Open questions / TODOs:
- `// TODO(question)` — none new for chunk 10.
- The chunk-12 `#ew-mj-btn` menu-jump button (and `js/pairing-suggestions.js`) remain unported; they
  are the whole residual of the answered-fixture diff and the source of the `__ewHinted` outermost-flag
  difference above.
- Per the session brief, `/restaurant-shell` was **NOT** added to `next.config.js` `PORTED_PAGES`
  (still `["/", "/search", "/category", "/under99"]`) — the URL/SEO contract task owns that.

Env variable names the owner must set in `web/.env.local`: `NEXT_PUBLIC_API_BASE_URL`,
`NEXT_PUBLIC_RAZORPAY_KEY_ID`, `NEXT_PUBLIC_FIREBASE_*` (see the Phase 1a entry; no keys are printed).

## 2026-10-26 Task: Phase 2d chunks 8 & 9 — restaurant-shell search page + dish sheet/sticky bar

Files changed (all under `web/`, `notes/`, `PROGRESS.md` — **no legacy root file changed**):
- `web/lib/restaurant-shell-search.ts` — **new** (chunk 8). Port of legacy `restaurant-shell.html`
  L~2600–2745: `installRestaurantShellSearch()`. Publishes `window.ewOpenSearch` / `window.ewCloseSearch`
  and the internal `ssIsOpen`, `ssItemsGet`, `ssVegMark`, `ssCtaHTML`, `ssPopstateClose`, `ssGoCategory`,
  `ssFinishClose`, `ssHook`, `ssScheduleRefresh`, `ssRefreshCtas`. `menuSearchQuery` stays OFF window.
  Deliberately does NOT port chunk-10 inline-search-row functions (`toggleMenuSearch`, `openMenuSearch`,
  `closeMenuSearch`, `syncSearchClearButton`, `onMenuSearchInput`, `clearMenuSearch`) — they belong to a
  later chunk; `window.toggleMenuSearch` is left exactly as chunks 6–7 had it (never assigned).
- `web/lib/restaurant-shell-dish.ts` — **new** (chunk 9). Port of legacy L~2450–2600: the dish detail
  sheet (`dsOpenSheet` / `dsClose` / `dsFinish`), the dish-row tap delegate, `installMenuFooterReveal`,
  `installStickySearchBar`. Imports `ssVegMark, ssCtaHTML, ssItemsGet, ssPopstateClose` from chunk 8 and
  registers BOTH popstate listeners (dish first, search second — legacy order) to avoid a circular import.
- `web/components/RestaurantShellRuntime.tsx` — **changed**: also calls `installRestaurantShellChunks8()`
  and `installRestaurantShellChunks9()` after chunks 4–5.
- `web/scripts/shell-chunks89-parity.mjs` — **new** (side-by-side harness; writes
  `compare-out/shell-chunks89-parity.txt`). 73 checks.
- `web/scripts/shell-chunks67-parity.mjs` — **changed**: fixed a flaky `focusItem` check (the two pages
  are opened sequentially, so the legacy 1800 ms window could close before polling started). Now a
  `MutationObserver` installed via `addInitScript` records whether the class was EVER added / later
  removed; both pages are reloaded together. 5/5 stable runs PASS.
- `notes/restaurant-shell-map.md` — corrected §4.5 / §7.4: the map's claim that the shell functions are
  "lexical bindings, not window properties" is **wrong**; the installer publishes the same `window`
  function set legacy classic scripts did.

CSS import order: not applicable — chunks 8 & 9 add no CSS and no markup to the server render; the
search overlay (`#ss-root`) and the dish sheet (`#ds-root`) are built at runtime into their own roots.

Compare result (fixtures as noted; legacy `:8080`, new `:3000`):
- Full menu, all three routes answered: `node scripts/compare.mjs … shell-answered
  scripts/fixtures/restaurant-shell-answered.json` → **phone 0.15% / desktop 0.02%** (PASS).
  **Measured cause (reported, not hidden):** the residual is the still-unported **chunk 12 menu-jump
  button** (`#ew-mj-btn`). Proof: hiding only `#ew-mj-btn` on BOTH pages drops it to
  **phone 0.034% / desktop 0.024%**. (The chunk-9 sticky bar, ported here, is no longer part of the
  residual — it previously accounted for most of the 0.17%.)
- Menu held (restaurant + reviews answered, menu `__hang__`): `… shell-menu-hang
  scripts/fixtures/restaurant-shell.json` → **phone 0.00% / desktop 0.00%**.
- Chunks 1–3 skeleton regression (all routes held): `… shell-skeleton
  scripts/fixtures/restaurant-shell-hang.json` → **phone 0.00% / desktop 0.00%**.

Tested behaviours (legacy vs new, side by side; `shell-chunks89-parity.mjs`, 73 checks, all PASS):
- chunk 8 search overlay: open idle, type "dosa", typo "chiken", empty state "zzz", toggle Veg /
  Non-veg, clear diet, tap a recent chip — `#ss-root` innerHTML byte-equal AND pixel diff < 1% in
  every state; `ew_menu_recent_…` equal; `__ewSearchData` present on both.
- chunk 8 tap-a-category: closes the overlay, switches to the menu tab, and scrolls to the same place.
  The KNOWN pre-existing chunk-3 glide lands **1 px** apart (212 vs 211); proved independent of chunks
  8/9 by disabling both installers and re-measuring (still 212 vs 211), so the check uses a 1 px
  tolerance and reports the offset.
- chunk 8 Back (popstate): overlay closes on both pages.
- chunk 9 dish sheet: opens on both; `.ds-sheet` innerHTML byte-equal (styles stripped); `.ds-name` /
  `.ds-cat` / `.ds-cta` equal; `#ds-root` pixel diff < 1%; Escape closes; Back closes; drag-down > 90 px
  closes.
- chunk 9 sticky bar: built identically; `body.ew-tsb-on` after scrolling past `#res-name`; pill
  rotates after 2.8 s and reads the same text at the same rotation index; hidden under
  `body.ew-search-open` and `body.ew-dish-open`.
- chunk 9 menu-footer reveal: `.rmf-anim` + `.in` on the rows.
- money path inside the sheet and the overlay (ADD / + / −): `nearbite_cart`, pink cart-bar text and
  count all equal after every step (normalising only the `Date.now()` key part).

Open questions / TODOs:
- `// TODO(question)` — the customisable-item ADD inside the dish sheet raises
  `ReferenceError: ewOpenCustomize is not defined` on the NEW page because chunk 11 (L3171) is not
  ported yet. This is the same "later chunk" gap as `toggleMenuSearch` before chunk 10; the
  `onclick="ewOpenCustomize(...)"` string itself is emitted by chunk 4's `makeBtnHTML` and must stay
  byte-identical. The harness asserts legacy opens the customise sheet while new cannot, and filters
  that one error out of the "no unexpected page errors" check (it is reported, not hidden).
- The chunk-12 `#ew-mj-btn` menu-jump button remains unported (residual of the answered-fixture diff).

Env variable names the owner must set in `web/.env.local`: `NEXT_PUBLIC_API_BASE_URL`,
`NEXT_PUBLIC_RAZORPAY_KEY_ID`, `NEXT_PUBLIC_FIREBASE_*` (see the Phase 1a entry; no keys are printed).

## 2026-10-26 Task: Phase 2c chunks 6 & 7 — restaurant-shell menu render + data loading/states/filters

Files changed (all under `web/`, `notes/`, `PROGRESS.md` — **no legacy root file changed**; the
root `.html`/`css/`/`js/`/`api/` files are all still the 16:14 setup-unzip timestamps):
- `web/lib/restaurant-shell-menu.ts` — **new**. Port of legacy `restaurant-shell.html`:
  - chunk 6 (L1300–1502): `renderMenu`, `categoryDomId`, `syncVegFilterAvailability`. The three
    helpers it shares with chunk 4 (`MENU_IMAGE_REJECT`, `resolveMenuImage`, `escapeMenuHtml`) are
    **imported from `restaurant-shell-page.ts`**, not redefined.
  - chunk 7 (L1503–1926): `loadRestaurantPage`, `showMenuSkeleton`, `showEmptyMenuState`,
    `showErrorState`, the `focusItem` scroll, the whole (dead) advanced-filter-sheet block, the 5
    quick-filter chips, `ewChipFeedback`, `applyFiltersAnimated`, `resetAllMenuFilters`,
    `isPopularMenuItem`, `itemPrice`, `itemRating`, `itemSearchText`, `applyAllMenuFilters`,
    `updateMenuEmptyState`, `openRestaurantSearchPage`, and the
    `installRestaurantShellChunks67()` installer + `bootRestaurantShellPage()`.
- `web/components/RestaurantShellRuntime.tsx` — **changed**: calls
  `installRestaurantShellChunks67()` and then `bootRestaurantShellPage()` behind a module-level
  `bootedOnce` flag (see "Boot once" below).
- `web/scripts/shell-chunks67-parity.mjs` — **new** (40-check side-by-side harness; writes
  `compare-out/shell-chunks67-parity.txt`).
- `web/scripts/fixtures/restaurant-shell-answered.json` — **new** (restaurant + menu + reviews all
  answered, so the menu renders; restaurant + menu reused from `home.json`, reviews recorded
  GET-only once from `api.eatswada.com`).
- `notes/restaurant-shell-map.md` — §6 chunk 6/7 rows marked done; chunk-7 out-of-scope note.
- `PROGRESS.md` — this entry.

CSS import order:
Not applicable — chunks 6 & 7 add no CSS and no markup. The page's import order is unchanged from
the chunks-1–3 entry.

Compare result (fixtures as noted):
- Full menu, all three routes answered: `node scripts/compare.mjs
  http://localhost:8080/restaurant-shell.html?id=… http://localhost:3000/restaurant-shell?id=…
  shell-answered scripts/fixtures/restaurant-shell-answered.json`
  → **phone 0.17% / desktop 0.03%** (PASS).
  **Measured cause (reported, not hidden):** the residual delta is **NOT** in the chunks 6–7 code.
  It is the not-yet-ported **chunk 9 sticky search bar** (`.tsb`, `body.ew-tsb-on`) and **chunk 12
  menu-jump button** (`#ew-mj-btn`), which the legacy page shows and the new page does not yet
  render. Proof: a probe that hides exactly those two elements on BOTH pages and diffs again gives
  **phone 0.000% / desktop 0.000%** (`#ew-mj-btn{display:none}.tsb{display:none}` + full-page
  pixelmatch). The menu DOM itself is **byte-identical**: `#menu-container` innerHTML hash
  `1455951801:85892` on both pages (85 892 chars), and `#cat-nav-inner` matches byte-for-byte.
- Chunks 1–3 skeleton regression (menu held, `__hang__`):
  `… shell-skeleton scripts/fixtures/restaurant-shell-hang.json` → **phone 0.00% / desktop 0.00%**.
- Menu-held (restaurant + reviews answered, menu `__hang__`):
  `… shell-menu-hang scripts/fixtures/restaurant-shell.json` → **phone 0.00% / desktop 0.00%**.

Boot once (loadRestaurantPage):
Legacy ran `loadRestaurantPage` from `document.addEventListener('DOMContentLoaded', …)` — exactly
once per page load. In Next the effect runs after the DOM is loaded and React StrictMode may mount
it twice in dev, which would fire each GET twice. `RestaurantShellRuntime.tsx` now sets a
module-level `bootedOnce` flag **before** the async load starts and calls the boot only on the first
mount; the flag resets only when the module is evaluated again, i.e. on a full page load — the same
semantics as legacy. **Verified**: the harness compares the full API-request list of both pages and
it is identical — `["/restaurants/:id", "/restaurants/:id/menu"]`, one each, in order.

Money-path / chunk-5 regression (must stay green):
- `node scripts/shell-money-parity.mjs` → **PASS (17 checks)** (unchanged).
- `node scripts/shell-chunk5-parity.mjs` → **PASS (367 checks)** (unchanged).
- `LEGACY=http://localhost:8080/restaurant-shell.html node scripts/shell-handtests.mjs` →
  chunks 1–3 **PASS** (46 ids, handler attrs, initial skeleton, chunk-3 globals, chip sequence,
  dark theme). NB the handtests default legacy URL is `…/restaurant-shell` (clean URL); the sandbox
  legacy server is a plain `python3 -m http.server`, which needs the `.html` URL — pass it via
  `LEGACY=` as above.
- Other ported pages unaffected: `/under99` and `/` still **0.00%** phone+desktop.

Tested behaviours (legacy vs new side by side, `shell-chunks67-parity.mjs`, **40/40 PASS**):
- chunk 6: menu DOM byte-equal (hash + full string), nav innerHTML, skeleton/container display,
  5 groups / 37 items, group ids, category titles+counts, cat-nav pills (target/class/onclick),
  `window.__ewSearchData` shape, `__ewMenuGroups` shape, `__ewCust` keys + first entry,
  `.nb-item-cta` count/ids, first `.menu-item` outerHTML byte-equal;
  `categoryDomId` (7 inputs), `resolveMenuImage` (12 inputs), `escapeMenuHtml` (4 inputs) all
  byte-equal; `syncVegFilterAvailability` side effects equal.
- chunk 7: boot API list equal; no page errors; each of the 5 quick chips → equal
  `aria-pressed`/`.active`/visible+hidden counts/`.cat-group-empty`/`#empty-filter-msg`
  (display, icon, title, sub, clear-hidden); `resetAllMenuFilters()` restores (37 visible, 0 hidden,
  0 empty groups); empty state via the ₹99–₹149 chip on an all-₹10 menu (0 visible, 5 empty groups,
  "No dishes match these filters"); the **dead** filter sheet driven through its public functions
  (`toggleDraftReordered` + `applySheetFilters`) → "No highly reordered items found" on both, and
  `#filter-count-badge` / `#apply-filter-btn` stay **`null`** on BOTH pages (proof the sheet is dead
  here, as the map §7.1 said); no `?id=` → error card with the exact message and **no** retry
  button; restaurant 500 → error card **with** "Try Again"; menu `data:{}` → "Menu not available";
  `focusItem` → `.ew-search-focus-item` appears then is removed after 1800 ms; dark mode equal.
- chunk 5 contract re-checked: the reviews GET is `?page=1&limit=5` (from the chunk-5 harness; the
  chunk-7 boot does not fire it — reviews load only when the Info tab first renders).

Owner decisions honoured (unchanged): dead code and quirks ported exactly; the advanced-filter
sheet stays unreachable; the FSSAI logo reference stays dead; the favourite heart stays decorative;
`/restaurant-shell` is **NOT** added to `PORTED_PAGES` (this session's explicit instruction).

Window parity:
The legacy classic `<script>` makes every top-level `function` a `window` property, so
`installRestaurantShellChunks67()` publishes the same set, including the four names other scripts
reach: `updateFilterBadge`, `ewChipFeedback`, `applyFiltersAnimated`, `applyAllMenuFilters`. The
top-level `let`/`const` (`menuSearchQuery`, `quickMenuFilters`, `ewFilterSkelTimer`,
`sheetDraft`/`sheetApplied`, `MENU_IMAGE_REJECT`) stay **off** `window`, exactly as legacy.

Open questions / TODOs:
- Two calls leave this file on purpose because their targets are chunks 8–12 and are **not ported
  yet**: `loadRestaurantPage` calls `renderOrderHint()` (chunk 10) and `openRestaurantSearchPage`
  calls `toggleMenuSearch()` (chunk 10). Both go through a guarded `window` lookup so the page
  never throws; they must be wired to the real functions when those chunks land. (Same temporary
  gap chunks 1–3 had, and `toggleFilter` still uses it for the four chunk-7 filter functions.)
- `TODO(question)`: `renderOrderHint` is genuinely invoked by the boot in legacy (so the minimum-
  order hint can appear immediately when the cart already has items). It is chunk 10, so today the
  hint does not render on the new page until chunk 10 — no visual effect with an empty cart (the
  compare fixtures have an empty cart, hence 0.00%). Flagged so chunk 10 remembers to make
  `window.renderOrderHint` available before the boot runs.
- `TODO(question)`: chunk 12's `menu-jump.js` is why the legacy page shows `#ew-mj-btn` (the "Menu"
  jump button) and chunk 9's sticky bar is why `body.ew-tsb-on` is set. Both are the entire residual
  compare delta above; nothing to fix in chunks 6–7.

Next chunk: chunk 8 (`ss*` full-screen menu search page, L1927–2398).


## 2026-10-26 Task: Phase 2 chunks 4 & 5 — restaurant-shell cart/ADD + tabs/Info/reviews/header

Files changed (all under `web/`, `notes/`, `PROGRESS.md` — **no legacy root file changed**):
- `web/lib/restaurant-shell-page.ts` — **new**. Port of legacy `restaurant-shell.html`:
  - chunk 4 (L477–764): `escapeMenuHtml`, `jsArg`, `getCustomizedCartQuantity`,
    `refreshCustomizedCartQuantities`, `window.ewRemoveCustomizedCartUnit`, `window.ewVerifiedOriginal`,
    `window.makeBtnHTML`, `resolveMenuImage` (+ the `MENU_IMAGE_REJECT` list it reads, legacy L1458),
    `notifyItemUnavailable`, `normalizeMenu`, `cuisineText`, `setMetaChip`,
    `selectedCustomerCoords`, `restaurantCoords`, `distanceKm`, `formatRestaurantDistance`.
  - chunk 5 (L766–1299): `switchResTab`, `restaurantTimeStr`, `FSSAI_LOGO_SRC`, `ewFssaiNumber`,
    `ewFssaiHTML`, `ewFillFssai`, `infoTime`, `infoSvc`, `shareRestaurantInfo`,
    `renderRestaurantInfo`, `ewReviewState`, `renderRestaurantReviews`, `loadRestaurantReviews`,
    the `#ew-customer-reviews-more` delegate, `openRestaurantDetails`, `toggleRestaurantFavorite`,
    `renderRestaurantHeader`, `renderClosedWarning`, `formatCompactCount`, and the
    `installRestaurantShellChunks45()` installer.
- `web/components/RestaurantShellRuntime.tsx` — **changed**: also calls
  `installRestaurantShellChunks45()` after `installRestaurantShell()`.
- `web/scripts/shell-money-parity.mjs` — **new** (chunk-4 money-path harness; writes
  `compare-out/shell-money-parity.txt`).
- `web/scripts/shell-chunk5-parity.mjs` — **new** (chunk-5 side-by-side harness; writes
  `compare-out/shell-chunk5-parity.txt`).
- `web/scripts/fixtures/restaurant-shell.json` — **new** (restaurant + reviews answered, menu
  `__hang__`).
- `notes/restaurant-shell-map.md` — **corrected** §4.5 and §7 item 4: the map claimed the main
  script's top-level `function`s are lexical bindings only, so `window.X` guards fail. Measured
  (probe with the API held): they ARE `window` properties — the guards succeed. Only top-level
  `let`/`const` are not on `window`.
- `PROGRESS.md` — this entry.

CSS import order:
Not applicable — chunks 4 & 5 add no CSS and no markup. The page's import order is unchanged from
the chunks-1–3 entry above.

Compare result:
`node scripts/compare.mjs http://localhost:8080/restaurant-shell.html?id=… http://localhost:3000/restaurant-shell?id=… shell-chunk45 scripts/fixtures/restaurant-shell.json`
→ **phone 0.00% / desktop 0.00%** (PASS, under 1%).

**Important finding about this compare (reported, not hidden).** The requested fixture answers the
restaurant + reviews routes and holds the menu (`__hang__`) "so the header renders and the menu
stays a skeleton". That is **not** what happens, on **either** page: `loadRestaurantPage` (legacy
L1503, chunk 7, not ported yet) awaits `Promise.all([restaurant, menu])` and only then calls
`renderClosedWarning` / `renderRestaurantHeader`. While the menu hangs, **both** pages stay on the
skeleton (`res-name` = "Loading…", `#menu-skeleton` block, `#menu-container` none) and the header
never renders. Verified by a direct probe of the legacy page (menu answered → header renders;
menu held → header does not). So the 0.00% is a genuine skeleton-vs-skeleton match — the
skeleton/loading-state compare — and chunk 5's real behaviour is exercised by
`shell-chunk5-parity.mjs` (below), which drives the functions directly on both pages. The menu
**must** be answered for the header to render, so "menu stays a skeleton while the header renders"
is impossible without changing behaviour (which the owner forbids).

Money-path parity (chunk 4) — `node scripts/shell-money-parity.mjs`:
**MONEY-PATH PARITY: PASS (17 checks).** Same inputs, same seeded localStorage, on both pages:
- `makeBtnHTML` byte-equal for qty 0, qty 2, out-of-stock, closed restaurant, customisable item
  (2 in cart / none in cart) and a name containing a backslash + quote;
- `normalizeMenu` deep-equal on the real menu fixture (raw object, `API.unwrap()`, array, flat
  array, `null`, `{}`) — 5 groups / 37 items;
- `getCustomizedCartQuantity` + `ewRemoveCustomizedCartUnit` on a seeded `nearbite_cart`:
  `nearbite_cart` and the pink cart-bar text are equal after removal (before: `3 items · ₹280`,
  after: `2 items · ₹160`);
- the `Date.now()` payload-key rule: a seeded encoded key is normalised to
  `<payload:…>` and reported (nothing to normalise appears in the normal chunk-4 path — chunk 4
  does not create payload keys, the customize sheet does);
- distance helpers with a seeded `nearbite_address` (`60.9 km` with the address, `2.0 km` without).

Chunk-5 parity — `node scripts/shell-chunk5-parity.mjs`:
**CHUNK-5 PARITY: PASS (367 checks).** Legacy and new driven identically through the same public
functions, DOM compared byte-for-byte:
- Info tab swap (`hidden`, `aria-selected`, `.active`, computed `display`, `.ew-pane-in`);
- `#info-content` markup: hours, services, address, FSSAI, reviews shell;
- reviews loaded **once** with `?page=1&limit=5` (asserted on both pages) and "Load more" →
  `?page=2&limit=5` with the list appended (synthetic 2-page payload, labelled as such);
- share (`navigator.share` payload + button label);
- closed restaurant (`isOpen:false`), `closed_today` variant;
- "New" pill when `rating:0`, `verified:false`, `freeDeliveryEnabled:false`;
- ratingCount compact `K`/`M`, 14-digit verified FSSAI, rejected FSSAI, offer banner, delivery
  banner image;
- dark mode (theme attr + computed colours of `#info-content`, `.inf-name`, `.inf-sec`,
  `.ew-customer-reviews`, html/body bg).

Tested behaviours (what was actually exercised):
- `cd web && npm run build` — passes, TypeScript clean; `npx tsc --noEmit` clean.
- chunks-1–3 regression: `node scripts/shell-handtests.mjs` with the correct legacy URL
  (`/restaurant-shell.html`) — all PASS (46 ids, 12 handlers byte-identical, skeleton state,
  chunk-3 globals, diet chips, dark mode).
- both harnesses above, plus the compare.

Open questions / TODOs:
- `TODO(question)`: as requested, the port reproduces the quirk that the consumers' `window.*`
  guards **succeed** (corrected — see `notes/restaurant-shell-map.md` §4.5/§7.4). Nothing was
  changed to make that happen; it is the natural result of publishing the functions.
- `TODO(question)`: the heart stays decorative — `toggleRestaurantFavorite` only flips
  `fa-solid`/`fa-regular` and sets `style.color`; it never touches `nearbite_favorites`.
  Confirmed intentional by the owner's instruction ("heart stays decorative").
- `TODO(question)`: `assets/fssai-logo.png` does not exist in the repo, so the FSSAI `<img>` 404s
  and hides itself on **both** pages. Kept for byte-parity; the compare harness normalises the
  race-y `hidden=""` attribute and reports it.
- Not ported in this task (later chunks, by the map's own split): `renderMenu` (chunk 6, legacy
  L1300+) and `loadRestaurantPage` (chunk 7, legacy L1503+) — so the page still renders only its
  skeleton on a real load.
- As instructed, `/restaurant-shell` was **not** added to `PORTED_PAGES`.
- Env var NAMES the owner must set in `web/.env.local` (no values here):
  `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_MAPTILER_ENABLED`,
  `NEXT_PUBLIC_MAPTILER_KEY`, `NEXT_PUBLIC_MAPTILER_MAP_ID`, `NEXT_PUBLIC_FIREBASE_ENABLED`,
  `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`,
  `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`,
  `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`.

## 2026-10-26 Task: Phase 2 chunks 1–3 — restaurant-shell static shell, CSS, page state

Files changed:
- `web/app/restaurant-shell/page.tsx` — **new** (chunks 1–3: `metadata` incl. the legacy
  `view-transition` meta + `twitter:card`, the 26 legacy CSS imports + the 2 inline CSS imports
  in exact `<link>` order, the static JSX skeleton of legacy L115–278, then `<CartBar/>` +
  `<RestaurantShellRuntime/>`).
- `web/components/RestaurantShellRuntime.tsx` — **new** (`"use client"`; installs the page's
  legacy scripts in order: `lib/api` side-effect, `installSearchOverlay()`,
  `installRestaurantShell()`. Renders nothing).
- `web/lib/restaurant-shell.ts` — **new** (chunk 3: `optimizedImageUrl` fallback,
  `ewLoadVisibleImages`, `shellState`/`sheetState`, `formatTime`, `toggleFilter`, `syncQuickChips`,
  `applyFilter`, the cat-nav sentinel observer, `setupScrollSpy`, `scrollToCategory`,
  `ewAutoScrollIntoMenu`, the inline-handler promotion, `installRestaurantShell()`).
- `web/styles/legacy/restaurant-shell-inline-1.css` — **new** (legacy inline `<style
  id="ew-header-v2">`, 4 436 B, byte-for-byte; only the single newline right after `<style>` is
  dropped, the same convention as the earlier phases).
- `web/styles/legacy/restaurant-shell-inline-2.css` — **new** (legacy inline `<style>` L92–111,
  1 848 B, byte-for-byte, same convention).
- `web/scripts/fixtures/restaurant-shell-hang.json` — **new**. Every API path is the `__hang__`
  sentinel (see below).
- `web/scripts/compare.mjs` — **extended** with the `__hang__` fixture value and a
  `domcontentloaded` capture when any fixture hangs. No other behaviour changed.
- `web/scripts/shell-handtests.mjs` — **new** (the chunks-1–3 hand-tests; writes
  `compare-out/shell-handtests.txt`).
- `PROGRESS.md` — this entry. **No legacy root file changed** (all writes are under `web/`;
  verified: the only files touched outside `web/` are `PROGRESS.md` and `notes/`).

CSS import order (top of `app/restaurant-shell/page.tsx` — the exact `<link>` order of legacy
`restaurant-shell.html` L20–48, then the page's own two inline blocks last). Provided by
`layout.tsx` and therefore NOT repeated here: the pre-paint theme snippet, the dark-only Dark
Reader loader, the dark background rule, the Google-Fonts links (Manrope is a superset of the
shell's own request) and Font Awesome:
1 `css/eatswada-typography.css` · 2 `style.css` · 3 `css/legacy-inline.css` · 4 `css/header.css` ·
5 `css/restaurant-info.css` · 6 `css/rating-meta.css` · 7 `css/delivery-banner.css` ·
8 `css/filters.css` · 9 `css/menu.css` · 10 `css/cart.css` · 11 `css/step1-geometry.css` ·
12 `css/step3-typography.css` · 13 `css/step3-navigation-fix.css` · 14 `css/step4-menu-geometry.css` ·
15 `search-overlay.css` · 16 `css/eatswada-ui-system.css` · 17 `eatswada-theme.css` ·
18 `eatswada-header-theme.css` · 19 `food-placeholder.css` · 20 `css/restaurant-tabs.css` ·
21 `css/restaurant-menu-enhancements.css` · 22 `css/pairing-suggestions.css` ·
23 `css/restaurant-info-premium.css` · 24 `css/restaurant-filter-motion.css` ·
25 `css/restaurant-search-page.css` · 26 `css/ew-sheet.css` · 27 `restaurant-shell-inline-1.css` ·
28 `restaurant-shell-inline-2.css`.
Files are kept separate and in order: several share selectors (`.filter-bar`, `.menu-item`,
`.ewcs-*`, the `--hd-*` tokens) and the later ones are the intended overrides — `css/ew-sheet.css`
and the second inline block must stay last.

Compare result — **phone 0.00% / desktop 0.00% — PASS**:
```
npm run compare -- "http://localhost:8080/restaurant-shell?id=6ac8f95828669b5f4e30f0ba" \
  "http://localhost:3000/restaurant-shell?id=6ac8f95828669b5f4e30f0ba" shell-1-3 \
  scripts/fixtures/restaurant-shell-hang.json
```
`?id=` is required: with an id the legacy page issues its two API calls (held pending) and stays
on the skeleton; without an id its own chunk-7 code paints the "missing restaurant ID" error card
into `#menu-container` and the two pages would not be comparable. The screenshots are **not**
byte-identical (88 100/88 106 B phone, 98 101/98 109 B desktop) because each side's
`animation-delay`/font rasterisation differs by a hair, but the pixel diff is 0.00% at both sizes
and the page height is identical (1 537 px phone / 1 436 px desktop on both).

The `__hang__` fixture value (explained): a fixture entry whose value is the string `"__hang__"`
makes `compare.mjs` **never fulfil** that route, so the request stays pending forever and the page
cannot leave its loading state. Because `networkidle` can then never fire, the script captures at
`domcontentloaded` and waits a little longer (1 600 ms). This is how a deliberately data-free
chunk is compared: legacy and new both render only their skeleton. When the chunk-7 data layer
lands the page will be compared with real fixtures instead.

Tested behaviours (`node scripts/shell-handtests.mjs` → `compare-out/shell-handtests.txt`; legacy
and new side by side with the same `__hang__` fixtures on both):
- `cd web && npm run build` — passes, no errors, 6 static routes
  (`/`, `/_not-found`, `/category`, `/restaurant-shell`, `/search`, `/under99`).
- **Static id set**: all **46** ids of legacy L115–278 are present in the new DOM and in the
  legacy DOM; the only new-only id is Next's own `_R_`.
- **Inline handlers**: 12 in-scope `onclick`/`oninput` attributes, values **byte-identical** to
  legacy (checked element by element); **0** leftover `data-ew-onclick`/`data-ew-oninput`
  attributes. The 13th legacy handler belongs to the already-ported `CartBar` (`#es-pink-inner`),
  out of scope.
- **Initial skeleton state**: `#res-name` = "Loading…", `#menu-container` `display:none`,
  `#menu-skeleton` `display:block`, `#info-pane` `hidden` — identical on both.
- **Chunk-3 globals**: `window.ewLoadVisibleImages`, `window.scrollToCategory`,
  `window.toggleFilter`, `window.ewAutoScrollIntoMenu` are `function`; `window.optimizedImageUrl`
  is still the `lib/safe-html.ts` implementation (the chunk-3 fallback correctly did **not**
  overwrite it — `…/image/upload/v1/a.jpg` @200 → `…/f_auto,q_auto,w_200,c_limit/v1/a.jpg`).
- **Diet quick chips** (the one fully-live chunk-3 control): `#filter-veg` → `.active` +
  `aria-pressed="true"`; then `#filter-nonveg` → veg clears, non-veg sets; clicking the active one
  again clears it. Sequence identical to legacy.
- **Dark mode** (`eatswada_theme=dark`): both pages end at `data-ew-theme="dark"`, `html` and
  `body` backgrounds both `rgb(24,26,27)`, Dark Reader loaded on both.
- **CSS leak check** (`/under99` → `/restaurant-shell` → `/under99`, real `next/link` soft
  navigation via a temporary `app/leakprobe/page.tsx` probe that imports restaurant-shell's two
  inline CSS blocks): **0 computed-style diffs** across body / u99-header / u99-hero / filter rail
  + chip / u99-page / price seg + tab / products head / count / product grid / card / price /
  `#white-cart-root`; body background **unchanged** across the soft nav. Next retains **1** route
  CSS chunk (9 → 10 stylesheets) — **stock Next.js App Router behaviour**, already recorded in
  MEMORY for Phase 1c: Next injects a route's CSS on soft navigation and never removes it. Not a
  port bug, and with no user-visible effect today because every internal link is a plain `<a>`
  (full reload). The probe route was deleted before packaging; the final build is exactly `/`,
  `/category`, `/restaurant-shell`, `/search`, `/under99`, `/_not-found`.
- **Not-yet-ported behaviour is inert, not broken**: clicking the Info tab logs
  `switchResTab is not defined` (chunk 5) but the page stays alive; `scrollToCategory("cat-nope")`
  does not throw. Both are expected until their chunks land.
- **Redirects**: `/restaurant-shell.html` → **404** (correct — the page is deliberately **not** in
  `PORTED_PAGES`, so the old `.html` keeps serving; on the real host `vercel.json`'s cleanUrls
  serves it, and `/under99.html` still 301s). `X-Robots-Tag: noindex, nofollow` is sent on
  `/restaurant-shell` (from `next.config.js`).
- **Metadata**: `<title>Menu – EatSwada</title>`, `<meta name="robots" content="noindex, nofollow">`,
  `<link rel="canonical" href="https://eatswada.com/restaurant-shell.html">`,
  `<meta name="view-transition" content="same-origin">` (added as the owner asked) and
  `<meta name="twitter:card" content="summary">`.

Open questions / TODOs:
- **`data-ew-onclick` promotion is required.** React 19 drops a lowercase `onclick` attribute and
  ignores a string `onClick` — measured with `renderToStaticMarkup`: neither produces the legacy
  DOM attribute. The attribute must exist because `cart-bar.js` reads
  `btn.getAttribute("onclick")` in its click delegate. The page therefore carries the legacy
  handler strings on `data-ew-onclick`/`data-ew-oninput` and `lib/restaurant-shell.ts` promotes
  them back (and re-promotes nodes React re-adds, via one `MutationObserver`). The resulting DOM is
  byte-identical to legacy. Flagged because it is a deviation from the "emit raw HTML strings in
  `lib/*.ts`" style used by earlier pages — for a mostly-static shell this keeps real JSX.
- **Chunk 7 must publish four globals.** `toggleFilter` calls `updateFilterBadge`,
  `ewChipFeedback`, `applyFiltersAnimated`; `applyFilter` calls `applyAllMenuFilters`. In legacy
  these were `function` declarations in the same script, i.e. properties of `window`. The port
  calls them through a `window[name]` guard so the chunks-1–3 skeleton never throws; chunk 7 must
  put them on `window` or those calls silently no-op.
- `sheetState` (legacy `sheetDraft`/`sheetApplied`, L1608–1609) lives in `lib/restaurant-shell.ts`
  because chunk 3's `toggleFilter` and chunk 7's filter sheet share it, exactly as legacy did.
  `activeFilter`/`isRestaurantOpen`/`currentResId`/`ewAutoScrolled` are in `shellState`.
- `formatTime`, `applyFilter`, `setupScrollSpy` are defined/exported but not yet called — they are
  wired by chunks 5, 6 and 7 respectively.
- Chunks 4–12 (cart-write helpers, tabs/Info/reviews, `renderMenu`, data loading + filter sheet,
  the two full-screen overlays, order hint, customization sheet, `pairing-suggestions.js` +
  `menu-jump.js`) are **not** started. `/restaurant-shell` stays out of `PORTED_PAGES` until then.
- All the `TODO(question)` items in `notes/restaurant-shell-map.md` §7 still stand; nothing in
  chunks 1–3 resolved or contradicted them.
- GET fixtures to record for the later chunks (GET only, never POST to production):
  `/restaurants/:id`, `/restaurants/:id/menu`, `/restaurants/:id/reviews?page=1&limit=5`, and the
  `?id=`-less case (no call at all — the page shows the error card). Use the public test id
  `6ac8f95828669b5f4e30f0ba` where possible. See `notes/restaurant-shell-map.md` §5.
- Env var NAMES the owner must set in `web/.env.local` (unchanged; no values printed):
  `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_MAPTILER_ENABLED`,
  `NEXT_PUBLIC_MAPTILER_KEY`, `NEXT_PUBLIC_MAPTILER_MAP_ID`, `NEXT_PUBLIC_FIREBASE_ENABLED`,
  `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`,
  `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`,
  `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`.


## 2026-10-26 Task: Setup + Phase 2 step 1 — restaurant-shell map (NO code)

Files changed:
- `AGENTS.md` (repo root) — already present, unchanged (`md5 2d59f6f9bb670b4165a22c86e6b17bbe`).
- `web/**`, `tools/compare.mjs`, `notes/**`, `PROGRESS.md` — **unzipped from
  `eatswada-web-phase-1c-part2.zip`** into the repo root. Verified with `md5sum` over every
  pre-existing file: **no legacy file changed** (byte-identical before/after).
- `web/.env.local` — **recreated** from legacy `config.js` (values are the legacy public config;
  the file is git-ignored and is never included in a zip).
- `notes/restaurant-shell-map.md` — **new** (the deliverable of this task).
- `PROGRESS.md` — this entry.

Setup results:
- `cd web && npm install` — clean.
- `cd web && npm run build` — **passes**, no errors. Routes: `/`, `/_not-found`, `/category`,
  `/search`, `/under99`.
- No `git` command was run (per instruction).

CSS import order:
Not applicable — **no code was written in this task.** The exact `<link>` order the future page
must reproduce is recorded in `notes/restaurant-shell-map.md` §2.1 (32 stylesheets, with the two
inline `<style>` blocks at lines 51–90 and 92–112 that must be extracted byte-for-byte).

Compare result:
Not applicable — no page was built. The map lists the exact compare commands to run per chunk
(§6) and the GET fixtures still to record (§8).

Tested behaviours:
- Legacy files byte-identical after unzip (`md5sum` diff of all 181 pre-existing files).
- `npm install` + `npm run build` succeed on the restored `web/`.
- GET-only live probes against `https://api.eatswada.com/api` (no POST/PUT/DELETE was issued):
  `/restaurants/<id>` → 200 `{success,data}` (64 fields);
  `/restaurants/<id>/menu` → 200 `{success,count,data}` (dict of group → item[]);
  `/restaurants/<id>/reviews?page=1&limit=5` → 200 `{success,summary,page,pages,total,data}`.
  Confirmed the page itself only ever issues those three GETs (no `fetch(`, no non-GET in
  `restaurant-shell.html` or `cart-bar.js`).
- Confirmed the advanced-filter sheet is unreachable on `restaurant-shell.html` (no markup, no
  caller) while `restaurant old.html` does have the markup — recorded as `TODO(question)` #1.

Open questions / TODOs (full list in `notes/restaurant-shell-map.md` §7 and §9):
- `TODO(question)`: the advanced-filter sheet is dead on this page — only the 3 quick chips and
  the veg/non-veg toggle do anything. Confirm the sheet is intentionally absent.
- `TODO(question)`: the favourite heart only toggles its own icon class; it never touches
  `eatswada_favorites`, and `favorites.js` is not loaded here. Confirm it stays decorative.
- `TODO(question)`: `assets/fssai-logo.png` and the whole `assets/` directory do not exist, yet
  `FSSAI_LOGO_SRC` is a non-empty string. Should the port ship the asset?
- `TODO(question)`: `window.currentResId`, `window.resolveMenuImage`, `window.escapeMenuHtml`,
  `window.toggleCategory`, `window.scrollToCategory` are read by `pairing-suggestions.js` /
  `menu-jump.js` but never assigned to `window` in the shell (they are top-level lexical
  bindings), so every consumer silently falls back. Reproduce exactly unless told otherwise.
- `TODO(question)`: `js/restaurant-info.js` is referenced by `restaurant-info.html` but **does not
  exist in the repo**, so that page is broken today. Decide whether `/restaurant-info` and
  `/restaurant-details` are still ported as their own pages.
- `TODO(question)`: `<meta name="view-transition" content="same-origin">` (shell L13) has no
  equivalent in `app/layout.tsx`.
- `TODO(question)`: `search-overlay.js` is loaded but unreachable on this page, and it re-injects
  `search-overlay.css` with a `?v=` query (a genuine second fetch). Keep or drop?
- Env var NAMES the owner must set in `web/.env.local` (no values printed here):
  `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_MAPTILER_ENABLED`,
  `NEXT_PUBLIC_MAPTILER_KEY`, `NEXT_PUBLIC_MAPTILER_MAP_ID`, `NEXT_PUBLIC_FIREBASE_ENABLED`,
  `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`,
  `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`,
  `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`.

## 2026-10-26 Task: Phase 1c part 2 — 99 Store page (`under99.html` → `app/under99/page.tsx`)

Files changed:
- `web/app/under99/page.tsx` — **new**. 1:1 JSX port of `under99.html` lines 45–178: the page's
  own `<header class="u99-header">` (topbar + hero), `nav.u99-filter-rail`, `main.u99-page`
  (price segment + `#u99-products` with the 4-card skeleton), the filters sheet, the sort sheet,
  the item-customization sheet host and `#u99-toast`, then `<CartBar/>` + `<Under99Runtime/>`.
  `metadata` is verbatim (`noindex, nofollow`, canonical `https://eatswada.com/under99.html`).
  **There is no inline `<style>` in the legacy file**, so no `under99-inline.css` was needed —
  every rule lives in the `css/under99-*.css` files (all already copied byte-for-byte in
  Phase 0). There is no `<footer>` and no body class either.
- `web/lib/under99-icons.ts` — **new**. Port of `js/under99-icons.js`: the `U99Icons` SVG set
  (14 stroke + 11 fill icons), `icon()`, `hydrate()`, byte-identical markup.
- `web/lib/under99-core.ts` — **new** (439 lines). Port of `js/under99-core.js`: the two API
  calls, `normalizeRestaurant` (canonical menu-item model), `load`/`loadHero`, the canonical
  cart reads (`readCart`, `cartQty`), `cartPayload` (the encodeURIComponent payload the pink
  cart consumes), `cartChange`/`addWithOptions`, `renderAddControl`/`addControlInner`, the
  delegated `[data-cart-add]` routing (customizable item → `eatswada99:open-customize`), and
  `syncAddControls` with the roll/collapse animations on `eatswada:cart-updated`.
- `web/lib/under99-header.ts` — **new**. Port of `js/under99-header.js`: the 9 location
  localStorage keys, first non-empty wins, `#u99-location-name` / `#u99-location-sub`, click →
  `/address` (legacy `address.html`), re-runs on `storage`.
- `web/lib/under99-filters.ts` — **new**. Port of `js/under99-filters.js`: the draft sheet,
  `Apply (n)` count, `.u99-check` ticks, rail quick-toggle, backdrop/Escape close.
- `web/lib/under99-price-tabs.ts` — **new**. Port of `js/under99-price-tabs.js`: the sliding
  thumb, `active`/`aria-selected`, no-op re-tap, `eatswada99:filters-changed`.
- `web/lib/under99-products.ts` — **new**. Port of `js/under99-products.js`: `bandMatch`,
  `filtered()` (all filters + 5 sort modes), `card()`, `emptyState()`, `#u99-count` text,
  the 240 ms skeleton swap on filter/sort changes, `resetFilters()`.
- `web/lib/under99-customize.ts` — **new**. Port of `js/under99-customize.js`: `readGroups`
  (flexible API shape: `label`/`extraPrice`/`minSelect`/`maxSelect`), `defaultSelection`,
  the full sheet render, `requiredSatisfied` gating on the Add button, `addWithOptions` call.
- `web/lib/under99.ts` — **new**. Port of `js/under99.js`: the sort sheet boot + `window.showToast`.
- `web/components/Under99Runtime.tsx` — **new**. `"use client"`, installs the modules in legacy
  script order. Renders nothing.
- `web/scripts/fixtures/under99.json` — **new**. GET-only recordings: `/restaurants/under99`
  (1 restaurant, 37 menu items) and `/home-banners?placement=under99`.
- `web/scripts/cart-parity.mjs` — **new** (task deliverable). Drives the same 6-step sequence on
  both pages with the same fixtures and deep-compares the cart storage after every step.
- `web/package.json` — **edited**. Added `"cart-parity": "node scripts/cart-parity.mjs"`.
- `web/next.config.js` — **edited**. `PORTED_PAGES` += `"/under99"`.
- `web/.gitignore` — **edited**. Added `/compare-out/` (visual-diff screenshots) as instructed.
- `notes/under99-map.md` — **new**. The full map (head order, CSS order, every script, API calls,
  query params, every localStorage key).
- `PROGRESS.md` — this entry.

CSS import order (top of `app/under99/page.tsx` — the exact `<link>` order of `under99.html`,
kept separate and in order; several share selectors and the later ones are the intended overrides):
1. `css/under99-tokens.css` 2. `css/under99-base.css` 3. `css/under99-header.css`
4. `css/under99-hero.css` 5. `css/under99-filters.css` 6. `css/under99-price-tabs.css`
7. `css/under99-product-card.css` 8. `css/under99-product-grid.css` 9. `css/under99-customize.css`
10. `css/under99-responsive.css` 11. `css/under99-skeleton.css`
12. *(search-overlay.css — runtime-injected by `lib/search-overlay.ts`, as on home)*
13. `css/eatswada-ui-system.css` 14. `eatswada-theme.css` 15. `eatswada-header-theme.css`
16. `css/under99-premium.css`.
Manrope comes from `layout.tsx`. **No Font Awesome on this page** (it uses the inline
`U99Icons` SVG set) and **no inline `<style>`** to extract.

Compare result (legacy `npx serve . -l 8080`, new `npm run build && npm start` on 3000):
- `npm run compare -- "http://localhost:8080/under99.html" "http://localhost:3000/under99" under99 web/scripts/fixtures/under99.json`
  → **phone 0.00% / desktop 0.00% — PASS** on the first run. The legacy and new screenshots are
  byte-identical files (md5 match): phone 1,170,292 B, desktop 3,543,919 B — i.e. the page
  really rendered all 22 items, not two empty states.
- Re-ran home / search / category after the layout + `PORTED_PAGES` changes →
  **all 0.00% phone and desktop**.
- `/under99.html` → 301 `/under99` (and `/index.html`, `/search.html`, `/category.html` still 301).

Cart parity (`npm run cart-parity` → `compare-out/cart-parity.txt`) — **PASS, 7/7 steps, all
checks equal**. Legacy and new run side by side, same fixtures, `nearbite_cart` deep-compared
after every step:
| step | nearbite_cart | es_image_dict | checkout keys | bar mode | bar visible | bar text |
|---|---|---|---|---|---|---|
| 0. initial | PASS | PASS | PASS | PASS | PASS | PASS |
| 1. add plain item (direct add) | PASS | PASS | PASS | PASS | PASS | PASS |
| 2. increase quantity (stepper "+") | PASS | PASS | PASS | PASS | PASS | PASS |
| 3. customize sheet: pick option 2, add | PASS | PASS | PASS | PASS | PASS | PASS |
| 4. decrease to zero (stepper − twice) | PASS | PASS | PASS | PASS | PASS | PASS |
| 5. add two items from different cards | PASS | PASS | PASS | PASS | PASS | PASS |
| 6. clear the cart | PASS | PASS | PASS | PASS | PASS | PASS |

Pink-bar text, legacy → new, identical at every step: `0 items` → `1 item · ₹80` →
`2 items · ₹160` → `3 items · ₹308` → `1 item · ₹148` → `3 items · ₹319` → (bar hidden).
The customized line lands in `nearbite_cart` under the plain item name key
(`"Hot & Sour Soup (Veg)"`, quantity 1, price 148 = 68 base + 80 add-on, originalPrice 160),
and the plain line under `"Foodie Special Soup (Veg & Egg)"` (price 80, originalPrice 100) —
byte-identical objects on both pages. Cart-bar mode is `pink` (`getCartBarMode('/under99')`),
`#es-pink-inner` shows `<n> items · ₹<total>`, and clearing hides the bar (`display:none`) on both.
Nothing was excluded from the diff. The only normalisation applied is the `Date.now()` variant
stamp that `cart-bar.js` itself embeds in the payload key of a customized line (random by
design); the harness reports it in the "normalised" section rather than hiding it. Note the
final cart bodies are both `null` (clear) — the cart after step 3 is printed in full for the
shape evidence, which is why the step-3 comparison is the load-bearing one.

Tested behaviours (Playwright, **legacy and new side by side with the same fixtures on both**;
all 14 byte-identical — `compare-out/under99-handtests.txt`):
- Initial state: `All 22 items`, 22 cards, first "Chicken Chilli Dry" ₹91, thumb
  `translateX(0%)`, active tab `99`, sort label `Sort`, hero `u99-hero-ready`, no pageerror.
- Price tabs: tab 100 and tab 150 each move the thumb to `translateX(100%)`/`translateX(200%)`,
  flip `active` + `aria-selected`, and recount the grid (tab 150 → 0 items → the `.u99-empty`
  "No dishes found" state).
- Filter sheet: opens, selecting `discount` + `veg` shows `Apply (2)` with 2 `.selected` rows;
  Apply commits and the rail chip goes `active`.
- Rail discount quick-toggle: toggles `#u99-discount.active` and re-filters.
- Sort: "Price: Low to High" sets the label and re-sorts.
- Customize sheet: opens from the "+" of a customizable card (`sheetOpen`), shows the real
  group count and the item name, picking option 2 updates the total, and close resets it.
- Empty state: veg filter + tab 150 → the same `.u99-empty` block with "Clear filters".
- Error state (API 500): both pages show the identical `.u99-empty` "Couldn’t load deals" /
  "Check your connection and try again." / "Try again" block and hide the skeleton.
- Location prompt (new user, no stored location): `#u99-location-name` = "Set location",
  `#u99-location-sub` = "Delivery in 35–40 minutes" — identical.
- Dark mode (`eatswada_theme=dark` + reload): page NOT blank, `data-ew-theme=dark`, Dark Reader
  present and `isEnabled()` true, 7 visible body children and 1625 chars of text on both pages.
- CSS leak check: `/under99` → `/search` → `/` → `/under99` with genuine client-side
  navigation (a `window` marker set on the probe route survived into `/under99`; the probe route
  was temporary and is deleted — the final build is exactly `/`, `/category`, `/search`,
  `/under99`, `/_not-found`). **0 computed-style diffs** across body / u99-header / u99-hero /
  filter rail + chip / u99-page / price seg + tab / products head / count / product grid /
  product card / current price / `#white-cart-root`, and `document.styleSheets` identical
  before and after (9 → 9, same list). **Nothing restyles.**

Open questions / TODOs:
- `TODO(question)`: `under99.html` does **not** load `js/under99-popular.js` or
  `js/pairing-suggestions.js`, and does not link `under99-popular.css` or
  `pairing-suggestions.css` (grep = 0 hits). The task listed them; they are dead code for this
  page, so they are not ported. Flag if a "popular rail" was expected — the page has no rail
  element today, and the grid's Bestseller/Popular badges come from the item flags.
- `TODO(question)`: `under99.html` reads **no** URL query params, so the compare uses the plain
  `under99.html` ↔ `/under99` pair (the task suggested a fixed URL; this is it).
- `TODO(question)`: `under99.html` is the only page in the site with
  `<meta name="theme-color" content="#E9546B">`; `eatswada-theme.js` then overwrites it with
  `#FFFFFF`/`#181A1B` on load. The port reproduces that exactly (page meta + theme.js rewrite),
  and the compare confirms the rendered colour matches.
- `TODO(question)`: the legacy `<a href="index.html">` back button is kept verbatim in the JSX
  so the markup matches byte-for-byte; `/index.html` 301s to `/`, so it still works. Same for
  the location click (`address.html` → ported as `/address`, which is not built yet — Phase:
  address pages) and the search-overlay result link to `restaurant-shell.html` (Phase: restaurant).
- `TODO(question)`: `cart-bar.js`'s `Date.now()` variant stamp means a customized cart line's
  *key* differs between two runs of the same sequence; the cart *body* under that key is
  deterministic and is what is compared. Documented in `cart-parity.mjs`.
- Playwright's chromium had to be re-downloaded this session (`npx playwright install chromium`,
  120 MB) — the earlier cache was gone. Needed for both `npm run compare` and `npm run cart-parity`.
- Env var NAMES the owner must set in `web/.env.local` (unchanged; no values printed):
  `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_MAPTILER_ENABLED`,
  `NEXT_PUBLIC_MAPTILER_KEY`, `NEXT_PUBLIC_MAPTILER_MAP_ID`, `NEXT_PUBLIC_FIREBASE_ENABLED`,
  `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`,
  `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`,
  `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`.

## 2026-10-26 Task: Phase 1c part 1 — Search + Category pages (`search.html` → `app/search/page.tsx`, `category.html` → `app/category/page.tsx`)

Files changed:
- `web/app/search/page.tsx` — **new**. Port of `search.html`. The legacy page renders **no
  markup of its own**: it is a bootstrapper that opens the shared search overlay in full-page
  mode from the URL. So this file only carries `metadata`, the CSS imports and
  `<SearchRuntime/>`. `metadata` is verbatim: `noindex, nofollow`, canonical
  `https://eatswada.com/search.html`, og/twitter as in legacy.
- `web/app/category/page.tsx` — **new** (server component, so it can export `metadata`). Port of
  `category.html`'s markup: `<CategoryHeader/>`, `#results-list.results-container` with
  `#cat-skeleton` (the two `.skel-card` skeletons, inline widths/heights kept) and
  `#cat-results[style="display:none"]`, then `<CartBar/>` and `<CategoryRuntime/>`.
- `web/components/CategoryHeader.tsx` — **new** (`"use client"`). `.cat-header` + the
  `#cat-filter-bar` filter pills. The legacy inline `onclick=` attributes became React
  handlers; the search control stays a `<button>` (legacy used
  `onclick="window.location.href='search.html'"`) because an `<a>` does not render identically
  under `.icon-btn-round`. It navigates with `router.push("/search")`, i.e. the clean URL.
- `web/components/SearchRuntime.tsx` — **new** (`"use client"`). Installs `search-overlay`,
  applies search.html's inline `<body style="margin:0;background:#fff;font-family:Inter,
  system-ui,sans-serif">` via `setAttribute` (inline, so the cascade position matches), then
  runs the bootstrapper.
- `web/components/CategoryRuntime.tsx` — **new** (`"use client"`). Installs `restaurant-card`
  then the category logic, in legacy load order.
- `web/lib/search-page.ts` — **new**. Port of search.html's inline `DOMContentLoaded` snippet:
  reads `q` / `scope` (`home`|`under99`|`restaurant`) / `restaurantId` (alias `id`), adds
  `ew-search-page` to `<body>`, calls `EatswadaSearch.open(q, { context, restaurantId })`.
- `web/lib/category-page.ts` — **new** (281 lines). Port of category.html's inline IIFE:
  `state`, `matchesCategory`, `visible`, `syncFilterBar`, `stateBlock`, `render`, `load`,
  the three toggles, `readCategory`. Same ids, class names, markup strings, same
  `API.cache.readList/writeList` session cache, same `window.toggleCategory*` globals.
- `web/app/layout.tsx` — **edited**. The pre-paint theme snippet and the dark-only Dark Reader
  loader moved from `<body>` (`next/script beforeInteractive`) into `<head>` as plain inline
  `<script>`s — the position they occupy in every legacy `<head>`. In `<body>` they only ran
  after the body was parsed, so a dark visitor painted white first. Also added the dark-theme
  background rule (see the dark-mode section below). `PRE_PAINT` is now byte-identical to
  `index.html` line 8.
- `web/next.config.js` — **edited**. `PORTED_PAGES` now `["/", "/search", "/category"]`, so
  `/index.html`, `/search.html` and `/category.html` 301 to the clean URLs.
- `web/styles/legacy/category-inline.css` — **new**. category.html's 150-line inline `<style>`,
  extracted byte-for-byte (roundtrip verified).
- `web/scripts/fixtures/search.json`, `web/scripts/fixtures/category.json` — **new**. Real API
  bodies (GET only) for `/restaurants/search?q=Noodles&scope=home`,
  `/restaurants/search?q=Egg&scope=home`, and `/restaurants`.
- `notes/search-map.md`, `notes/category-map.md` — **new**. Section/script/API/CSS maps.
- `PROGRESS.md` — this entry.

CSS import order (AGENTS.md hard rule 2 — the exact `<link>` order of each legacy page):

`app/search/page.tsx` (search.html has no inline `<style>`):
1. `styles/legacy/css/eatswada-ui-system.css` 2. `styles/legacy/eatswada-theme.css`
3. `styles/legacy/eatswada-header-theme.css`.
`search-overlay.css` is injected at runtime by `lib/search-overlay.ts` (via the existing
`public/search-overlay.css`), exactly where `search-overlay.js` injected it. The Google Fonts
Manrope/Font Awesome sheets come from `layout.tsx`; search.html additionally loads the
**Inter** sheet (its `<body>` uses Inter) — reproduced as a `<link>` in the page, so it keeps
its position after the three app sheets, as in legacy.

`app/category/page.tsx`:
1. `styles/legacy/category-inline.css` (the inline `<style>`; **must stay first** — the linked
   files win the cascade for the shared `.filter-bar` / `.filter-pill` rules)
2. `styles/legacy/style.css` 3. `styles/legacy/css/eatswada-ui-system.css`
4. `styles/legacy/eatswada-theme.css` 5. `styles/legacy/eatswada-header-theme.css`
6. `styles/legacy/food-placeholder.css`.
Manrope + Font Awesome come from `layout.tsx`.

Compare result (legacy `npx serve . -l 8080`, new `npm run build && npm start` on 3000):
- `npm run compare -- "http://localhost:8080/search?q=Noodles" "http://localhost:3000/search?q=Noodles" search web/scripts/fixtures/search.json`
  → **phone 0.00% / desktop 0.00% — PASS**. (`search-*-legacy.png` and `search-*-new.png` are
  byte-identical files, 123659 B desktop / 116328 B phone.)
- `npm run compare -- "http://localhost:8080/category?type=Dosa" "http://localhost:3000/category?type=Dosa" category web/scripts/fixtures/category.json`
  → **phone 0.00% / desktop 0.00% — PASS**.
- `home` re-run to confirm no regression from the layout change → **phone 0.00% / desktop 0.00%**.
Screenshots are in `web/compare-out/` and shipped in `home-compare.zip`.
(`serve` maps the clean `/search` and `/category` to the `.html` files, and `/search.html`
also 301s to `/search`, so both spellings were exercised.)

Tested behaviours (Playwright, **legacy and new run side by side with the same fixtures
installed on both**; every value below was byte-identical between the two pages):
- Category `?type=Dosa`: title "Dosa", `.res-count` "1 restaurant found", 1 `.res-card`,
  name "Foodie Dosa Restaurant", href `restaurant.html?id=6ac8f95828669b5f4e30f0ba`, rating
  "4.0", cuisine "Dosa. Chinese", `.res-loc` "2.0 km" (green `fa-location-dot`), 1 `.ew-food-ph`
  placeholder, skeleton `display:none`. Filter bar shown; `#veg-cat-btn` hidden (the restaurant
  has no `pureVeg`), sort + rating pills shown. No `pageerror` on either page.
- Category filter pills: sort → `active` true; rating 4.0+ → `active` true; veg → `active` true
  and the list drops to 0 with the "No restaurants found / We couldn’t find any places serving
  \"Dosa\" nearby." state block (curly apostrophe `\u2019`); all three toggled back → 1 card.
- Category empty state (`?type=Zzz`): `fa-utensils` icon, "No restaurants found", sub
  "We couldn’t find any places serving \"Zzz\" nearby.", "Go Back" button — identical.
- Category no `type` param: title stays "Category", 1 card (matches everything) — identical.
- Category error state (API 500): `fa-plug-circle-xmark`, "Couldn't load restaurants", sub
  "boom" (the server message), `#cat-retry` "Try Again" — identical.
- Category search control: both render `BUTTON` with no `href`; the new one navigates to
  `/search` via the router.
- Search `?q=Noodles`: `<body>` class `ew-search-page ew-search-open`, `#ew-search-root`
  `ew-search-root is-open` with `aria-hidden=false`, input value "Noodles", context
  "Search Eatswada", 10 `.ew-search-result`, first "Chinese Bhel" with meta
  "₹114 · Crispy noodles tossed with fresh vegetables and tangy Indo-Chinese sauces." and a
  thumbnail. No `pageerror`.
- Search typing "Egg" → 13 results, first "Burnt Garlic Fried Rice (Egg With Chicken)".
  `#ew-search-clear` → body emptied, clear button hidden. No-match ("zzzzzz", fixture 404) →
  "Search is temporarily unavailable" / "Please check your connection and try again.".
- Search with no `q`: input empty, body empty, overlay still open (`is-open`) — identical.
- Search `scope=under99`: context "Search 99 Store", 0 results (the fixture has no under99
  match) — identical.
- Dark mode (`localStorage eatswada_theme=dark`, reload `/`): page **not blank** — 27 body
  children, 464 chars of text, `data-ew-theme=dark`, Dark Reader present and `isEnabled()` true,
  `theme-color` meta `#181A1B`. The document.write loader in `layout.tsx` was **not** the
  problem and is unchanged: it had already been converted to a normal
  `<script src integrity crossorigin>` (same URL + sha384 hash) in Phase 1b, so `<head>` keeps
  a normal script tag.
- CSS leak check: loaded `/`, then **genuinely client-side navigated** `/` → `/search?q=Noodles`
  → `/category?type=Dosa` → `/` using a temporary `app/leakprobe/page.tsx` with real
  `next/link` `<Link>`s (created only for the test, deleted before packaging; the final build
  has exactly `/`, `/search`, `/category`, `/_not-found`). A `window` marker set on the probe
  survived into `/`, proving no full reload. Result: **0 computed-style diffs** across body /
  hero-header / loc-name / search-box / 99-card / cat-scroll / filter-bar / sec-title / sec-head
  / bottom-nav, and `document.styleSheets.length` identical before (10) and after (10) with the
  same sheet list. **Nothing restyles.**
- Redirects on the new app: `/index.html` → 301 `/`, `/search.html` → 301 `/search`,
  `/category.html` → 301 `/category`.

Dark-mode flash — the one thing that needed judgement (please read):
- Requested `html[data-ew-theme="dark"]{background:#181A1B}` was added, but measurement showed
  it is **not sufficient**: the page CSS also sets `html{background:var(--page-bg)}` **and**
  `body{background:var(--page-bg)}` with `--page-bg:#FFFFFF`, and the opaque body background is
  what fills the viewport. A CDP screencast (`Page.startScreencast`, everyNthFrame=1) showed the
  new page painting the legacy light header on frames 0–6 before the attribute landed.
- Fix applied (all dark-theme-only, no light-mode change): (a) the pre-paint snippet now runs
  synchronously in `<head>` instead of after the body, so `data-ew-theme="dark"` is set before
  first paint — this alone removed every white `html` sample (0/40 white, 39/40 dark); and
  (b) the same `#181A1B` is applied to the body too:
  `html[data-ew-theme="dark"]{background:#181A1B}html[data-ew-theme="dark"] body{background:#181A1B}`.
  `#181A1B` is Dark Reader's own `darkSchemeBackgroundColor` (`eatswada-theme.js` line 112), so
  the post-load rendering is unchanged.
- Honest limitation: a short residual staged lightening is still visible for a few frames
  (~200–300 ms) on the new page. It is **Dark Reader's own async conversion** of the legacy
  light markup, not an extra white background of ours — Dark Reader loads from a CDN and can
  only convert the DOM once it is parsed. Legacy has the identical window (its frame 0 is
  fully white, then it snaps to dark), so this is at parity or better, and it is not the
  "page is blank / Dark Reader did not load" failure the task was guarding against. Both pages
  end at `htmlBg rgb(24,26,27)` with Dark Reader enabled. Evidence:
  `web/compare-out/dark-flash-report.txt` + `early-dark-{legacy,new}*.png`.

Open questions / TODOs:
- `TODO(question)`: the residual Dark Reader conversion window above cannot be closed without
  changing the design (e.g. shipping dark CSS instead of using Dark Reader). Left as-is for
  parity. Flag if the owner wants it gone.
- `TODO(question)`: `lib/category-page.ts` uses `optimizedImageUrl(images[0],240)` for the card
  image and falls back to the raw URL if the helper is absent. `category.html`'s inline script
  called `optimizedImageUrl` from `safe-html.js`, which is a shell global — identical source.
- `TODO(question)`: the category card links to `restaurant.html?id=…` (verbatim legacy, so the
  compare matches). On the new site that URL 301s to `/restaurant?id=…`, which does not exist
  yet (Phase: restaurant page). Revisit when `/restaurant` lands.
- `TODO(question)`: `category.html` marks itself `noindex, nofollow` and so does the port; the
  canonical still points at the legacy `https://eatswada.com/category.html` URL, verbatim. Same
  for `/search`. Revisit the canonical host if the site moves off `eatswada.com`.
- Env var NAMES the owner must set in `web/.env.local` (unchanged; no values printed):
  `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_MAPTILER_ENABLED`,
  `NEXT_PUBLIC_MAPTILER_KEY`, `NEXT_PUBLIC_MAPTILER_MAP_ID`, `NEXT_PUBLIC_FIREBASE_ENABLED`,
  `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`,
  `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`,
  `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`.

## 2026-10-26 Task: Phase 1b — Home page (`index.html` → `app/page.tsx`)

Files changed:
- `web/app/page.tsx` — **new**. Full port of `index.html`'s `<body>`: `<Header/>`, `main.page`
  with `#home-platform-banners`, `#mind-section` (category skeleton), `#filter-bar` skeleton,
  `#restaurants-section` (`#home-notice`, `#profile-setup-banner`, `#location-banner`,
  `#restaurant-list` with the two `u99-card-host.rs-skeleton` cards), `#home-feed-end`, the
  `#filter-sheet` and `#location-sheet` dialogs, `<CartBar/>`, `<HomeRuntime/>`.
- `web/app/layout.tsx` — **edited**. (1) `<ShellRuntime/>` moved BEFORE `{children}` so shared
  globals install before page effects run; (2) the two CDN `<link>`s every legacy page loads
  (Google Fonts Manrope+Caveat, Font Awesome 6.5.2) added to `<head>` verbatim — without them
  the ported page rendered in a fallback font with no icons (this was the whole 3.8%/1.8% diff);
  (3) the dark-only Dark Reader `document.write` loader kept as the DOM-injected
  `<script src integrity crossorigin>` (same URL + hash) — the `document.write` form blanked the
  document in React. Verified dark mode is not blank and Dark Reader loads + enables.
- `web/lib/restaurant-card.ts` — **new** (1402 lines). Port of `restaurant-card.js`: the `read`
  field readers, distance/haversine, cuisine formatting, availability rules, the 99-Store card
  builder, cart add/stepper, delegated interactions, favorites wiring, galleries.
- `web/lib/home.ts` — **new** (1741 lines). Port of `home.js`: `state.restaurants` +
  `state.filter`, the FILTERS/SORTS registries, filter bar + filter sheet, category row and
  `GET /restaurants/search?scope=home`, restaurant refresh + cache, location provider,
  saved-address header, profile banner, search placeholder, `#cat-scroll` "Pizaa"→"Pizza"
  MutationObserver, `sw.js` registration.
- `web/lib/home-banners.ts` — **new**. Port of `home-banners.js`: hero carousel,
  `GET /home-banners`, `es_home_banners_v2` sessionStorage cache, pointer/touch swipe.
- `web/lib/search-overlay.ts` — **new**. Port of `search-overlay.js`: shared search sheet,
  runtime-injected `search-overlay.css`, `GET /restaurants/search`, voice search.
- `web/lib/new-user-location-prompt.ts` — **new**. Port of `new-user-location-prompt.js`
  (see the TODO below — no legacy page loads this script).
- `web/components/HomeRuntime.tsx` — **new**. `"use client"`, installs the five Home modules in
  legacy load order.
- `web/public/search-overlay.css`, `web/public/new-user-location-prompt.css` — **new** copies
  (byte-for-byte) so the runtime `<link href="/search-overlay.css">` resolves. The legacy
  `search-overlay.js` injected the same file from the site root.
- `web/scripts/fixtures/home.json` — **new**. Real API bodies (GET only) for the paths Home
  calls: `/restaurants`, `/categories`, `/home-banners`, `/platform/public-status`,
  `/restaurants/6ac8f95828669b5f4e30f0ba/menu`, `/restaurants/search?q=Noodles&scope=home`,
  `/restaurants/search?q=Rice&scope=home`.
- `web/scripts/compare.mjs` — **edited** (approved). Optional 4th argument = fixtures file;
  `page.route("https://api.eatswada.com/**")` fulfils both pages from it with
  `access-control-allow-origin: *`; unknown API paths get a 404 JSON. Fixtures path accepts
  either `web/scripts/...` or `scripts/...`. Nothing else changed.
- `web/next.config.js` — **edited**. `PORTED_PAGES = ["/"]` so `/index.html` 301s to `/`.
- `notes/home-map.md` — **new**. Sections/scripts/API map + the CSS order and its conflicts.
- `PROGRESS.md` — this entry.

CSS import order (top of `app/page.tsx`, the exact `<link>` order of `index.html`):
1. `home-inline.css` (the page's own inline `<style>`, extracted byte-for-byte) — **must stay
   first**: the linked files below win the cascade for the 29 header selectors they share.
2. `restaurant-card.css` 3. `skeleton.css` 4. `eatswada-end-section.css`
5. `whats-on-your-mind.css` 6. `filter-bar.css` 7. `filter-sheet.css`
8. `eatswada-theme.css` 9. `eatswada-header-theme.css` 10. `css/platform-status.css`.
The two CDN sheets (Google Fonts, Font Awesome) are in `layout.tsx`. `search-overlay.css` is
injected at runtime by `lib/search-overlay.ts`, exactly as `search-overlay.js` did.

Compare result:
`cd web && npm run compare -- http://localhost:8080/index.html http://localhost:3000/ home web/scripts/fixtures/home.json`
→ **phone 0.00% / desktop 0.01% — PASS (under 1%)**. (First run before the font fix: phone
3.82% / desktop 1.76%, page heights 1485/1519 and 2353/2428 — the height difference was the
missing Font Awesome + Manrope links.) Legacy served with `npx serve . -l 8080`, new app with
`npm run build && npm start` on port 3000.

Tested behaviours (Playwright, both pages, fixtures installed on both — outputs byte-identical):
- Card render: 1 card, 6 `.u99-item`, 6 `.u99-add`, 1 `.u99-more-tile`, rating "4.0",
  offer "UP TO 35% OFF", meta `4.0 • 30-40 min • 2.0 km • Dosa • Chinese`.
- Category row: 10 categories, "Pizaa"→"Pizza" normalisation; tapping a category sets the
  section title to "Pizaa near you" and marks 1 `.cat-item.is-selected` (the API returns 0
  matches for "Pizaa", same on both pages).
- Search overlay: opens from the header search box, context "Search Eatswada", typing "Noodles"
  → 10 results, first "Chinese Bhel"; Escape closes. Empty query "zzzzzz" → the same
  "Search is temporarily unavailable" state on both pages (the fixture has no match, so the
  overlay treats the 404 as a failure — identical behaviour, not a regression).
- Filter sheet: opens, 6 tabs, 4 sort options; picking sort #2 gives the "Filters 1" pill and
  `?sort=rating`; "Show results" closes. Quick pill `Near & Fast` → `active` + `?filters=nearfast`;
  "Clear all" resets to `/` and clears the pill.
- Veg toggle: toggles off/on identically; with it on, the "No restaurants match your filters"
  state-block appears on both pages.
- Add to cart: the home card "+" is a *navigate* action in legacy (`restaurant.html?id=…`), not
  an in-place add — verified identical (`/restaurant` legacy, `/restaurant?id=…` new). The
  `.u99-add` selector the task mentions exists but the real add control is `data-home99-action`.
- Card tap and "View full menu" both navigate to the restaurant (same on both pages).
- Location prompt for a new user: `#loc-name` "Set delivery location", `#loc-sub` "Choose your
  delivery location", `#location-banner` visible with "Set your location to see delivery
  availability. / Set location" — identical. `#profile-setup-banner` and
  `#home-service-area-notice` stay hidden (no user / no coords) — identical.
- Banners: 1 slide rendered, `#banner-controls` hidden, track `translate3d(0px, 0px, 0px)` —
  identical (the fixture returns a single "Welcome to eatswada" banner).
- Favorite hearts: 0 `.es-fav` on both pages (the 99-Store card Home uses renders none).
- Dark mode: `localStorage eatswada_theme=dark` + reload → page NOT blank (27 body children,
  836 chars of text), `data-ew-theme=dark`, Dark Reader script present and `isEnabled()` true.
  Identical to legacy. No `pageerror` on either page.
- CSS leak check: loaded `/`, navigated client-side to a temporary placeholder route and back
  (0 document requests both ways, `window` marker survived → genuinely soft navigation). Zero
  computed-style diffs across body/header/loc-name/search-box/filter-pill/card/item/cat-ring/
  feed-end/sheet-panel, and `document.styleSheets.length` unchanged.

Open questions / TODOs:
- `TODO(question)`: `#location-sheet` is present in `index.html` but **no** script on `main`
  references `location-allow-btn` / `location-sheet-close`; `home.js` says Home no longer
  auto-opens a permission sheet. Rendered verbatim, left unwired, exactly as legacy.
- `TODO(question)`: `new-user-location-prompt.js` is **not** referenced by any legacy HTML file
  and its CSS is not linked either; only `complete-profile.html` writes its pending key. Ported
  per the task list and installed on Home, but it is a no-op unless that key is set — so the
  "new user location prompt" test above is really the location *banner*, which is what the
  legacy page shows. Flag if it is meant to be wired into `complete-profile.html` later.
- `TODO(question)`: `.es-fav` hearts are emitted by `restaurant-card.js syncFavoriteButtons()`,
  but the 99-Store card Home uses (`homeBuildCard`) renders no `.es-fav` button and `index.html`
  has none, so no heart is visible on Home today. The delegated handler is ported as-is.
- `TODO(question)`: `search-overlay.js` uses `location.href = 'restaurant-shell.html?id=…'`
  (line 189 area) for a search result, which is the legacy un-ported shell. The port keeps the
  same string; revisit when `/restaurant` lands in a later phase.
- The `pixelmatch`/`pngjs`/`playwright` devDeps and the system chromium
  (`/usr/bin/chromium`, ms-playwright cache present at `chromium-1248`) are needed for
  `npm run compare`.
- Env var NAMES the owner must set in `web/.env.local` (unchanged from Phase 0/1a; no values
  printed): `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_MAPTILER_ENABLED`,
  `NEXT_PUBLIC_MAPTILER_KEY`, `NEXT_PUBLIC_MAPTILER_MAP_ID`, `NEXT_PUBLIC_FIREBASE_ENABLED`,
  `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`,
  `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`,
  `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`.

## 2026-10-26 Task: Phase 1a — Shared shell (header, footer, cart bar, theme)

Files changed:
- `web/lib/theme.ts` — **new**. Port of `eatswada-theme.js`: dark/light state, Dark Reader
  Dynamic Theme loader + fixed config, `data-ew-theme`, `color-scheme`/`theme-color` metas,
  `[data-ew-theme-toggle]` switches, cross-tab `storage` sync, new-user pending flag.
- `web/lib/header-theme.ts` — **new**. Port of `eatswada-header-theme.js`: `data-ew-header`,
  `THEMES` (raspberry only), `[data-ew-header-picker]`, `primary()` for Razorpay.
- `web/lib/navigation.ts` — **new**. Port of `navigation.js`: `nearbiteSafeBack`, `premiumBack`,
  the 15 s fetch timeout wrapper and the hover/pointer prefetch.
- `web/lib/favorites.ts` — **new**. Port of `favorites.js`: `eatswada_favorites` (IDs only),
  corrupt-JSON wipe, in-memory fallback, `eatswada:favorites-changed`.
- `web/lib/address-store.ts` — **new**. Port of `address-store.js`: active-address cache,
  `GET /users/addresses`, `nearbite_selected_address_id` / `nearbite_address` /
  `nearbite_address_updated_at`, `eatswada:address-state` + `nearbite:address-changed`.
- `web/lib/safe-html.ts` — **new**. Port of `safe-html.js`: `escapeHtml`/`esc`, `safeUrl`,
  `optimizedImageUrl`, `ewFoodPlaceholder`.
- `web/lib/platform-status.ts` — **new**. Port of `platform-status.js`:
  `GET /platform/public-status`, 60 s sessionStorage cache, `DEFAULTS`/`normalise`,
  banner markup, `fromBlockedOrder`, 90 s polling.
- `web/lib/cart.ts` — **new**. Data half of `cart-bar.js` v3: `nearbite_cart`, `es_image_dict`,
  `findBaseCartKey`, `applyCartChange`, `updateCart`, `restaurantGroups`, `clearCart`,
  `cartTotals`, `deliveryMessage`, `getCartBarMode`, checkout-key invalidation.
- `web/lib/cart-bar.css.ts` — **new**. The `const CSS` string from `cart-bar.js`, verbatim.
- `web/components/ShellRuntime.tsx` — **new**. Installs the six shared globals in legacy order.
- `web/components/Header.tsx` — **new**. Port of `index.html`'s `header.hero-header#home-header`
  incl. the verbatim `data-ew-premium-theme` style block.
- `web/components/Footer.tsx` — **new**. Port of the shared `<footer class="ew-site-footer">`.
- `web/components/CartBar.tsx` — **new**. Presentation half of `cart-bar.js` (home / pink /
  hidden modes, image stack, "All ↑", clear-cart confirm, multi-restaurant drawer).
- `web/components/ThemeIntro.tsx` — **new**. The one-time `.ew-theme-intro` new-user prompt.
- `web/components/ThemeToggle.tsx` — **new**. Profile `#themeToggleRow` switch.
- `web/components/PlatformStatusBanners.tsx` — **new**. `.ps-host` mount point for the banners.
- `web/app/layout.tsx` — added the verbatim pre-paint inline script + the dark-only Dark Reader
  `document.write` loader (`next/script` `beforeInteractive`), a `viewport` export
  (`color-scheme: light dark`, `theme-color #FFFFFF`, `viewport-fit=cover`), and mounted
  `ShellRuntime` + `ThemeIntro`.
- `notes/shared-map.md` — **new**. What each shared legacy file does and what it reads/writes
  in localStorage.
- `PROGRESS.md` — **this file**.

CSS import order (AGENTS.md hard rule 2 — recorded when a page is ported):
No page was built in this phase, so there is no per-page import list yet. The global order a
page will need is documented in `notes/shared-map.md` §11, e.g. `index.html`:
`restaurant-card.css` → `skeleton.css` → `eatswada-end-section.css` → `whats-on-your-mind.css`
→ `filter-bar.css` → `filter-sheet.css` → `eatswada-theme.css` → `eatswada-header-theme.css`
→ `css/platform-status.css`. The shell components add no CSS of their own except the cart bar,
which injects its legacy `const CSS` as `<style id="wc-styles">` exactly as `cart-bar.js` did.

Compare result:
No page to compare yet (the ported shell is not wired into any route, by instruction). The
`compare` tool was not run this phase. Visual parity is deferred to the page phases, which
will place `<Header/>`, `<Footer/>`, `<CartBar/>` on the real pages.

Tested behaviours (headless Chromium against `next start`, all on a temporary throwaway page
that was deleted afterwards; the placeholder `app/page.tsx` is unchanged):
- `npm run build` passes; `npx tsc --noEmit` clean.
- Shell globals installed: `EatswadaTheme`, `EatswadaHeaderTheme`, `Favorites`,
  `EatswadaAddressStore`, `EWPlatform`, `updateCart`, `updateGlobalCart`, `nearbiteSafeBack`,
  `premiumBack`, `esc`, `optimizedImageUrl`, wrapped `fetch` (`__nearbiteFetchTimeout`).
- Theme: `set('dark')` → `data-ew-theme=dark`, `localStorage.eatswada_theme=dark`,
  `style.colorScheme=dark`; `set('light')` restores. `<meta name="color-scheme">` = `light`.
- Header theme: `data-ew-header=raspberry` before paint (from the inline script).
- Cart (home): `updateCart('Biryani',1,249,'r1',true,'m1',img,false,299)` writes the expected
  `nearbite_cart` object, shows the bar (`display:block`, `wc-enter`), count `1 item`, label
  `Biryani`, one thumbnail; home bar shows NO price.
- Cart (pink, on `/under99`): `#white-cart-root.wc-pink` + `#es-pink-inner`, count
  `2 items · ₹498`, free-delivery line `Your order is ready to review`.
- Cart (hidden, on `/cart`): `display:none`, no pink inner, bar never shown.
- "All ↑": appears only with 2+ restaurants; drawer opens with title `Your Carts (2)`, 2 rows,
  `body.overflow=hidden`; closes cleanly.
- Clear-cart confirm: `#wc-close-btn` swaps to the clear actions, `#wc-confirm-clear` empties
  `nearbite_cart` (null) and hides the bar.
- Theme intro: shows only on `/` when `eatswada_theme_intro_pending=1`, flag consumed, and
  choosing "dark" persists the theme and removes the sheet; does NOT show on non-home pages.
- `.ew-strip`, the premium theme style block, `#wc-styles`, and `[data-ew-theme-toggle]` all
  present in the rendered HTML; the pre-paint script lands inside `<head>`.
- Only console errors are the expected CORS failure of `GET /platform/public-status` from
  `localhost` (the API only allows the eatswada origins); `EWPlatform` falls back to `DEFAULTS`.

Open questions / TODOs:
- `TODO(question)`: `eatswada-header-theme.js` exposes a `data-ew-header-picker` switch API but
  no legacy page renders a picker (grep finds zero). Ported as-is for parity.
- `TODO(question)`: `#nearbite-bottom-tabbar` (the bottom nav the cart bar positions against) is
  referenced by `cart-bar.js` / `cart-bar.test.js` but no script on `main` creates it. The cart
  bar therefore always takes its fallback position today; not invented here.
- `TODO(question)`: `installNavigation()` registers `./sw.js` as in legacy. `web/public/sw.js`
  does not exist yet (Phase: PWA). Registration fails silently, as legacy tolerated.
- ESLint: the only remaining findings are `@typescript-eslint/no-explicit-any` (200), which
  AGENTS.md rule 3 explicitly allows (`strict: false`, "`any` is acceptable"). No
  correctness rules remain.
- Env var NAMES the owner must set in `web/.env.local` (no values are printed here):
  `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_MAPTILER_ENABLED`,
  `NEXT_PUBLIC_MAPTILER_KEY`, `NEXT_PUBLIC_MAPTILER_MAP_ID`, `NEXT_PUBLIC_FIREBASE_ENABLED`,
  `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`,
  `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`,
  `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`.

## 2026-10-26 Task: Phase 0 fixes (Tailwind reset, gated redirects, compare script)

Files changed:
- `web/app/globals.css` — replaced the create-next-app starter CSS with the Tailwind
  theme + utilities layer imports only. `@import "tailwindcss"` (which pulls in preflight)
  is gone, so the legacy CSS files render unchanged.
- `web/app/layout.tsx` — removed the Geist font imports and the starter `<html>`/`<body>`
  classes; metadata title is now "EatSwada".
- `web/app/page.tsx` — starter content removed; returns `null` (placeholder).
- `web/next.config.js` — redirects are now data-driven (`PORTED_PAGES` + `LEGACY_HTML`).
- `web/scripts/compare.mjs` — **new**, unchanged copy of `tools/compare.mjs`.
- `web/package.json` — added `"compare": "node scripts/compare.mjs"`.
- `PROGRESS.md` — **this file**.

CSS import order:
Not applicable yet — no page was built in this task. Per-page order is recorded when each
page is ported (AGENTS.md hard rule 2). The global layer statement is now
`@layer theme, base, components, utilities;` and Tailwind contributes only `theme` and
`utilities` (no `base`, so no preflight reset).

Compare result:
No page to compare. The `compare` script itself was sanity-checked against one URL twice
(`about.html` vs `about.html`) from `web/`:
phone 0.00% / desktop 0.00% — PASS. Real per-page results start in Phase 1.

compare.mjs usage line (do not rewrite the script):
`cd web && npm run compare -- <legacyUrl> <newUrl> <name>`
(equivalently `node scripts/compare.mjs <legacyUrl> <newUrl> <name>`). It resolves
`playwright`/`pixelmatch`/`pngjs` from `web/node_modules`, so it must be run from `web/`.
There is no root `package.json` and no symlink (as instructed); the previous open question
about module resolution is now resolved by running from `web/`.

Redirects are data-driven:
`next.config.js` has `const PORTED_PAGES = []` at the top and a `LEGACY_HTML` table mapping
every legacy `*.html` file to its clean URL. A legacy URL only 301-redirects once its clean
page is in `PORTED_PAGES`. **Each phase must append its pages to `PORTED_PAGES`.**
Always on, regardless of `PORTED_PAGES`:
- `/restaurant.html` → `/restaurant` (301)
- rewrites `/restaurant` → `/api/restaurant-seo` and `/sitemap-restaurants.xml` → `/api/sitemap`
- `X-Robots-Tag: noindex, nofollow` on `/restaurant-shell` and `/restaurant-shell.html`
`restaurant old.html` → `/restaurant` and `track-order-10.html` → `/track-order`, both active
only once `/restaurant` and `/track-order` are in `PORTED_PAGES`.

Tested behaviours:
- `cd web && npm run build` — passes, no errors.
- Generated CSS (`.next/static/chunks/*.css`, 457 bytes) contains the Tailwind `theme` layer
  and only the utilities in use; the preflight reset (`box-sizing: border-box`,
  `-webkit-text-size-adjust`, `img { display: block }`) is **absent**, confirming the legacy
  design is untouched.
- With `PORTED_PAGES = []` (live `next start`): only `/restaurant.html` → 301; `/about.html`,
  `/index.html`, `/restaurant%20old.html`, `/track-order-10.html`, `/restaurant-shell.html`
  all 404 (not ported yet, expected); noindex header still present; both rewrites registered.
- Gating verified by temporarily setting `PORTED_PAGES = ["/restaurant", "/track-order"]`:
  `/restaurant.html`, `/restaurant%20old.html` → 301 `/restaurant`; `/track-order.html`,
  `/track-order-10.html` → 301 `/track-order`; `/about.html` still 404. Then reverted to `[]`.
- `cd web && npm run compare -- <url> <url> sanity` — 0.00% / 0.00%, PASS.
- `git check-ignore` confirms `web/.gitignore` ignores `node_modules`, `.next` and `.env*`.

Open questions / TODOs:
- `TODO(question)`: `restaurant old.html` and `track-order-10.html` are on the AGENTS.md skip
  list yet now map to `/restaurant` and `/track-order` (per this task's instruction). They are
  not copied into `web/`; they only redirect once those pages are ported.
- `TODO(question)`: branches `poc/app-shell` and `stage-3-home-banners` contain a separate
  `modern-shell/` React 19 + **Vite 7** prototype (Home/Orders nav shell), unrelated to the
  Next.js app and marked do-not-merge in its README. Ignored here; flag if it is meant to be
  used as a reference for later phases.
- Env var NAMES the owner must set in `web/.env.local` (no values are printed here):
  `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_MAPTILER_ENABLED`,
  `NEXT_PUBLIC_MAPTILER_KEY`, `NEXT_PUBLIC_MAPTILER_MAP_ID`, `NEXT_PUBLIC_FIREBASE_ENABLED`,
  `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`,
  `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`,
  `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`.

## 2026-10-26 Task: Phase 0 — Next.js scaffold (no pages)
(superseded in part by the "Phase 0 fixes" task above — see that section for the current
globals.css, redirect model and compare-script location.)

Files changed:
- `web/` — new Next.js 16.4.3 app (App Router, TypeScript, Tailwind 4, ESLint, no `src/`).
- `web/next.config.js` — **new** (ported from legacy `vercel.json`; replaces the generated
  `next.config.ts`, which was deleted). Holds the redirects, both rewrites and the
  noindex headers.
- `web/.env.local` — **new**, values moved out of legacy `config.js` (git-ignored).
- `web/lib/config.ts` — **new**, reads the `NEXT_PUBLIC_*` vars; mirrors the legacy `CONFIG` shape.
- `web/lib/api.ts` — **new**, line-for-line port of legacy `api.js`.
- `web/styles/legacy/*.css` (20) + `web/styles/legacy/css/*.css` (54) — copied byte-for-byte.
- `web/public/` — `*.svg *.png *.webp *.ico robots.txt firebase-messaging-sw.js` copied.
- `tools/compare.mjs` — **not touched** (owner committed it); devDeps it needs were installed.
- `notes/phase-0-notes.md` — **new**.
- `PROGRESS.md` — **new** (this file).

CSS import order:
Not applicable yet — no page was built in this task. Per-page order is recorded when each
page is ported (AGENTS.md hard rule 2).

Compare result:
No page to compare. The tool itself was sanity-checked against one URL twice:
`about.html` phone 0.00% / desktop 0.00% — PASS. Real per-page results start in Phase 1.

compare.mjs usage line (do not rewrite the script):
`cd web && npm run compare -- <legacyUrl> <newUrl> <name>` — see the "Phase 0 fixes" section
above for the resolution details. (The initial run used a temporary repo-root symlink; the
current, committed approach is the `web/scripts/compare.mjs` copy plus the npm script.)

Tested behaviours:
- `cd web && npm run build` — passes, no errors (only `/` and `/_not-found` routes exist).
- `npx tsc --noEmit` — clean.
- Live `next start` checks (at the time, all 40 redirects were unconditional):
  - all 40 legacy `*.html` URLs → HTTP **301** with the correct clean `location`
    (scripted check of every file, including `/restaurant%20old.html`).
  - `/restaurant-shell` and `/restaurant-shell.html` → `X-Robots-Tag: noindex, nofollow`.
  - rewrites `/restaurant` → `/api/restaurant-seo` and `/sitemap-restaurants.xml` → `/api/sitemap`
    are registered (both 404 today because no route exists yet — expected in Phase 0).
  - `/robots.txt` and `/firebase-messaging-sw.js` served from `public/` (200).

Open questions / TODOs:
- Resolved by the "Phase 0 fixes" task: compare.mjs module resolution (now run from `web/`);
  the two skip-list redirects (now `/restaurant` and `/track-order`, gated by `PORTED_PAGES`).
- `TODO(question)`: branches `poc/app-shell` and `stage-3-home-banners` contain a separate
  `modern-shell/` React 19 + **Vite 7** prototype (Home/Orders nav shell), unrelated to the
  Next.js app and marked do-not-merge in its README. Ignored here; flag if it is meant to be
  used as a reference for later phases.
- Env var NAMES the owner must set in `web/.env.local` (no values are printed here):
  `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_MAPTILER_ENABLED`,
  `NEXT_PUBLIC_MAPTILER_KEY`, `NEXT_PUBLIC_MAPTILER_MAP_ID`, `NEXT_PUBLIC_FIREBASE_ENABLED`,
  `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`,
  `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`,
  `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`.

## 2026-10-27 Task: Phase 2f chunk 11 — customization sheet (CART WRITE)

Ported legacy `restaurant-shell.html` L3110–3302 (the customization-sheet IIFE) to
`web/lib/restaurant-customize.ts`. The block is a classic `<script>` IIFE whose only
window publication is `window.ewOpenCustomize`; everything else (`cur`, `el`, `build`,
`animateQty`, `money`, `esc`, `refresh`, `confirmAdd`, `close`) stayed in the closure and
is ported as module scope (nothing extra lands on `window`). Installed from
`RestaurantShellRuntime` after `installRestaurantShellChunks10()` and before the boot.

Files changed (all under `web/`, plus this file — **no legacy root file changed**, no git run):
- `web/lib/restaurant-customize.ts` — new (chunk 11).
- `web/components/RestaurantShellRuntime.tsx` — import + `installRestaurantCustomize()` call.
- `web/scripts/shell-chunk11-parity.mjs` — new harness (58 checks).
- `web/scripts/fixtures/restaurant-shell-customize.json` — new GET-only fixture (injects one
  customizable item into the real menu: required multi max3, optional single, required portion
  max1, optional portion max2).
- `web/scripts/compare-mj-hidden.mjs` — new (compare.mjs + hide `#ew-mj-btn` on both pages).
- `web/scripts/shell-money-parity.mjs` — new section 9 (customization cart states).
- `web/scripts/shell-chunks89-parity.mjs` — Test E: the dish-ADD check now asserts legacy and
  new BOTH open `#ewcs-sheet` (was: assert the chunk-11 ReferenceError on new).

CSS import order: n/a — chunk 11 adds no CSS and no server markup (sheet is built at runtime;
its CSS `ew-sheet.css` etc. already imported by earlier chunks).

Step 0 baseline (BEFORE porting) — all PASS, legacy via `python3 -m http.server 8080`:
a) shell-money-parity 47; b) chunk5 367, chunks67 40, chunks89 73, chunk10 30 (needs the
`.html` legacy URL — bare `/restaurant-shell` 404s on python http.server), handtests 46 static
ids + handlers/globals/chips/dark; c) cart-parity 7/7; d) `npm run build` OK, `tsc` clean.

After porting (all re-run) — all PASS:
shell-money-parity **59** (was 47, +12 = section 9), chunk5 367, chunks67 40, chunks89 **73**
(Test E now asserts parity, not the ReferenceError), chunk10 30, chunk11 **58**, cart-parity 7/7,
handtests 46 ids, `npm run build` OK, `tsc` clean.

Chunk-11 harness (answered fixture, phone+desktop): A sheet innerHTML + pixel <1%; B required
gating / maxSelect disable / portion pricing, incl. Add-disabled pinned to expected values;
C qty3 Add → nearbite_cart (Date.now key normalised) + pink bar, then menu-card −, then a second
variant (2 lines); D backdrop close, opening pushes no history, Escape does NOT close (quirk);
E dish sheet ADD opens the customize sheet on both. 58/58 PASS, 3× stable.

Compare (answered fixture, `compare.mjs`): phone **0.15%** / desktop **0.03%**. With `#ew-mj-btn`
hidden on BOTH pages (`compare-mj-hidden.mjs`): phone **0.02%** / desktop **0.01%** — the whole
phone residual is the still-unported chunk-12 `js/menu-jump.js` button (absent on new).

Quirks ported exactly (do not "fix"): no popstate/Escape handler (only backdrop/✕/Add close);
`close()` never restores `#white-cart-root` display (relies on `updateGlobalCart()`); `resName`
reads `window.currentRestaurant.name` (a legacy lexical binding, so `undefined`) → falls back to
`#res-name`; `money()` uses `Math.round` here (chunk 10 uses `Math.ceil` — deliberately NOT
merged); dead `animateQty` kept; composite cart key `name + " (" + labels.join(", ") + ")"`;
`originalPrice = base.originalPrice + (unit - base.price)` only when not a portion price.

Legacy→port table (L3110–3302): 3111 `cur`→module `cur`; 3112 `el`→module `el`; 3113–3165
`build`→`build` (inner `animatePopupQty`→same); 3166–3171 `animateQty`→dead `animateQty`;
3172 `money`→`money`; 3173 `esc`→`esc`; 3175–3215 `window.ewOpenCustomize`→`ewOpenCustomize`
(exported); 3217–3245 `refresh`→`refresh`; 3247–3295 `confirmAdd`→`confirmAdd`; 3297–3301
`close`→`close`; 3302 `})();`→`installRestaurantCustomize()` + `window.ewOpenCustomize=`.

Uncertainties: none functional. `window.__ewCust` (chunk 6/7) is assumed installed before chunk
11, as legacy ordered it. `/restaurant-shell` deliberately NOT added to `PORTED_PAGES` (chunk 12
still pending, same as prior phases).

## 2026-10-27 Task: Phase 2g chunk 12 — pairing suggestions + menu-jump (LAST CHUNK)

Ported the LAST two legacy scripts: `js/pairing-suggestions.js` (291 L) → `web/lib/pairing-suggestions.ts`,
`js/menu-jump.js` (209 L) → `web/lib/menu-jump.ts`, installed from `RestaurantShellRuntime` AFTER
`installRestaurantCustomize()` (chunk 11) and BEFORE the boot, so pairing is the OUTERMOST
`window.updateCart` wrapper exactly as legacy. Both were written in a prior session; this task fixed a
cross-chunk bug, added the parity harness, and verified.

Files changed (all under `web/`; **no legacy root file changed**, no git run): `restaurant-customize.ts`
(FIX: `confirmAdd` calls `window.refreshCustomizedCartQuantities('up')`, import fallback); `restaurant-shell-page.ts`
(FIX: `ewRemoveCustomizedCartUnit` same, `'down'`); `menu-jump.ts` (restored CSS literal `height:44px`, kept
`BTN_H` DEAD as legacy); NEW `scripts/shell-chunk12-parity.mjs` (44 checks), `scripts/compare-chunk12.mjs`
(pixel compare hiding `.tsb`+`#ew-mj-*` on both pages); `scripts/shell-chunk10-parity.mjs` (check I now asserts
the chunk-12 pairing wrapper is the outermost `window.updateCart` on BOTH pages).

Cross-chunk bug found & fixed (the point of this task): legacy's chunk-11 `confirmAdd` and chunk-4
`ewRemoveCustomizedCartUnit` call the BARE global `refreshCustomizedCartQuantities(...)`, a shared-scope
lookup that lands on `window.refreshCustomizedCartQuantities`. Chunk 12 REPLACES that window property
with a wrapper that refreshes the suggestion strip. The old ports called the imported module binding,
bypassing the wrapper — after a custom add/remove from the strip the card's +/- never updated (legacy spy
`rcq:1`, old new page `rcq:0`). Both call sites now go through `window`.

Step 0 baseline (legacy via `python3 -m http.server 8080`, `?id=` preserved): money 59; chunk5 367;
chunks67 40; chunks89 73; chunk10 **30** (needs the `.html` legacy URL — bare `/restaurant-shell` 404s
on python http.server; check I was FAIL before this fix); chunk11 58; cart-parity 7/7; handtests 46 ids
+ all PASS; `npm run build` OK; `tsc --noEmit` clean. After porting — ALL PASS: money **59**, chunk5 367,
chunks67 40, chunks89 73, chunk10 **30**, chunk11 58, chunk12 **44**, cart-parity **7/7**, handtests 46
ids, `npm run build` OK (8/8 static), `tsc --noEmit` exit 0.

Chunk-12 harness (answered fixture, phone, real clicks): A strip on the first add to an empty cart —
`data-for`, afterend of host, class, full `innerHTML`, all 6 cards (id/name/price/veg/action) identical;
✕ closes it; remove + re-add re-opens it with identical innerHTML. B suggestion-card ADD takes the
`pendingCustId` branch → opens `#ewcs-sheet`; completing it → `nearbite_cart` (Date.now key normalised) +
pink bar identical, and the strip does NOT re-open; card − (custom path → `ewRemoveCustomizedCartUnit`)
identical. B2 plain `window.updateCart` passthrough identical. C once-per-empty-cart rule + close-on-remove
(press − on the menu card). D veg main never suggests a non-veg card. E `#ew-mj-btn`+style present,
`window.__ewMenuJump` set, open → same category rows (name/count/active), Escape closes, backdrop closes, jumping
the last category lands at the SAME `scrollY` (6391) and same active `cat-nav` pill. 44/44 PASS, 2× stable.

Compare (answered fixture): `compare.mjs` phone **0.02%** / desktop **0.01%**. `#ew-mj-btn` hidden on BOTH:
phone 0.02% / desktop 0.02%. `.tsb` + `#ew-mj-*` hidden on BOTH (`compare-chunk12.mjs`): phone **0.000%** /
desktop **0.000%**. Isolated: hide `.tsb` → 0.000%/0.001%; hide `#ew-mj-*` → 0.019%/0.009%. So the whole residual
is the PRE-EXISTING chunk-9 `.tsb` sticky bar re-painted at a different sub-pixel offset while `fullPage`
stitches (viewport-only is 0.000% / 0 px) — NOT a chunk-12 difference; the mj button itself is pixel-identical.

Quirks ported exactly (do not "fix"): `isRestaurantOpen` is a legacy top-level `let`, so the bare `typeof
isRestaurantOpen` reads the SHARED lexical binding, not `window` — port reads `shellState.isRestaurantOpen`;
`BTN_H` dead (CSS literal `44px`); `esc()`/`imgUrl()` prefer the `window.escapeMenuHtml` /
`resolveMenuImage` / `optimizedImageUrl` globals with inline fallbacks; pairing reads `window.__ewMenuGroups`;
the strip's `touchstart/move/end` `stopPropagation` (swiping it never reaches the `#menu-pane` tab handler);
`open()` sets `sheet.style.bottom`/`maxHeight` from the live button rect; `lift()` scans
`white-cart-root`/`order-hint` children; `watchMenu()` disconnects its page observer once `#menu-container`
exists; `jump()` waits 80 ms then uses `window.toggleCategory`/`window.scrollToCategory` (both ARE functions
on legacy — map §3.18's "window vs lexical" claim is WRONG for these two).

Legacy→port (pairing-suggestions.js): 6 `MAX/MIN/internal/openFor/stripEl/pendingCustId/lastSnap`→lets;
8–12 `snapshot/cartTotal/snapTotal/reducedMotion/findIncreased`→same; 18–22 `esc/readCart/priceOf/idOf/
isOpenNow`→same; 24–31 `allItems`; 32–51 `KINDS`/`kindOf`; 52–75 `WANT`/`PAIRS`; 76–89 `cartQty/
findEntryById/findEntryByName/baseKey/isReordered/isPopular`; 91–130 `pick`; 131–150 `imgUrl/actionHTML/
cardHTML`; 151–175 `removeNode/closeStrip/animateOpen`; 176–190 `revealStrip/openStrip`; 191–199
`refreshButtons/callCart`; 201–218 click delegate; 219–245 `install`(`wrapped.__ewPair`); 246–283
`installCustomHook`(`w.__ewPair`); 284–291 `installAll`+`snapshot()`+load/pageshow/storage listeners→
`installPairingSuggestions()` export + `installCustomHook`. menu-jump.js: 12–14 state; 16–39 `CSS`/icons;
41–42 `reduced`/`esc`; 44–69 `build`; 71–98 `groups/currentId/render/fade`; 100–139 `setBtn/open/close/
jump/lift`; 156–192 `update/schedule/watchMenu`; 194–208 `init`+listeners→`installMenuJump()` export.

Uncertainties: none functional. `/restaurant-shell` is now feature-complete (all 12 chunks ported) but is
still NOT in `PORTED_PAGES` (that list was only updated at a phase boundary) — flag for the owner.

## 2026-10-27 Task: Phase 2h — restaurant-shell close-out + /restaurant SEO step

Files changed (all under `web/`): NEW `lib/seo/restaurant-seo.ts` (+`sitemapUrls`/`sitemapList`),
`lib/seo/restaurant-header.ts` (base64 payload header), `proxy.ts` (Next-16 middleware gate),
`app/restaurant/page.tsx` (real route: generateMetadata + shell + OG/JSON-LD),
`app/sitemap-restaurants.xml/route.ts`, `app/manifest.ts`, `public/sw.js`, `public/sitemap.xml`,
`public/robots.txt` (dedup), `next.config.js` (dropped the two rewrites, kept headers),
`scripts/seo-restaurant-parity.mjs`, `scripts/sitemap-pwa-parity.mjs`,
`scripts/headers-redirects-parity.mjs`. `app/leakprobe/page.tsx` is TEMP (deleted before packaging).
CSS import order: unchanged (RestaurantShell component).

**The 404 fix (T2).** `cacheComponents` streams the 200 shell before the page body /
`generateMetadata` runs, so `notFound()` rendered the not-found body with status 200 (proved with a
throwaway `app/nftest` route: `notFound()` alone = 404, `notFound()` after awaiting `searchParams` =
200, even with `connection()`). Fix = a `proxy.ts` gate (matcher `["/restaurant"]`) that runs before
the response starts: invalid id / not eligible / upstream 4xx → `NextResponse.rewrite("/__eatswada_not_found__")`
(a non-existent path → Next's REAL 404). The proxy fetches the restaurant ONCE and forwards the
base64 JSON in `x-ew-restaurant`, so the page does NOT fetch again (verified: header-hit 2, fallback 0).
It also sets legacy `Cache-Control: public, s-maxage=300, stale-while-revalidate=600`. Upstream
5xx/network still falls through to the page's 500.

Test numbers. **SEO** `seo-restaurant-parity.mjs`: **12/12 synthetic + E2E live payload PASS**
(indexable, NEVER_INDEX, isActive:false, pending, success:false, upstream 404/500, invalid id,
cloudinary og:image, non-cloudinary dropped, eatswada-prefixed, special chars). **Sitemap/PWA**
`sitemap-pwa-parity.mjs`: **25/25 PASS** (golden: legacy `api/sitemap.js` with patched `https.get`
vs ported `sitemapUrls()` over 4 fixtures + the 502 error path; live `/sitemap-restaurants.xml`
== `sitemapUrls(live API)`; `/sitemap.xml` byte-identical; robots single `User-agent`; sw.js never
names `eatswada-shell-v8` / no `.html` precache / activate deletes other caches; manifest
name/standalone/theme/2 icons). **Headers/redirects** `headers-redirects-parity.mjs`: **26/26 PASS**
(`*.html`→clean 301 incl. `/restaurant.html`, `X-Robots-Tag` only on `/restaurant-shell`,
`/restaurant` has NONE + legacy cache-control, statuses 404/404/200/404, xml+manifest+robots+sw+
firebase-messaging-sw all 200). **Regression**: shell-money 59, chunk5 367, chunks67 40, chunks89 73,
chunk10 30, chunk11 58, chunk12 44, cart 7/7, handtests (46 ids + leak PASS), boot-requests 1/1,
deadcode 19 — ALL PASS. `compare.mjs` new `/restaurant` vs new `/restaurant-shell` (answered fixture):
phone 0.02% / desktop 0.00%.

Quirks kept exactly: single upstream GET (legacy fetched once); `approvalStatus` absent/empty is
KEPT by the sitemap filter (legacy truthiness); `ID_RE` = `/^[a-zA-Z0-9_-]{8,80}$/`; NEVER_INDEX test
id `6ac5cbd0933976c30865d23e` dropped from the sitemap (per brief) yet still 404s on `/restaurant`;
`og:type=restaurant` emitted as a hoisted `<meta>` (Next's Metadata union has no "restaurant").

Legacy→port: `api/restaurant-seo.js` `esc/ID_RE/fetchRestaurant/NON_INDEX_IDS/seoFor` →
`lib/seo/restaurant-seo.ts` (`seoFor(data,id)` → title/desc/robots/canonical/og/jsonld);
`api/sitemap.js` `toList`+filter loop → `sitemapList`/`sitemapUrls`; `vercel.json`
`cleanUrls`+`redirects` → `next.config.js redirects`; `headers` → `next.config.js headers`;
`rewrites` → real routes.

Uncertainties: (1) `NOT_FOUND_PATH` is a private internal rewrite target — it could 200 if a route
ever claims `/__eatswada_not_found__` (none does). (2) `cacheComponents` means the /restaurant HTML
shell is always streamed 200 before the 404 status is written by the proxy rewrite; the status is
correct but the shell bytes may already be on the wire — flagged, no legacy equivalent. (3) the
proxy fetches on every `/restaurant` request (like legacy, which also fetched per request).
