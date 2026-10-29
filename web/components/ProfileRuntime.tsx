"use client";

/* ================================================================
   EATSWADA — PROFILE RUNTIME  (profile.html script tags)
   ----------------------------------------------------------------
   Legacy `profile.html` loaded, in order:

     eatswada-theme.js        -> <ShellRuntime/> (layout) installs it
     eatswada-header-theme.js -> <ShellRuntime/> (layout) installs it
     js/auth-token.js         -> (installed by <ShellRuntime/>? no — see note)
     config.js                -> lib/config.ts (imported by lib/profile-page.ts)
     safe-html.js             -> <ShellRuntime/> (layout) installs it
     inline script (L436–614) -> installProfilePage()
     api.js                   -> lib/api.ts (window.API at import time)
     favorites.js             -> <ShellRuntime/> (layout) installs it
     restaurant-card.js       -> installRestaurantCard()
     navigation.js            -> <ShellRuntime/> (layout) installs it

   <ShellRuntime/> (layout) already owns theme / header-theme / navigation /
   favorites / address-store / safe-html, so this page must NOT install them
   again. `api.js` publishes `window.API` at module-evaluation time (import),
   and `restaurant-card.js` is installed here. `js/auth-token.js` (window.EWAuth)
   is installed here too, matching the legacy order.
   ================================================================ */
import { useEffect } from "react";
import "../lib/config";
import "../lib/api";
import { installEWAuth } from "../lib/ew-auth";
import { installRestaurantCard } from "../lib/restaurant-card";
import { installProfilePage } from "../lib/profile-page";
import { startInlineHandlerPromotion } from "../lib/inline-handlers";

export default function ProfileRuntime() {
  useEffect(() => {
    installEWAuth();
    installRestaurantCard();
    installProfilePage();
    startInlineHandlerPromotion();
  }, []);

  return null;
}
