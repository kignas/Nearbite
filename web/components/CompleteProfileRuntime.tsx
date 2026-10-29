"use client";

/* ================================================================
   EATSWADA — COMPLETE PROFILE RUNTIME  (complete-profile.html scripts)
   ----------------------------------------------------------------
   Legacy `complete-profile.html` loaded, in order:

     eatswada-theme.js        -> <ShellRuntime/> (layout) installs it
     eatswada-header-theme.js -> <ShellRuntime/> (layout) installs it
     js/auth-token.js         -> installEWAuth()
     config.js                -> lib/config.ts (imported by the page lib)
     firebase-app-compat      -> loadFirebaseCompat()
     firebase-auth-compat     -> loadFirebaseCompat()
     inline script (L405–542) -> installCompleteProfile()
     navigation.js            -> <ShellRuntime/> (layout) installs it

   The Firebase SDK is requested here (React cannot put a blocking <script> in
   the tree). The auth harness stubs `window.firebase` first and aborts the
   CDN, so the real SDK is never fetched in tests.
   ================================================================ */
import { useEffect } from "react";
import "../lib/config";
import { installEWAuth } from "../lib/ew-auth";
import { loadFirebaseCompat } from "../lib/firebase-loader";
import { installCompleteProfile } from "../lib/complete-profile";

export default function CompleteProfileRuntime() {
  useEffect(() => {
    installEWAuth();
    loadFirebaseCompat().then(() => {
      installCompleteProfile();
    });
  }, []);

  return null;
}
