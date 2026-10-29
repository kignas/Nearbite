"use client";

/* ================================================================
   EATSWADA — ADDRESS-NEW RUNTIME  (address-new.html script tags)
   ----------------------------------------------------------------
   Legacy `address-new.html` loaded, in order:

     eatswada-theme.js        -> <ShellRuntime/> (layout) installs it
     eatswada-header-theme.js -> <ShellRuntime/> (layout) installs it
     js/auth-token.js         -> installEWAuth()
     config.js                -> lib/config.ts (imported by the page libs)
     address-store.js         -> <ShellRuntime/> (layout) installs it
     address-api.js           -> installAddressAPI()
     address-model.js         -> installAddressModel()
     safe-html.js             -> <ShellRuntime/> (layout) installs it
     address-new.js           -> installAddressNewPage()
     navigation.js            -> <ShellRuntime/> (layout) installs it

   <ShellRuntime/> (layout) owns the theme / header-theme / navigation /
   favorites / address-store / safe-html globals, so this page must NOT
   install them again.
   ================================================================ */
import { useEffect } from "react";
import "../lib/config";
import { installEWAuth } from "../lib/ew-auth";
import { installAddressAPI } from "../lib/address-api";
import { installAddressModel } from "../lib/address-model";
import { installAddressNewPage } from "../lib/address-new-page";
import { startInlineHandlerPromotion } from "../lib/inline-handlers";

export default function AddressNewRuntime() {
  useEffect(() => {
    installEWAuth();
    installAddressAPI();
    installAddressModel();
    installAddressNewPage();
    startInlineHandlerPromotion();
  }, []);

  return null;
}
