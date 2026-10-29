# `category.html` → `web/app/category/page.tsx` — map

Source: `category.html` (463 lines, 17.5 KB): 150 lines of inline `<style>`, 51 lines of
markup, and a 215-line inline IIFE that is the entire page logic. Uses `restaurant-card.js`
only for its `read`/`escape`/`formatDistance`/`getDistanceKm` helpers — **not** for the
99-Store card builder.

## 1. `<head>` order

| # | element | ported where |
|---|---------|--------------|
| 1 | `<meta name="color-scheme" content="light">` | `layout.tsx` `viewport` (Phase 0) |
| 2 | charset / viewport | App Router |
| 3 | pre-paint theme snippet | `layout.tsx` `PRE_PAINT` |
| 4 | `<script src darkreader@4.9.133 integrity=sha384-AedAbrPK… data-ew-dark-reader>` — **NOT** `defer` here (index/search use `defer`) | `layout.tsx` `DARK_READER_PRELOAD` |
| 5 | `eatswada-theme.js` | `installTheme` (ShellRuntime) |
| 6 | `eatswada-header-theme.js` | `installHeaderTheme` (ShellRuntime) |
| 7 | `<title>Category – Eatswada \| EatSwada</title>` | `metadata` |
| 8 | preconnect fonts.googleapis / fonts.gstatic | `FONT_LINKS` |
| 9 | Google Fonts **Manrope** 400..800 | `FONT_LINKS` |
| 10 | Font Awesome 6.5.2 + `integrity=sha384-PPIZEGYM…` | `FONT_LINKS` |
| 11 | **inline `<style>`** (150 lines) | `styles/legacy/category-inline.css` (byte-for-byte, raw content between the tags) |
| 12 | `style.css` | page import |
| 13 | `css/eatswada-ui-system.css?v=20260923-typography` | page import |
| 14 | `eatswada-theme.css` | page import |
| 15 | `eatswada-header-theme.css` | page import |
| 16 | `food-placeholder.css` | page import |
| 17 | description / robots `noindex,nofollow` / canonical / og / twitter | `metadata` |

## 2. CSS import order (top of `app/category/page.tsx`)

1. `styles/legacy/category-inline.css` — the page's own inline `<style>`, **must stay first**;
   `style.css` (later) wins the cascade for the shared `.filter-bar` / `.filter-pill` rules.
2. `styles/legacy/style.css`
3. `styles/legacy/css/eatswada-ui-system.css`
4. `styles/legacy/eatswada-theme.css`
5. `styles/legacy/eatswada-header-theme.css`
6. `styles/legacy/food-placeholder.css`

The Manrope + Font Awesome CDN sheets come from `layout.tsx` `FONT_LINKS`.
`food-placeholder.css` is loaded because the inline renderer emits `.ew-food-ph` /
`.ew-img-fade` inside every `.res-img-wrap`.

Cascade notes (both files are imported, so both keep their legacy relative order):
- `.filter-bar` / `.filter-pill` are defined in the inline block **and** in `style.css`
  (`.filter-pill` at lines 233 and 632). `style.css` is later → wins, exactly as legacy.
