"use client";

/* ================================================================
   EATSWADA — HOME PAGE RUNTIME
   ----------------------------------------------------------------
   Installs the browser-only modules the Home page owns, in the same order
   the legacy index.html loaded them (after the shared shell):

     restaurant-card.js            -> installRestaurantCard
     home.js                       -> installHome
     home-banners.js               -> installHomeBanners
     search-overlay.js             -> installSearchOverlay
     new-user-location-prompt.js   -> installNewUserLocationPrompt

   The shared shell (theme, header-theme, navigation, favorites,
   address-store, safe-html) is installed by <ShellRuntime/> in layout.tsx,
   which is a sibling placed before {children}, so it runs first.
   <CartBar/> (which owns window.updateGlobalCart) is mounted before this
   component, so its effect also runs first. Renders nothing.
   ================================================================ */
import { useEffect } from "react";
import { installRestaurantCard } from "../lib/restaurant-card";
import { installHome } from "../lib/home";
import { installHomeBanners } from "../lib/home-banners";
import { installSearchOverlay } from "../lib/search-overlay";
import { installNewUserLocationPrompt } from "../lib/new-user-location-prompt";

export default function HomeRuntime() {
  useEffect(() => {
    installRestaurantCard();
    installHome();
    installHomeBanners();
    installSearchOverlay();
    installNewUserLocationPrompt();
  }, []);

  return null;
}
