"use client";

/* ================================================================
   EATSWADA — RATE US RUNTIME
   ----------------------------------------------------------------
   Legacy `rate-us.html` loaded `js/auth-token.js` (→ installEWAuth) then its
   own inline script (→ installRateUsPage). Both are installed here in the same
   order; theme / header-theme are owned by the layout's `<ShellRuntime/>`.
   ================================================================ */
import { useEffect } from "react";
import { installEWAuth } from "../lib/ew-auth";
import { installRateUsPage } from "../lib/rate-us-page";

export default function RateUsRuntime() {
  useEffect(() => {
    installEWAuth();
    installRateUsPage();
  }, []);

  return null;
}
