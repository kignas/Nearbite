# Shared shell map (Phase 1a)

Date: 2026-10-26

What repeats across the 40 legacy pages, what each shared file does, and exactly what it
reads/writes in browser storage. This is the reference for the `web/lib/` + `web/components/`
ports. No page is created in this phase.

Evidence basis: `index.html` (the only page that carries the full Home hero header), the
`<footer class="ew-site-footer">` block copied verbatim into 12 pages, and the shared JS files
listed below. Every claim here is traceable to a legacy file.

---

## 1. Which pages include what (verified with grep over `*.html`)

| Asset | Pages |
|---|---|
| `eatswada-theme.js` | 30 pages (all except `apply/faq/order-help/partner-with-us/terms/delivery-areas…` variants) |
| `eatswada-header-theme.js` | 34 pages |
| `navigation.js` | 24 pages |
| `favorites.js` | `index.html`, `profile.html` only |
| `address-store.js` | `index.html`, `address.html`, `address-new.html` |
| `safe-html.js` | 18 pages |
| `platform-status.js` | `index.html`, `cart.html` |
| `cart-bar.js` | `index.html`, `cart.html`, `category.html`, `under99.html`, `restaurant old.html`, `restaurant-shell.html` |
| `eatswada-header-theme.css` | same 34 pages as the JS |
| `css/header.css` | `restaurant old.html`, `restaurant-shell.html` only (hides restaurant-header "more" buttons) |
| `css/eatswada-site-footer.css` | the 12 pages that carry the footer |

The Home hero header markup (`<header class="hero-header" id="home-header">`) exists **only** in
`index.html`. Every other page has its own small page header (`about.html` → `<header class="top">`,
`profile.html` → `<header class="header">`, `orders.html` → `<header class="orders-header ew-themed-header">`,
`under99.html` → `<header class="u99-header">`, …). The **shared** piece across all of them is the
*theme system* (the `--hd-*` tokens + `data-ew-theme`/`data-ew-header` attributes), not one header
component. See §8.

---

## 2. `eatswada-theme.js` → `web/lib/theme.ts`

Light/dark state, driven by **Dark Reader Dynamic Theme** (not a hand-written dark stylesheet).
No Dark Reader = no dark mode; the site stays functional.

* Purpose: one-time new-user theme prompt on Home, Profile toggle elsewhere, persistence.
* Storage:
  * `localStorage['eatswada_theme']` — read/write. `'dark'` or `'light'`. Anything else → `light`.
  * `localStorage['eatswada_theme_intro_pending']` — read (must be `'1'`) then **removed** when the
    prompt is shown. Written by `complete-profile.html` for new Google accounts.
* DOM/global side effects: sets `documentElement.dataset.ewTheme`, `documentElement.style.colorScheme`,
  a `<meta name="color-scheme">` (created on demand, inserted as head's first child; content `light dark`
  only when dark, else `light`), and updates `<meta name="theme-color">` to `#181A1B`/`#FFFFFF`.
* Loads `https://cdn.jsdelivr.net/npm/darkreader@4.9.133/darkreader.js` (a `<script data-ew-dark-reader>`
  is injected if absent; the page `<head>` also has a `document.write` blocking loader for dark visitors).
  Dark Reader is enabled with a fixed config object + `darkReaderFixes()` (`ignoreImageAnalysis` list for
  food photos, a small `css` string).
* Switches: `[data-ew-theme-toggle]` elements get `aria-checked`, class `is-on`, inner `.ew-theme-switch`
  gets `is-on`, and `[data-ew-theme-state]` text becomes `On`/`Off`. Bound once (`dataset.ewThemeBound`).
* New-user prompt: a `.ew-theme-intro` backdrop appended to `<body>` with the exact markup in the legacy
  file (`ew-theme-sheet`, `ew-theme-icon`, `ew-theme-actions`, `.ew-theme-choice.ew-theme-light|dark`).
  Home page only (`isHomePage()`: pathname last segment `''` or `index.html`).
* Events: dispatches `eatswada:themechange` (detail `{theme}`) on every apply. Listens for `storage`
  (key `eatswada_theme`) to sync other tabs.
* Public API (`window.EatswadaTheme`): `get`, `set`, `toggle`, `keys{theme,newUserPending}`,
  `darkReaderVersion`.
