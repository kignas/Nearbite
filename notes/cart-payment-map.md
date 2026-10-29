# Cart + Payment pages map (Phase 2i)

Date: 2026-10-27
Scope: MAP ONLY. No page code, no new routes. Legacy root files are READ-ONLY.

Legacy files covered (all paths relative to repo root):

| File | Lines | Notes |
|---|---|---|
| `cart.html` | 424 | the checkout page |
| `payment-success.html` | 107 | |
| `payment-failed.html` | 122 | |
| `payment-pending.html` | 117 | |
| `js/cart-page.js` | 3359 | page logic (the bulk) |
| `js/cart-checkout-upgrades.js` | 457 | `window.CtX` — payment selector, fee preview, CTA |
| `js/checkout-key.js` | 269 | `window.EWCheckout` — idempotency key + fingerprint |
| `js/order-payload.js` | 112 | `window.EWOrderPayload` — POST /orders body builder |
| `js/payment-state.js` | 180 | `window.EWPayment` — pure classifier |
| `js/payment-verify.js` | 200 | `window.EWPaymentVerify` — verify + reconcile |
| `js/auth-token.js` | 75 | `window.EWAuth` — token read order |
| `config.js` | 22 | `window.CONFIG` (API base + Firebase + Maptiler) |
| `cart-bar.js` | 1167 | cart DATA layer + floating bar (shared, ported) |
| `platform-status.js` | 285 | `window.EWPlatform` — maintenance/COD/UPI/fees snapshot |
| `navigation.js` | 180 | `window.nearbiteSafeBack` + fetch timeout wrapper |
| `eatswada-theme.js` | 239 | shared theme (ported) |
| `eatswada-header-theme.js` | 104 | shared header theme (ported) |

---

## 1. Page inventory — asset order

No page has an inline `<style>` block (verified: `grep -n "<style"` on all four returns nothing).
Every rule comes from linked sheets, so **CSS order is exactly the `<link>` order below**.

### `cart.html`

`<link>` order (L14–L38):
```
https://fonts.googleapis.com  (preconnect)
https://fonts.gstatic.com     (preconnect)
https://fonts.googleapis.com/css2?family=Manrope:wght@400..800&display=swap
https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css
style.css
css/cart-page.css?v=20260928-shared
css/cart-header.css?v=20261016-header-v2
css/cart-savings-banner.css?v=20260928-sections      <-- 0 bytes
css/cart-items.css?v=20261016-original-price
css/cart-add-items.css?v=20260928-sections
css/cart-meal-suggestions.css?v=20260928-meal-v3
css/cart-coupons.css?v=20260928-sections
css/cart-rider-options.css?v=20260928-sections
css/cart-delivery-details.css?v=20261016-contact-v2
css/eatswada-ui-system.css?v=20260923-typography
eatswada-theme.css
eatswada-header-theme.css
css/eatswada-back-button.css?v=20260928-back
css/cart-premium-refinement.css?v=20261016
css/cart-bill-summary.css?v=20261016-original-price
css/cart-checkout-header-refinement.css?v=20261016-v2
css/platform-status.css?v=20261023
```

`<script>` order:
```
L9   inline  theme pre-paint (eatswada_theme / eatswada_header_theme -> data-ew-*)
L10  defer   cdn.jsdelivr.net/npm/darkreader@4.9.133/darkreader.js  (data-ew-dark-reader)
L11  eatswada-theme.js
L12  eatswada-header-theme.js
L411 async   https://checkout.razorpay.com/v1/checkout.js
L412 js/auth-token.js?v=20261025
L413 config.js
L414 js/checkout-key.js?v=20261025
L415 js/payment-state.js?v=20261025
L416 js/payment-verify.js?v=20261025
L417 js/order-payload.js?v=20261025
L418 platform-status.js?v=20261023
L419 js/cart-checkout-upgrades.js?v=20261025
L420 cart-bar.js
L421 js/cart-page.js?v=20261025-checkout
L422 navigation.js
```
Body sections (comment banners in the HTML): 1 delivery header (L52), 1a savings strip (L93),
1b fee line (L104), 2 cart items (L114), 3 complete-your-meal (L146), 4 savings/coupon (L167),
5 rider tip + delivery instructions (L198), 6 delivery details (L222), 7 full bill (L234),
8 cancellation policy (L289), `#empty-cart` (L295), `#checkout-footer` (L310), 3 sheets
(note L332+, tip L360+, coupon L385+).
`<meta name="robots" content="noindex, nofollow">` (L41); canonical `.../cart.html` (L42).

### `payment-success.html`
```
L4   inline  theme pre-paint
L5   defer   darkreader
L6   eatswada-theme.js
L7   eatswada-header-theme.js
L9   <link>  Manrope
L10  <link>  css/eatswada-payment.css?v=20261004-pay1
L11  <link>  eatswada-theme.css
L12  <link>  eatswada-header-theme.css
L71  js/auth-token.js
L72  config.js
L73  js/payment-state.js
L74-106  inline script (the page logic)
```
robots noindex (L15); canonical (L16). Body `.ew-result.ew-success` (L24).

### `payment-failed.html`
```
L4 inline theme · L5 darkreader · L6 eatswada-theme.js · L7 eatswada-header-theme.js
L9 <link> Manrope
L10 js/auth-token.js   <-- note: script BEFORE config/CSS here
L11 config.js
L12 <link> css/eatswada-payment.css?v=20261004-pay1
L13 <link> eatswada-theme.css
L14 <link> eatswada-header-theme.css
L52 js/payment-state.js
L53 js/checkout-key.js
L54 js/payment-verify.js
L55-121 inline script
```
Also loads Razorpay (`L10` line contains both razorpay checkout.js and auth-token.js). robots noindex (L17).

