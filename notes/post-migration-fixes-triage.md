# Post-migration fixes — triage (Phase 5a, Part D)

Re-read of `notes/post-migration-fixes.md` (all §1–§11). **Nothing here is fixed** — this is a
ranked decision list for after launch. Severity = impact if left as-is (money/security/auth >
user-visible bug > cosmetic). Effort: S < 1 h, M ≈ half a day, L ≈ multi-day. Risk = chance the
fix itself breaks the frozen design / a ported behaviour.

Legacy line numbers below were **re-verified against the current tree**; where the original note's
numbers were stale I quote the real ones and say so.

| # | Item | Severity | Effort | Risk | Notes (verified legacy refs) |
|---|---|---|---|---|---|
| §8 | `payment-failed` retry never POSTs `/payments/verify` | **Money / payment** | M | Med | `payment-failed.html:104` passes the native unbound `fetch` into `EWPaymentVerify.run({fetchImpl:fetch,…})`; `js/payment-verify.js:111` calls `opts.fetchImpl(...)` with `this===opts` → "Illegal invocation" → caught → falls back to `GET /payments/:id/status`. The port keeps the exact throw. |
| §1 | `ctState.items` never assigned → coupon `subtotal` always 0 | **Money + user-visible** | S | Low–Med | `js/cart-page.js:3210` (inside `applyCouponFromSheet`, defined L3206) reads `ctState.items`; nothing assigns it. A %/free-item coupon is validated against `subtotal:0`. |
| §7 | COD cap defaults to ₹1000 when `maxCodOrderAmount` is 0/absent | **Money (edge)** | S | Low | `js/cart-checkout-upgrades.js:108` `n(s.maxCodOrderAmount) > 0 ? … : 1000` (note said L101–116; real range L103–108). |
| §3 | `ctState.tax` read but never set → "Government Taxes" row hidden | **Money (hidden)** | M | Med | `js/cart-page.js:862` reads it in `applyTotals` (defined L828); never assigned. Needs a backend decision on whether tax is charged. |
| §2 | `ctState.discount` read but never set → "Extra discount" row hidden | User-visible (minor) | S–M | Low–Med | `js/cart-page.js:855` reads it; never assigned. Coupled to the §1 coupon response. |
| §4 | Delivery-fee tiers 40 and 50 unreachable | Cosmetic (dead) | S | Low | `js/cart-page.js:104` `deliveryFeeForDistance` returns 30/40/50, but the radius is capped at 10 km (`:302`, `:347`) so 40/50 never occur. |
| §5 | `ctaBlock()` defined but never called | Cosmetic (dead) | S | Low | `js/cart-checkout-upgrades.js:95` defines it, `:440` exports it; no caller. (note said L95–99.) |
| §6 | `#ct-fd-progress` inserted lazily after `#free-delivery-nudge` | Cosmetic / test-only | S | Low | `js/cart-checkout-upgrades.js:306–313` (`paintFreeDelivery`). No user effect; only harnesses must paint first. (note said L424–438.) |
| §9 | Phase 3b auth quirks (dead carousel, ignored `?redirect=`, no session check, ≥8 vs `minlength=6`, double redirect, GPS gate) | Cosmetic / legacy | — | Low | `login.html:961-969`, `:733-737`; `reset-password.html`; `location-onboarding.html`. Leave as legacy. |
| §10 | Phase 3c account/orders quirks (`#empty-btn` double-bind, logout key set, empty avatar, `sanitizeLegacyCarts` reload, polling, countdown) | Cosmetic / legacy | — | Low | `orders.html:540-547`,`:551`; `profile.html:481`; `address-store.js`. Leave as legacy. |
| §11 | Phase 3d partner/support quirks (hardcoded `onrender` API base, draft keys, blank support contacts, `?mock=1`, 3-submit cap, privacy delete) | Cosmetic / legacy | — | Low | `apply.html`, `application-status.html`, `support.html`, `order-support.html`, `rate-us.html`, `privacy-data.html`. Leave as legacy. |

## Recommended order (fix after launch, top first)

1. **§8 payment-failed verify** — only real payment-path divergence. Fix = load the fetch-timeout
   wrapper (or a bound `fetch`) on `payment-failed` so the verify POST actually fires, then re-run
   `payment-pages-parity` + a live test-mode retry. Do first because a stuck payment is money.
2. **§1 coupon subtotal** — set `ctState.items` in `paintItems`/`renderCart` (or compute the
   subtotal inline in `applyCouponFromSheet`), then re-verify the coupon flow end to end. S, money.
3. **§7 COD cap** — confirm with the backend whether an absent cap means "no cap" or "₹1000"; align
   the fallback. S, money edge.
4. **§3 tax row** — needs a backend decision (is tax charged?). Only then set `ctState.tax`. M.
5. **§2 discount row** — wire from the coupon response once §1 is decided. S–M.
6. **§4 / §5 / §6** — cheap cleanups (dead tiers, dead `ctaBlock`, lazy insert). Do together when
   touching the cart; no user-visible change.
7. **§9 / §10 / §11** — **do not change.** These are legacy behaviours, not port defects; they are
   recorded only so a future reader does not mistake them for migration bugs.

Rule to respect: any change above re-runs `cart-money-parity`, `payment-pages-parity`,
`auth-parity`, `account-parity` and the restaurant-shell money harness, and is noted in PROGRESS.md.
