# `restaurant-shell.html` → `web/app/restaurant-shell/page.tsx` — map (Phase 2, step 1)

Date: 2026-10-26. **No code was written for this task.** This is the reference the port follows.

Evidence: `restaurant-shell.html` (3311 lines, read in ~300-line ranges), `api/restaurant-seo.js`,
`api/sitemap.js`, `restaurant-details.html`, `restaurant-info.html`, `js/menu-jump.js`,
`js/pairing-suggestions.js`, `api.js`, `cart-bar.js`, `safe-html.js`, `search-overlay.js`,
`vercel.json`, `sw.js`, `next.config.js`, and every CSS file the page links.
Live GET probes against `https://api.eatswada.com/api` (GET only, read-only).

---

## 1. How the pieces fit

### 1.1 The two URLs

| URL | Serves | Notes |
|---|---|---|
| `/restaurant?id=<id>` | rewritten to **`/api/restaurant-seo`** (`next.config.js` rewrites, legacy `vercel.json` L8) | This is the **only indexed** restaurant URL. Legacy `restaurant.html` does not exist in the repo, but `/restaurant.html` → 301 `/restaurant` is kept forever. |
| `/restaurant-shell` (and `/restaurant-shell.html`) | the raw shell | `X-Robots-Tag: noindex, nofollow` (legacy `vercel.json` L13–L23, already ported to `next.config.js` `headers()`). |

`sw.js` (legacy cache `eatswada-shell-v8`) precaches `./restaurant.html` — not the shell. The
shell is **never** in the service-worker shell list.

### 1.2 What `api/restaurant-seo.js` does (server-side)

It is a Vercel Node function, not a Next route. Port it to `app/api/restaurant-seo/route.ts`
(or keep the rewrite target as a route handler) so `/restaurant` keeps working.

Step by step:

1. `id = req.query.id`, validated with `/^[a-zA-Z0-9_-]{8,80}$/`. Invalid → **400** + `noindex`.
2. `GET https://api.eatswada.com/api/restaurants/<id>` (via `https.get`, `accept: application/json`).
   Upstream 4xx/5xx → **404**; other errors → **502**; both `noindex, nofollow`.
3. Gate: `result.success === true` **and** `data` present **and** `data.isActive === true`
   **and** `data.approvalStatus === 'approved'`. Anything else → **404**
   `<!doctype html><title>Restaurant unavailable | EatSwada</title><h1>Restaurant unavailable</h1>`.
4. **Fetches the shell over HTTP**: `GET {protocol}://{host}/restaurant-shell`
   (`x-forwarded-proto` or `https`). Non-200 → 502. This is why the shell must exist as a route
   before `/restaurant` can render — the SEO function is a string post-processor of the shell HTML.
5. Rewrites `<title>` → `<name> – Order Food Online in Maynaguri` when the name starts with
   `eatswada` (case-insensitive), else `<name> – Order Online in Maynaguri | EatSwada`.
6. Injects into `</head>`:
   - `<meta name="description">` — `Explore the menu and order from <name>[ serving <cuisine>] in Maynaguri, West Bengal on EatSwada.`
   - `<meta name="robots">` — `index, follow` unless the id is in `NEVER_INDEX_IDS`
     (`['6ac5cbd0933976c30865d23e']`, "Eatswada 2 (test)"). `indexEnabled` is hard-coded `true`.
   - `<link rel="canonical" href="https://eatswada.com/restaurant?id=<id>">`
   - OG: `og:type=restaurant`, `og:site_name=EatSwada`, `og:title=<name> | EatSwada`,
     `og:description=<desc>`, `og:url=<canonical>`, `og:image` **only** when the image is a
     `https://res.cloudinary.com/...` URL (`safeImage()`).
   - JSON-LD `@type: Restaurant` with `name`, `url`, `description`, `servesCuisine`,
     `image`, `address` (`addressLocality` always `Maynaguri`, `addressRegion` `West Bengal`,
     `addressCountry` `IN`), `areaServed {City: Maynaguri}`. `undefined` keys drop out of JSON.
   - A trailing `<script>try{history.replaceState(null,"",location.pathname+"?id=<id>"+location.hash)}catch(e){}</script>`
     — so the visible URL is always `/restaurant?id=<id>`.
7. Response headers: `Content-Type: text/html; charset=utf-8`,
   `Cache-Control: public, s-maxage=300, stale-while-revalidate=600`, `X-Robots-Tag: <robots>`.

**Consequence for the port:** the shell page must **server-render the same `<head>` shape**
(`<title>Menu – EatSwada</title>` etc.) and must not itself set `robots`, because the SEO layer
overwrites it. The shell page's own metadata should be `noindex, nofollow` + canonical
`https://eatswada.com/restaurant-shell.html` (matching the `X-Robots-Tag` header), and the
`/restaurant` route supplies the indexed metadata via `generateMetadata` in a server component.

`api/sitemap.js` (`/sitemap-restaurants.xml`) reads `GET /restaurants`, filters
`isActive === true`, `approvalStatus !== 'approved'` → drop, `NEVER_INDEX_IDS` → drop, and emits
`<loc>https://eatswada.com/restaurant?id=<id></loc>`. Same `NEVER_INDEX_IDS` list as the SEO file.
The list is duplicated on purpose ("keep this list the same") — the port must keep both copies in
sync too, or the sitemap will advertise an id the page marks noindex.

### 1.3 Server-side vs browser-side split

| Concern | Side |
|---|---|
| `<title>`, description, canonical, OG, JSON-LD, robots, `X-Robots-Tag` | **server** (`/api/restaurant-seo`, post-processing the shell) |
| Restaurant name / cuisine / rating / distance / delivery strip / offer banner | **browser** — `renderRestaurantHeader()` writes them after `GET /restaurants/:id` |
| Menu list | **browser** — `GET /restaurants/:id/menu` |
| Reviews | **browser, lazily** — `GET /restaurants/:id/reviews?page=N&limit=5`, only when the Info tab is first opened |
| Info tab content | **browser**, from the already-fetched restaurant object (no second API call) |
| Cart, favourites, theme, address | **browser** (`localStorage`) |

The shell HTML ships a **skeleton** for the header (`<h1 id="res-name">Loading…</h1>`) and a
skeleton for the menu (`#menu-skeleton`) and Info (`#info-skeleton`). Everything else is filled
in by script. So the server-rendered page is intentionally almost empty of restaurant data —
the SEO layer only ever adds `<head>` tags.

### 1.4 URL parameters

| Param | Read at | Meaning |
|---|---|---|
| `id` | L1504–1505 | the restaurant id. Missing → `showErrorState('This link is missing a restaurant ID.', false)`. **The only required param.** |
| `focusItem` | L417 (autoscroll guard), L1535–1547 | after the menu renders, scroll to `.menu-item[data-menu-item-id="<focusItem>"]`, `block:'center'`, add class `ew-search-focus-item` for 1800 ms. Set by `search-overlay.js` `openResult()` when it links to `restaurant-shell.html?id=..&focusItem=..`. |
| hash (`#...`) | L417 | presence disables the landing auto-scroll. No other use. |
| `restaurantId`, `restaurant` | **not read by this page.** Read by `search-overlay.js` `detectContext()` (L44) for its `scope=restaurant` mode. |

`search-overlay.js` is loaded (L311) but this page **never opens it**: `detectContext()` would
return `scope:'restaurant'`, but nothing on the page calls `window.openEatswadaSearch` and the
page has no `a[href="search.html"]`, `.search-box[data-search-trigger]` or `.u99-search-btn`, which
are the only triggers `bind()` looks for. It does inject `search-overlay.css` into `<head>` on
load, so that stylesheet is present on this page as a side effect (see §2).

---

## 2. CSS `<link>` order and inline block sizes

### 2.1 Exact `<link>` order (lines 15–48)

Kept **separate and in order** — several files share selectors and the later ones are the
intended overrides (AGENTS.md rule 2). Note the **gap at lines 22–30** (9 blank lines) and
**35–36**; nothing is missing there.

**32 `<link>` elements in `<head>`**: 3 preconnects, the Font Awesome preload (line 18) plus its
`<noscript>` fallback (line 19), **26 local stylesheets**, and the Manrope Google-Fonts request.
The 26 local files are rows 6–20 and 22–32 below; rows 1–5 and 21 are the CDN links that
`app/layout.tsx` already provides.