### `payment-pending.html`
```
L4 inline theme · L5 darkreader · L6 eatswada-theme.js · L7 eatswada-header-theme.js
L9 <link> Manrope
L10 config.js
L11 js/auth-token.js
L12 js/payment-state.js
L13 js/checkout-key.js
L14 <link> css/eatswada-payment.css?v=20261004-pay1
L15 <link> eatswada-theme.css
L16 <link> eatswada-header-theme.css
L74-116 inline script
```
robots noindex (L19); canonical (L20). No `js/payment-verify.js`, no `order-payload.js`.

**Load-order rule to keep:** each page's link/script order above must be reproduced as its import
order (AGENTS.md rule 2). Note the three payment pages differ from each other.

---

## 2. Function inventory

### `js/cart-page.js` (all top-level; the file is one `<script>` scope, no IIFE)

| Lines | Function | Window global? | Dead? |
|---|---|---|---|
| 11–41 | `sanitizeLegacyCarts` (IIFE, runs at load) | no | live (one-shot) |
| 43–47 | `esc` | no | live |
| 49–58 | `ctClearCheckoutKey` | no | live |
| 63–72 | `ctSelectedPaymentMethod` (shim → `CtX.getPaymentMethod`) | no | live |
| 75–91 | `normalizeCoords` | no | live |
| 93–102 | `distanceKm` (haversine, R=6371) | no | live |
| 104–109 | `deliveryFeeForDistance` | no | live |
| 111–116 | `getCartRestaurantId` | no | live |
| 128–174 | `ctEtaText` | no | live |
| 179 | `ctProfile` (const, not a function) | no | live |
| 183 | `ctProfileRefreshedThisPass` (let) | no | live |
| 187–197 | `ctCaptureProfile` | no | live |
| 202–214 | `hydrateCachedCustomer` (IIFE) | no | live |
| 216–239 | `getRestaurantLocation` (GET /restaurants/:id, cached) | no | live |
| 244–310 | `calculateCurrentDelivery` (GET /users/profile) | no | live |
| 317–329 | `ctCartGroups` | no | live |
| 331–359 | `ctComputeBreakdown` | no | live |
| 361–394 | `renderMultiBreakdown` | no | live |
| 396–452 | `applyMultiDelivery` | no | live |
| 459–467 | `selectPaymentMethod` (shim → `CtX.selectMethod`) | no | live |
| 471–475 | `syncPaymentOptions` (shim → `CtX.refreshPayment`) | no | live |
| 551–554 | `ctCleanNote` | no | live |
| 556–560 | `ctCleanTip` | no | live |
| 562–575 | `loadCartExtras` | no | live |
| 577–586 | `saveCartExtras` | no | live |
| 588–594 | `clearCartExtras` | no | live |
| 598–601 | `readCart` | no | live |
| 619–622 | `itemImage` | no | live |
| 625–631 | `vegMark` | no | live |
| 634–651 | `customLine` | no | live |
| 659–771 | `paintItems` | no | live |
| 772–823 | `paintBill` | no | live |
| 828–884 | `applyTotals` | no | live |
| 887–920 | `updateBillCompact` | no | live |
| 921–936 | `setDeliveryPending` | no | live |
| 937–1029 | `applyDelivery` | no | live |
| 1036–1061 | `refreshDelivery` | no | live |
| 1063–1066 | `scheduleDelivery` (320 ms debounce) | no | live |
| 1069–1114 | `updateCheckoutCta` | no | live |
| 1117–1159 | `renderCart` | no | live |
| 1162–1170 | `repaintCart` | no | live |
| 1173–1185 | `cartAdjust` | no | live |
| 1189–1201 | `ctBumpQty` | no | live |
| 1203–1210 | `clearCart` | no | live |
| 1222–1226 | `hasAddress` | no | live |
| 1228–1299 | `loadAddress` (GET /users/profile) | no | live |
| 1302–1314 | `showToast` | no | live |
| 1315–1324 | `shakeCheckout` | no | live |
| 1326–1334 | `syncFooterOffset` | no | live |
| 1336–1342 | `ctSetCheckoutButton` | no | live |
| 1344–1351 | `ctSavePaymentContext` | no | live |
| 1353–1362 | `ctPaymentContextBase` | no | live |
| 1364–1369 | `ctGoPaymentResult` | no | live |
| 1371–1377 | `ctRestoreCheckoutButton` | no | live |
| 1383–1401 | `ctReadPaymentStatus` (GET /payments/:id/status) | no | live |
| 1406–1414 | `ctPaymentStatusIsTerminal` | no | live |
| 1420–1442 | `ctWaitForPaymentStatus` (poll, maxMs 22000) | no | live |
| 1444–1455 | `ctFinishCodOrder` | no | live |
| 1460–1474 | `ctPaymentDisplayAmounts` | no | live |
| 1476–1488 | `ctFinishSuccessfulPayment` | no | live |
| 1490–1494 | `ctHandleFailedPayment` | no | live |
| 1499–1502 | `ctHandlePendingPayment` | no | live |
| 1507–1607 | `ctOpenRazorpay` (the Razorpay entry point) | no | live |
| **1610–1919** | **`placeOrder`** | **`window.placeOrder` via `onclick`** | live |
| 1932–1935 | `ctReducedMotion` | no | live |
| 1936–1946 | `ctSetBackgroundHidden` | no | live |
| 1947–1952 | `ctSyncKeyboardInset` | no | live |
| 1953–1958 | `ctAttachViewportSync` | no | live |
| 1959–1966 | `ctDetachViewportSync` | no | live |
| 1967–1972 | `ctFocusables` | no | live |
| 1973–1991 | `openSheet` | no | live |
| 1992–2015 | `closeSheet` | no | live |
| 2044–2047 | `restaurantNoteField` | no | live |
| 2048–2051 | `getRestaurantNote` | no | live |
| 2052–2059 | `setRestaurantNote` | no | live |
| 2060–2064 | `getNoteRestaurantGroups` | no | live |
| 2065–2094 | `paintNoteCards` | no | live |
| 2095–2099 | `ctCartSingleRid` | no | live |
| 2100–2103 | `ctNoteForRid` | no | live |
| 2104–2122 | `paintNotePill` | no | live |
| 2123–2125 | `ctInstructionTokens` | no | live |
| 2126–2144 | `paintDIPills` | no | live |
| 2145–2158 | `toggleDIPill` | no | live |
| 2159–2190 | `ctRetryCompleteMeal` | no | live (deferred retries 900/2600 ms) |
| 2191–2215 | `ctMenuGroups` | no | live |
| 2216–2227 | `ctMenuGroupsFromRestaurant` | no | live |
| 2228–2262 | `ctMealItemFrom` | no | live |
| 2263–2269 | `ctExtractMenu` | no | **DEAD** (only referenced by itself) |
| 2270–2284 | `ctFetchMenu` (GET /restaurants/:id/menu) | no | live |
| 2285–2301 | `ctMenuForRestaurant` | no | live |
| 2302–2306 | `ctParseMenuPrice` | no | live |
| 2307–2309 | `ctPricesMatch` | no | live |
| 2310–2352 | `ctMenuOriginalForCartEntry` (uses `pricingMode:'portion'`) | no | live |
| 2353–2418 | `ctHydrateCartOriginalPrices` | no | live |
| 2419–2423 | `ctPairWeight` | no | live |
| 2424–2442 | `ctInCartTest` | no | live |
| 2443–2477 | `ctMealCardHtml` | no | live |
| 2478–2480 | `ctSyncMealTabState` | no | live |
| 2481–2510 | `ctSyncMealIndicator` | no | live |
| 2511–2532 | `ctPaintMealTrack` | no | live |
| 2533–2552 | `ctSelectMealTab` | no | live |
| 2553–2680 | `paintCompleteMeal` | no | live |
| 2681–2697 | `ctBindMealTabKeys` (IIFE) | no | live |
| 2698–2760 | `ctBindMealDrag` (IIFE) | no | live |
| 2761–2808 | `ctAddMealItem` | no | live |
| 2809–2826 | `paintSavingsHero` | no | live |
| 2827–2843 | `paintFooterSavings` | no | live |
| 2844–2856 | `paintSavingsCorner` | no | live |
| 2857–2865 | `updateNoteCount` | no | live |
| 2866–2894 | `openNoteSheet` | no | live |
| 2895–2922 | `saveNoteSheet` | no | live |
| 2923–2946 | `removeNoteSheet` | no | live |
| 2947–2953 | `setTip` | no | live |
| 2954–2977 | `paintTipChips` | no | live |
| 2978–2984 | `setTipError` | no | live |
| 2985–2998 | `openTipSheet` | no | live |
| 2996–3012 | `saveTipSheet` | no | live |
| 3013–3027 | `removeTipSheet` | no | live |
| 3028–3037 | `ctSetDetail` | no | live |
| 3038–3041 | `ctSelectedAddress` | no | live |
| 3042–3049 | `ctCustomerContact` | no | live |
| 3050–3054 | `ctAddressTag` | no | live |
| 3055–3061 | `ctAddressLine` | no | live |
| 3062–3103 | `paintCheckoutDeliverySummary` | no | live |
| 3104–3132 | `ctEnsureProfile` (GET /users/profile) | no | live |
| 3137–3152 | `ctSelectTipTab` | no | live |
| 3153–3167 | `toggleDeliveryInstructions` | no | **DEAD** (no caller) |
| 3168–3205 | `ctAnimateGroupBody` | no | live |
| 3206–3220 | `applyCouponFromSheet` (POST /coupons/validate) | no | live |
| 3225–3281 | delegated `click` wiring | no | live |
| 3282–3302 | delegated `keydown` wiring | no | live |
| 3303–3345 | `#tip-input` keydown | no | live |
| 3346–3359 | `DOMContentLoaded` boot | no | live |

