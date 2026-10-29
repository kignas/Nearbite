"use client";

/* ================================================================
   EATSWADA — ORDERS RUNTIME  (orders.html script tags)
   ----------------------------------------------------------------
   Legacy `orders.html` loaded, in order:

     eatswada-theme.js        -> <ShellRuntime/> (layout) installs it
     eatswada-header-theme.js -> <ShellRuntime/> (layout) installs it
     js/auth-token.js         -> installEWAuth()
     config.js                -> lib/config.ts (imported by lib/orders-page.ts)
     safe-html.js             -> <ShellRuntime/> (layout) installs it
     firebase-app-compat      -> loadFirebaseCompat()
     firebase-messaging-compat-> loadFirebaseCompat()
     push.js                  -> installPush()
     order-status.js          -> installOrderStatus()
     eatswada-ux.js           -> installEatswadaUx()
     inline script (L479–1015)-> installOrdersPage()
     navigation.js            -> <ShellRuntime/> (layout) installs it

   <ShellRuntime/> (layout) owns the theme / header-theme / navigation /
   favorites / address-store / safe-html globals, so this page must NOT
   install them again. `js/auth-token.js` (window.EWAuth) and the Firebase
   SDK are installed here; the auth harness stubs `window.firebase` first and
   aborts the CDN, so the real SDK is never fetched in tests.
   ================================================================ */
import { useEffect } from "react";
import "../lib/config";
import { installEWAuth } from "../lib/ew-auth";
import { loadFirebaseCompat } from "../lib/firebase-loader";
import { installPush } from "../lib/push";
import { installOrderStatus } from "../lib/order-status";
import { installEatswadaUx } from "../lib/eatswada-ux";
import { installOrdersPage } from "../lib/orders-page";
import { startInlineHandlerPromotion } from "../lib/inline-handlers";

export default function OrdersRuntime() {
  useEffect(() => {
    installEWAuth();
    loadFirebaseCompat().then(() => {
      installPush();
    });
    installOrderStatus();
    installEatswadaUx();
    installOrdersPage();
    startInlineHandlerPromotion();
  }, []);

  return null;
}