| # | Line | Stylesheet | Size | Role |
|---|---|---|---|---|
| 1 | 15 | `https://fonts.googleapis.com` (preconnect) | — | |
| 2 | 16 | `https://fonts.gstatic.com` (preconnect, crossorigin) | — | |
| 3 | 17 | `https://api.eatswada.com` (preconnect, crossorigin) | — | |
| 4 | 18 | Font Awesome 6.5.2, `rel=preload as=style` + `onload` swap | CDN | icons |
| 5 | 19 | same, `<noscript>` fallback | CDN | |
| 6 | 20 | `css/eatswada-typography.css` | 1015 B | |
| 7 | 21 | `style.css` | 28 668 B | base + skeletons + `--font` |
| — | 22–30 | *(blank)* | | |
| 8 | 31 | `css/legacy-inline.css` | **114 549 B** | header: *"Preserved original inline CSS blocks 0-15. Do not edit for section work."* — the bulk of the page's layout |
| 9 | 31 | `css/header.css` | 235 B | hides `.restaurant-header .more-btn` etc. |
| 10 | 31 | `css/restaurant-info.css` | 637 B | `.res-card-body`, `.res-name`, `.res-cuisine`, `.res-meta-row` |
| 11 | 31 | `css/rating-meta.css` | 1728 B | `.rating-pill` |
| 12 | 31 | `css/delivery-banner.css` | 2235 B | `.delivery-strip` height/spacing (declared "the only file to edit for banner height") |
| 13 | 31 | `css/filters.css` | **101 B — comment only** | reserved; real rules live in `legacy-inline.css` |
| 14 | 31 | `css/menu.css` | **104 B — comment only** | reserved |
| 15 | 31 | `css/cart.css` | **108 B — comment only** | reserved |
| 16 | 31 | `css/step1-geometry.css` | 1864 B | header → info → banner → tabs → filters geometry only |
| 17 | 31 | `css/step3-typography.css` | 3202 B | typography only |
| 18 | 32 | `css/step3-navigation-fix.css` | 873 B | `.menu-tabs` grid |
| 19 | 33 | `css/step4-menu-geometry.css` | 8137 B | "FINAL BENCHMARK MENU / ITEM GEOMETRY (single source of truth)" |
| 20 | 34 | `search-overlay.css` | 8994 B | the overlay; **also re-injected at runtime** by `search-overlay.js` `ensureStyles()` as `/search-overlay.css?v=20260924-polish` |
| — | 35–36 | *(blank)* | | |
| 21 | 37 | `https://fonts.googleapis.com/css2?family=Manrope:wght@400..800&display=swap` | CDN | |
| 22 | 38 | `css/eatswada-ui-system.css?v=20260923-typography` | 3410 B | |
| 23 | 39 | `eatswada-theme.css` | 2862 B | `--ew-*` tokens, `color-scheme` |
| 24 | 40 | `eatswada-header-theme.css` | 9264 B | `--hd-*` tokens |
| 25 | 41 | `food-placeholder.css` | 3527 B | `.ew-food-ph` |
| 26 | 42 | `css/restaurant-tabs.css` | 3092 B | `.res-pane`, tab switching |
| 27 | 43 | `css/restaurant-menu-enhancements.css?v=20261016-3` | 9296 B | "final overrides loaded last" |
| 28 | 44 | `css/pairing-suggestions.css?v=1` | 7638 B | `.ew-pair*` |
| 29 | 45 | `css/restaurant-info-premium.css?v=1` | 5604 B | `.inf-*` Info tab + swipe |
| 30 | 46 | `css/restaurant-filter-motion.css?v=1` | 2199 B | `.ew-chip-pop`, `.ew-filter-reveal`, `.hidden-by-filter` |
| 31 | 47 | `css/restaurant-search-page.css?v=8` | **23 587 B** | `.ss-*` full-screen search, `.ds-*` dish sheet, `.tsb*` sticky bar, `.rmf*` menu footer |
| 32 | 48 | `css/ew-sheet.css?v=1` | 4619 B | "ONE look for every popup (bottom sheet)… Load LAST" — overrides `.ewcs-*` and `.ds-*` |

All 26 local stylesheets exist under `web/styles/legacy/` (verified individually, all present;
the CDN ones come from `app/layout.tsx`).

**Not linked by this page** (do not import): `css/tabs.css`, `css/add-button.css`,
`css/eatswada-back-button.css`, `css/rating-fix.css`, `css/platform-status.css`,
`css/eatswada-site-footer.css`, every `cart-*.css`, every `under99-*.css`, and the root-level
`restaurant-card.css`, `skeleton.css`, `filter-bar.css`, `filter-sheet.css`, `address-*.css`,
`eatswada-*.css` (except `eatswada-theme.css` / `eatswada-header-theme.css` / `eatswada-typography.css`).
`.nb-add-btn` is styled by `css/step4-menu-geometry.css`, `css/restaurant-menu-enhancements.css`,
`css/legacy-inline.css`, `style.css` and `css/ew-sheet.css` — **not** `css/add-button.css`.

`app/layout.tsx` already provides: the pre-paint theme snippet, the dark-only Dark Reader loader,
the dark background rule, the two Google-Fonts links and the Font Awesome link. The page must
**not** re-add those. Manrope already comes from the layout's Google-Fonts URL (a superset of the
shell's `wght@400..800` request), so line 37 does not need repeating — but note that the legacy
page requests Manrope *twice* and the port only once; this changes nothing visually because the
second request is the same family.

### 2.2 Inline `<style>` blocks

| Lines | Selector | Lines | Bytes | What it styles |
|---|---|---|---|---|
| 51–90 | `<style id="ew-header-v2">` | 40 | 4470 | `.ew-hd-circle`, `.ew-hd-search`, `.ew-hd-back`, `.ew-res-head` grid, `.ew-name-row`, `.ew-verified`, `.ew-info-row`, `.ew-hd-pill`/`[data-tier]`, `.ew-hd-num`, `.ew-hd-star`, `.ew-hd-count`, `:root{--ew-hd-gap:2px}`, `html[data-ew-theme="dark"]` overrides |
| 92–112 | `<style>` (no id) | 21 | 1864 | `.ew-customer-reviews*`, `.ew-customer-review*` (Info-tab reviews block) |

Both must be extracted byte-for-byte into `web/styles/legacy/restaurant-shell-inline-1.css` and
`…-inline-2.css` and imported **at their exact positions** (after `css/ew-sheet.css`). Keeping
the `id="ew-header-v2"` is not needed in Next, but keeping the two blocks as two separate
stylesheets is.

### 2.3 Inline `<script>` blocks

| Lines | Lines | Bytes | What it is |
|---|---|---|---|
| 9 | 1 | 372 | pre-paint theme snippet — **already in `app/layout.tsx`** (`PRE_PAINT`), do not duplicate |
| 279–307 | 29 | 1428 | `window.optimizedImageUrl` (only `if (typeof window.optimizedImageUrl !== 'function')`) + `window.ewLoadVisibleImages` (IntersectionObserver lazy-image loader, 150 px rootMargin) |
| 313–3107 | **2795** | **128 849** | **the main page script** (see §3) |
| 3110–3302 | 193 | 9942 | the customization-sheet IIFE (`window.ewOpenCustomize`) |

External `<script src>` (in load order):

| Line | Script | Already ported to |
|---|---|---|
| 10 | Dark Reader 4.9.133 (defer) | `app/layout.tsx` `DARK_READER_PRELOAD` |
| 11 | `eatswada-theme.js` | `lib/theme.ts` (`installTheme`) |
| 12 | `eatswada-header-theme.js` | `lib/header-theme.ts` |
| 308 | `config.js` | `lib/config.ts` |
| 309 | `safe-html.js` | `lib/safe-html.ts` (`installSafeHtml`) |
| 310 | `api.js` | `lib/api.ts` |
| 311 | `search-overlay.js` | `lib/search-overlay.ts` (`installSearchOverlay`) |
| 312 | `cart-bar.js` | `lib/cart.ts` + `components/CartBar.tsx` |
| 3108 | `navigation.js` | `lib/navigation.ts` (`installNavigation`) |
| 3304 | `js/pairing-suggestions.js?v=1` | **NOT ported — new work** |
| 3305 | `js/menu-jump.js?v=1` | **NOT ported — new work** |

`favorites.js`, `restaurant-card.js`, `home.js`, `platform-status.js`, `address-store.js` are
**not** loaded by this page.

Order matters: `config.js` → `safe-html.js` → `api.js` → `search-overlay.js` → `cart-bar.js`
must all have run before the main script's top-level statements execute (the main script reads
`document.getElementById('cat-nav')` etc. at parse time and relies on `window.API` and
`window.updateCart` existing later).

---

## 3. Every section of `restaurant-shell.html`

One heading per section. "L" = line range.

### 3.1 `head` — L1–114
- L1–8: doctype, `<html lang="en">`, `color-scheme`, charset, viewport
  (`width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no`).
- L9: pre-paint theme snippet. L10: Dark Reader. L11–12: theme JS.
- L13: `<meta name="view-transition" content="same-origin">` — **not** in the ported layout; check
  whether Next 16 emits an equivalent. Behavioural effect is only View-Transition availability.
- L14: `<title>Menu – EatSwada</title>` (replaced by the SEO layer on `/restaurant`).
- L15–19: preconnects + Font Awesome preload/noscript.
- L20–48: the 32 `<link>`s of §2.1.
- L50: `<meta name="twitter:card" content="summary">`. **No `theme-color`** on this page
  (unlike `under99.html`), so `eatswada-theme.js` creates/updates it at runtime.
- L51–90, L92–112: the two inline `<style>` blocks.
- L114: `</head>`.
- *No* description / robots / canonical / OG tags — the SEO layer adds them.

### 3.2 Free-delivery toast — L116–122
`#ew-free-delivery-toast` (`.ew-free-delivery-toast`, `role=status`, `aria-live=polite`,
`aria-atomic=true`) with icon + title "Congratulations!" + sub "Free delivery is now unlocked for
your order." Shown by `showFreeDeliveryCongratulations()` (L2836) — 2× rAF, `.show` for 3200 ms.
Styled by `css/legacy-inline.css`.