Only **two** functions are dead in this file: `ctExtractMenu` (L2263) and
`toggleDeliveryInstructions` (L3153). Both must be ported as-is (AGENTS.md rule 10) and listed as
open questions.

`window.*` published by cart-page.js: **only** `window.placeOrder` is reachable from markup
(`onclick="placeOrder()"` at cart.html L320). `window._toastTimer` (L1312) is an incidental global.
Everything else is file-scope.

### `js/cart-checkout-upgrades.js` → `window.CtX` (L435–453)
`pricing`(48–77), `totalDelta`(81–87), `fmtTotal`(89–92), `ctaBlock`(95–100), `codState`(103–114),
`upiState`(115–117), `getPaymentMethod`(119–122), `revalidateBeforeOrder`(128–151),
`storedMethod`(156–158), `selectMethod`(160–174), `refreshPayment`(179–184), `resetMethod`(187–190),
`paintBill`(236–303), `paintFreeDelivery`(306–334), `paintPayment`(336–365), `paintPayNote`(366–373),
`ctaLabel`(374–377), `ensureMounts`(378–396), `onClick`(397–403), `onChange`(404–410),
`init`(411–423), `handleOrderFailure`(427–433). Helpers not exported: `S`, `n`, `money`, `esc`,
`st`, `prof`, `el`, `ensureRow`, `setRow`, `setFeeRow`. No `fetch` in this file — it reads
`window.EWPlatform.current()`.

### `js/checkout-key.js` → `window.EWCheckout` (L256–268)
Keys: `nearbite_checkout_key`, `nearbite_checkout_fp`, `nearbite_checkout_fp_ts` (L35–37),
`MAX_AGE_MS = 24h` (L43). `read/write/drop`(45–53), `stable`(56–67), `rotr`(69),
`utf8Bytes`(87–112), `sha256`(114–156), `addressPart`(160–176), `itemSortKey`(181–183),
`material`(188–217), `fingerprint`(219–221), `newKey`(223–228), `isExpired`(230–234),
`ensureKey`(238–248), `clearKey`(250–254).

