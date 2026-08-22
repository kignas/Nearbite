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