### 3.3 Top bar — L123–134
`.top-bar.ew-themed-header`:
- back button `.ew-hd-circle.ew-hd-back` → `onclick="window.nearbiteSafeBack()"` (double-chevron SVG, two `<path>`s, `.4` opacity first);
- `.top-actions` with `#menu-search-btn.ew-hd-search` (`onclick="toggleMenuSearch()"`,
  `aria-expanded="false"`, magnifier SVG + `<span>Search</span>`);
- favourite button `.ew-hd-circle` → `onclick="toggleRestaurantFavorite()"` containing
  `<i id="restaurant-heart-icon" class="fa-regular fa-heart">`.

### 3.4 Legacy inline search row (dead) — L135–142
`#menu-search-row.menu-search-inline[hidden]` with `#menu-search-input` (`oninput="onMenuSearchInput()"`),
`#menu-search-clear` (`onclick="clearMenuSearch()"`, `hidden`), `.menu-search-cancel`
(`onclick="closeMenuSearch()"`). **Never opened** — `toggleMenuSearch()` now opens the full-screen
search page instead. The functions are kept for "old callers". Must be ported as inert markup.

### 3.5 Restaurant header card — L143–167
`.res-card` > `.res-card-body`:
- `.ew-res-head` grid: `.ew-res-head-main` (`.ew-name-row` with `#res-name` `<h1>Loading…</h1>` +
  `#res-verified` verified-badge SVG; `#res-cuisine` `<p>`; `#res-distance`; `#res-time`)
  and `.ew-hd-rbox` (`#res-rating-pill` with `#res-rating-num` + star SVG, `#res-rating-count`).
- `#res-offer-banner.offer-strip` with `.offer-icon` (tag icon) and `#res-offer-text`.

Filled by `renderRestaurantHeader()` (L1138–1251).

### 3.6 Delivery strip + order hint — L168–194
`.delivery-strip`: `.delivery-banner-line` (two `<span>`s), `.delivery-copy` > `.del-chip#res-free-delivery`
(motorcycle icon + "FREE delivery above ₹199"), `.delivery-rider` with
`#delivery-rider-image` (`hidden`, `referrerpolicy=no-referrer`) and `#delivery-rider-fallback`
(inline SVG scooter, uses `var(--hd-primary,#E9546B)`), and `#order-hint[hidden]`.

### 3.7 Menu/Info tabs — L196–199
`#res-tabs.menu-tabs[role=tablist]` with `#res-tab-menu` (`onclick="switchResTab('menu');"`, `active`,
`aria-selected=true`, `aria-controls="menu-pane"`) and `#res-tab-info`
(`onclick="switchResTab('info');"`, `aria-controls="info-pane"`).
A `.menu-tab-indicator` span is **injected** by `initResTabGestures()` (L2968) plus
`tabs.classList.add('has-indicator')`.

### 3.8 Category nav + sentinel — L200–201
`#cat-nav-sentinel.cat-nav-sentinel` and `#cat-nav.cat-nav[aria-hidden=true]` >
`#cat-nav-inner.cat-nav-inner`. Pills are generated in `renderMenu()`; the strip shows/hides via
the `sentinelObs` IntersectionObserver (L370–375).

### 3.9 Menu pane — L202–264
- **Quick filter bar** L203–210: `.filter-bar.ew-menu-quick-filters#restaurant-filter-bar` >
  `.ew-filter-chip-row#quick-filter-row` with `#filter-popular` (`onclick="toggleMenuQuickFilter('popular')"`),
  `#filter-rating` (`'rating'`), `#filter-price` (`'price'`), `#filter-veg` (`onclick="toggleFilter('veg')"`,
  `.veg-chip.veg-type.ew-filter-chip.diet-chip` + `.veg-dot-icon`),
  `#filter-nonveg` (`onclick="toggleFilter('nonveg')"`, `.veg-chip.nonveg-type…`).
  The advanced-filter button and the filter sheet are **absent** from this page (see §7).
- **Menu skeleton** L213–233: `#menu-skeleton` with one 20 px bar and two `.skel-item` blocks
  (`.skel-left` + `.skel-media > .skeleton.skel-img`).
- **Menu container** L234: `#menu-container[style="display:none"]`.
- **Empty-filter message** L235–241: `#empty-filter-msg` > `#empty-filter-icon`
  (`fa-sliders`), `#empty-filter-title`, `#empty-filter-sub`,
  `#empty-filter-clear[hidden]` (`onclick="resetAllMenuFilters()"`).
- **Menu footer** L242–263: `footer.rmf#menu-footer` — `.rmf-legend` (two `.rmf-key` with
  `.ss-veg.is-veg` / `.ss-veg.is-nonveg`), `.rmf-title` "Good to know", 4 `.rmf-row` items
  (prices/photos/allergies/nutrition), `.rmf-info` (`onclick="switchResTab('info');window.scrollTo({top:0,behavior:'smooth'})"`),
  `#rmf-fssai[hidden]`, `.rmf-brand` "Eatswada". Reveal animation is an IIFE at L2589–2597.
- `</div>` for `.menu-section` L264.

### 3.10 Info pane — L265–278
`#info-pane.res-pane[hidden][role=tabpanel]` > `.menu-section` >
`#info-skeleton.info-skeleton` (7 skeleton bars) and `#info-content[style="display:none"]`.
Content is produced by `renderRestaurantInfo()` (L913–1044) and includes, in order: hero
(`.inf-hero`), address, opening hours `<details>`, services, FSSAI, then the reviews section
`#ew-customer-reviews` with `#ew-customer-reviews-summary`, `#ew-customer-reviews-status`,
`#ew-customer-reviews-list`, `#ew-customer-reviews-more[hidden]`.

### 3.11 Main inline script — L313–3107
See §4 for the per-function breakdown. Sub-sections:

| L | Block |
|---|---|
| 313–319 | top-level `let activeFilter`, `let isRestaurantOpen`, `let currentResId` |
| 321–334 | `formatTime` |
| 336–364 | `toggleFilter`, `syncQuickChips`, `applyFilter` |
| 366–409 | `catNav`/`sentinel`/`menuSec` consts, `sentinelObs`, `setupScrollSpy`, `scrollToCategory` |
| 411–475 | `ewAutoScrollIntoMenu` (the "landing glide") |
| 477–595 | `jsArg`, `getCustomizedCartQuantity`, `refreshCustomizedCartQuantities`, `window.ewRemoveCustomizedCartUnit`, `window.ewVerifiedOriginal` |
| 601–659 | `window.makeBtnHTML`, `notifyItemUnavailable` |
| 661–704 | `normalizeMenu`, `cuisineText` |
| 705–764 | `setMetaChip`, `selectedCustomerCoords`, `restaurantCoords`, `distanceKm`, `formatRestaurantDistance` |
| 766–831 | `switchResTab` + tab state |
| 822–911 | `restaurantTimeStr`, `FSSAI_LOGO_SRC`, `ewFssaiNumber/HTML/FillFssai`, `infoTime`, `infoSvc`, `shareRestaurantInfo` |
| 913–1044 | `renderRestaurantInfo` |
| 1046–1121 | `ewReviewState`, `renderRestaurantReviews`, `loadRestaurantReviews`, the `#ew-customer-reviews-more` click delegate |
| 1123–1127 | `openRestaurantDetails` (now just `switchResTab('info')`) |
| 1129–1136 | `toggleRestaurantFavorite` |
| 1138–1251 | `renderRestaurantHeader` |
| 1253–1286 | `renderClosedWarning` |
| 1288–1298 | `formatCompactCount` |
| 1300–1456 | `renderMenu` |
| 1458–1501 | `MENU_IMAGE_REJECT`, `resolveMenuImage`, `categoryDomId`, `escapeMenuHtml`, `syncVegFilterAvailability` |
| 1503–1606 | `loadRestaurantPage`, `showMenuSkeleton`, `showEmptyMenuState`, `showErrorState` |
| 1608–1739 | filter-sheet block (`sheetDraft`, `sheetApplied`, `filterMenuItems`, `itemDiet`, `isHighlyReordered`, `previewFilterCount`, `activeSheetCount`, `updateFilterBadge`, `syncSheetOptions`, `openFilterSheet`, `closeFilterSheet`, `setDraftSort`, `setDraftDiet`, `toggleDraftReordered`, `clearAllFilters`, `applySheetFilters`) — **markup absent, see §7** |
| 1741–1925 | `menuSearchQuery`, `quickMenuFilters`, `toggleMenuQuickFilter`, `ewChipFeedback`, `applyFiltersAnimated`, `resetAllMenuFilters`, `isPopularMenuItem`, `itemPrice`, `itemRating`, `itemSearchText`, `applyAllMenuFilters`, `updateMenuEmptyState`, `openRestaurantSearchPage` |
| 1927–2397 | the full-screen menu search page (`ss*` — see §3.12) |
| 2399–2587 | the dish detail sheet (`ds*` — see §3.13) |
| 2589–2597 | menu-footer reveal IIFE |
| 2599–2684 | sticky search bar IIFE (`#ew-sticky-search`) |
| 2686–2790 | `ewOpenSearch`, `ewCloseSearch`, `ssFinishClose`, `ssGoCategory`, `toggleMenuSearch`, `openMenuSearch`, `closeMenuSearch`, `syncSearchClearButton`, `onMenuSearchInput`, `clearMenuSearch` |
| 2791–2950 | `currentRestaurant`, `firstPositiveNumber`, `money`, `cartSubtotalForRestaurant`, free-delivery state + `showFreeDeliveryCongratulations`, `getFreeDeliveryThreshold`, `checkFreeDeliveryCrossed`, `renderOrderHint`, `hookCartUpdates` IIFE |
| 2952–2959 | Escape-key handler |
| 2961 | `document.addEventListener('DOMContentLoaded', loadRestaurantPage)` |
| 2963–3096 | `initResTabGestures` IIFE (swipe + sliding underline + arrow keys) |
| 3098–3102 | `toggleCategory` |

