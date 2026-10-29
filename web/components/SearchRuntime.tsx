"use client";

/* ================================================================
   EATSWADA — SEARCH PAGE RUNTIME
   ----------------------------------------------------------------
   Legacy `search.html` loaded exactly one page script (`search-overlay.js`)
   plus the shared shell, then an inline DOMContentLoaded snippet that opened
   the overlay in full-page mode from the URL.

   The shared shell is installed by <ShellRuntime/> in layout.tsx (before
   {children}). This installs the overlay, applies search.html's inline
   `<body style="margin:0;background:#fff;font-family:Inter,system-ui,sans-serif">`
   (inline, so it keeps the same cascade position — `eatswada-ui-system.css`
   still wins for `font-family` via `!important`, exactly as in legacy), then
   runs the bootstrapper. Renders nothing.
   ================================================================ */
import { useEffect } from "react";
import { installSearchOverlay } from "../lib/search-overlay";
import { installSearchPage } from "../lib/search-page";

export default function SearchRuntime() {
  useEffect(() => {
    installSearchOverlay();
    document.body.setAttribute(
      "style",
      "margin:0;background:#fff;font-family:Inter,system-ui,sans-serif"
    );
    installSearchPage();
  }, []);

  return null;
}