### `js/order-payload.js` → `window.EWOrderPayload` (L105–111)
`num`(20–23), `buildItems`(27–41), `previewSubtotal`(43–47), `restaurantIdFrom`(49–57),
`restaurantNameFrom`(59–68), `build`(73–103).

### `js/payment-state.js` → `window.EWPayment` (L171–179)
`norm`(24), `numOrNull`(26–30), `money`(32–37), `partialCod`(44–56), `refundState`(60–79),
`state`(82–160), `authoritativeTotal`(164–169).

### `js/payment-verify.js` → `window.EWPaymentVerify` (L190–199)
`norm`(33), `payloadOf`(36–41), `isConfirmed`(43–49), `saysFailed`(51–56), `isTerminal`(58–67),
`readStatus`(71–84), `waitForStatus`(88–106), `postVerify`(110–122), `run`(126–155),
`decide`(157–165), `codDecision`(179–188).

### `js/auth-token.js` → `window.EWAuth` (L67–74)
`LOCAL_KEYS = ['nearbite_token','token','eatswada_token']` (L23), `SESSION_KEY='nearbite_token'`
(L24). `readStorage`(26–33), `getToken`(36–42), `hasToken`(44), `setToken`(47–52) — writes
`nearbite_token` **and** `token`; `clearToken`(54–59); `authHeader`(62–65).

### `platform-status.js` → `window.EWPlatform` (L274–282)
`BASE` from `CONFIG.API_BASE_URL` (L26); `ENDPOINTS=['/platform/public-status']` (L27);
`CACHE_KEY='eatswada_platform_settings_v2'` (L28, sessionStorage); `CACHE_MS=60s`, `REFRESH_MS=90s`.
`DEFAULTS`(32–54) lists every field CtX consumes. `get(force)`, `current`, `onChange`, `mount`,
`fromBlockedOrder`(245–261), `normalise`, `DEFAULTS`. Polling (263–272) skips while
`document.hidden` and refreshes on `visibilitychange`.

### `navigation.js` → `window.nearbiteSafeBack` (L37–55), `window.goBack` (L57),
`window.premiumBack` (59–71). `PARENT` map (20–35). Also installs
`window.__nearbiteFetchTimeout` (78+) wrapping `window.fetch` with a 15 s default timeout.

### `cart-bar.js` → `window.updateCart` (97), `window.updateGlobalCart` (871),
`window.__esGetUpdateGlobalCart` (1164). Ported already (`web/lib/cart.ts`,
`web/components/CartBar.tsx`).

---

## 3. Storage keys (read / write)

`localStorage` unless noted. "R/W" = written on this page.

| Key | Shape | cart.html | pay-success | pay-failed | pay-pending |
|---|---|---|---|---|---|
| `nearbite_cart` | object keyed by cart line name → `{quantity,price,originalPrice,resId,menuItem,image,name,isVeg,restaurantName,customizations?}` | R/W (R 599,1118,1174,1312,1687,248,319,333; W 1178,1204 remove) | remove (L74) | remove (L74) | remove (L86) |
| `nearbite_cart_extras` | `{restaurantNote, restaurantNotes:{rid:note}, deliveryInstructions, tipAmount}` | R/W (564,579,593) | — | — | — |
| `nearbite_cart_before_auth` | raw string copy of `nearbite_cart` | W (1625) | — | — | — |
| `nearbite_after_login` | `'cart.html'` | W (1627) | — | — | — |
| `nearbite_address` | `{tag,house,area,landmark,city,pincode,location,latitude,longitude,receiverName,receiverPhone,_id}` | R (249,333,1230,1749,3039) W (275,1269) | — | — | — |
| `nearbite_selected_address_id` | string `_id` | R (252,1247,1763) W (1270) | — | — | — |
| `nearbite_payment_method` | `'upi'` \| `'cod'` | R/W via CtX (L29,142,170,189,466) | — | — | — |
| `nearbite_send_cutlery` | `'1'` \| absent | R (CtX L28) | — | — | — |
| `nearbite_checkout_key` | uuid string | R/W (via EWCheckout; fallback 1805/1810) | — | remove (76/77) | remove (88/89) |
| `nearbite_checkout_fp` | sha256 hex | via EWCheckout | — | remove | remove |
| `nearbite_checkout_fp_ts` | epoch ms string | via EWCheckout | — | remove | remove |
| `nearbite_payment_context` | `{orderId,multiple,orderNumber,method?,serverTotal?,partialCodAdvanceAmount?,partialCodCashDue?,advanceStatus?,failureMessage?,savedAt}` | W (1346) | R (76) remove (103) | R (57) remove (75) | R (76) remove (87) |
| `nearbite_user` | cached backend User `{name,phone,...}` | R (204) | — | — | — |
| `nearbite_token` / `token` / `eatswada_token` | JWT string | R (EWAuth) | R | R | R |
| `eatswada_theme` | `'dark'` \| `'light'` | R (L9) | R (L4) | R (L4) | R (L4) |
| `eatswada_header_theme` | `'raspberry'` | R (L9) | R (L4) | R (L4) | R (L4) |
| `es_image_dict` | `{foodName: imageUrl}` | R/W via cart-bar (818,1080) | — | — | — |
| `eatswada_platform_settings_v2` (**sessionStorage**) | `{at:epochMs, data:{...DEFAULTS}}` | R/W (platform-status 114,120) | — | — | — |

`sessionStorage` is used **only** by `platform-status.js` (cache) and by `EWAuth` for a
`nearbite_token` fallback read (auth-token L41). No other session key exists on these pages.

---

## 4. Network calls

Base: `CONFIG.API_BASE_URL = https://api.eatswada.com/api` (config.js L5).
Auth header on every user-scoped call: `Authorization: Bearer <EWAuth.getToken()>`.

