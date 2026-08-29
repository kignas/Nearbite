# Phase 1.2 restaurant page rollback

- Restored the Phase 1.1 restaurant/menu page layout.
- Removed the restaurant-page reviews section.
- Removed the restaurant-page details section.
- Removed the restaurant-page coupon banner.
- Kept the restaurant distance consistency fix.
- Kept menu-item coupon badges when supplied by the API.
- Added `restaurant-details.html?id=<restaurantId>` as a separate information page.
- The restaurant page info icon opens the separate information page.
- The separate information page can show customer reviews and customer food photos when the backend provides `/restaurants/:id/reviews`.
