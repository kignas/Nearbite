"use client";

/* ================================================================
   EATSWADA — CART PAGE RUNTIME (chunk C2, Phase 2j)
   ----------------------------------------------------------------
   Legacy `cart.html` loaded, in order:

     eatswada-theme.js          -> <ShellRuntime/> (layout) installs it
     eatswada-header-theme.js   -> <ShellRuntime/> (layout) installs it
     js/auth-token.js           -> (C9/C10 — not this chunk)
     config.js                  -> lib/config.ts (imported by lib/cart-page-state.ts)
     js/checkout-key.js         -> (C9)
     js/payment-state.js        -> (C10)
     js/payment-verify.js       -> (C10)
     js/order-payload.js        -> (C9)
     platform-status.js         -> lib/platform-status.ts (installed below)
     js/cart-checkout-upgrades.js -> lib/cart-checkout-upgrades.ts (C7 + C11 — installed below)
     cart-bar.js                -> <CartBar/> (mounted before this component)
     js/cart-page.js            -> lib/cart-page-state.ts (chunk C2)
     navigation.js              -> <ShellRuntime/> (layout) installs it

   <ShellRuntime/> (layout) owns the theme / header-theme / navigation globals,
   and `installNavigation()` already installs the `window.fetch` timeout wrapper
   ONCE (owner decision 10 — the shared shell already installs it, so this page
   must NOT wrap fetch again). <CartBar/> is mounted before this component so its
   effect (and the cart data layer, plus `window.updateCart`) installs first.

   This chunk (C2) installs only the cart DATA + MONEY MATH surface and runs the
   cart boot. Everything a LATER chunk owns (delivery refresh, item painting,
   complete-your-meal, the sheet save handlers, coupon validation, placeOrder)
   stays unported; the C2 code reaches those by name through the same
   `typeof window.X === 'function'` guards the restaurant-shell installers use,
   so the page never throws. No WRITE endpoint is ever called here.
   ================================================================ */
import { useEffect } from "react";
import { installEWAuth } from "../lib/ew-auth";
import { installEWCheckout } from "../lib/ew-checkout";
import { installEWPayment } from "../lib/ew-payment-state";
import { installEWPaymentVerify } from "../lib/ew-payment-verify";
import { installEWOrderPayload } from "../lib/ew-order-payload";
import { loadRazorpay } from "../lib/razorpay-loader";
import { installPlatformStatus } from "../lib/platform-status";
import { installCartCheckoutUpgrades } from "../lib/cart-checkout-upgrades";
import { installCartPageC2, loadAddress, renderCart, syncFooterOffset, closeSheet } from "../lib/cart-page-state";
import { installCartPageC3 } from "../lib/cart-page-delivery";
import { installCartPageC4 } from "../lib/cart-page-items";
import { installCartPageC5 } from "../lib/cart-page-extras";
import { installCartPageC6 } from "../lib/cart-page-meal";
import { installCartPageC8 } from "../lib/cart-page-address";
import { installCartPageC9 } from "../lib/cart-page-order";

/* Legacy ran the boot from a `DOMContentLoaded` listener — EXACTLY ONCE per
   page load. In Next the DOM is already loaded when this effect runs and React
   StrictMode may mount the effect twice in dev, so a plain call would run the
   boot twice. This module-level flag makes the boot once per page load: it is
   reset when the module is evaluated again, which only happens on a full page
   load — matching the legacy `DOMContentLoaded` semantics. The flag is set
   BEFORE the async work starts, so a second mount during the same load cannot
   re-enter. */
let bootedOnce = false;