* Pre-paint: `index.html` `<head>` runs an inline snippet that sets `dataset.ewTheme`/`dataset.ewHeader`
  before first paint so the wrong theme never flashes.

## 3. `eatswada-header-theme.js` → `web/lib/header-theme.ts`

Owns only "which header colour theme is active". The light/dark engine is untouched.

* Storage: `localStorage['eatswada_header_theme']` — read/write. Known ids only; unknown/missing → `raspberry`.
* `THEMES` currently has exactly one entry: `{id:'raspberry', label:'Raspberry', primary:'#E9546B'}`.
* DOM: sets `documentElement.dataset.ewHeader`; dispatches `eatswada:headerthemechange`.
* Switches: `[data-ew-header-picker]` → `is-active` class + `aria-pressed`. Bound once.
* `primary()` reads the computed `--hd-primary` from `documentElement` (fallback `#E9546B`) — used by
  Razorpay which needs a concrete hex.
* Public API (`window.EatswadaHeaderTheme`): `get`, `set`, `apply`, `list`, `themes`, `default`, `key`, `primary`.
* Listens for `storage` on its key. Applies immediately on load (idempotent with the inline snippet).

## 4. `navigation.js` → `web/lib/navigation.ts`

Deterministic in-app Back buttons + two page-script helpers. No storage of its own.

* `window.nearbiteSafeBack()` (alias `window.goBack`) — maps the current file name to a parent via the
  `PARENT` table (`cart.html→index.html`, `support.html→orders.html`, `legal.html→profile.html`,
  `complete-profile.html→login.html`, … default `index.html`); `address.html?return=cart` → `cart.html`.
  Uses `location.replace` so the intermediate page is not left in history.
* `window.premiumBack()` — adds `slide-out-active` to `.res-card, .delivery-strip, .filter-bar,
  .menu-section, .cat-nav, .closed-warning-card`, then calls `nearbiteSafeBack()` after 250 ms.
* Global `window.fetch` wrapper adding a 15 s default timeout (`__nearbiteFetchTimeout` guard), preserving
  caller abort signals; throws a `TimeoutError` named error on timeout.
* Intent-based navigation warming (`__esFastNavigation` guard): `pointerover` (120 ms debounce, non-touch),
  `pointerout`, `pointerdown` → injects `<link rel="prefetch" as="document">` for same-origin `*.html` links.
* Registers the service worker: `navigator.serviceWorker.register('./sw.js')` on `load`.

## 5. `favorites.js` → `web/lib/favorites.ts`

Restaurant **IDs only**, never objects. Defensive: any failure resolves to an empty list.

* Storage: `localStorage['eatswada_favorites']` — JSON array of unique non-empty strings. Corrupt JSON is
  **removed** and treated as empty. Numbers are coerced to strings; objects/nulls/blanks dropped.
* Storage probe (`__es_fav_probe__`) decides between `localStorage` and an in-memory fallback (private mode).
* Event: dispatches `eatswada:favorites-changed` (detail `{favorites}`); re-emits on cross-tab `storage`.
* Public API (`window.Favorites`): `KEY`, `CHANGE_EVENT`, `getFavorites`, `saveFavorites`, `isFavorite`,
  `toggleFavorite`, `count`.

## 6. `address-store.js` → `web/lib/address-store.ts`

Client-side cache of the **active** delivery address. Saved addresses stay server-authoritative.

* Storage:
  * `localStorage['nearbite_selected_address_id']` — read/write/remove. Chosen address `_id`.
  * `localStorage['nearbite_address']` — read/write/remove. JSON of the active address object.
  * `localStorage['nearbite_address_updated_at']` — write/remove. `Date.now()`.
  * `localStorage['eatswada_recent_locations']` — **removed** by `clearSession()` only (device-local history).
  * Auth token read: `localStorage['nearbite_token']` then `localStorage['token']`.
* API: `GET {API_BASE}/users/addresses` with `Authorization: Bearer <token>`, `cache:'no-store'`.
  401/403 → `AUTH` (cache cleared); other non-OK → `ADDRESS_FETCH_FAILED`. Payload normalised from
  array | `.addresses` | `.data.addresses` | `.data`.
* Selection: selected id → `isDefault`/`default` → first. No addresses left → clear the cache and tell
  pages only if something was actually cleared.
