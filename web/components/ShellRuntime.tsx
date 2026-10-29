"use client";

/* ================================================================
   EATSWADA — SHARED SHELL RUNTIME
   ----------------------------------------------------------------
   Installs the browser-only globals the shared shell owns, in the same
   order the legacy pages loaded them:

     eatswada-theme.js        -> installTheme
     eatswada-header-theme.js -> installHeaderTheme
     navigation.js            -> installNavigation
     favorites.js             -> installFavorites
     address-store.js         -> installAddressStore
     safe-html.js             -> installSafeHtml

   Every installer is idempotent and a no-op on the server. Renders nothing.
   ================================================================ */
import { useEffect } from "react";
import { installTheme } from "../lib/theme";
import { installHeaderTheme } from "../lib/header-theme";
import { installNavigation } from "../lib/navigation";
import { installFavorites } from "../lib/favorites";
import { installAddressStore } from "../lib/address-store";
import { installSafeHtml } from "../lib/safe-html";

export default function ShellRuntime() {
  useEffect(() => {
    installSafeHtml();
    installTheme();
    installHeaderTheme();
    installNavigation();
    installFavorites();
    installAddressStore();
  }, []);

  return null;
}
