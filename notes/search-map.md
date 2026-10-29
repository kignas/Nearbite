# `search.html` → `web/app/search/page.tsx` — map

Source: `search.html` (51 lines, 3.0 KB). The smallest page in the site: it renders **no
markup of its own** — it is a bootstrapper that opens the shared search overlay in
"full page" mode. Everything visible is built at runtime by `search-overlay.js`.

## 1. `<head>` order (what the port must reproduce)

| # | element | ported where |
|---|---------|--------------|
| 1 | `<meta name="color-scheme" content="light">` | `layout.tsx` `viewport.colorScheme` = `light dark` (Phase 0, unchanged) |
| 2 | `<meta charset>` / `<meta viewport>` | App Router |
| 3 | pre-paint inline theme snippet (`data-ew-theme`, `data-ew-header`) | `layout.tsx` `PRE_PAINT` (Phase 1b) |
| 4 | `<script defer darkreader@4.9.133 integrity=sha384-AedAbrPK… data-ew-dark-reader>` | `layout.tsx` `DARK_READER_PRELOAD` |
| 5 | `eatswada-theme.js` | `lib/theme.ts` via `<ShellRuntime/>` |
| 6 | `eatswada-header-theme.js` | `lib/header-theme.ts` via `<ShellRuntime/>` |
| 7 | `<title>Search – Eatswada \| EatSwada</title>` | `app/search/page.tsx` `export const metadata` |
| 8 | preconnect fonts.googleapis / fonts.gstatic | `layout.tsx` `FONT_LINKS` (has Manrope+Caveat, **not** the Inter-only sheet — see §3) |
| 9 | Google Fonts **Inter** 400–800 | `app/search/page.tsx` `<head>` — page-specific, added in this phase |
| 10 | `<link rel="stylesheet" href="search-overlay.css">` | injected at runtime by `lib/search-overlay.ts` `ensureStyles()` (href `/search-overlay.css?v=20260924-polish`), exactly as legacy |
| 11 | `config.js` | `lib/config.ts` |
| 12 | `safe-html.js` | `lib/safe-html.ts` via `<ShellRuntime/>` |
| 13 | `api.js` | `lib/api.ts` (imports `API`) |
| 14 | `search-overlay.js` | `lib/search-overlay.ts` via `<SearchRuntime/>` |
| 15 | preconnect fonts.googleapis / fonts.gstatic (repeated) | `FONT_LINKS` |
| 16 | Google Fonts **Manrope** 400..800 | `FONT_LINKS` |
| 17 | `css/eatswada-ui-system.css?v=20260923-typography` | page import |
| 18 | `eatswada-theme.css` | page import |
| 19 | `eatswada-header-theme.css` | page import |
| 20 | description / robots `noindex,nofollow` / canonical / og / twitter metas | `metadata` |

Note: `<meta name="robots" content="noindex, nofollow">` is on the page **and** is why this
URL was never indexed — keep it (the playbook only requires the `.html`→clean 301).

## 2. CSS import order (top of `app/search/page.tsx`)

1. `styles/legacy/eatswada-ui-system.css`
2. `styles/legacy/eatswada-theme.css`
3. `styles/legacy/eatswada-header-theme.css`

No inline `<style>` on this page (the only page so far without one) → no `search-inline.css`.
`search-overlay.css` is **not** imported; `lib/search-overlay.ts` injects it at runtime, in the
same place the legacy script did (after the three links above → later in the cascade, same
relative order). The Inter and Manrope Google Fonts sheets are `<link>`s in `layout.tsx` +
`<head>`; the Font Awesome sheet (already in `FONT_LINKS`) is what the overlay's SVG icons
don't need, but `search.html` does not load FA either — it loads **Inter** instead.

## 3. Fonts (why Inter matters here)

`search.html`'s `<body style="font-family:Inter,system-ui,sans-serif">` is an inline style on
`<body>`, so it beats every stylesheet in the cascade. The port must reproduce that (inline
`style` on the ported `<body>` wrapper or an equivalent `font-family:Inter,…` rule on the page
root) **and** must load the Inter sheet, which `layout.tsx` does not (it loads Manrope+Caveat).
If Inter is missing the overlay's text falls back to system-ui → visible diff.

## 4. Scripts

| legacy | port |
|--------|------|
| `eatswada-theme.js` | `installTheme` (ShellRuntime) |
| `eatswada-header-theme.js` | `installHeaderTheme` (ShellRuntime) |
| `config.js` | `lib/config.ts` |
| `safe-html.js` | `installSafeHtml` (ShellRuntime) |
| `api.js` | `lib/api.ts` |
| `search-overlay.js` | `installSearchOverlay` (page runtime) |
| inline `DOMContentLoaded` bootstrapper | `lib/search-page.ts` → `installSearchPage()` |

`search.html` does **not** load `navigation.js` or `cart-bar.js` → no `<CartBar/>` and no
footer on this page (unlike Home). `cart-bar.js` self-injects `#white-cart-root`; not loading it
means the port must not render `<CartBar/>` here.

## 5. The inline bootstrapper (the whole page logic)

```js
document.addEventListener('DOMContentLoaded', function () {
  const params = new URLSearchParams(location.search);
  const q = params.get('q') || '';
  const scope = params.get('scope') === 'restaurant' ? 'restaurant'
              : (params.get('scope') === 'under99' ? 'under99' : 'home');
  const restaurantId = params.get('restaurantId') || params.get('id') || '';
  document.body.classList.add('ew-search-page');
  window.EatswadaSearch?.open({ context: scope, restaurantId, query: q });
});
```

Port: `lib/search-page.ts` — same reads, same defaults, adds `ew-search-page` to `<body>`, then
calls `EatswadaSearch.open(query, { context, restaurantId })`. The overlay's own
`open(prefill, options)` already accepts that object shape.

## 6. URL query parameters

| param | values | meaning |
|-------|--------|---------|
| `q` | free text | prefills the search input and triggers an immediate search |
| `scope` | `home` (default) / `under99` / `restaurant` | which context the overlay searches |
| `restaurantId` | id | only meaningful with `scope=restaurant` |
| `id` | id | alias of `restaurantId` |

## 7. API calls

| call | when | fixture key |
|------|------|-------------|
| `GET /restaurants/search?q=<q>&scope=<scope>` (+`&restaurantId=<id>` when scope=restaurant) | immediately on load when `q` is non-empty (≥ 2 chars), and on every input/Enter after the 260 ms debounce | `"/restaurants/search?q=Noodles&scope=home"` |
| `GET /restaurants/search?q=Egg&scope=home` | only if the tester types "Egg" | `"/restaurants/search?q=Egg&scope=home"` |

No other endpoint. With no `q` the overlay renders its idle (empty) state and makes **no**
request at all.

## 8. `localStorage` / `sessionStorage` keys

| key | who | note |
|-----|-----|------|
| `eatswada_theme` | pre-paint snippet, `lib/theme.ts` | `dark` \| anything else |
| `eatswada_header_theme` | pre-paint snippet, `lib/header-theme.ts` | only `raspberry` accepted |
| — | — | the overlay itself caches nothing; it has no `sessionStorage` use |

`search.html` does not read `API.CACHE_KEYS.restaurants` and does not write the session cache.

## 9. Compare fixture URL

`http://localhost:8080/search.html?q=Noodles` vs `http://localhost:3000/search?q=Noodles`
(the URL the task fixes as the reference). Fixture file: `web/scripts/fixtures/search.json`.
