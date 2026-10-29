"use client";

/* ================================================================
   EATSWADA — SUPPORT RUNTIME  (support.html script tags)
   ----------------------------------------------------------------
   Legacy `support.html` loaded, in order:

     eatswada-theme.js        -> <ShellRuntime/> (layout) installs it
     eatswada-header-theme.js -> <ShellRuntime/> (layout) installs it
     js/auth-token.js         -> installEWAuth()
     safe-html.js             -> <ShellRuntime/> (layout) installs it
     inline script            -> installSupportPage()
     navigation.js            -> <ShellRuntime/> (layout) installs it

   <ShellRuntime/> owns the theme / header-theme / navigation / safe-html
   globals; this page installs only `js/auth-token.js` (window.EWAuth) and the
   inline script, exactly like the legacy order.
   ================================================================ */
import { useEffect } from "react";
import { installEWAuth } from "../lib/ew-auth";
import { installSupportPage } from "../lib/support-page";

export default function SupportRuntime() {
  useEffect(() => {
    installEWAuth();
    installSupportPage();
  }, []);

  return null;
}
