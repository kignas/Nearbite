# `under99.html` → `web/app/under99/page.tsx` — map

Source: `under99.html` (191 lines, 12,032 B). **There is no inline `<style>`** — every rule
lives in the `css/under99-*.css` files, all of which are already copied byte-for-byte into
`web/styles/legacy/css/`. Body has **no class**, there is **no `<footer>`**, and the page
builds its own `<header class="u99-header">` (it does not use the shared `Header`).

## 1. `<head>` order (what the port must reproduce)

| # | element | ported where |
|---|---------|--------------|
| 1 | `<meta name="color-scheme" content="light">` | `layout.tsx` `viewport` (Phase 0) |
| 2 | charset / viewport (`maximum-scale=1,user-scalable=no`) | App Router |
| 3 | pre-paint theme snippet | `layout.tsx` `PRE_PAINT` (byte-identical) |
| 4 | `<script defer src darkreader@4.9.133 data-ew-dark-reader>` — **no integrity hash on this page** (unlike index/search) | `layout.tsx` `DARK_READER_PRELOAD` |
| 5 | `eatswada-theme.js` | `installTheme` (ShellRuntime) |
| 6 | `eatswada-header-theme.js` | `installHeaderTheme` (ShellRuntime) |
| 7 | `<meta name="theme-color" content="#E9546B">` | page `viewport`/`metadata` |
| 8 | `<title>99 Store – Eatswada \| EatSwada</title>` | `metadata` |
| 9 | preconnect fonts.googleapis / fonts.gstatic | `FONT_LINKS` |
| 10 | Google Fonts **Manrope** 400..800 (no Caveat) | `FONT_LINKS` |
| 11 | 13 × `css/under99-*.css` (see §2) | page imports |
| 12 | `search-overlay.css` | runtime-injected by `lib/search-overlay.ts` (as on home) |
| 13 | `css/eatswada-ui-system.css?v=20260923-typography` | page import |
| 14 | `eatswada-theme.css` | page import |
| 15 | `eatswada-header-theme.css` | page import |
| 16 | `css/under99-premium.css?v=20261005-premium` | page import |
| 17 | description / robots `noindex,nofollow` / canonical / og / twitter | `metadata` |

Note: **no Font Awesome** on this page — it uses the inline `U99Icons` SVG set instead.

## 2. CSS import order (top of `app/under99/page.tsx`) — exact `<link>` order

1. `styles/legacy/css/under99-tokens.css`
2. `styles/legacy/css/under99-base.css`
3. `styles/legacy/css/under99-header.css`
4. `styles/legacy/css/under99-hero.css`
5. `styles/legacy/css/under99-filters.css`
6. `styles/legacy/css/under99-price-tabs.css`
7. `styles/legacy/css/under99-product-card.css`
8. `styles/legacy/css/under99-product-grid.css`
9. `styles/legacy/css/under99-customize.css`
10. `styles/legacy/css/under99-responsive.css`
11. `styles/legacy/css/under99-skeleton.css`
12. *(search-overlay.css — runtime-injected, same position)*
13. `styles/legacy/css/eatswada-ui-system.css`
14. `styles/legacy/eatswada-theme.css`
15. `styles/legacy/eatswada-header-theme.css`
16. `styles/legacy/css/under99-premium.css`

Keep them **separate and in this order** (per the task): several of them share selectors
(`.u99-filter`, `.u99-product-card`, tokens) and the later ones are the intended overrides.

## 3. Scripts (exact order, lines 180–189)

| # | legacy | port |
|---|--------|------|
| 1 | `cart-bar.js` | `lib/cart.ts` (data) + `<CartBar/>` (presentation) |
| 2 | `search-overlay.js` | `lib/search-overlay.ts` (`installSearchOverlay`) |
| 3 | `js/under99-icons.js` | `lib/under99-icons.ts` (`installUnder99Icons`, `U99Icons`) |
| 4 | `js/under99-core.js` | `lib/under99-core.ts` (`Eatswada99`, `Eatswada99State`) |
| 5 | `js/under99-header.js` | `lib/under99-header.ts` |
| 6 | `js/under99-filters.js` | `lib/under99-filters.ts` |
| 7 | `js/under99-price-tabs.js` | `lib/under99-price-tabs.ts` |
| 8 | `js/under99-products.js` | `lib/under99-products.ts` |
| 9 | `js/under99-customize.js` | `lib/under99-customize.ts` |
| 10 | `js/under99.js` | `lib/under99.ts` (boot + sort sheet + `window.showToast`) |

