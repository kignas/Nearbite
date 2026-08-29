# Nearbite Production UI/UX Refactor

## Typography
- Global UI typography: Plus Jakarta Sans.
- Micro-copy, currency, ratings, counts and metrics: Inter with tabular numerals.
- Primary text: #1C2024.
- Secondary text: #697077.
- Added Google font loading for Inter and Plus Jakarta Sans.
- Removed SF Pro-specific font declarations.

## Marketplace UI
- Standardized section headers, item titles, price and metadata hierarchy.
- Added truncation/ellipsis defenses for dense cards.
- Added compact offer/discount badge styling.
- Refined card padding, borders, shadows and spacing.

## Search
- Refined search bar and suggestion chips.
- Refined "What's on your mind?" discovery grid.
- Improved category image containment and typography.
- Refined result cards and rating typography.

## ₹99 Store
- Refined Swiggy-inspired deal hierarchy.
- Improved 2-column product cards.
- Refined price/old-price/rating typography.
- Replaced inline image object-fit styling with semantic CSS classes.

## Restaurant
- Refactored menu item markup from large inline style blocks to semantic classes:
  `.nb-menu-item`, `.nb-item-title`, `.nb-item-price-row`, `.nb-item-discount`, `.nb-item-desc`, `.nb-item-media`, etc.
- Improved price/discount presentation and menu text truncation.
- Preserved existing cart/menu logic and button generation.

## Validation
- Inline JavaScript syntax checked with Node.js.
- CSS brace balance checked.
- Backend files were not modified.

## Phase 1.2 — Stabilization + restaurant details

- Unified old-stack page background to white.
- Home header now derives a real minimum delivery estimate from loaded restaurant data.
- Restaurant card and restaurant page now use the same customer-address coordinate calculation for distance, avoiding conflicting values.
- Added real restaurant details panel from API-provided address/cuisine/hours/radius/phone fields only.
- Added restaurant info action to open the details panel.
- Added optional restaurant coupon display when the API supplies coupon data.
- Added optional menu-item coupon badge when the API supplies coupon data.
- Added optional restaurant review rendering with customer food photos when the review endpoint/data provides them; review failure never blocks menu loading.
- Kept all optional UI data-driven: no fake offers, coupons, ratings, reviews, or details are fabricated.
- Existing API/cache/cart behavior remains intact.

## Phase 2.1 — Home page UI upgrade

Scope: home page only. Old HTML/CSS/JS stack kept. No framework migration,
no backend or API-contract change, no new dependencies.

### Files changed
- `index.html` — header/hero/search markup and all page CSS
- `home.js` — header estimate, search hint source, category markup, result count
- `restaurant-card.css` — image-on-top card layout
- `restaurant-card.js` — card markup only (`buildCard`, `handleImageError`)
- `cart-bar.js` — floating-cart / help-button collision fix

### UI
- Header leads with the real minimum delivery estimate derived from loaded
  restaurants; place name and saved address sit underneath. With no estimate
  available the line is hidden and the place name is promoted — no dash.
- Hero reduced to one compact amber block (~205–225px). Removed the looping
  gradient animation, the 12s text scroller and the floating emoji particles.
- Search hint now rotates through real category names from `/categories`.
- "What's on your mind?" is a single-row snap rail: fixed 76px tiles,
  `object-fit: contain`, 2-line centred names, every category reachable.
- Filter pills unified at 36px, rounded, horizontally scrollable. Filter
  registry unchanged: a pill is only rendered when the data can answer it.
- Restaurant cards rebuilt: 16:10 image on top, content below.
  `#restaurant-list` uses `grid-auto-rows: 1fr` so every card is the same
  height, with the Order button pinned to the bottom.
- Page background is a light neutral (#F5F6F8) with white cards only.
- Section heading shows a live count that follows the active filters.

### Bugs fixed
- Floating cart overlapped the floating help button below 375px width. The
  help button now lifts above the cart bar whenever the cart is visible.
- Category images could escape their container (`scale(1.2)` on a `contain`
  image with no clipping).

### Known / deferred
- `search.html` still shows a microphone icon with no handler (Phase 2.2).
