"use client";

/* ================================================================
   EATSWADA — RESTAURANT SHELL PAGE RUNTIME
   ----------------------------------------------------------------
   Legacy `restaurant-shell.html` loaded, in order:

     config.js         -> lib/config.ts   (imported by lib/api.ts)
     safe-html.js      -> <ShellRuntime/> (layout) installs it
     api.js            -> lib/api.ts      (installs window.API on import)
     search-overlay.js -> installSearchOverlay (injects search-overlay.css)
     cart-bar.js       -> <CartBar/>      (mounted before this component)
     the main inline script (lines 313–3107)
     navigation.js     -> <ShellRuntime/> (layout) installs it
     js/pairing-suggestions.js / js/menu-jump.js  -> chunks 12a / 12b (below)

   <ShellRuntime/> (in the layout) owns the theme / header-theme / navigation /
   favorites / address / safe-html globals. <CartBar/> is mounted before this
   component so its effect (and the cart data layer) installs first. Here we
   install, in the legacy order, everything that belongs to this page.

   Phase 2 chunks 1–3 install only: the inline image helpers, the page state,
   the diet quick chips, the category-nav sentinel / scroll spy and the landing
   glide. Renders nothing.
   ================================================================ */
import { useEffect } from "react";
import "../lib/api";
import { installSearchOverlay } from "../lib/search-overlay";
import { installRestaurantShell } from "../lib/restaurant-shell";
import { installRestaurantShellChunks45 } from "../lib/restaurant-shell-page";
import {
  installRestaurantShellChunks67,
  bootRestaurantShellPage,
} from "../lib/restaurant-shell-menu";
import { installRestaurantShellChunks8 } from "../lib/restaurant-shell-search";
import { installRestaurantShellChunks9 } from "../lib/restaurant-shell-dish";
import { installRestaurantShellChunks10 } from "../lib/restaurant-shell-hint";
import { installRestaurantCustomize } from "../lib/restaurant-customize";
import { installPairingSuggestions } from "../lib/pairing-suggestions";
import { installMenuJump } from "../lib/menu-jump";
import { installCartGlobals } from "../lib/cart";

/* Legacy ran `loadRestaurantPage` from a `DOMContentLoaded` listener, i.e.
   EXACTLY ONCE per page load. In Next the DOM is already loaded when this
   effect runs and React StrictMode may mount the effect twice in dev, so a
   plain call would fetch `/restaurants/:id` and `/restaurants/:id/menu` twice.
   This module-level flag makes the boot once per page load: it is reset when
   the module is evaluated again, which only happens on a full page load —
   matching the legacy `DOMContentLoaded` semantics. The flag is set BEFORE the
   async load starts, so a second mount during the same load cannot re-enter.
   Verified: both pages issue exactly one request to each route
   (web/scripts/shell-boot-parity.mjs). */
let bootedOnce = false;

export default function RestaurantShellRuntime() {
  useEffect(() => {
    /* search-overlay.js is loaded by the legacy page (it injects
       search-overlay.css as a side effect) but this page never opens it. */
    installSearchOverlay();
    installRestaurantShell();
    /* Chunks 4–5: the cart-write helpers / ADD markup, the tabs + Info pane +
       reviews + header render. They publish the same `window` function set the
       legacy classic script did. */
    installRestaurantShellChunks45();
    /* Chunks 6–7: the menu render, data loading, the error/empty states, the
       (dead) advanced filter sheet and the quick-filter / in-menu-search state.
       This is the first installer that CALLS anything — the boot below. */
    installRestaurantShellChunks67();
    /* Chunk 8: the full-screen menu search page (`ss*`). Publishes
       `ewOpenSearch`/`ewCloseSearch`/`ssFinishClose`/`ssGoCategory`. */
    installRestaurantShellChunks8();
    /* Chunk 9: the dish detail sheet (`ds*`), the menu-footer reveal and the
       sticky search bar. Installed BEFORE the boot so the sticky bar's
       IntersectionObserver on `#res-name` is watching when the header
       renders. */
    installRestaurantShellChunks9();
    /* Chunk 10: the (dead) inline search row, the minimum-order / free-delivery
       hint, the cart hook, the Escape handler and the tab swipe gestures.
       Installed BEFORE the boot so `window.renderOrderHint` (called by
       `loadRestaurantPage`) and `window.toggleMenuSearch` (called by
       `openRestaurantSearchPage`) resolve. The boot itself stays below, so
       `loadRestaurantPage` still runs exactly once per page load.

       `installCartGlobals()` is idempotent and re-asserts `window.updateCart`
       here: legacy loaded `cart-bar.js` BEFORE this inline script, but
       `<CartBar/>` defers its own `installCartGlobals()` behind a `portalTarget`
       state set in a LATER render — so without this line chunk 10's cart hook
       would find no `window.updateCart` and skip the wrap. */
    installCartGlobals();
    installRestaurantShellChunks10();
    /* Chunk 11: the customization sheet IIFE (legacy L3110–3302). Publishes
       only `window.ewOpenCustomize`, which chunk 4's `makeBtnHTML` and the dish
       sheet CTA call by that name. Installed AFTER chunks 10 and BEFORE the
       boot; legacy parsed this block before `DOMContentLoaded`. */
    installRestaurantCustomize();
    /* Chunk 12: `js/pairing-suggestions.js` + `js/menu-jump.js` (legacy L3304 and
       L3305 — the LAST two scripts on the page). Pairing wraps
       `window.updateCart` (chunk 10's `__ewHinted` wrapper) and
       `window.refreshCustomizedCartQuantities` (chunk 4), so it must be
       installed AFTER both to be the OUTERMOST wrapper, exactly as in legacy.
       Menu-jump reads the rendered menu and publishes only the `#ew-mj-*` DOM. */
    installPairingSuggestions();
    installMenuJump();

    if (bootedOnce) return;
    bootedOnce = true;
    bootRestaurantShellPage();
  }, []);

  return null;
}