### 3.12 Full-screen menu search page (`ss*`) — L1927–2397
A `#ss-root` dialog built on demand (`ssBuild`), `.ss-top` with back button, `#ss-input`,
`.ss-clear`, and a `.ss-diet` group with two `.ss-diet-chip[data-diet]` buttons; `#ss-body` for
results. Idle state = recent searches (`ssRecentKey`, 5 max) + "Popular dishes" + "Browse the
menu"; results state = ranked cards with `<mark class="ss-hl">` highlighting; empty state =
"Bestsellers you might like" or "Popular dishes" or categories.
Search is **client-side over `window.__ewSearchData`** — no API call. Ranking:
starts-with (0) < word-start (1) < contains (2) < category/desc (3) < fuzzy-name (4) <
fuzzy-rest (5); whole-phrase prefix scores −1; exact pass first, fuzzy fallback (Damerau-ish
`ssDist`, 1 slip for 4–7 letters, 2 for 8+). `ssHook` wraps `updateCart`/`updateGlobalCart`/
`ewRemoveCustomizedCartUnit` to refresh CTAs (rAF + 250 ms debounce).
CSS: `css/restaurant-search-page.css`.

### 3.13 Dish detail sheet (`ds*`) — L2399–2587
`#ds-root` (`.ds` with `.ds-bd` backdrop + `.ds-sheet` dialog) built on demand. Opens when a
dish row (or a search-result card) is tapped and the target is not a `button/a/input/.nb-item-cta/.ss-cta/.ds`.
Hero image at width 720 with `.ds-skel` shimmer, badge/name/price/desc, `.ds-cta` = the same
`ssCtaHTML` button. `history.pushState({ewDish:true})` so Back closes it; `popstate` handler;
Escape closes; drag-the-handle-down (>90 px) closes. `dsHook` mirrors `ssHook`.
CSS: `css/restaurant-search-page.css` + `css/ew-sheet.css`.

### 3.14 Sticky search bar — L2599–2684
Builds `#ew-sticky-search.tsb` (appended to `<body>`) with `.tsb-back.ew-hd-circle` (back SVG) and
`.tsp` (`.tsp-text`). It appears when `#res-name` scrolls off the top
(`IntersectionObserver` with `boundingClientRect.bottom < 0`), adds `body.ew-tsb-on`, and rotates
the pill text every 2800 ms through up to 12 dish names (badge/bestseller first, deduped, ≤28 chars,
in-stock only), `Search "biryani"` → `Search "chicken tikka"` …, with `.tsp-line.is-in/.is-out`
animation. `visibilitychange` pauses/resumes the timer. CSS: `css/restaurant-search-page.css`.

### 3.15 Order hint + free delivery — L2791–2950
`#order-hint` shows "Minimum order ₹X · **Add ₹Y more**" (`.is-short`) or
"Add **₹Y more** for FREE delivery". `cartSubtotalForRestaurant()` reads `nearbite_cart`
**read-only**, filters entries whose `restaurantId|resId|restaurant|rId` ≠ `currentResId`, sums
`price × quantity`, returns `null` unless at least one priced entry was seen.
`hookCartUpdates` wraps `window.updateCart` (guard `__ewHinted`) to compute before/after subtotals,
call `checkFreeDeliveryCrossed` (which fires `showFreeDeliveryCongratulations` when the threshold is
crossed upward) and `renderOrderHint`, then `refreshCustomizedCartQuantities()`.

### 3.16 Customization sheet — L3110–3302
IIFE. `build()` creates `#ewcs-backdrop` (`z-index:100050`) and `#ewcs-sheet` (`z-index:100051`),
both `position:fixed` and positioned **by inline style**, not by CSS, to sit above the cart bar.
Sheet markup: `.ewcs-handle`, `.ewcs-head` (`.ewcs-htitle` > `.ewcs-vegdot` + `#ewcs-title`,
`#ewcs-close`), `#ewcs-body`, `.ewcs-foot` (`.ewcs-qty` > `#ewcs-minus`, `#ewcs-qty`,
`#ewcs-plus`; `#ewcs-add`).
`window.ewOpenCustomize(id)` reads `window.__ewCust[id]`; renders each group with
`data-gi/-max/-required/-multi/-pricing-mode/-title`; radio for single-select, checkbox for
multi; `pricingMode==='portion'` shows an absolute price and forbids multi-select.
`refresh()` recomputes the unit price (`portionPrice ?? base.price + Σ extra`), enforces
`maxSelect` by disabling unchecked boxes, and disables `#ewcs-add` until every required group is
satisfied. `confirmAdd()` builds `compositeName = name + ' (' + labels.join(', ') + ')'`, writes
the cart **directly to `localStorage['nearbite_cart']`** (incrementing an existing composite key or
creating one with `{quantity, price, originalPrice, resId, menuItem, image, name, isVeg,
restaurantName, customizations:[{title,label,extraPrice,pricingMode,isVeg}]}`), then calls
`window.updateGlobalCart()`, `refreshCustomizedCartQuantities('up')`, `close()`, and finally
`checkFreeDeliveryCrossed(before, after)` + `renderOrderHint()`.
Quantity is clamped to 1…20. `.ewcs-*` styles: `css/legacy-inline.css` (44 rules) overridden by
`css/ew-sheet.css` (16 rules).

### 3.17 `js/pairing-suggestions.js` — L3304
Wraps `window.updateCart` (guard `__ewPair`) and `window.refreshCustomizedCartQuantities`
(guard). On the **first** add to an **empty** cart, inserts `.ew-pair` right after the added
`.menu-item[data-menu-item-id]` with up to 6 suggestions (min 2 to show) chosen by a
`KINDS`/`WANT`/`PAIRS` heuristic (veg items never suggest non-veg; items already in the cart are
excluded; same-base-key variants excluded; "keep a mix" penalty). Cards use
`.ew-pair-card/-img/-name/-price/-act`, `.ew-pair-add`, `.ew-pair-step`, `.ew-pair-veg`,
`.ew-pair-close`. Strip is removed when the item reaches 0 or another item is added.
Adds `touchstart/move/end` `stopPropagation` so the pane-swipe handler does not see it.
Reads: `nearbite_cart`; `window.__ewMenuGroups`; `window.__ewCust`; bare global `isRestaurantOpen`;
`window.currentResId` (**undefined** — falls back to the URL `id`); `window.resolveMenuImage`
(**undefined** — uses the raw URL); `window.escapeMenuHtml` (**undefined** — uses its own `esc`).
Dispatches nothing. CSS: `css/pairing-suggestions.css`.

### 3.18 `js/menu-jump.js` — L3305
Floating "Menu" button (`#ew-mj-btn`, 44 px, bottom-right) + `#ew-mj-backdrop` + `#ew-mj-sheet`
with `#ew-mj-list`. Injects its own `<style id="ew-mj-style">`. Reads categories fresh from
`#menu-container .menu-cat-group` (skips groups hidden by a filter), shows item counts, marks the
current one active (140 px line), and jumps on tap.
It calls `window.toggleCategory` and `window.scrollToCategory` **guarded by
`typeof … === 'function'`** — but the main script declares them as top-level `function`s, which are
**not** `window` properties, so both guards are false and menu-jump falls back to its own
`window.scrollTo(... -116)`. It also will not expand a collapsed category. `lift()` keeps the
button above `#white-cart-root` / `#order-hint`. Hides itself when
`body.ewcs-custom-open` / `body.menu-search-open`, and when the Info tab is showing.
CSS is self-injected; `css/…` has no file for `.ew-mj-*`.

### 3.19 Things that are referenced but not present

**Never created anywhere** (so these branches are dead on this page):

`#top-res-name`, `#review-tab-count` (read in `renderRestaurantHeader`, L1145/L1148 — no-op);
`#filter-count-badge`, `#apply-filter-btn`, `#apply-filter-count`, `.sheet-option`,
`#filter-sheet-backdrop` (the whole filter sheet — see §7.1).

**Created at runtime by this page's own script** (must exist before the first read, and must be
removed again by React on unmount in the port):

`#ss-root`, `#ss-body`, `#ss-input` (search page); `#ds-root` (dish sheet);
`#ew-sticky-search` (sticky bar); `#ewcs-sheet`, `#ewcs-backdrop`, `#ewcs-title`, `#ewcs-body`,
`#ewcs-qty`, `#ewcs-add`, `#ewcs-close`, `#ewcs-minus`, `#ewcs-plus` (customize sheet);
`#ew-customer-reviews-summary`, `#ew-customer-reviews-status`, `#ew-customer-reviews-list`,
`#ew-customer-reviews-more` (Info tab); `#menu-retry-btn` (error state);
`#ew-mj-btn`, `#ew-mj-backdrop`, `#ew-mj-sheet`, `#ew-mj-list`, `<style id="ew-mj-style">`
(menu-jump).