export default function CartPageRuntime() {
  useEffect(() => {
    /* Legacy `<body class="ct-page ct-loading-cart ct-loading-delivery">`. The
       body belongs to the layout, so the classes are applied here on mount
       (before the boot below paints) and removed on unmount — the same
       leak-free pattern the other ported pages use. `renderCart()` removes the
       two loading classes once the cart is painted. */
    document.body.classList.add("ct-page", "ct-loading-cart", "ct-loading-delivery");
    return () => {
      document.body.classList.remove(
        "ct-page",
        "ct-loading-cart",
        "ct-loading-delivery",
        "ct-sheet-open"
      );
    };
  }, []);

  useEffect(() => {
    /* Legacy `cart.html` <body> script order (L411–422):
       razorpay (async), auth-token, config, checkout-key, payment-state,
       payment-verify, order-payload, platform-status, cart-checkout-upgrades,
       cart-bar (mounted before this component), cart-page, navigation.
       The Razorpay SDK is loaded ASYNC (non-blocking) exactly like legacy; a
       test aborts its CDN and installs a fake `window.Razorpay`. */
    loadRazorpay().catch(() => {});
    installEWAuth();
    installEWCheckout();
    installEWPayment();
    installEWPaymentVerify();
    installEWOrderPayload();
    /* platform-status.js is a shared reader; installed once (idempotent). */
    installPlatformStatus();
    /* Chunk C7 + C11: `js/cart-checkout-upgrades.js` (window.CtX) — the
       payment selector, the itemized bill preview, the free-delivery progress
       bar, the platform banners and the CTA blocking. Legacy script order:
       platform-status.js, then cart-checkout-upgrades.js, then cart-page.js.
       `init()` runs synchronously here (the DOM already exists, so the legacy
       `document.readyState === 'loading'` deferral is unnecessary), matching
       the legacy DOMContentLoaded ordering: CtX init before the cart boot. */
    installCartCheckoutUpgrades();
    /* Chunk C2: the cart data layer + money math. Publishes the legacy window
       surface and runs sanitizeLegacyCarts() as the first thing (before any
       cart read), then hydrates the cached profile and the cart extras. */
    installCartPageC2();
    /* Chunk C3: geo + delivery fee. Chunk C4: item rows. Both publish the same
       `window.*` names the legacy classic scripts shared, so C2's
       `typeof window.paintItems === 'function'` / `window.refreshDelivery`
       guards resolve. Legacy script order: cart-page.js is ONE script, so C3
       and C4 install in source order (C3 ranges 216–1066 precede C4 659–771;
       either order works because the installers only assign functions). */
    installCartPageC3();
    installCartPageC4();
    /* Chunk C5: cart extras (note/tip/instructions sheets + toast + the
       background/viewport helpers openSheet/closeSheet already call). Chunk C6:
       the complete-your-meal rail. Both publish the same `window.*` names the
       legacy classic script shared. Legacy script order: cart-page.js is ONE
       script, so they install in source order (C5 handlers 1930–3305 precede
       the C6 rail 2159–2805; either order works because the installers only
       assign functions and attach listeners, and the C6 rail is triggered by
       `renderCart()` which runs after all installers). */
    installCartPageC5();
    installCartPageC6();
    /* Chunk C8: address + profile hydration LIFECYCLE wiring (the
       pageshow/storage/nearbite:address-changed/resize listeners, legacy
       L3309–3346). The C8 FUNCTIONS themselves were already ported by C2/C3;
       this installer only attaches the listeners, exactly as legacy did at
       script-parse time (before the DOMContentLoaded boot below). */
    installCartPageC8();
    /* Chunk C9: placeOrder + idempotency + Razorpay open (cart-page.js
       L1334–1607, 1610–1919). Publishes `window.placeOrder` (the only window
       global this chunk owns — legacy reached it from `onclick="placeOrder()"`).
       Installed AFTER the data/render chunks so the functions it calls
       (calculateCurrentDelivery, ctComputeBreakdown, ctCartGroups, showToast,
       ctSetCheckoutButton, EWOrderPayload, EWCheckout, EWPaymentVerify) already
       resolve, and BEFORE the boot below (legacy: cart-page.js is ONE script, so
       placeOrder exists before DOMContentLoaded fires). */
    installCartPageC9();

    if (bootedOnce) return;
    bootedOnce = true;

    /* Legacy `DOMContentLoaded` body (L3346–3359): sync the footer offset,
       observe the footer for resize, load the address, then render the cart. */
    (async () => {
      syncFooterOffset();
      if (typeof window !== "undefined" && (window as any).ResizeObserver) {
        const footer = document.getElementById("checkout-footer");
        if (footer) new (window as any).ResizeObserver(syncFooterOffset).observe(footer);
      }
      await loadAddress();
      await renderCart();
    })();
  }, []);

  return null;
}

/* Exported for tests: the C2 sheet closer (used by the empty-cart branch). */
export { closeSheet };
