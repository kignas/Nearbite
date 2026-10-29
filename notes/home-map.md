# Home page map (Phase 1b)

Source: legacy `index.html` (938 lines) + the five home scripts. Goal: byte-level
visual parity in `web/app/page.tsx`. No GSAP/Lenis/Motion in this phase.

## 1. CSS load order (AGENTS.md rule 2 — exact `<link>` order of index.html)

After the two CDN `<link>`s (Google Fonts Manrope+Caveat, Font Awesome 6.5.2):

1. **inline `<style>`** (index.html lines 21–605) — the page's own base + header +
   filter-sheet + category + banner styles. Extracted byte-for-byte to
   `web/styles/legacy/home-inline.css`.
2. `restaurant-card.css`
3. `skeleton.css`
4. `eatswada-end-section.css`
5. `whats-on-your-mind.css`
6. `filter-bar.css`
7. `filter-sheet.css`
8. `eatswada-theme.css`
9. `eatswada-header-theme.css`
10. `css/platform-status.css`

**Order is load-bearing.** The inline block has real property conflicts with
`eatswada-header-theme.css` (29 shared selectors: `.loc-*`, `.btn-store`,
`.search-box`, `.banner-*`, …). In the legacy head the inline block comes FIRST, so
the linked files win for those tokens. The inline block must therefore be imported
before the linked files (i.e. **inline CSS first**), never reordered.

The `data-ew-premium-theme="oxblood-gold"` block (index.html 673–720) is already
rendered by the Phase 1a `<Header/>` component (inside `<head>` in legacy → injected
as a `<style>` in the page body here; it only uses `!important` rules on header
classes so its position is not cascade-sensitive).

`search-overlay.css` is NOT in index.html's head — `search-overlay.js` injects it at
runtime (`ensureStyles()` → `<link href="search-overlay.css?v=20260924-polish">`).
The port loads it from `useEffect` the same way, so it does not join the static order.

## 2. Body structure (index.html 723–937)

| Lines | Element |
|---|---|
| 725–781 | `<header class="hero-header" id="home-header">` → Phase 1a `<Header/>` (reused verbatim) |
| 783 | `<main class="page">` |
| 785 | `<div id="home-platform-banners" class="ps-host" hidden>` → `<PlatformStatusBanners id=.../>` |
| 787–806 | `#mind-section` (`.sec-head` + `#cat-scroll` category skeleton, 8 `.cs-item`) |
| 808–812 | `#filter-bar` (3 `.filter-pill.is-skeleton`) |
| 814–861 | `#restaurants-section`: `.sec-head` + `#home-notice` + `#profile-setup-banner` + `#location-banner` + `#restaurant-list` (2 `u99-card-host.rs-skeleton`) |
| 863–868 | `.ew-feed-end#home-feed-end` (end section) |
| 872–887 | `#filter-sheet` (sheet-backdrop/panel/grabber/head/tabs/body/footer) |
| 889–899 | `#location-sheet` (dead in legacy — see TODO) |
| 901–926 | scripts |

`<body>` has no class. index.html has **no** footer and **no** `#nearbite-bottom-tabbar`.

## 3. Inline scripts

- 8: pre-paint theme snippet (Phase 1a `layout.tsx`).
- 9: dark-only Dark Reader `document.write` loader → **replaced** in layout.tsx with a
  DOM-injected `<script src integrity crossorigin>` (the document.write version blanked
  the whole page in React).
- 913–924: the `Pizaa`→`Pizza` `MutationObserver` on `#cat-scroll` (ported inside
  `lib/home.ts`).
- 926–934: `navigator.serviceWorker.register('./sw.js')` on load (ported in `lib/home.ts`).

## 4. Scripts and what they own

| File | Lines | Port | Notes |
|---|---|---|---|
| `config.js` | — | `lib/config.ts` | already ported |
| `platform-status.js` | — | `lib/platform-status.ts` | already ported; mounted via `<PlatformStatusBanners/>` |
| `safe-html.js` | — | `lib/safe-html.ts` | already ported (`safeUrl`, `ewFoodPlaceholder`) |
| `api.js` | — | `lib/api.ts` | already ported (`window.API`) |
| `favorites.js` | — | `lib/favorites.ts` | already ported |
| `restaurant-card.js` | 1127 | `lib/restaurant-card.ts` | **new**: card markup, availability, distance, cart add, customize sheet |
| `address-store.js` | — | `lib/address-store.ts` | already ported |
| `home.js` | 1715 | `lib/home.ts` | **new**: page controller |
| `home-banners.js` | 388 | `lib/home-banners.ts` | **new**: hero carousel |
| `search-overlay.js` | 233 | `lib/search-overlay.ts` | **new**: shared search sheet |
| `cart-bar.js` | — | `lib/cart.ts` + `<CartBar/>` | already ported |
| `new-user-location-prompt.js` | 131 | `lib/new-user-location-prompt.ts` | **new**, but not referenced by index.html (see TODO) |

## 5. API calls on Home (every one traceable to legacy)

| Call | Source | Consumed by |
|---|---|---|
| `GET /restaurants` | `api.js` `routes.restaurants` via `home.js refresh()` | restaurant list |
| `GET /categories` | `routes.categories` via `home.js loadCategories()` | category row |
| `GET /home-banners` | `home-banners.js` line 373 | hero carousel |
| `GET /restaurants/search?q&scope=home` | `api.js` `searchMenuItems` via `home.js searchCategory()` | category tap |
| `GET /restaurants/search?q&scope=home` | `search-overlay.js` line 138 | search overlay |
| `GET /restaurants/:id/menu` | `restaurant-card.js` line 608 | menu enrichment for cards |
| `GET /platform/public-status` | `platform-status.js` | banners |
| `GET /users/addresses` | `address-store.js` | header address |

Caches: `api.js` `es_restaurants_v4` / `es_categories_v4` (localStorage, 10 min),
`home-banners.js` `es_home_banners_v2` (sessionStorage, 10 min),
`platform-status.js` `eatswada_platform_settings_v2` (sessionStorage, 60 s).

## 6. Tested-by-hand checklist (see PROGRESS.md for results)

add-to-cart on a home card (stepper +/−, "first add opens the menu"), search overlay
(open via the header search box, type ≥2 chars, results, close), new-user location
prompt, banners (autoplay/swipe/dots hidden), dark mode, favorite hearts, CSS leak check.

## 7. TODOs / questions

- `TODO(question)`: `#location-sheet` is present in index.html but **no** script on
  `main` references `location-allow-btn` / `location-sheet-close`; `home.js` says Home no
  longer auto-opens a permission sheet. Rendered verbatim, left unwired, as legacy.
- `TODO(question)`: `new-user-location-prompt.js` is **not** referenced by any legacy
  HTML file (its CSS `new-user-location-prompt.css` is not linked either); only
  `complete-profile.html` writes its `eatswada_new_user_location_pending` key. Ported
  per the task list, installed on Home, no-op unless that key is set.
- `TODO(question)`: `.es-fav` favorite hearts are emitted by `restaurant-card.js`
  `syncFavoriteButtons()` but the 99-Store card markup Home actually uses
  (`homeBuildCard`) renders no `.es-fav` button, and index.html has none. So no heart is
  visible on Home today; the delegated handler is ported as-is.