| # | Method | Path | Called from | Payload / query | Response fields used | Auth | Class |
|---|---|---|---|---|---|---|---|
| 1 | GET | `/restaurants/:id` | cart-page 220 | `cache:'no-store'` | `data.location,minOrder,freeDeliveryEnabled,freeDeliveryAbove,deliveryRadiusKm,codEnabled` (224–232) | no | **GET** |
| 2 | GET | `/users/profile` | cart-page 266, 1240, 3122 | `cache:'no-store'` | `data.addresses[],defaultAddress,isDefault,name,phone,isFirstOrder,isCodBlocked` | yes | **GET** |
| 3 | GET | `/restaurants/:id/menu` | cart-page 2274 | `cache:'no-store'` | menu groups/items for complete-your-meal + originalPrice recovery | no | **GET** |
| 4 | GET | `/payments/:orderId/status` | cart-page 1390 / payment-verify 73 / payment-pending 105 | `cache:'no-store'` | `success,data.paymentStatus,paymentMethod,partialCod*,refund*` | yes | **GET** |
| 5 | GET | `/platform/public-status` | platform-status 130 | `cache:'no-store'`, signal | the whole `DEFAULTS` shape | optional | **GET** |
| 6 | POST | `/orders` | cart-page 1814 | see §5 payload | `success,message,data._id,data.orderNumber,data.total/paymentStatus,payment.{orderId,keyId,amount,currency}` | yes + `Idempotency-Key` | **WRITE** |
| 7 | POST | `/payments/verify` | payment-verify 111 / pay-failed 109 | `{orderId,razorpayPaymentId,razorpayOrderId,razorpaySignature}` | `success,paymentStatus,data.*` | yes | **WRITE** |
| 8 | POST | `/payments/retry` | pay-failed 86 | `{orderId}` | `success,alreadyPaid,payment.{orderId,keyId,amount,currency},message` | yes | **WRITE** |
| 9 | POST | `/coupons/validate` | cart-page 3212 | `{code,subtotal,restaurantId?}` | `success,data.code,data.discount,message` | yes if token | **WRITE** |

**Rule for tests: never call 6, 7, 8, 9 against a real backend. Always stub.**
Calls 1–5 are GET-safe and can be recorded as fixtures.

---

## 5. Razorpay flow end to end (TEST MODE ONLY)

### 5.1 Order creation (`placeOrder`, cart-page 1610–1919)
1. Token = `EWAuth.getToken()`. No token → save `nearbite_cart` to `nearbite_cart_before_auth`,
   set `nearbite_after_login='cart.html'`, go to `login.html` (1621–1630). **Guest cart allowed.**
2. Guards: unavailable restaurant (1614), multi-restaurant below-min (1632), single below-min
   (1640), no address → `address.html` (1647), re-entrancy `ctOrderInFlight` (1654).
3. Preflight: `EWPlatform.get(true)` then `CtX.revalidateBeforeOrder()` (1671–1684).
4. Build `itemsArray` from `nearbite_cart` (1693–1706); `restaurantId` must be ≥20 chars (1708).
5. Delivery fee: multi → `ctComputeBreakdown`; single → `calculateCurrentDelivery({force:true})`
   (1720–1742). `deliveryFee` defaults to **30** when `fee == null` (1741).
6. Address read **after** the delivery calc (1748–1749).
7. `payload = EWOrderPayload.build(savedCart, {...})` (1760–1793) — the exact POST /orders body:
   ```json
   {
     "items":[{"menuItem","name","price","quantity","customizations":{}}],
     "deliveryAddress": {..savedAddress..} | null,
     "addressId": "…" | null,
     "restaurantId": "…",
     "restaurantName": "…",
     "subtotal": <number>, "deliveryFee": <number>, "total": subtotal+deliveryFee,
     "paymentMethod": "upi" | "cod",
     "restaurantNote": "", "deliveryInstructions": "",
     "tipAmount": <number>, "couponCode": "",
     "restaurantNotes": {rid:note}   // only when non-empty
   }
   ```
   (order-payload L82–102.)
8. Idempotency: `EWCheckout.ensureKey(payload)` (1801–1812) → header `Idempotency-Key`.
9. `POST /orders` with `Content-Type`, `Authorization: Bearer`, `Idempotency-Key` (1814–1822).
10. 503 → `CtX.handleOrderFailure` first (1831–1834). Then `!success` → throw `result.message`.
11. `primaryOrderId = result.data._id`; `serverTotal = EWPayment.authoritativeTotal(result.data)`.

### 5.2 COD branch (1854–1893)
`EWPaymentVerify.codDecision({data, payment, hasRazorpay})` →
- `advance-open` → `ctOpenRazorpay({purpose:'advance'})`
- `advance-pending` → keep order id, route to `payment-pending.html`
- `complete` → `ctFinishCodOrder` → clear cart + key, save context, `payment-success.html?state=success`

### 5.3 UPI branch (1895–1911)
If `!result.payment.orderId || !keyId || !window.Razorpay` → throw
"Online payment is temporarily unavailable." Else `ctOpenRazorpay({purpose:'payment'})`.

### 5.4 Razorpay checkout options (`ctOpenRazorpay`, 1507–1607)
```js
new Razorpay({
  timeout: 300,
  key:      result.payment.keyId,
  amount:   result.payment.amount,
  currency: result.payment.currency || 'INR',
  name:     'Eatswada',
  description: isAdvance ? `Advance for COD order ${orderNumber}`
                         : (result.multiple ? 'Eatswada multi-restaurant order'
                                            : `Eatswada order ${orderNumber}`),
  order_id: result.payment.orderId,
  prefill:  { name: #checkout-customer-name.textContent,
              contact: #checkout-customer-phone.textContent },
  theme:    { color: '#C2185B' },
  modal: { ondismiss: () => { restore CTA; toast } },
  handler: async (paymentResponse) => { …verify… }
})
rzp.on('payment.failed', …)   // L1596
rzp.open()                     // L1606
```