**Created by a dependency**: `#white-cart-root` (+ `#wc-styles`, the whole `wc-*` tree) —
injected by `cart-bar.js` / `components/CartBar.tsx`.

**Missing asset**: `assets/fssai-logo.png` — the `assets/` directory does not exist.
`FSSAI_LOGO_SRC` is a non-empty string, so `ewFssaiHTML` always emits the `<img>`, which always
fails and hides itself (`onerror="this.hidden=true"`). Only the licence number ever renders.

---

## 4. Per-section inventory (functions, API, storage, events, globals, third parties)

### 4.1 Functions defined (main script + customize IIFE + the two external files)

`formatTime`, `toggleFilter`, `syncQuickChips`, `applyFilter`, `setupScrollSpy`,
`scrollToCategory`, `ewAutoScrollIntoMenu`, `jsArg`, `getCustomizedCartQuantity`,
`refreshCustomizedCartQuantities`, `notifyItemUnavailable`, `normalizeMenu`, `cuisineText`,
`setMetaChip`, `selectedCustomerCoords`, `restaurantCoords`, `distanceKm`,
`formatRestaurantDistance`, `switchResTab`, `restaurantTimeStr`, `infoTime`, `infoSvc`,
`shareRestaurantInfo`, `renderRestaurantInfo`, `renderRestaurantReviews`,
`loadRestaurantReviews`, `openRestaurantDetails`, `toggleRestaurantFavorite`,
`renderRestaurantHeader`, `renderClosedWarning`, `formatCompactCount`, `renderMenu`,
`resolveMenuImage`, `categoryDomId`, `escapeMenuHtml`, `syncVegFilterAvailability`,
`loadRestaurantPage`, `showMenuSkeleton`, `showEmptyMenuState`, `showErrorState`,
`filterMenuItems`, `itemDiet`, `isHighlyReordered`, `previewFilterCount`, `activeSheetCount`,
`updateFilterBadge`, `syncSheetOptions`, `openFilterSheet`, `closeFilterSheet`, `setDraftSort`,
`setDraftDiet`, `toggleDraftReordered`, `clearAllFilters`, `applySheetFilters`,
`toggleMenuQuickFilter`, `ewChipFeedback`, `applyFiltersAnimated`, `resetAllMenuFilters`,
`isPopularMenuItem`, `itemPrice`, `itemRating`, `itemSearchText`, `applyAllMenuFilters`,
`updateMenuEmptyState`, `openRestaurantSearchPage`, `ssIsOpen`, `ssNorm`, `ssRecentKey`,
`ssGetRecent`, `ssSaveRecent`, `ssClearRecent`, `ssLoadItems`, `ssWords`, `ssDist`, `ssFuzzyWord`,
`ssVisible`, `ssSearch`, `ssHighlight`, `ssSetDiet`, `ssCartQty`, `ssCtaHTML`, `ssThumb`,
`ssVegMark`, `ssCardHTML`, `ssRecentHTML`, `ssPopHTML`, `ssBestHTML`, `ssCatsHTML`, `ssIdleHTML`,
`ssRender`, `ssSetQuery`, `ssBuild`, `ssHook`, `ssScheduleRefresh`, `ssRefreshCtas`, `dsFindById`,
`dsMakeEntry`, `dsHTML`, `dsBuild`, `dsHook`, `dsScheduleRefresh`, `dsRefreshCta`, `dsOpenSheet`,
`dsClose`, `dsFinish`, `ewOpenSearch`, `ewCloseSearch`, `ssFinishClose`, `ssGoCategory`,
`toggleMenuSearch`, `openMenuSearch`, `closeMenuSearch`, `syncSearchClearButton`,
`onMenuSearchInput`, `clearMenuSearch`, `firstPositiveNumber`, `cartSubtotalForRestaurant`,
`showFreeDeliveryCongratulations`, `getFreeDeliveryThreshold`, `checkFreeDeliveryCrossed`,
`renderOrderHint`, `toggleCategory`; plus `build`, `animateQty`, `refresh`, `confirmAdd`, `close`
inside the customize IIFE; plus the whole of `pairing-suggestions.js` and `menu-jump.js`.

### 4.2 API calls (all GET, no body, `cache: 'no-store'`, 12 s timeout via `api.js`)

| # | Method | Path | Called from | Notes |
|---|---|---|---|---|
| 1 | GET | `/restaurants/:id` | `loadRestaurantPage` L1515 via `window.API.getObject(window.API.routes.restaurant(resId))` | `getObject` = `request().then(asObject)` → throws on a non-object `data`. |
| 2 | GET | `/restaurants/:id/menu` | `loadRestaurantPage` L1516 via `window.API.request(window.API.routes.restaurantMenu(resId))` | raw payload; unwrapped with `window.API.unwrap()` then `normalizeMenu()`. |
| 3 | GET | `/restaurants/:id/reviews?page=N&limit=5` | `loadRestaurantReviews` L1094 | raw `window.API.request`; requires `payload.success === true` **and** `Array.isArray(payload.data)`; reads `page`, `pages`, `total`, `summary`. Fired only when the Info tab first renders. |

Both 1 and 2 are issued **in parallel** (`Promise.all`). There is **no POST/PUT/PATCH/DELETE and no
`fetch()`** anywhere in the page or in `cart-bar.js`. `api.js` is the only network layer.

Verified live (GET only) on `6ac8f95828669b5f4e30f0ba`:
- `/restaurants/:id` → 200, `{success, data}`; `data` has **64 fields**;
  `_id`, `id`, `name`, `slug`, `cuisine[]`, `cuisineDisplay`, `description`, `address`, `phone`,
  `image`, `images[]`, `isActive`, `approvalStatus`, `availability{isOpen,status,opensAt,closedReason,…}`,
  `isOpen`, `openingHours{monday…sunday{closed,opensAt,closesAt}}`, `opensAt`, `closesAt`,
  `operational`, `businessType`, `categories[]`, `deliveryFee`, `deliveryMode`, `deliveryRadiusKm`,
  `freeDeliveryAbove`, `freeDeliveryEnabled`, `codEnabled`, `minOrder`, `distance`,
  `distanceMeters`, `estimatedDeliveryMin`, `estimatedDeliveryMax`, `time`, `rating`,
  `ratingCount`, `reviewCount`, `totalOrders`, `location{type,coordinates[lng,lat]}`,
  `offer`, `deliveryBannerImage`, `fssaiLicenseNumber`, `fssaiVerificationStatus`,
  `fssaiCertificateUrl`, `fssaiExpiryDate`, `homeOrder`, `displayPriority`, `isVeg`,
  `isBestSeller`, `isFeatured`, `isNearFast`, `maxActiveOrders`, `commissionPlan`,
  `commissionRate`, `settlementSchedule`, `owner`, `createdAt`, `updatedAt`, `__v`.
- `/restaurants/:id/menu` → 200, `{success, count, data}`; `data` is a **dict of group → item[]**
  (5 groups / 37 items for this id). Item fields: `_id`, `name`, `price`, `originalPrice`,
  `description`, `image`, `category`, `isVeg`, `inStock`, `trackStock`, `stockQuantity`,
  `lowStockThreshold`, `pausedUntil`, `isActive`, `approvalStatus`, `isBestseller`,
  `isRecommended`, `isUnder99`, `customizations[]`, `sortOrder`, `restaurantId`, `createdBy`,
  `reviewedBy`, `reviewedAt`, `rejectionReason`, `createdAt`, `updatedAt`, `__v`.
- `/restaurants/:id/reviews?page=1&limit=5` → 200, `{success, summary, page, pages, total, data}`;
  `summary = {rating, ratingCount, reviewCount, breakdown{1..5}}`. For this id: `pages 0`,
  `total 0`, `data []`.

**Important:** `renderRestaurantHeader` reads `restaurant.estimatedDeliveryMin/Max`, `area`,
`locality`, `neighbourhood`, `neighborhood`, `time`, `costForOne`, `priceForOne`,
`averageCostForOne`, `costPerPerson`, `minimumOrder`, `minOrder`, `minimumOrderAmount`,
`minOrderValue`, `freeDeliveryThreshold`, `freeDeliveryMinimum`, `freeDeliveryMinOrder`,
`offerText`, `verified`, `_id`. The live payload has only some of them (`minOrder` yes;
`area`/`costForOne`/`minimumOrder`/`freeDeliveryThreshold` absent) — the code is defensive and
falls back to `''`/hidden. Do **not** "fix" the fallbacks.

### 4.3 `localStorage` / `sessionStorage`

**Written by this page**
| Key | Where | Value |
|---|---|---|
| `nearbite_cart` | customize IIFE `confirmAdd` (L3266) and `window.ewRemoveCustomizedCartUnit` (via `window.updateCart`) | `{ [lineKey]: {quantity, price, originalPrice, resId, menuItem, image, name, isVeg, restaurantName, customizations[]} }` |
| `ew_menu_recent_<resId>` | `ssSaveRecent` / `ssClearRecent` (L1947/L1956) | JSON array of ≤5 query strings, newest first, deduped case-insensitively, min length 2 |