**NOT loaded by this page** (verified by grep, 0 hits): `js/under99-popular.js` and
`js/pairing-suggestions.js`. Their CSS (`under99-popular.css`, `pairing-suggestions.css`) is
**not linked either**. The task mentioned them; they are dead code for this page and are
therefore not ported.

## 4. Markup (lines 45–178) — port as JSX

```
body
├── header.u99-header
│   ├── .u99-topbar
│   │   ├── a.u99-circle-btn[href=index.html][aria-label=Back] > span[data-icon=back]
│   │   ├── button#u99-location.u99-location > pin + #u99-location-name + #u99-location-sub
│   │   └── button.u99-circle-btn.u99-search-btn[data-ew-search] > span[data-icon=search]
│   └── section.u99-hero
│       ├── .u99-hero-copy (.u99-kicker / .u99-price > .currency+.number / .u99-sub)
│       ├── .u99-hero-fallback[aria-hidden]
│       ├── .u99-hero-skeleton[aria-hidden] (2 spans)
│       └── img#u99-hero-art.u99-hero-art[hidden]
├── nav.u99-filter-rail
│   ├── button.u99-filter.filter-pill.u99-filter-icon[data-filter-action=open] > filter icon
│   ├── button#u99-discount.u99-filter.filter-pill.featured[data-filter-action=discount] "%"
│   ├── button[data-filter-action=open][data-rail=delivery] "Delivery time"
│   └── button[data-filter-action=open][data-rail=food] "Veg / Non-Veg"
├── main.u99-page
│   ├── nav.u99-price-seg[role=tablist] > span.u99-price-thumb + 3 × button.u99-price-tab[data-price-band=99|100|150]
│   └── section#u99-products
│       ├── .u99-products-head > h2#u99-count + button#u99-sort (+ span#u99-sort-label)
│       └── .u99-results-stage > #u99-skeleton (.u99-skel-grid × 4) + #u99-product-grid.u99-product-grid
├── #u99-filter-backdrop.u99-filter-backdrop > section.u99-filter-sheet
│   ├── .u99-sheet-grab + .u99-filter-head (h2#u99-filter-title + close btn)
│   ├── .u99-filter-scroll > 3 × .u99-filter-block (Offers 3 rows / Delivery 3 rows / Veg 3 rows)
│   │     each row: button.u99-row[data-filter-choice][data-value] > .u99-row-label + .u99-check|.u99-radio
│   └── .u99-filter-actions > button.u99-clear[data-filter-action=clear] + button.u99-apply[data-filter-action=apply]
├── #u99-sort-backdrop.u99-filter-backdrop > section.u99-sort-sheet
│   ├── .u99-sheet-grab + .u99-filter-head (h2#u99-sort-title + close[data-sort-action=close])
│   ├── .u99-sort-options > 5 × button.u99-sort-option[data-sort-option=default|price|price-desc|rating|delivery]
│   │     (.u99-sort-ic[data-icon] + .u99-sort-text + .u99-sort-radio) — `default` starts `.selected`
│   └── .u99-filter-actions.single > button.u99-apply[data-sort-action=apply]
├── #u99-item-backdrop.u99-filter-backdrop.u99-item-backdrop > section#u99-item-sheet.u99-item-sheet
└── #u99-toast.u99-toast[role=status]
```

The `[data-icon]` spans are hydrated by `under99-icons.js`. On the port they are hydrated by
`installUnder99Icons()` at runtime (identical), so the JSX keeps the empty `<span data-icon>`.

## 5. `under99-core.js` → `lib/under99-core.ts`

