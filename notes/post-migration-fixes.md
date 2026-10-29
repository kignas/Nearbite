# Post-migration fixes (deferred, NOT applied in Phase 2j)

Owner decision 4/5: the cart page's `ctState.items`, `discount` and `tax` quirks are **kept
exactly as legacy** in Phase 2j. They are genuine legacy bugs, so they must not be "fixed" during
the migration (AGENTS.md rule 10: do not delete or fix things you don't understand). This file is
the place to record them so they can be decided and fixed **after** the migration is complete and
the new pages are live.

Each entry: what the bug is, where it lives, why it is preserved, and the fix to consider.

---

## 1. `ctState.items` is never assigned → coupon subtotal is always 0

- **Legacy:** `js/cart-page.js` — `ctState.items` is read by `applyCouponFromSheet` (≈ L3210) to
  build the coupon `subtotal`, but **nothing ever assigns `ctState.items`**. The coupon payload
  therefore always sends `subtotal: 0`.
- **Ported as:** `web/lib/cart-page-state.ts` — `ctState.items` stays unset; the same dead read is
  kept.
- **Effect:** a percentage/free-item coupon that is validated against a subtotal cannot work
  correctly. This is a real user-visible bug, not a cosmetic one.
- **Considered fix (post-migration):** set `ctState.items` in `paintBill`/`renderCart` (or compute
  the subtotal directly in `applyCouponFromSheet` from `readCart()`), then re-verify the coupon
  flow end to end against the backend.

## 2. `ctState.discount` is read but never set (dead read)

- **Legacy:** `applyTotals` (≈ L855) reads `Number(ctState.discount || 0)` and only shows the
  "Extra discount for you" row when it is > 0. `ctState.discount` is never assigned anywhere, so
  the row is effectively always hidden / `-₹0`.
- **Ported as:** `web/lib/cart-page-state.ts` — identical dead read kept, with a comment.
- **Considered fix (post-migration):** decide whether a discount is meant to come from the coupon
  response; if so, assign `ctState.discount` there and re-test the bill.

## 3. `ctState.tax` is read but never set (dead read)

- **Legacy:** `applyTotals` (≈ L862) reads `Number(ctState.tax || 0)` and shows the
  "Government Taxes" row only when > 0 (formatted with `toFixed(2)`). Never assigned.
- **Ported as:** `web/lib/cart-page-state.ts` — identical dead read kept, with a comment.
- **Considered fix (post-migration):** if taxes are meant to be charged, source them from the
  backend order/total and set `ctState.tax`; otherwise delete the row from the markup.

## 4. Delivery-fee tiers 40 and 50 are unreachable

- **Legacy:** `deliveryFeeForDistance` returns 30 (< 10 km), 40 (≤ 15 km) or 50 (else), but the
  delivery radius is capped at 10 km (cart-page ≈ L302/L347), so 40 and 50 never occur.
- **Ported as:** `web/lib/cart-page-state.ts` — all three tiers kept (owner decision 3).
- **Considered fix (post-migration):** either keep (harmless) or align the tiers with the real
  radius cap once delivery pricing is reviewed.

## 5. C7 `ctaBlock()` is never called by legacy `cart-page.js` (dead code)

- **Legacy:** `js/cart-checkout-upgrades.js` L95–99 defines `ctaBlock()` (maintenance / shortage CTA labels) and
  exports it on `window.CtX`, but no caller exists anywhere in `cart.html`, `js/cart-page.js` or the other scripts.
  The CTA is blocked in practice only through `CtX.revalidateBeforeOrder()` (cart-page.js L1675–1676), which runs
  immediately before `POST /orders`.
- **Ported as:** `web/lib/cart-checkout-upgrades.ts` — `ctaBlock()` kept and exported (dead, exactly like legacy).
- **Considered fix (post-migration):** either wire `ctaBlock()` into the checkout button (maintenance / shortage
  labels) or delete it; decide with the owner.

## 6. `#ct-fd-progress` is inserted lazily, after `#free-delivery-nudge`

- **Legacy:** `paintFreeDelivery` (cart-checkout-upgrades L424–438) creates `#ct-fd-progress` on first paint and
  inserts it with `insertBefore(host, anchor.nextSibling)` right after `#free-delivery-nudge`. Until then the node
  does not exist, so a naive snapshot of the DOM before the first bill paint shows no `#ct-fd-progress`.
- **Ported as:** `web/lib/cart-checkout-upgrades.ts` — identical lazy insert (id + class + position preserved).
- **Effect:** none for users; test harnesses must paint the bill before asserting the node exists.

## 7. COD cap defaults to 1000 when `maxCodOrderAmount` is 0/absent

- **Legacy:** `codState()` (L101–116) uses `n(s.maxCodOrderAmount) > 0 ? n(s.maxCodOrderAmount) : 1000`, so a
  platform payload that omits the cap still enforces ₹1000.
- **Ported as:** identical (kept).
- **Effect:** the "Available for orders up to ₹1000" note appears even when the backend did not send a cap.

---

## 8. `payment-failed.html` retry-verify never POSTs `/payments/verify` (unbound native `fetch`)

- **Legacy:** `payment-failed.html` does **not** load `navigation.js`, so its `window.fetch` is the
  native, unbound function. Its inline script passes that straight into
  `EWPaymentVerify.run({fetchImpl: fetch, …})` (L104). Inside `payment-verify.js` `postVerify` calls
  `opts.fetchImpl(url, init)` (L111), i.e. with `this === opts` — and native `fetch` then throws
  `TypeError: Failed to execute 'fetch' on 'Window': Illegal invocation`. `run()` catches that as a
  network error and falls back to `waitForStatus` (GET `/payments/:id/status` polling). The
  `/payments/verify` POST is therefore **never sent from this page**; the outcome is decided purely
  by the status poll. (`cart.html` DOES load `navigation.js`, whose `window.fetch` is a plain
  function, so the checkout verify path works there.)
- **Ported as:** `web/lib/navigation.ts` `installFetchTimeout()` exposes the raw unbound `fetch` as
  `window.__nearbiteNativeFetch` before wrapping it; `web/lib/payment-failed.ts` passes that as
  `fetchImpl`, so the same throw happens and the same `/status` fallback is taken. Result: the new
  page sends exactly the legacy requests (`POST /payments/retry`, then `GET …/status` only).
- **Why it matters:** without this, the Next app's global fetch-timeout wrapper (decision 10) makes
  the call succeed, so the new page would POST `/payments/verify` where legacy never did — a real
  behavioural divergence. The port preserves the legacy behaviour exactly.
- **Considered fix (post-migration):** load `navigation.js` (or its equivalent) on payment-failed so
  the verify POST actually fires, then re-verify the retry flow end to end against the backend.

---

_Anything fixed here must be re-verified with `web/scripts/cart-money-parity.mjs`,
`web/scripts/payment-pages-parity.mjs` and the restaurant-shell money harness, and noted in
PROGRESS.md._

---

## 9. Phase 3b auth quirks (kept exactly as legacy)

- **login.html `#slide0..2` carousel** — `login.html` L961-969 still runs
  `setInterval(...,3500)` over `.slide`/`.carousel-dots`, but the redesign hides those elements
  (they do not exist in the rendered body). The interval is dead but kept running; **ported as-is**
  in `web/lib/login-page.ts`.
- **login.html `fetchProfileForRouting()`** (L733-737) — an unused compatibility stub that is never
  called. Ported verbatim, still unused.
- **login.html does not honour `?redirect=`** — the redirect target comes only from
  `localStorage['nearbite_after_login']` (set by the caller, e.g. `/cart`). A `?redirect=` query
  string is ignored. Kept exactly; the ported page reads the same storage key and nothing else.
- **login.html never checks an existing session** — visiting it while already logged in renders the
  login form normally (no auto-redirect). The only auto behaviour is the Google redirect gate keyed
  on `eatswada_google_redirect_pending`. Kept.
- **complete-profile password mismatch** — the `#password` input carries `minlength="6"` but
  `passwordValid` requires ≥8 characters, so the browser's own validity check and the page's
  `syncCta` disagree. Kept exactly (both the attribute and the ≥8 rule).
- **reset-password.html double redirect** — the stub redirects twice: `<meta http-equiv="refresh"
  content="0;url=login.html">` **and** an inline `location.replace('login.html')`. Both are ported.
- **location-onboarding GPS gate is un-dismissable** — Escape and backdrop clicks do nothing; the
  dialog traps focus. `permissionState()` races a 500 ms timeout; `DEFAULT=[26.545,88.820]` is
  visual-only and can never be confirmed without a real fix/selection. All kept.

- **Considered fix (post-migration):** none of the above is worth changing before launch; they are
  legacy behaviour, not port defects. Re-verify with `web/scripts/auth-parity.mjs` and
  `web/scripts/auth-pages-compare.mjs` if any is ever touched.

---

## 10. Phase 3c account + orders quirks (kept exactly as legacy)

- **`orders.html` `#empty-btn` default handler** — legacy `requireLogin()` (L540-547) rebinds
  `#empty-btn` to `localStorage.clear(); location.href='login.html'`, then L551 rebinds it again to
  `location.href='index.html'`. So a logged-in user with no orders who taps the empty-state button
  goes to the home page (the login branch is only reachable while logged out, where `requireLogin`
  returns early before L551). Ported verbatim in `web/lib/orders-page.ts`.
- **`orders.html` status coverage** — the list renders every status the legacy `statusMeta()` switch
  handles (placed / confirmed / preparing / out-for-delivery / delivered / cancelled) plus the
  "Load more" paging path. All kept; the compare harness exercises each.
- **`profile.html` logout** — `confirm()` gate then `localStorage.removeItem('token'|'nearbite_token'
  |'nearbite_user'|'nearbite_address')` and `location.replace('login.html')`. It does NOT clear the
  whole `localStorage` (unlike the orders logged-out branch) and does not call Firebase signOut.
  Kept exactly.
- **`profile.html` avatar fallback** — the avatar circle is only filled when a photo URL exists
  (L481 comment); otherwise an empty circle is left. Kept.
- **`address-store.js` `sanitizeLegacyCarts()`** — calls `location.reload()` when it rewrites a
  malformed legacy cart; the port keeps the reload. Tests seed only on the first document so the
  reload is observable but not looping.
- **`address.html` / `address-new.html`** — share `window.EatswadaAddressStore.setActive` as the
  single source of truth for the selected address; the map pin move and set-default both funnel
  through it. The `?return=cart` query redirect (`location.replace('cart.html')`, navigation.js
  L40-43) is preserved.
- **`track-order.html` polling** — the page polls the order status on an interval and, for a courier
  in transit, drops a marker on the Leaflet map. Polling URL, interval and the map layer behaviour
  are kept; the harness uses fake timers and stubs the tile CDN so compares are deterministic.
- **`track-order.html` cancel-deadline countdown** — the "cancel" button hides itself when the
  deadline is absent/NaN and otherwise counts down from `deadline - Date.now()`. Kept.

- **Considered fix (post-migration):** none of the above is a port defect; all are legacy behaviour.
  Re-verify with `web/scripts/account-parity.mjs` and `web/scripts/account-pages-compare.mjs`.

## 11. Phase 3d partner + support / info + privacy-data quirks (kept exactly as legacy)

- **`apply.html` / `application-status.html` hardcoded API base** — both inline scripts POST/GET a
  HARDCODED `https://eatswada.onrender.com/api/vendor-applications…`, NOT `CONFIG.API_BASE_URL`.
  Ported verbatim (`web/lib/apply-page.ts`, `web/lib/application-status-page.ts`); the harness stubs
  that exact origin. Do not "fix" to CONFIG.
- **`apply.html` draft key** — the wizard draft is `localStorage['eatswada_vendor_application_draft_v1']`
  and the session id is `sessionStorage['eatswada_customer_application_id']`; both shapes are kept
  byte for byte (password is never persisted). Redirects `login.html?redirect=apply.html` and
  `application-status.html` kept.
- **`support.html` blank contact values** — `SUPPORT_PHONE`/`SUPPORT_WHATSAPP` are empty strings by
  design: the matching contact cards stay HIDDEN rather than showing a fake number. `SUPPORT_EMAIL`
  is `support@eatswada.com`. Kept.
- **`order-support.html` demo `?mock=1` adapter** — the in-file `SUPPORT_ADAPTER` mock branch is
  ported even though it is only reachable with `?mock=1`; the real adapter uses the hardcoded
  `/support/...` paths. The `localStorage.clear()` on a 401 and all redirects are kept.
- **`rate-us.html` 3-submission limit + `nearbite_after_login`** — the page caps submissions at 3 and
  writes `nearbite_after_login = 'rate-us.html'` before sending a logged-out user to `login.html`.
  Both kept.
- **`storage-check.html`** — a diagnostics page that only READS localStorage/sessionStorage and
  offers clear buttons; it issues no API writes. Kept as-is.
- **`privacy-data.html` destructive flows** — export / correction / grievance / nominee (PUT+DELETE)
  and account delete (`DELETE /privacy/me` with body `{confirmation:'DELETE MY ACCOUNT'}`, then a
  600 ms redirect to `login.html?account_deleted=1`). The storage-key purge regexes are kept exact.
- **`partner-with-us.html` / `order-help.html`** — static info pages; only their links and accordions
  are interactive. No writes.

- **Considered fix (post-migration):** none of the above is a port defect; all are legacy behaviour.
  Re-verify with `web/scripts/3d-parity.mjs` and `web/scripts/3d-pages-compare.mjs`.