### 5.5 handler → verification (1541–1594)
```js
paymentPayload = { orderId: primaryOrderId,
                   razorpayPaymentId: paymentResponse.razorpay_payment_id,
                   razorpayOrderId:  paymentResponse.razorpay_order_id,
                   razorpaySignature: paymentResponse.razorpay_signature }
EWPaymentVerify.run({fetchImpl, apiBase, token, orderId, verifyBody: paymentPayload})
  verdict 'paid'    -> ctFinishSuccessfulPayment  (clear cart+key, context, payment-success)
  verdict 'failed'  -> ctHandleFailedPayment      (context, payment-failed)
  verdict 'pending' -> ctHandlePendingPayment     (context, payment-pending)
```
If `EWPaymentVerify` is missing → **refuse to guess**: log an error and go to pending (1586–1592).

### 5.6 `EWPaymentVerify.run` decision table (payment-verify 126–165)
| Condition | Result |
|---|---|
| network error on POST /payments/verify | poll `/status`, `decide(status,'status-after-network-error')` |
| verify.ok && success && `isConfirmed` | `paid` (source `verify`) |
| status 409 or ≥500 | poll, `decide(s1,'status-after-<code>')` |
| `saysFailed(body)` | `failed` |
| anything else (401/429/…) | poll, `decide(s2,'status-after-<code>')` |
| `decide`: confirmed→paid, saysFailed→failed, else **pending** | |

Polling: `waitForStatus` (88–106), start delay 1200 ms, ×1.35 capped 3000 ms, `maxMs` default 22000.
**Invariant: an unconfirmed outcome is never "failed".**

### 5.7 Payment-result pages

**payment-success.html** (inline 74–106): reads `nearbite_payment_context`; also accepts
`?orderId=&method=COD` (L82–87, COD swaps the h1 to "Order placed!" and meta to
"Cash on delivery · Order confirmed"). Shows `ctx.orderNumber` (88), advance row (93),
cash-due row (94). `go()` (96–105): removes the context then
`location.href = ctx.multiple ? 'orders.html' : 'track-order.html?id='+orderId`; auto-runs after
**3600 ms** or on the Continue button. If no `orderId`, it stays put (97–100).

**payment-failed.html** (inline 55–121): Retry button → `POST /payments/retry {orderId}` (86).
- `alreadyPaid || isPaid(result)` → `success()` (clear cart+key, go to order).
- not ok / no `payment.orderId` → if definitive server failure (`status<500` and
  `EWPayment.state(result).isFailed`) show the message; **otherwise** `payment-pending.html` (89–96).
- else open Razorpay (97) with the retry order; handler → `EWPaymentVerify.run` (104) then
  paid→success, failed→error shown, else `payment-pending.html`.
- `rzp.on('payment.failed')` shows the error inline (116). "Return to cart" → `cart.html` (119).
- Missing context → error text (120).

**payment-pending.html** (inline 74–116): shows `ctx.orderNumber`. `check()` (102–111) polls
`GET /payments/:orderId/status`; paid→`goToOrder()`, failed→`payment-failed.html`, else stay.
Auto-poll: `setInterval(check,3000)` for **30 s** then stops (115). Buttons: View My Orders (114),
Check again (113).

### 5.8 Payment context shape (`ctPaymentContextBase`, 1353–1362)
```json
{ "orderId": "…"|null, "multiple": true|false, "orderNumber": "…",
  "method": "COD"?, "serverTotal": number|null,
  "partialCodAdvanceAmount": number?, "partialCodCashDue": number?,
  "advanceStatus": "pending|paid|failed"?, "failureMessage": "…"?,
  "savedAt": 1699999999999 }
```
Deliberately **never** stores a delivery OTP (comment 1354–1356).

---

## 6. Firebase usage and auth gating

- Firebase config lives in `config.js` L12–20 (`window.CONFIG.FIREBASE`). The four cart/payment
  pages **do not load any Firebase SDK** — no `firebase.js`, no `firebase-messaging-sw.js` script
  tag, no `initializeApp` on these pages. `FIREBASE` is present in `CONFIG` because the shared
  `config.js` is used site-wide.
- Push/service-worker: `sw.js` and `firebase-messaging-sw.js` are site-root files; the cart/payment
  pages register nothing themselves. (PWA work is separate — see `sitemap-pwa-parity`.)
- **Auth gating** is token-based only, via `EWAuth.getToken()`:
  - `cart.html` renders for guests (cart is guest-usable). Login is required only at
    **Order** time: no token → stash cart to `nearbite_cart_before_auth`, set
    `nearbite_after_login='cart.html'`, redirect to `login.html` (1621–1630).
  - `payment-failed.html` retry: no token → `login.html` (83).
  - `payment-pending.html` `check()` returns early when `!token` (103).
  - `payment-success.html` needs no token (it only reads the local context).
- No `onAuthStateChanged` / `signInWith*` on any of the four pages.

---

## 7. Money math

Primitives:
- **subtotal** = Σ `Number(item.price) * Number(item.quantity)` over cart lines.
  Single source of truth: `paintBill` (774), `calculateCurrentDelivery` (255),
  `placeOrder` (1716); `EWOrderPayload.previewSubtotal` (43–47) mirrors it.
- **deliveryFeeForDistance** (104–109): `d < 10 → 30`, `d ≤ 15 → 40`, else `50`.
  ⚠ **Note:** the platform radius is capped at 10 km (`radius = Math.min(deliveryRadiusKm, 10)`,
  L302/L347) and `distance > radius` returns "outside" — so the 40/50 tiers are **unreachable in
  practice**. Recorded as a finding, not "fixed".
- **free delivery** = `freeDeliveryAbove > 0 && subtotal >= freeDeliveryAbove` → fee 0
  (284, 308, 350). No-GPS fallback fee is 30 unless free (286).