**Read only**
| Key | Where |
|---|---|
| `nearbite_cart` | `getCustomizedCartQuantity`, `ewRemoveCustomizedCartUnit`, `renderMenu` (initial quantities), `ssCartQty`, `cartSubtotalForRestaurant` |
| `nearbite_address` | `selectedCustomerCoords()` — reads `address.location.coordinates` `[lng, lat]` |
| `eatswada_theme`, `eatswada_header_theme` | the pre-paint snippet (already in `app/layout.tsx`) |

**Written by dependencies** (not this page): `nearbite_cart`, `es_image_dict`,
`nearbite_checkout_key`, `nearbite_checkout_fp`, `nearbite_checkout_fp_ts` (`cart-bar.js`);
`eatswada_theme`, `eatswada_theme_intro_pending` (`eatswada-theme.js`);
`eatswada_header_theme` (`eatswada-header-theme.js`).

No `sessionStorage` use at all on this page. `api.js`'s `CacheStore` uses sessionStorage but this
page never calls `API.cache`/`getList`.

### 4.4 Custom events

**Dispatched** (all by dependencies): `eatswada:cart-updated` (`cart-bar.js` `saveCart`/`clearCart`),
`eatswada:themechange`, `eatswada:headerthemechange`, `eatswada:address-state`,
`nearbite:address-changed`, `eatswada:favorites-changed`.

**Listened to on this page:** none of the custom events. The page listens to DOM events only:
`click` (delegated: reviews "Load more" L1117, dish-row tap L2570, pairing strip L~200,
menu-jump list), `input`/`keydown` (`#ss-input`), `touchstart/move/end/cancel` (dish sheet drag,
pane swipe, pairing strip), `popstate` (dish sheet L2567, search page L2741), `keydown` (Escape
L2952, tab arrows L3092), `DOMContentLoaded` (L2961), `resize`/`load`/`visibilitychange` (tab
indicator, sticky bar, menu-jump), `storage` (pairing snapshot, cart-bar).

The page therefore **never learns about a cart change by event** — it either wraps
`window.updateCart` or is called explicitly.

### 4.5 Globals

**Defined (`window.*`)** — `optimizedImageUrl` (only if absent — `safe-html.js` defines it first
in legacy; `lib/safe-html.ts` must win), `ewLoadVisibleImages`, `ewRemoveCustomizedCartUnit`,
`ewVerifiedOriginal`, `makeBtnHTML`, `ewFssaiNumber`, `ewFssaiHTML`, `ewFillFssai`,
`openRestaurantSearchPage`, `ewSyncTabIndicator`, `ewOpenCustomize`.

**Also on `window` — every top-level `function` declaration (CORRECTION, measured).** The main
script is a classic (non-module) `<script>`, so *all* of its top-level `function` declarations
become `window` properties, exactly like the explicit `window.X =` assignments. Measured with the
API held so the page stays on the skeleton:

```
typeof window.makeBtnHTML / normalizeMenu / escapeMenuHtml / resolveMenuImage /
       scrollToCategory / toggleCategory / switchResTab / renderRestaurantHeader /
       loadRestaurantReviews / formatTime / setMetaChip / … === "function"
```

So the earlier claim in this section (and §7 item 4) — that the functions are lexical bindings
only and that `pairing-suggestions.js` / `menu-jump.js` guards therefore fail — is **WRONG**. Those
guards **succeed** on the real page.

**Defined as global *lexical* bindings only** (top-level `let`/`const` — visible to other scripts
by bare name, **not** on `window`; measured: `typeof window.X === "undefined"` while
`typeof X` is `"string"`/`"boolean"`/`"object"`): `activeFilter`, `isRestaurantOpen`,
`currentResId`, `catNav`, `sentinel`, `menuSec`, `sentinelObs`, `ewAutoScrolled`, `sheetDraft`,
`sheetApplied`, `menuSearchQuery`, `quickMenuFilters`, `ewFilterSkelTimer`, `activeResTab`,
`infoRenderedFor`, `menuScrollY`, `FSSAI_LOGO_SRC`, `ewReviewState`, `MENU_IMAGE_REJECT`,
`currentRestaurant`, `freeDeliveryUnlockState`, `freeDeliveryToastTimer`, `money`, `ss*`/`ds*`
state.

This distinction matters: `pairing-suggestions.js` reads the bare global `isRestaurantOpen` (works)
**and** `window.currentResId`, `window.resolveMenuImage`, `window.escapeMenuHtml` (all `undefined`
— those are `let`/`function`… careful: `resolveMenuImage`/`escapeMenuHtml` are `function`s, so they
ARE on `window` and the guards succeed; only `currentResId` is `undefined`). `menu-jump.js` reads
`window.toggleCategory` / `window.scrollToCategory` — both are `function`s, so both succeed.
**The port must reproduce these exact behaviours** — do not "improve" them. Practical route: keep
the functions as module-scope exports and expose the same names on `window` as legacy did (the 11
explicit ones **plus every top-level `function`**), and let the ported pairing/menu-jump modules
use their own fallbacks exactly as legacy did.

**Read**: `window.API` (+ `.routes`, `.unwrap`, `.getObject`, `.request`), `window.CONFIG.BRAND_NAME`,
`window.updateCart`, `window.updateGlobalCart`, `window.nearbiteSafeBack`, `window.__ewCust`,
`window.__ewMenuGroups`, `window.__ewSearchData`, `window.matchMedia`,
`window.performance.getEntriesByType`, `navigator.share`, `navigator.clipboard`,
`document.fonts.ready`, `history.pushState/back/state`.

**Set for other scripts**: `window.__ewSearchData = {groups, resId}` (L1303, read by ss/ds and the
sticky bar), `window.__ewMenuGroups = groups` (L1529, read by pairing), `window.__ewCust[item._id]`
(L~1370, read by makeBtnHTML / ss / ds / pairing / customize).

### 4.6 Third-party scripts

Only **Dark Reader 4.9.133** (CDN, defer, SRI) — already handled in `app/layout.tsx`. No Razorpay,
Firebase, Leaflet or MapTiler on this page. Font Awesome and Google Fonts are the only other
third parties (CSS only).

---

## 5. What is already ported and reused vs new

### Reused as-is (do not touch)

| Legacy | Ported | Used here for |
|---|---|---|
| `eatswada-theme.js` | `lib/theme.ts`, `components/ShellRuntime.tsx` | `data-ew-theme`, dark mode |
| `eatswada-header-theme.js` | `lib/header-theme.ts` | `--hd-*` tokens, `--hd-primary` (used by the delivery rider SVG and the pairing strip) |
| `config.js` | `lib/config.ts` | `CONFIG.BRAND_NAME` |
| `safe-html.js` | `lib/safe-html.ts` | `escapeHtml`, `optimizedImageUrl`, `ewFoodPlaceholder` |
| `api.js` | `lib/api.ts` | all 3 GETs |
| `navigation.js` | `lib/navigation.ts` | `nearbiteSafeBack`, fetch timeout, SW registration |
| `cart-bar.js` | `lib/cart.ts` + `components/CartBar.tsx` | `window.updateCart`, `window.updateGlobalCart`, `nearbite_cart`, `es_image_dict`, `#white-cart-root`, `wc-*` markup, clear-cart flow, multi-restaurant drawer |
| `search-overlay.js` | `lib/search-overlay.ts` | loaded (injects `search-overlay.css`); not opened by this page |
| `favorites.js` | `lib/favorites.ts` | **available but unused** — see §7 |
| `address-store.js` | `lib/address-store.ts` | **available but unused** — the page reads `nearbite_address` raw |
| `restaurant-card.js` | `lib/restaurant-card.ts` | **not loaded here** |

`getCartBarMode('/restaurant…')` → `'pink'` (the `path.includes('restaurant')` branch in
`lib/cart.ts`), which is what this page needs. Verified by reading the ported function.

### New work (nothing exists yet)

1. `web/app/restaurant-shell/page.tsx` — the static shell (markup L115–278) + CSS imports + metadata.
2. `web/app/restaurant-shell/RestaurantShellRuntime.tsx` (`"use client"`) — installs the ported
   modules in legacy script order.
3. `web/lib/restaurant-shell*.ts` — the ported main script (see §6).
4. `web/lib/restaurant-customize.ts` — the customize-sheet IIFE (L3110–3302).
5. `web/lib/pairing-suggestions.ts` — port of `js/pairing-suggestions.js`.
6. `web/lib/menu-jump.ts` — port of `js/menu-jump.js`.
7. `web/styles/legacy/restaurant-shell-inline-1.css` and `…-inline-2.css` — the two inline `<style>`
   blocks, byte-for-byte.
8. `web/app/restaurant/page.tsx` + the `/restaurant` SEO layer (`app/api/restaurant-seo/route.ts`
   or an equivalent server component with `generateMetadata`) — §1.2.
9. `web/scripts/fixtures/restaurant-shell.json` — the GET fixtures (§8).
10. `web/next.config.js` — append `"/restaurant-shell"` (and, when the SEO layer is ready,
    `/restaurant`) to `PORTED_PAGES`.

**Cart-bar interplay is the one integration risk**: `CartBar.tsx` is a React component rendered by
the page; it installs `window.updateCart`/`window.updateGlobalCart` in an effect and renders
`#white-cart-root` through a portal. The ported page script calls those globals, so the runtime
component must run **after** `CartBar` has mounted (or the calls must be guarded with
`typeof === 'function'`, which the legacy code already does in most places — but **not** in
`window.ewRemoveCustomizedCartUnit`, which warns and returns).

---

