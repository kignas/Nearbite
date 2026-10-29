"use client";

/* ================================================================
   EATSWADA — ORDER SUPPORT RUNTIME  (order-support.html script tags)
   ----------------------------------------------------------------
   Legacy `order-support.html` loaded, in order:

     eatswada-theme.js        -> <ShellRuntime/> (layout) installs it
     eatswada-header-theme.js -> <ShellRuntime/> (layout) installs it
     js/auth-token.js         -> installEWAuth()
     config.js                -> lib/config.ts (imported by lib/order-support-page.ts)
     safe-html.js             -> <ShellRuntime/> (layout) installs it
     firebase-app-compat      -> loadFirebaseCompat()
     firebase-messaging-compat-> loadFirebaseCompat()
     push.js                  -> installPush()
     customer-upload.js       -> installCustomerUpload()
     order-status.js          -> installOrderStatus()
     eatswada-ux.js           -> installEatswadaUx()
     SUPPORT_ADAPTER + inline script -> installOrderSupportPage()
     navigation.js            -> <ShellRuntime/> (layout) installs it

   <ShellRuntime/> (layout) owns the theme / header-theme / navigation /
   favorites / address-store / safe-html globals, so this page must NOT
   install them again.
   ================================================================ */
import { useEffect } from "react";
import "../lib/config";
import { installEWAuth } from "../lib/ew-auth";
import { loadFirebaseCompat } from "../lib/firebase-loader";
import { installPush } from "../lib/push";
import { installCustomerUpload } from "../lib/customer-upload";
import { installOrderStatus } from "../lib/order-status";
import { installEatswadaUx } from "../lib/eatswada-ux";
import { installOrderSupportPage } from "../lib/order-support-page";

export default function OrderSupportRuntime() {
  useEffect(() => {
    installEWAuth();
    loadFirebaseCompat().then(() => {
      installPush();
    });
    installCustomerUpload();
    installOrderStatus();
    installEatswadaUx();
    installOrderSupportPage();
  }, []);

  return null;
}