* Events: `eatswada:address-state` (detail = snapshot `{addresses, activeAddress, activeAddressId, status,
  hydrated, error, reason}`) on every emit; `nearbite:address-changed` (detail = address | `null`) when the
  active address is set or cleared.
* Public API (`window.EatswadaAddressStore`): `state`, `hydrate(options{force})`, `subscribe`, `getActive`,
  `getAll`, `setActive`, `clearSession`, `cache`, `clearCache`.

## 7. `safe-html.js` → `web/lib/safe-html.ts`

Output escaping + display-only image optimisation. Load before anything that renders API data.

* `escapeHtml` / `window.esc` — escapes `& < > " '`.
* `safeUrl` — resolves against `location.href`; returns `''` unless the protocol is `http:`/`https:`
  (blocks `javascript:`/`data:`).
* `optimizedImageUrl(url, width)` — Cloudinary `image/upload` → `f_auto,q_auto,w_N,c_limit`; Unsplash →
  `auto=format&fit=crop&w=N&q=80`; width clamped 64…1600 (default 320); unknown hosts unchanged. Never
  alters the stored URL, only the rendered `src`.
* `window.ewFoodPlaceholder()` — returns `<div class="ew-food-ph" aria-hidden="true"></div>`.
* No storage.

## 8. `platform-status.js` → `web/lib/platform-status.ts`

Single reader of backend platform config (maintenance / rider shortage / rain surge / fees). Every
failure resolves to safe "all normal" defaults.

* Storage: `sessionStorage['eatswada_platform_settings_v2']` — `{at, data}` cache, 60 s TTL.
  Token read from `localStorage['nearbite_token']` / `localStorage['token']`.
* API: `GET {API_BASE}/platform/public-status` (`/platform/settings` is admin-only), 6 s abort timeout,
  `cache:'no-store'`. Optional `Authorization: Bearer <token>` (only adds caller's own
  `isFirstOrder`/`isCodBlocked` flags).
* `DEFAULTS` object and the full `normalise()` field list must be ported verbatim (fees, tax, COD limits,
  free-delivery flags, `rainExtraEtaMinutes`→`rainSurgeExtraMinutes`, `maxCodOrderAmount` clamped to 1000).
* `merged()` overlays a `forced` patch produced by `fromBlockedOrder(503 body)` (maintenance → title/message/
  ETA; shortage/rider/demand → `isDeliveryPausedShortage`). A fresh successful read clears `forced`.
* Banner markup: `.ps-banner` variants `ps-maint`, `ps-shortage`, `ps-surge` with `.ps-ic`, `.ps-copy`,
  `.ps-title`, `.ps-msg`, `.ps-eta`, Font Awesome icons, `formatEta()`, `rupee()`. Presentation is
  `css/platform-status.css`.
* Polling: 90 s interval, skipped while `document.hidden`; refresh on `visibilitychange`.
* Public API (`window.EWPlatform`): `get(force)`, `current`, `onChange`, `mount(el)`, `fromBlockedOrder`,
  `normalise`, `DEFAULTS`.

## 9. `cart-bar.js` → `web/lib/cart.ts` + `web/components/CartBar.tsx`

The single owner of the cart **data** layer and the floating cart bar. ~1167 lines.

* Storage:
  * `localStorage['nearbite_cart']` — read/write/remove. Object keyed by cart line. Cart parse is cached
    per raw value; corrupt JSON is wiped.
  * `localStorage['es_image_dict']` — read/write. `{foodName: imageUrl}` captured on product taps.
  * On clear-cart also removes `nearbite_checkout_key`, `nearbite_checkout_fp`, `nearbite_checkout_fp_ts`
    (or delegates to `window.EWCheckout.clearKey()` when present).
* Presentation mode (`getCartBarMode()`, path-based): `home` (white capsule, no price, "All ↑" at 2+
  restaurants), `pink` (`under99`/`99store`/`deals`/`restaurant` → solid pink bar with `X items · ₹TOTAL`),
  `hidden` (`cart`/`checkout`/`payment`).
* DOM ids/classes (must stay identical): `#white-cart-root` (+ `.wc-pink`), `#white-cart-container`,
  `.wc-left/.wc-right/.wc-btn/.wc-close/.wc-img/.wc-qty-badge`, `#wc-allup`, `#wc-item-count`,
  `#wc-dynamic-res`, `#wc-dynamic-img-stack`, `#wc-standard-actions`, `#wc-clear-actions`,
  `#es-pink-inner`, `.wc-pink-message/.wc-pink-main/.wc-pink-left/.wc-pink-cta`,
  `#ew-cart-drawer-backdrop`, `#ew-cart-drawer`, `.ew-cd-*`. Its CSS is injected as `<style id="wc-styles">`.