## 6. Proposed port order (12 chunks)

Rules: static shell + data loading first, then menu list, then add/stepper + cart write, then the
sheets, then the rest. Each chunk is one commit-sized step with its own compare run.

| # | Chunk | Legacy lines | Size | Risk | How it is tested |
|---|---|---|---|---|---|
| **1** | Head + CSS: page metadata, the 26 local CSS imports in §2.1 order, the two inline `<style>` blocks extracted to `restaurant-shell-inline-1/2.css`, static JSX for `head`-only concerns | 1–114 | ~114 | **low** | `npm run compare -- .../restaurant-shell.html .../restaurant-shell shell-head` — expect 0.00% on a page with no data (both pages show only skeletons). Confirms no CSS leak: visit `/under99` → `/restaurant-shell` → `/under99` and diff the second `/under99` against a fresh load. |
| **2** | Static body markup → JSX: toast, top bar, dead search row, res-card, delivery strip, tabs, cat-nav, both panes, menu skeleton, menu footer, info skeleton | 115–278 | ~164 | **low** | Compare at phone+desktop. Assert the rendered id set equals the **46 static ids** listed in §3.19, and that `#res-name` reads "Loading…", `#menu-container` is `display:none`, `#info-pane` is `hidden`. |
| **3** | Inline image helpers + page state + scroll plumbing: `optimizedImageUrl` fallback (must NOT override `lib/safe-html.ts`), `ewLoadVisibleImages`, `activeFilter`/`isRestaurantOpen`/`currentResId`, `formatTime`, `toggleFilter`/`syncQuickChips`/`applyFilter`, `catNav`/`sentinel`/`menuSec`/`sentinelObs`, `setupScrollSpy`, `scrollToCategory`, `ewAutoScrollIntoMenu` | 279–307 + 313–476 | ~193 | **low/medium** | Compare (still skeleton-only, so 0.00%). Unit-style check in the browser console: `typeof window.ewLoadVisibleImages === 'function'`, and that importing the module did not replace `optimizedImageUrl`. |
| **4** | Cart-write helpers + ADD/stepper + menu normaliser: `jsArg`, `getCustomizedCartQuantity`, `refreshCustomizedCartQuantities`, `window.ewRemoveCustomizedCartUnit`, `window.ewVerifiedOriginal`, `window.makeBtnHTML`, `notifyItemUnavailable`, `normalizeMenu`, `cuisineText`, `setMetaChip`, `selectedCustomerCoords`, `restaurantCoords`, `distanceKm`, `formatRestaurantDistance` | 477–764 | ~288 | **high** (money path) | `cart-parity`-style harness: with fixtures, click ADD on a plain item, +, −, −, and deep-compare `nearbite_cart` and the pink cart-bar text against legacy after every step. Also assert `makeBtnHTML` output string equals legacy byte-for-byte for (qty 0, qty 2, out-of-stock, closed restaurant, customisable). |
| **5** | Tabs + Info pane + reviews + header render: `switchResTab`, `restaurantTimeStr`, `FSSAI_LOGO_SRC`, `ewFssaiNumber/HTML/FillFssai`, `infoTime`, `infoSvc`, `shareRestaurantInfo`, `renderRestaurantInfo`, `ewReviewState`, `renderRestaurantReviews`, `loadRestaurantReviews`, the `#ew-customer-reviews-more` delegate, `openRestaurantDetails`, `toggleRestaurantFavorite`, `renderRestaurantHeader`, `renderClosedWarning`, `formatCompactCount` | 766–1299 | ~534 | **medium/high** | Compare with fixtures (still skeleton-only for the menu, but the header renders) → 0.00% phone+desktop. Click the Info tab: assert the pane swap, `.menu-tab-indicator` position, hours/services/address/FSSAI markup, and that `loadRestaurantReviews` fired exactly once with `?page=1&limit=5`. Negative cases: `rating:0`/`ratingCount:0` → "New" pill; `verified:false` → badge hidden; `freeDeliveryEnabled:false` → "Delivery available"; `isOpen:false` → `.closed-warning-card` before `.res-card` with the right variant. |
| **6** ✅ ported (`lib/restaurant-shell-menu.ts`) | `renderMenu` + item cards + `resolveMenuImage`/`categoryDomId`/`escapeMenuHtml`/`syncVegFilterAvailability` | 1300–1502 | ~203 | **high** | Compare with fixtures (menu visible) → target 0.00% phone+desktop. Assert the generated `#menu-container` innerHTML hash equals legacy's for the same fixture (the `animation-delay` values are index-derived and deterministic). Check `window.__ewSearchData`/`__ewMenuGroups`/`__ewCust` shapes. |
| **7** ✅ ported (`lib/restaurant-shell-menu.ts`) | Data loading + states + filter sheet + quick filters + in-menu search state + empty state: `loadRestaurantPage`, `showMenuSkeleton`, `showEmptyMenuState`, `showErrorState`, the `focusItem` scroll, the filter-sheet block, `toggleMenuQuickFilter`, `ewChipFeedback`, `applyFiltersAnimated`, `resetAllMenuFilters`, `isPopularMenuItem`, `itemPrice`, `itemRating`, `itemSearchText`, `applyAllMenuFilters`, `updateMenuEmptyState`, `openRestaurantSearchPage` | 1503–1926 | ~424 | **medium** | Compare with fixtures (0.00%). Negative cases: no `?id=` → error card with the exact message and no retry button; `/restaurants/:id` → 500 fixture → error card **with** "Try Again"; menu `data: {}` → "Menu not available". Fixture a `focusItem` id and assert the item gets `.ew-search-focus-item` then loses it. Click each of the 5 quick chips and assert `aria-pressed`, `.active`, `#empty-filter-msg` visibility and the `.cat-group-empty` collapse match legacy; `resetAllMenuFilters()` restores. Record that `#filter-count-badge`/`#apply-filter-btn` stay `null` on both pages (proof the sheet is dead here). |
| **8** | Full-screen menu search page (`ss*`): normaliser, ranking, highlighting, idle/recent/popular/categories, build/hook/refresh, `ewOpenSearch`/`ewCloseSearch`/`ssFinishClose`/`ssGoCategory` | 1927–2398 | ~472 | **medium/high** | Open search, type "dosa", "chiken" (typo), "zzz" (empty state), toggle Veg/Non-veg, tap a recent chip, tap a category; screenshot-diff `#ss-root` against legacy for each state (pixel compare of the overlay, not the whole page). Assert `ew_menu_recent_<id>` matches legacy after each query. Assert Back (popstate) closes it. |
| **9** | Dish detail sheet (`ds*`) + menu-footer reveal + sticky search bar | 2399–2685 | ~287 | **medium** | Tap a dish → `#ds-root` pixel-diff; Back closes; Escape closes; drag-down >90 px closes; tapping the ADD inside does not double-open. Sticky bar: scroll past `#res-name`, assert `body.ew-tsb-on`, the pill text rotates (2.8 s), and it hides on `body.ew-search-open`/`ew-dish-open`. Menu footer `.rmf-row` gets `.in`. |
| **10** | Legacy inline search row functions + order hint / free delivery + cart hook + Escape + boot + tab gestures + `toggleCategory` | 2686–3107 | ~422 | **high** (money path) | Order hint: with fixtures, add items until the subtotal crosses `freeDeliveryAbove`; assert the toast appears once, the hint text/`is-short` matches legacy, and `nearbite_cart` is untouched by the hint code. Tab gestures: swipe left/right on `#menu-pane`, assert the pane switch, the indicator position and the scroll restore. Escape closes search → sheet → inline row in that order. |
| **11** | Customization sheet IIFE → `lib/restaurant-customize.ts` | 3110–3302 | ~193 | **high** (cart write) | `cart-parity` harness step: open the sheet on a `customizations` item, pick options, set qty 3, Add; deep-compare `nearbite_cart` (normalising the `Date.now()` key discriminator — see MEMORY) and the pink bar total; then `−` on the menu card and compare again. Required-group gating: Add stays disabled until satisfied; `maxSelect` disables the extra boxes; `pricingMode:'portion'` shows an absolute price and forbids multi-select. |
| **12** | `js/pairing-suggestions.js` + `js/menu-jump.js` → `lib/pairing-suggestions.ts`, `lib/menu-jump.ts` | external files, 291 + 209 lines (17 598 B / 12 512 B) | ~500 | **medium** | Pairing: add the first item to an empty cart → the `.ew-pair` strip appears with the same card ids/order as legacy (deterministic given fixtures); add a second item → strip moves; drop to 0 → strip removed; confirm veg never suggests non-veg. Menu-jump: button appears after the menu renders (no scroll), the sheet lists the same categories+counts, tapping jumps with the 116 px offset, and the button lifts above `#white-cart-root`. Compare the whole page with fixtures at 0.00% after both are loaded. |

Chunks 6 & 7 are ported in `web/lib/restaurant-shell-menu.ts` (Phase 2c); the menu DOM is
byte-identical (innerHTML hash `1455951801:85892`). The chunks 6–7 compare residual
(`shell-answered`: phone 0.17% / desktop 0.03%) is entirely the not-yet-ported chunk 9 sticky bar
(`.tsb`) + chunk 12 menu-jump button (`#ew-mj-btn`) — hiding those two on both pages gives
0.000%. Note `loadRestaurantPage` also calls `renderOrderHint()` (chunk 10) and
`openRestaurantSearchPage` calls `toggleMenuSearch()` (chunk 10); both are guarded window lookups
until those chunks land.

