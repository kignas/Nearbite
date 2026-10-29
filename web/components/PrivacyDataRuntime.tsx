"use client";

/* ================================================================
   EATSWADA — PRIVACY & DATA RUNTIME
   ----------------------------------------------------------------
   Legacy `privacy-data.html` loaded `eatswada-theme.js`,
   `eatswada-header-theme.js`, `js/auth-token.js`, `config.js`, `safe-html.js`,
   then its inline script, then `navigation.js`. Theme / header-theme /
   safe-html / navigation are owned by the layout's `<ShellRuntime/>`;
   `installEWAuth()` covers auth-token and this runtime installs the inline
   script (config is imported by lib/config.ts).
   ================================================================ */
import { useEffect } from "react";
import { installEWAuth } from "../lib/ew-auth";
import { installPrivacyDataPage } from "../lib/privacy-data-page";

export default function PrivacyDataRuntime() {
  useEffect(() => {
    installEWAuth();
    installPrivacyDataPage();
  }, []);

  return null;
}