- API: `GET https://api.eatswada.com/api/restaurants/under99` (30 s timeout)
  and `GET https://api.eatswada.com/api/home-banners?placement=under99` (12 s timeout).
  Both via a local `fetchJson` with `AbortController`, `cache: 'no-store'`,
  `Accept: application/json`.
- `state` (`window.Eatswada99State`): `restaurants`, `discountOnly`, `foodType` (`all|veg|nonveg`),
  `priceRanges`, `deliveryLimit`, `priceBand` (`99|100|150`), `sortMode`, `searchQuery`,
  `freeDeliveryOnly`, `greatOffersOnly`.
- `normalizeRestaurant(raw)`: unwraps `raw.restaurant` when present, normalises every menu item
  to the canonical model (`id,name,description,price,originalPrice,discountPercent,image,isVeg,
  category,isUnder99,isBestseller,isRecommended,inStock,customizations`) and drops items with no
  id or `price <= 0`. `isUnder99` defaults to `price <= 99`.
- `loadHero()` → sets `#u99-hero-art` src from `data[0].mobileImage || data[0].image`, adds
  `.loaded` + `.u99-hero-ready`, or `.u99-hero-error` on failure.
- `load()` → dispatches `eatswada99:data-ready`; on failure writes the `.u99-empty` error block
  into `#u99-product-grid` and dispatches `eatswada99:data-error`; always hides `#u99-skeleton`.
- Cart helpers: `readCart()`, `cartQty(menuItemId, restaurantId)`, `cartPayload(item,r,selection)`
  (encodeURIComponent of `{name,price,originalPrice,resId,menuItem,image,isVeg[,options]}`),
  `cartChange`, `addWithOptions(item,r,selection,qty)`, `findItem`, `hasOptions`.
- `renderAddControl` / `addControlInner` / `syncAddControls` (on `eatswada:cart-updated`):
  the +/stepper reconciliation with `roll-up`/`roll-down`/`u99-collapsing` animations.
- Delegated click routing: `[data-cart-add]` on an item with customizations dispatches
  `eatswada99:open-customize`; otherwise `cartChange(±1)`. Image/card taps never add.

## 6. `under99-header.js` → `lib/under99-header.ts`

Reads the first non-empty of the localStorage keys
`nearbite_address`, `nearbite_selected_address`, `nearbite_onboarding_geocode`,
`nearbite_onboarding_location`, `eatswada_location`, `userLocation`, `deliveryLocation`,
`selectedLocation`, `location` and writes it to `#u99-location-name` (else `Set location`),
always sets `#u99-location-sub` = `Delivery in 35–40 minutes`. Click on `#u99-location` →
`address.html` (port: `/address`). Re-runs on `storage`.

## 7. `under99-filters.js` → `lib/under99-filters.ts`

Draft-based sheet: `snapshot()` copies the five filter fields, `sync()` paints `.selected` +
the `.u99-check` tick + `Apply (n)` count, `apply()` commits + `reflectRail()` +
`eatswada99:filters-changed`, `clear()` resets the draft. Rail `[data-filter-action=discount]`
toggles `discountOnly` directly. Closes on backdrop click / Escape.

## 8. `under99-price-tabs.js` → `lib/under99-price-tabs.ts`

Moves `.u99-price-thumb` with `translateX(i*100%)`, toggles `.active` + `aria-selected`,
dispatches `eatswada99:filters-changed`. No-op re-tap on the active band. Syncs on
`eatswada99:data-ready` and at DOM ready.

## 9. `under99-products.js` → `lib/under99-products.ts`

`bandMatch(price,band)` → `99: <=99`, `100: 100..149`, `150: 150..200`.
`filtered()` applies freeDeliveryOnly / deliveryLimit / band / searchQuery / foodType /
priceRanges / discountOnly (≥20 % or original>price) / greatOffersOnly (≥40 %), keeps `inStock`,
then sorts by `sortMode` (`default` = bestseller → recommended → price asc; `price`;
`price-desc`; `rating`; `delivery`). `card()` builds `.u99-product-card` (image + badge +
veg/non-veg markers + rating badge + add control + body with restaurant name, name row and the
price row). `emptyState()` is the `.u99-empty` "No dishes found" block with `[data-empty-clear]`.
`paint()` also sets `#u99-count` (`All N items` / `Results for "q" · N items`).
`render(animate)` uses a 240 ms skeleton phase on filter/sort changes (skipped under
`prefers-reduced-motion`). `resetFilters()` clears state and the rail chips.