Then: `next.config.js` gets `"/restaurant-shell"` in `PORTED_PAGES`; the `/restaurant` SEO layer is
a separate task (it needs `generateMetadata` + the shell fetch).

---

## 7. `TODO(question)` — things that look like dead code or that I do not understand

1. **`TODO(question)`: the whole advanced-filter sheet is dead on this page.** L1608–1739 define
   `openFilterSheet`, `closeFilterSheet`, `syncSheetOptions`, `applySheetFilters`,
   `setDraftSort/Diet`, `toggleDraftReordered`, `clearAllFilters`, `previewFilterCount`,
   `activeSheetCount`, `updateFilterBadge`, and the `sheetDraft`/`sheetApplied` state. But
   `restaurant-shell.html` has **no** `#advanced-filter-btn`, no `#filter-sheet-backdrop`, no
   `.sheet-option`, no `#apply-filter-btn`, no `#filter-count-badge`. `restaurant old.html`
   (the skip-listed copy) *does* have them (L148–L200). So on this page nothing ever calls
   `openFilterSheet()` and `applySheetFilters()` is unreachable. Consequence: the sheet's
   **sort** and **highly-reordered** filters can never be applied — only `sheetApplied.diet` (set
   by `toggleFilter`) and the three quick chips do anything. Port verbatim (parity) and keep the
   markup out. **Confirm with the owner** whether the sheet is intentionally dropped from the
   shell.
2. **`TODO(question)`: the heart is not wired to `Favorites`.** `toggleRestaurantFavorite()`
   (L1129) only flips `fa-solid`/`fa-regular` on `#restaurant-heart-icon` and sets
   `style.color`. It never reads/writes `eatswada_favorites` and `favorites.js` is not loaded.
   `lib/favorites.ts` exists, so the temptation is to wire it — **do not**, that changes behaviour.
   Confirm the heart is meant to be decorative on this page.
3. **`TODO(question)`: `assets/fssai-logo.png` does not exist.** `FSSAI_LOGO_SRC` is a
   non-empty string so `ewFssaiHTML` always emits the `<img>`, which always fails and hides
   itself (`onerror`). Only the licence number ever renders. Should the port ship the asset, or
   keep the dead reference for byte-parity? (Same question applies to `restaurant-details.html`.)
4. **`TODO(question)`: are the `window.*` reads in `pairing-suggestions.js` / `menu-jump.js`
   intended to succeed?** **CORRECTED (measured):** the main script is a classic `<script>`, so
   every top-level `function` declaration *is* a `window` property —
   `typeof window.makeBtnHTML / resolveMenuImage / escapeMenuHtml / toggleCategory /
   scrollToCategory / …` all return `"function"` on the real page, so the consumers' guards
   **succeed**. Only the top-level `let`/`const` bindings are *not* on `window`
   (`currentResId`, `isRestaurantOpen`, `activeFilter`, `activeResTab`, `ewReviewState`, …) — so
   `window.currentResId` is `undefined` and `pairing-suggestions.js` falls back to the URL `id`.
   The port therefore publishes the explicit `window.X =` names **and** every top-level
   `function` (see §4.5). Reproduce it exactly unless told otherwise.
5. **`TODO(question)`: the inline search row (L135–142) and its four functions are unreachable.**
   `toggleMenuSearch()` now calls `ewOpenSearch()`; `closeMenuSearch`/`onMenuSearchInput`/
   `clearMenuSearch`/`syncSearchClearButton` are only reachable from the hidden row. The Escape
   handler still calls `closeMenuSearch()` when the row is not hidden (never). Keep for parity.
6. **`TODO(question)`: `#top-res-name` and `#review-tab-count` are written but never exist.**
   Two dead branches in `renderRestaurantHeader` (L1145–1152). Keep the guards.
7. **`TODO(question)`: `openRestaurantDetails()` is dead.** It now only calls
   `switchResTab('info')`; nothing on the page calls it. `restaurant-details.html` and
   `restaurant-info.html` still exist as separate legacy pages and are *not* linked from the
   shell (`#menu-footer`'s `.rmf-info` button switches tabs instead). Should
   `/restaurant-details` and `/restaurant-info` still be ported as their own pages, or redirected
   into the shell's Info tab? (`restaurant-info.html` loads `js/restaurant-info.js` as a module —
   **that file does not exist in the repo**, so that page is broken today. `restaurant-details.html`
   is self-contained and does work.)
8. **`TODO(question)`: `css/ew-sheet.css` is linked but the shell's own sheets already define the
   `.ewcs-*`/`.ds-*` look.** `legacy-inline.css` has 44 `.ewcs-*` rules, `ew-sheet.css` 16 more
   (plus `.ds-*`, `.filter-sheet*`, `.apply-filter-btn`). Loaded last on purpose ("ONE look for
   every Eatswada popup"). Note that `ew-sheet.css` also styles `.filter-sheet*` /
   `.apply-filter-btn`, which are the *other* page's sheet — harmless here, but it means the file
   is shared and must stay in the same position.
9. **`TODO(question)`: `<meta name="view-transition" content="same-origin">` (L13) has no
   equivalent in `app/layout.tsx`.** Check whether Next 16.4.3 emits it; if not, decide whether to
   add it (it enables cross-document View Transitions in Chrome). No visual effect in the compare
   harness (headless Chromium, no cross-document navigation).
10. **`TODO(question)`: the `restaurantName` written into customized cart lines.** The customize
   IIFE tries `window.currentRestaurant.name` (undefined) and falls back to
   `#res-name`'s text. If the sheet is somehow opened before the header renders, `restaurantName`
   would be `''` or `"Loading…"`. I could not construct that case (the sheet only opens from a
   rendered card) but it is worth a defensive note in the port.
11. **`TODO(question)`: `search-overlay.js` is loaded but unreachable, and it re-injects
    `search-overlay.css` at runtime.** The stylesheet is already `<link>`ed at line 34, so it is
    loaded twice (browser dedupes by URL — but the runtime URL has a `?v=` query, so it is
    genuinely a second fetch). Legacy has this double-load; the port should too, or the
    stylesheet order differs. Confirm whether `installSearchOverlay()` should be called on this
    page at all.
12. **`TODO(question)`: `sw.js` precaches `./restaurant.html`, which does not exist.** Pre-existing
    issue noted in `notes/shared-map.md`; the shell is not in the precache list, so no action here.
13. **`TODO(question)`: `api/restaurant-seo.js` and `api/sitemap.js` each keep their own copy of
    `NEVER_INDEX_IDS`.** The port must keep both in sync; consider a single shared constant —
    but that is a behaviour-preserving refactor and should be confirmed first.

---

## 8. GET fixtures to record later (GET only, never POST to production)

To compare the page (and to run a cart-parity harness) the fixtures file
`web/scripts/fixtures/restaurant-shell.json` needs these keys — exactly the shape
`web/scripts/compare.mjs` expects (`path+query` relative to the API base, keyed by the string the
page requests):

| Fixture key | Method | Notes |
|---|---|---|
| `/restaurants/6ac8f95828669b5f4e30f0ba` | GET | the restaurant object; already inside `home.json` under the same path — **reuse it**. `isActive:true`, `approvalStatus:'approved'` so `/restaurant` would render. |
| `/restaurants/6ac8f95828669b5f4e30f0ba/menu` | GET | already in `home.json` (5 groups, 37 items, `customizations` present). |
| `/restaurants/6ac8f95828669b5f4e30f0ba/reviews?page=1&limit=5` | GET | **must be recorded** — not in any fixture yet. Shape: `{success, summary{rating,ratingCount,reviewCount,breakdown}, page, pages, total, data[]}`. For this id it is empty; a second id with real reviews would make the review UI testable. |
| `/restaurants/6ac8cbd0933976c30865d23e` (optional) | GET | the `NEVER_INDEX_IDS` test restaurant — needed to assert `robots: noindex` on `/restaurant`. Record only if the owner wants that path covered. |

Also useful for edge-case fixtures (record once, then edit locally — do not re-fetch):
- a restaurant with `isOpen:false` / `availability.isOpen:false` (closed-warning card, "Unavailable"
  overlay, disabled steppers);
- a restaurant with `freeDeliveryEnabled:true` and a `freeDeliveryAbove` small enough to cross with
  one add (the congratulations toast);
- a menu where every item has `isVeg:false` (the veg chip row is hidden by
  `syncVegFilterAvailability`);
- a menu item with `inStock:false` (out-of-stock overlay + "Unavailable" button);
- an item with `customizations` (`pricingMode:'portion'` and a `maxSelect>1` group) for chunk 11.

**Never** issue a non-GET request to `api.eatswada.com`; the page itself only ever does the three
GETs in §4.2.

---

## 9. Open questions / follow-ups for the owner

- Confirm the advanced-filter sheet is intentionally absent from the shell (§7.1).
- Confirm the favourite heart stays decorative (§7.2).
- Confirm whether `/restaurant-details` and `/restaurant-info` remain separate pages, and whether
  to recreate the missing `js/restaurant-info.js` (§7.7).
- Decide whether the `view-transition` meta is wanted (§7.9).
- Decide whether `installSearchOverlay()` should run on this page at all (§7.11).
