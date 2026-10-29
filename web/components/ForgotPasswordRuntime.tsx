"use client";

/* ================================================================
   EATSWADA — FORGOT PASSWORD RUNTIME  (forgot-password.html scripts)
   ----------------------------------------------------------------
   Legacy `forgot-password.html` loaded, in order:

     eatswada-theme.js        -> <ShellRuntime/> (layout) installs it
     eatswada-header-theme.js -> <ShellRuntime/> (layout) installs it
     config.js                -> lib/config.ts (imported by the page lib)
     safe-html.js             -> installSafeHtml()
     inline script (L42–147)  -> installForgotPassword()
     navigation.js            -> <ShellRuntime/> (layout) installs it

   This page has NO Firebase and NO localStorage/sessionStorage.
   ================================================================ */
import { useEffect } from "react";
import "../lib/config";
import { installSafeHtml } from "../lib/safe-html";
import { installForgotPassword } from "../lib/forgot-password";

export default function ForgotPasswordRuntime() {
  useEffect(() => {
    installSafeHtml();
    installForgotPassword();
  }, []);

  return null;
}
