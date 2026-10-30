EatSwada — customer frontend, dynamic pricing (v2)
==================================================
Branch: feature/dynamic-pricing-customer-v2   (from main f06194d)
Contains: only the 34 files added or changed by this work.

HOW TO APPLY (either way)
-------------------------
A) Copy the files in this zip over your repo root (paths match exactly), OR
B) From your repo root, run:  git apply eatswada-dynamic-pricing.patch

Then verify:
  node tests/ew-listing.test.js
  node tests/ew-modules.test.js
  node tests/ew-phase2.test.js
  node tests/ew-phase3.test.js
  node tests/ew-phase4.test.js
  -> 262 passed, 0 failed

NEW FILES (11)
--------------
js/ew-money.js              money formatting (paise -> INR, Indian grouping)
js/ew-bill.js               quote + stored-order bill -> itemized rows, decisions
js/ew-quote.js              the ONE module that calls POST /pricing/quote
js/cart-quote-ui.js         live quote UI on the cart; gates the Pay button
js/ew-availability.js       reads backend availability/orderable + badges
js/ew-freedelivery.js       renders backend freeDelivery (locked/unlocked/fee)
js/ew-pricing.js            pricing client (quote + restaurant-cards)
js/ew-restaurant-cards.js   attaches backend pricing to listing cards
js/ew-tracking.js           activity analytics (menu/item/add/remove/checkout)
css/ew-pricing-ui.css       additive styles (load LAST)
docs/rebuild/VERIFICATION.md  Phase 5 verification + deploy verdict

CHANGED FILES (23)
------------------
cart.html, category.html, index.html, under99.html,
restaurant-shell.html, orders.html, track-order.html,
cart-bar.js, home.js, restaurant-card.js,
js/cart-page.js, js/order-payload.js,
js/under99.js, js/under99-core.js, js/under99-products.js,
docs/rebuild/AUDIT.md, API_CONTRACTS.md, BACKEND_GAPS.md,
tests/ew-{listing,modules,phase2,phase3,phase4}.test.js

NOT INCLUDED
------------
Nothing was deleted or renamed. No build output, no secrets.
The backend is NOT in this zip (source of truth: kignas/Eatswada- @2139abb).

PRODUCTION BLOCKER (see docs/rebuild/BACKEND_GAPS.md B1)
-------------------------------------------------------
POST /orders does not read or verify quoteId, and returns no
QUOTE_EXPIRED / QUOTE_PRICE_CHANGED / QUOTE_MISMATCH codes.
The client already sends quoteId + Idempotency-Key. Staging-safe;
production needs the backend change.