## 10. `under99-customize.js` → `lib/under99-customize.ts`

`readGroups(item)` reads the flexible API shape: option name from `name|label|title`, price from
`price|extraPrice|amount`; `required` from `required|isRequired|min>0`; `max` from
`max | (type==='single'||single ? 1 : options.length)`; `multiple = !(single) && max>1`.
`defaultSelection` preselects option 0 of a required single group. Renders `#u99-item-sheet`
(hero image + back, name + veg marker, price block, restaurant, rating/time meta, description,
the `Choose your options` groups, and the foot with the qty stepper + `Add to cart ₹total`).
`requiredSatisfied()` disables the Add button until every required group has a selection.
Add → `E.addWithOptions(item, r, {options: selectedOptions(), addonTotal}, qty)` then toast +
close. Multi-group overflow toast: `Up to N only`.

## 11. `under99.js` → `lib/under99.ts`

DOMContentLoaded boot: wires `#u99-sort` open, `[data-sort-option]` draft select,
`[data-sort-action=apply]` commits `S.sortMode` + sets `#u99-sort-label`
(`Sort` for default, else the LABELS map) + `Eatswada99Products.render()`; close on
`[data-sort-action=close]` / backdrop / Escape. Then `Eatswada99.loadHero()` and
`Eatswada99.load()`. Also defines `window.showToast(msg)` → `#u99-toast` `.show` for 1600 ms.

## 12. API calls (fixtures)

| call | fixture key |
|------|-------------|
| `GET /restaurants/under99` | `"/restaurants/under99"` |
| `GET /home-banners?placement=under99` | `"/home-banners?placement=under99"` |

That is all — no POST/PUT/DELETE anywhere on this page.

## 13. URL query params

**None.** `under99.html` reads no query string. (The task suggested a fixed URL; use
`under99.html` and `/under99`.)

## 14. localStorage / sessionStorage keys

| key | who | access |
|-----|-----|--------|
| `eatswada_theme` | pre-paint, `lib/theme.ts` | r/w |
| `eatswada_header_theme` | pre-paint, `lib/header-theme.ts` | r/w |
| `nearbite_cart` | `cart-bar.js` (`updateCart`, `readCart`, `cartQty`) | r/w |
| `es_image_dict` | `cart-bar.js` `rememberCartImage` | r/w |
| `nearbite_checkout_key`, `nearbite_checkout_fp`, `nearbite_checkout_fp_ts` | `cart-bar.js` clear path | w |
| `nearbite_address`, `nearbite_selected_address`, `nearbite_onboarding_geocode`, `nearbite_onboarding_location`, `eatswada_location`, `userLocation`, `deliveryLocation`, `selectedLocation`, `location` | `under99-header.js` (read only, first non-empty wins) | r |

No `sessionStorage` use on this page.

## 15. Cart parity (task requirement)

`cart-bar.js` owns the cart. On the pink (99 Store) path, the add control calls
`window.updateCart(encodeURIComponent(JSON.stringify(payload)), ±1)` — the 2-argument
"Under99 payload" form. `lib/cart.ts` `updateCart` is a line-for-line port of that, so the
resulting `nearbite_cart` object must be byte-identical. `web/scripts/cart-parity.mjs` asserts
this by driving the same sequence on both pages against the same fixtures and deep-comparing
`nearbite_cart` (plus the other keys above) after every step.

Cart-bar mode on this path: `getCartBarMode('/under99')` → `'pink'`.

## 16. Compare URL

`http://localhost:8080/under99.html` vs `http://localhost:3000/under99`,
fixtures `web/scripts/fixtures/under99.json`.
