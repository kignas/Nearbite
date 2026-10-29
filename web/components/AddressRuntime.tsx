"use client";

/* ================================================================
   EATSWADA — ADDRESS RUNTIME  (address.html script tags)
   ----------------------------------------------------------------
   Legacy `address.html` loaded, in order:

     eatswada-theme.js        -> <ShellRuntime/> (layout) installs it
     eatswada-header-theme.js -> <ShellRuntime/> (layout) installs it
     js/auth-token.js         -> installEWAuth()
     config.js                -> lib/config.ts (imported by the page libs)
     address-store.js         -> <ShellRuntime/> (layout) installs it
     address-api.js           -> installAddressAPI()
     address-model.js         -> installAddressModel()
     safe-html.js             -> <ShellRuntime/> (layout) installs it
     address.js               -> installAddressPage()
     navigation.js            -> <ShellRuntime/> (layout) installs it

   <ShellRuntime/> (layout) owns the theme / header-theme / navigation /
   favorites / address-store / safe-html globals, so this page must NOT
   install them again. `js/auth-token.js` (window.EWAuth) is installed here.
   ================================================================ */
import { useEffect } from "react";
import "../lib/config";
import { installEWAuth } from "../lib/ew-auth";
import { installAddressAPI } from "../lib/address-api";
import { installAddressModel } from "../lib/address-model";
import { installAddressPage } from "../lib/address-page";
import { startInlineHandlerPromotion } from "../lib/inline-handlers";

export default function AddressRuntime() {
  useEffect(() => {
    installEWAuth();
    installAddressAPI();
    installAddressModel();
    installAddressPage();
    startInlineHandlerPromotion();
  }, []);

  return null;
}
