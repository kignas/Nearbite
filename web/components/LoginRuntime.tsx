"use client";

/* ================================================================
   EATSWADA — LOGIN PAGE RUNTIME  (login.html script tags)
   ----------------------------------------------------------------
   Legacy `login.html` loaded, in order:

     eatswada-theme.js            -> <ShellRuntime/> (layout) installs it
     eatswada-header-theme.js     -> <ShellRuntime/> (layout) installs it
     firebase-app-compat 10.14.1  -> loadFirebaseCompat()
     firebase-auth-compat 10.14.1 -> loadFirebaseCompat()
     js/auth-token.js             -> installEWAuth()
     config.js                    -> lib/config.ts (imported first)
     inline script (L668–1183)    -> installLoginPage() (lib/login-page.ts)
     navigation.js                -> <ShellRuntime/> (layout) installs it

   <ShellRuntime/> (layout) owns the theme / header-theme / navigation globals
   and the global fetch timeout wrapper, so this page must NOT install them
   again. The Firebase SDK is requested here (React cannot put a blocking
   <script> in the tree); the auth harness stubs `window.firebase` first and
   aborts the CDN, so the real SDK is never fetched in tests.
   ================================================================ */
import { useEffect } from "react";
import "../lib/config";
import { installEWAuth } from "../lib/ew-auth";
import { loadFirebaseCompat } from "../lib/firebase-loader";
import { installLoginPage } from "../lib/login-page";

export default function LoginRuntime() {
  useEffect(() => {
    installEWAuth();
    loadFirebaseCompat().then(() => {
      installLoginPage();
    });
  }, []);

  return null;
}