- **fee defaults**: `applyDelivery` coerces `null → 30` (942–944); `placeOrder` `null → 30` (1741);
  `ctComputeBreakdown` no-coords `→ 30` (355).
- **tip**: `ctCleanTip` (556–560) = `Math.round(Number(v))`, clamped to `[1, 1000]`, 0 = no tip.
- **display total** (`applyTotals`, 828–830): `total = subtotal + deliveryFee + tip`.
  Rendered as `'₹' + total` (no `toLocaleString`) — keep exactly.
- **preview total** (`CtX.pricing`, 48–77): adds `packaging`(per-item×units), `handling`,
  `smallCart`, `surge`, `tax`, minus `coupon`:
  `tax = Math.round((subtotal - coupon) * taxPercent) / 100` (70);
  `total = Math.max(0, subtotal - coupon + delivery + packaging + handling + smallCart + surge + tax + tip)`
  (71), final `Math.round(total*100)/100` (75). **This is the number the CTA/bill show**; the
  backend remains authoritative.
- **rounding**: `Math.round` is used for money everywhere (`EWPayment.money` 35,
  `CtX.money` 36, `CtX.fmtTotal` 90, `CtX.pricing` tax/total). `Math.ceil` is used **only** for
  the "add ₹X more" progress nudges (1634, 1641, 1732, 1090, 1097, 1003, 376) — not for money
  charged. Do not merge these two rules (also true in `restaurant-shell` chunk 10 vs 11).
- **authoritative total** for a created order: `EWPayment.authoritativeTotal` =
  `total ?? amount ?? finalTotal` (164–169). The client never derives the final charge.
- **partial-COD**: `EWPayment.partialCod` (44–56) — advance required only on server evidence
  (positive `partialCodAdvanceAmount` or a `partialCodAdvanceStatus`). Displayed advance =
  `partialCodAdvanceAmount`; cash due = `partialCodCashDue`.

### Customizations and `pricingMode:'portion'`
- `restaurant-shell.html` builds the customization sheet: `pricingMode = g.pricingMode === 'portion'
  ? 'portion' : 'extra'` (3189); portion groups are single-select (`if (pricingMode === 'portion' &&
  checked.length > 1) valid = false;` 3227) and set `portionPrice` (3223). `confirmAdd` (3242–3292)
  writes `customizations: flat` where each entry is
  `{title, label, extraPrice, pricingMode, isVeg}` (3250), and the cart line key is the **composite
  name** `name + ' (' + labels.join(', ') + ')'` (3255, 3266).
- `cart-page.js` `ctMenuOriginalForCartEntry` (2310–2352) matches cart lines back to menu records
  using the portion entry: `customizations.find(c => c.pricingMode === 'portion')` (2319),
  `filter(... !== 'portion')` (2321), and `rawGroups.find(g => g.pricingMode === 'portion' && …)`
  (2330). This drives the crossed-out `originalPrice` only.
- **`Date.now()` variant discriminator — NOT FOUND in the legacy tree.** I searched every legacy
  `.js`/`.html` for a cart-line key built from `Date.now()`: the only `Date.now()`-derived
  identifiers are the **checkout idempotency key** (`nearbite_checkout_key`, checkout-key L227 /
  cart-page L1809) and the Razorpay/theme timestamps. The customized cart key is the deterministic
  composite name above; the Under-99 encoded-payload form (`encodeURIComponent(JSON.stringify(payload))`,
  under99-core L147) contains no timestamp and `cart-bar.js` decodes it to `payload.name` before
  keying (`updateCart` 104–122). The parity harnesses normalise a **seeded** encoded key
  (`shell-money-parity` 463) as a defensive rule, not because legacy writes one.
  → recorded as an open question (see §10), because prior session notes claimed otherwise.

---

## 8. Cross-page navigation (clean-URL contract)

| From | Action | Target | Params |
|---|---|---|---|
| cart.html | address block (L59) | `address.html?return=cart` | `return=cart` |
| cart.html | back button | `window.nearbiteSafeBack()` | — |
| cart.html | no address (1647) | `address.html` | — |
| cart.html | no token at Order (1628) | `login.html` (after setting `nearbite_after_login='cart.html'`) | — |
| cart.html | Add Items link (809) | `restaurant.html?id=<rid>` or `index.html` | `id` |
| cart.html | empty-cart button (305) | `index.html` | — |
| cart-page | `ctGoPaymentResult(state)` (1368) | `payment-${state}.html?state=<state>` | `state` |
| payment-success | go() (104) | `orders.html` (multiple) else `track-order.html?id=<orderId>` | `id` |
| payment-success | COD hand-off (82–87) | accepts `?orderId=&method=COD` | `orderId`,`method` |
| payment-failed | success (79–80) | `orders.html` / `track-order.html?id=` | `id` |
| payment-failed | unsure/retry-fail (95,107,113,114) | `payment-pending.html` | — |
| payment-failed | no token (83) | `login.html` | — |
| payment-failed | Return to cart (119) | `cart.html` | — |
| payment-pending | paid (92) | `orders.html` / `track-order.html?id=` | `id` |
| payment-pending | failed (109) | `payment-failed.html` | — |
| payment-pending | View My Orders (114) | `orders.html` / `track-order.html?id=` | `id` |
| navigation.js | `PARENT` back-fallbacks (20–35) | `cart.html→index.html`, `track-order.html→orders.html`, `address-new.html→index.html`, … | — |
| navigation.js | `address.html` + `return=cart` (40–43) | `location.replace('cart.html')` | — |

Next.js `next.config.js` must 301 every `.html` above to its clean URL, including
`cart.html→/cart`, `payment-success.html→/payment-success`, `payment-failed.html→/payment-failed`,
`payment-pending.html→/payment-pending`. All four payment pages are `noindex, nofollow`.

---

## 9. Proposed chunk plan (like restaurant-shell) + test plan

