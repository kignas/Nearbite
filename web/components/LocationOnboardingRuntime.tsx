"use client";

/* ================================================================
   EATSWADA — LOCATION ONBOARDING RUNTIME  (location-onboarding.html scripts)
   ----------------------------------------------------------------
   Legacy `location-onboarding.html` loaded, in order:

     eatswada-theme.js        -> <ShellRuntime/> (layout) installs it
     eatswada-header-theme.js -> <ShellRuntime/> (layout) installs it
     config.js                -> lib/config.ts (imported by the page lib)
     safe-html.js             -> installSafeHtml()
     address-model.js         -> installAddressModel()
     leaflet 1.9.4 (unpkg)    -> loadLeaflet()
     inline script (L362–898) -> installLocationOnboarding()
     navigation.js            -> <ShellRuntime/> (layout) installs it

   Leaflet is requested here (React cannot put a blocking <script> in the
   tree); the harness injects a fake `window.L` first and aborts the CDN.
   ================================================================ */
import { useEffect } from "react";
import "../lib/config";
import { installSafeHtml } from "../lib/safe-html";
import { installAddressModel } from "../lib/address-model";
import { loadLeaflet } from "../lib/leaflet-loader";
import { installLocationOnboarding } from "../lib/location-onboarding";

export default function LocationOnboardingRuntime() {
  useEffect(() => {
    installSafeHtml();
    installAddressModel();
    loadLeaflet()
      .then(() => installLocationOnboarding())
      .catch(() => {
        /* Legacy had no error handler on the Leaflet tag; if it fails the
           inline script throws on `L.map` exactly as before. */
        installLocationOnboarding();
      });
  }, []);

  return null;
}