- `.cat-header`, `.res-*`, `.empty-*`, `.btn-back-home`, `.skel-*` are inline-only.
- `style.css` also sets `body{font-family:var(--font-sans)!important}` — the inline block's
  `body{font-family:var(--font)}` (from `style.css`'s `:root --font:'Manrope',…`) is what
  actually renders, and `eatswada-ui-system.css` then forces `Manrope` on html/body/controls.

## 3. Markup (lines 187–235) — port as JSX

```
body
├── .cat-header
│   ├── .cat-header-left
│   │   ├── button.icon-btn-round[onclick=nearbiteSafeBack()][aria-label="Go back"] > i.fa-solid.fa-arrow-left
│   │   └── div > h1#category-title.cat-title "Category" + p.cat-sub "Restaurants near you"
│   └── button.icon-btn-round[onclick=location.href='search.html'][aria-label="Search"] > i.fa-solid.fa-magnifying-glass
├── .filter-bar#cat-filter-bar[hidden]
│   ├── button#sort-cat-btn.filter-pill[hidden][onclick=toggleCategorySort()] "Top rated first"
│   ├── button#rating-cat-btn.filter-pill[hidden][onclick=toggleCategoryRating()] "Ratings 4.0+"
│   └── button#veg-cat-btn.filter-pill[hidden][onclick=toggleCategoryVeg()] "Pure Veg"
└── #results-list.results-container
    ├── #cat-skeleton (2 × .skel-card > .skeleton.skel-img + .skel-info > 3 × .skeleton.skel-line with inline width/height)
    └── #cat-results[style="display:none"]
```

No header/footer/cart-bar in the markup. `navigation.js` and `cart-bar.js` are loaded at the
bottom, so the port needs `nearbiteSafeBack` (already in `lib/navigation.ts`, ShellRuntime) and
`<CartBar/>`. Note the legacy search button points at `search.html`; the port must point at the
clean `/search` (the overlay's trigger selector matches both spellings).

## 4. Scripts

| legacy | port |
|--------|------|
| `config.js` | `lib/config.ts` |
| `safe-html.js` | `installSafeHtml` (ShellRuntime) |
| `api.js` | `lib/api.ts` (`API`) |
| `restaurant-card.js` | `installRestaurantCard` (`RestaurantCard.read` / `.escape` / `.formatDistance` / `.getDistanceKm`) |
| inline IIFE (215 lines) | `lib/category-page.ts` → `installCategoryPage()` |
| `navigation.js` | `installNavigation` (ShellRuntime) |
| `cart-bar.js` | `<CartBar/>` |

The page has **no** `<Header/>` — it draws its own `.cat-header`. It also does not load
`search-overlay.js`, `home.js`, `home-banners.js`, or `favorites.js` as scripts, but
`restaurant-card.js`'s delegated handlers (favorites, galleries) come along with it, so the
port installs `installRestaurantCard()` for parity.

## 5. Inline logic → `lib/category-page.ts`

State: `{ restaurants: [], category: '', sortByRating: false, ratingOnly: false, vegOnly: false,
status: 'loading' }`.

| function | behaviour to keep |
|----------|-------------------|
| `matchesCategory(res)` | case-insensitive `indexOf` of `state.category` in name, then cuisine, then any `res.menu[].name`. Empty category ⇒ everything matches. |
| `visible()` | filter by category → `ratingOnly` (`read.rating` non-null and ≥ 4) → `vegOnly` (`read.pureVeg === true`); then if `sortByRating`, copy + sort desc by `read.rating || 0`. |
| `syncFilterBar()` | show `#sort-cat-btn` + `#rating-cat-btn` only when some restaurant has a non-null rating; show `#veg-cat-btn` only when some has non-null `pureVeg`; hide the whole `.filter-bar` when neither. |
| `stateBlock(icon,title,sub,buttonHtml)` | `.empty-state` + `.empty-icon-wrap > i.fa-solid.<icon>` + `.empty-title` + `.empty-sub` + optional button; title/sub go through `esc`. |
| `render()` | hides `#cat-skeleton`, shows `#cat-results`; error → `fa-plug-circle-xmark` "Couldn't load restaurants" + `#cat-retry` ("Try Again" → disabled + "Retrying…" → `load()`); empty → `fa-utensils` "No restaurants found" + sub uses the category (curly apostrophe `\u2019`) or "Nothing available here right now." + `.btn-back-home` calling `nearbiteSafeBack()`; else `.res-count` ("N restaurant(s) found") + one `.res-card` per item. |
| card markup | `<a href="restaurant.html?id=<encoded>" class="res-card">` → `.res-img-wrap` (`.ew-food-ph` + `.ew-img-fade` img via `optimizedImageUrl(images[0],240)` + optional `.res-offer`) + `.res-info` (`.res-top > h3.res-name`, optional `.res-meta-row` with `.res-rating` `rating.toFixed(1)` and/or `.res-time`, optional `.res-cuisine`, optional `.res-loc` with the green `fa-location-dot` + `formatDistance(getDistanceKm(res))`). |
| `load()` | read `API.cache.readList(API.CACHE_KEYS.restaurants, 10*60*1000)` → if present, set + render immediately; then `API.getList(API.routes.restaurants)` → filter to items with `_id \|\| id \|\| slug` → `writeList` → `syncFilterBar()` + `render()`; on error log `[category] load failed:` and, **only if the list is still empty**, switch to the error state. |
| `toggleCategorySort/Rating/Veg` | flip the flag, toggle `.active` on the matching button, `render()`. Published on `window`. |

The legacy `onclick=` attributes become React handlers; the `window.toggleCategory*` globals
are still published for parity with any not-yet-ported inline script.

## 6. URL query parameters

| param | meaning |
|-------|---------|
| `type` | category name; sets `state.category` **and** `#category-title` `innerText`. Absent ⇒ `''` and the title stays "Category", and `matchesCategory` matches everything. |

## 7. API calls

| call | when | fixture key |
|------|------|-------------|
| `GET /restaurants` | on `DOMContentLoaded` (after the session-cache read) | `"/restaurants"` |

That is the only request. No search, no menu, no categories. `API.getList` unwraps
`payload.data`; `writeList` caches it under `es_restaurants_v4` for 10 minutes.

## 8. `localStorage` / `sessionStorage` keys

| key | who |
|-----|-----|
| `eatswada_theme` | pre-paint snippet, `lib/theme.ts` |
| `eatswada_header_theme` | pre-paint snippet, `lib/header-theme.ts` |
| `es_restaurants_v4` (sessionStorage) | `API.cache.readList` / `writeList` — the restaurant list |

## 9. Compare fixture URL

`http://localhost:8080/category.html?type=Dosa` vs `http://localhost:3000/category?type=Dosa`.
`Dosa` matches the single fixture restaurant ("Foodie Dosa Restaurant" / cuisine "Dosa.
Chinese"), so the list renders; an unmatched type exercises the empty state. Fixture file:
`web/scripts/fixtures/category.json`.
