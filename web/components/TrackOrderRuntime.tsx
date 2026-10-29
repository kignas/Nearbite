"use client";

/* ================================================================
   EATSWADA — TRACK ORDER RUNTIME  (track-order.html script tags)
   ----------------------------------------------------------------
   Legacy `track-order.html` loaded, in order:

     eatswada-theme.js        -> <ShellRuntime/> (layout) installs it
     eatswada-header-theme.js -> <ShellRuntime/> (layout) installs it
     leaflet 1.9.4 (unpkg)    -> loadLeaflet()  (head, L20)
     js/auth-token.js         -> installEWAuth()
     config.js                -> lib/config.ts (imported by lib/track-order-page.ts)
     safe-html.js             -> <ShellRuntime/> (layout) installs it
     firebase-app-compat      -> loadFirebaseCompat()
     firebase-messaging-compat-> loadFirebaseCompat()
     push.js                  -> installPush()
     order-status.js          -> installOrderStatus()
     customer-upload.js       -> installCustomerUpload()
     inline script (L730–1844)-> installTrackOrderPage()
     navigation.js            -> <ShellRuntime/> (layout) installs it

   <ShellRuntime/> (layout) owns the theme / header-theme / navigation /
   favorites / address-store / safe-html globals, so this page must NOT
   install them again. Leaflet is requested here (React cannot put a blocking
   <script> in the tree); the harness injects a fake `window.L` first and
   aborts the CDN, so the real library is never fetched in tests.
   ================================================================ */
import { useEffect } from "react";
import "../lib/config";
import { installEWAuth } from "../lib/ew-auth";
import { loadFirebaseCompat } from "../lib/firebase-loader";
import { installPush } from "../lib/push";
import { installOrderStatus } from "../lib/order-status";
import { installCustomerUpload } from "../lib/customer-upload";
import { loadLeaflet } from "../lib/leaflet-loader";
import { installTrackOrderPage } from "../lib/track-order-page";
import { startInlineHandlerPromotion } from "../lib/inline-handlers";

export default function TrackOrderRuntime() {
  useEffect(() => {
    installEWAuth();
    loadFirebaseCompat().then(() => {
      installPush();
    });
    installOrderStatus();
    installCustomerUpload();
    loadLeaflet()
      .then(() => installTrackOrderPage())
      .catch(() => {
        /* Legacy had no error handler on the Leaflet tag; if it fails the
           inline script throws on `L` exactly as before (ensureMap returns
           early when `L` is undefined). */
        installTrackOrderPage();
      });
    startInlineHandlerPromotion();
  }, []);

  return null;
}