Each chunk = one page/component, one commit-sized change, `npm run build` green, compare under 1 %.

| # | Chunk | Legacy range | Risk | Test |
|---|---|---|---|---|
| C1 | cart page static shell + CSS import order | `cart.html` (all) + 22 CSS files | Low | `compare.mjs /cart.html /cart` phone+desktop <1 %; CSS-leak probe |
| C2 | cart data + money math (`ctState`, subtotal, `paintBill`, `applyTotals`, `updateBillCompact`) | cart-page 478–498, 551–660, 772–890 | Med | money-parity harness (seeded cart → bill rows + total) |
| C3 | geo + delivery fee (`normalizeCoords`,`distanceKm`,`deliveryFeeForDistance`,`calculateCurrentDelivery`,`ctComputeBreakdown`,`applyDelivery`,`refreshDelivery`) | cart-page 75–116, 216–310, 317–452, 921–1066 | Med | fixture restaurant (GPS, radius, freeAbove, minOrder) → fee/strip/CTA |
| C4 | items render + qty/remove + clear | cart-page 659–771, 1117–1226 | Med | seeded cart → rows HTML, stepper ±, clear |
| C5 | extras: note / tip / delivery instructions + 3 sheets | cart-page 562–596, 1973–2020, 2044–2160, 2844–3030 | Med | seeded extras → pills/sheet/context |
| C6 | complete-your-meal + originalPrice hydration | cart-page 2191–2808 | Med | fixture `GET /menu` → cards, MRP strike |
| C7 | payment selector + fee preview (`CtX`) + platform status | cart-checkout-upgrades 20–457; platform-status 1–285 | High | COD/UPI eligibility matrix, pricing preview |
| C8 | address + profile hydration | cart-page 187–215, 1228–1300, 3038–3132 | Med | fixture `GET /users/profile` |
| C9 | **placeOrder + idempotency + Razorpay open** | cart-page 1334–1607, 1610–1919; checkout-key; order-payload | **HIGH (WRITE)** | stubbed `POST /orders`; assert exact body + `Idempotency-Key`; assert no real POST |
| C10 | **payment result pages** | payment-success/failed/pending inline; payment-state; payment-verify | **HIGH (WRITE)** | stubbed verify/retry/status; verdict matrix |
| C11 | CTA blocking + maintenance/shortage banners | cart-checkout-upgrades 95–151, 427–433; platform-status | Med | 503 maintenance / shortage fixtures |

### Fixtures to record (GET only, captured from the live backend)
1. `GET /restaurants/:id` — normal, GPS-less, `outsideRadius`, `freeDeliveryAbove>0`,
   `minOrder>0`, `codEnabled:true`, `codEnabled:false`.
2. `GET /restaurants/:id/menu` — multi-category, with `originalPrice`, with `pricingMode:'portion'`.
3. `GET /users/profile` — with/without `addresses`, `isFirstOrder`, `isCodBlocked`.
4. `GET /platform/public-status` — default; maintenance; rider-shortage; COD off; UPI off; fees on.
5. `GET /payments/:orderId/status` — `paid`, `pending`, `failed`, `cod_pending` + advance paid,
   `refunded`, partial refund.

### Stubbed WRITE routes (never call the real backend)
- `POST /orders` → upi success (payment block), cod complete, cod advance-open,
  cod advance-pending, 503 maintenance, 503 shortage, validation error.
- `POST /payments/verify` → paid, failed, 409, 500, 401, non-JSON body.
- `POST /payments/retry` → `alreadyPaid`, new Razorpay order, unsure.
- `POST /coupons/validate` → valid, invalid, network error.

Razorpay: **TEST mode only**; stub `window.Razorpay` in the harness (never load the real checkout).
Payload shapes must not change.

---

## 10. Questions / TODOs for the owner

1. **`Date.now()` cart-key claim.** The task brief (and prior session notes) say a customized cart
   line's key carries a `Date.now()` discriminator. The current legacy tree does **not** do this —
   the key is the deterministic composite name (`restaurant-shell.html` 3255/3266), and the only
   `Date.now()` ids are the checkout key. Please confirm which is authoritative. I did not change
   any code; the harness normalisation stays as-is.
2. **Dead code.** `ctExtractMenu` (cart-page 2263) and `toggleDeliveryInstructions` (3153) have no
   callers. Port verbatim (AGENTS.md rule 10) or drop? Default = port verbatim.
3. **Delivery-fee tiers 40 / 50 are unreachable** (radius capped at 10 km, cart-page 302/347).
   Confirm they should stay in the ported code.
4. **`ctState.items` is never assigned** but is read in `applyCouponFromSheet` (3210), so the coupon
   `subtotal` is always 0. Bug to preserve or fix? (Likely a real bug.)
5. **`ctState.discount` / `ctState.tax`** are read in `applyTotals` (855, 862) but never set —
   dead reads. Same question.
6. **`cart.html` canonical/robots**: canonical is `/cart.html` with `noindex`. Confirm the new
   `/cart` route keeps `noindex` and the canonical is rewritten to the clean URL (or dropped).
7. **`css/cart-savings-banner.css` is 0 bytes** — include the empty file for byte-parity or omit?
8. **`nearbite_cart_extras` validation** only accepts 24-hex restaurant ids for `restaurantNotes`
   (cart-page 570) — keep the strict filter?
9. **`sanitizeLegacyCarts`** (cart-page 11–41) mutates the stored cart at load. Port as a
   `"use client"` one-shot effect; confirm the exact migration rules are still wanted.
10. **`navigation.js` wraps `window.fetch`** with a 15 s timeout. In Next this must not double-wrap
    the app's own fetch. Confirm the ported version is installed once, client-side only.
11. **`payment-success.html` 3.6 s auto-redirect** and **`payment-pending.html` 30 s poll** are
    timings that affect tests — confirm they stay identical.