* Behaviour: `window.updateCart(arg1, arg2, price, rId, inStock, menuItemId, image, isVeg, originalPrice)`
  (handles the Under-99 `%7B` encoded-payload form), `findBaseCartKey` legacy-line merge,
  `window.updateGlobalCart()` renderer, clear-cart confirm flow, multi-restaurant drawer
  (`restaurantGroups`, `renderCartDrawer`), free-delivery message from `documentElement.dataset`
  (`ewFreeDeliveryEnabled`, `ewFreeDeliveryAbove`, `ewRestaurantId`), positioning above
  `#nearbite-bottom-tabbar` via the shared `--nb-cart-bottom` variable.
* Events: dispatches `eatswada:cart-updated` (detail `{source, itemName}` / `{source:'clearCart', cleared:true}`).
  Listens for `storage` on `nearbite_cart` and `pageshow`.
* Reduced motion respected (`matchMedia('(prefers-reduced-motion: reduce)')`).

## 10. Header / Footer / page headers

* `css/header.css` is a 7-line rule that hides the restaurant-header "more" buttons; it is *not* the
  shared header. `css/eatswada-site-footer.css` styles `.ew-site-footer` (dark 4-column footer) and is the
  only truly shared *component* CSS in the legacy set. The footer markup (Company / For customers /
  For restaurants / Legal & contact + `ew-footer-brand` + `ew-footer-bottom`) is byte-identical across the
  12 pages that use it.
* Home hero header: `header.hero-header#home-header` with `loc-row` (`.loc-left/.loc-pin-wrap/.loc-name/
  #loc-name/#loc-sub/.btn-store/.btn-profile/.profile-initial`), `search-row` (`.search-box/.search-text/
  .search-mic/.veg-box/.veg-track/.veg-thumb`), and `banner-wrap` (`.header-carousel/.header-carousel-track/
  .header-slide` + `#banner-controls`) plus `.ew-strip`. The banner carousel content is filled by
  `home-banners.js` (out of scope this phase) — the port keeps the skeleton markup.

## 11. CSS load order (AGENTS.md hard rule 2)

`index.html` stylesheet order:
`restaurant-card.css` → `skeleton.css` → `eatswada-end-section.css` → `whats-on-your-mind.css` →
`filter-bar.css` → `filter-sheet.css` → `eatswada-theme.css` → `eatswada-header-theme.css` →
`css/platform-status.css`
(after the two Google Fonts / Font Awesome CDN links). Per-page order is recorded when each page is ported.

`about.html` (a footer page) order:
`css/eatswada-ui-system.css` → `eatswada-theme.css` → `css/eatswada-secondary-pages.css` →
`css/eatswada-site-footer.css`.

## 12. Legacy `<head>` pre-paint snippet (must be reproduced)

```js
try {
  if (localStorage.getItem('eatswada_theme') === 'dark') document.documentElement.dataset.ewTheme = 'dark';
  var h = localStorage.getItem('eatswada_header_theme');
  document.documentElement.dataset.ewHeader = ['raspberry'].indexOf(h) > -1 ? h : 'raspberry';
} catch (e) { document.documentElement.dataset.ewHeader = 'raspberry'; }
```

plus the dark-only `document.write` Dark Reader loader. In Next.js these go in `app/layout.tsx` as a
`beforeInteractive` inline script so there is no theme flash.

## 13. Open questions / TODOs

* `TODO(question)`: `eatswada-header-theme.js` declares a `data-ew-header-picker` switch API but no legacy
  page renders a picker (grep finds zero `data-ew-header-picker` in `*.html`). Ported as-is for parity.
* `TODO(question)`: `#nearbite-bottom-tabbar` (the universal bottom nav the cart bar positions itself
  against) is referenced by `cart-bar.js` and `cart-bar.test.js` but **no legacy script creates it** on
  `main`. The cart bar therefore always takes its fallback position today. Not invented here.
* `TODO(question)`: `restaurant-shell.html` links `cart-bar.js` but not `platform-status.js`; the drawer's
  "Checkout all" always goes to `cart.html`.
