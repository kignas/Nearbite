"use client";

/* ================================================================
   EATSWADA — LEGACY <body> CLASS
   ----------------------------------------------------------------
   Several legacy pages carry a class on `<body>` (e.g. `ew-doc`,
   `ew-doc ew-doc-refund`). The `<body>` element belongs to the shared layout in
   Next, so the classes are applied on mount and removed on unmount — the same
   leak-free pattern the ported cart page uses. Renders nothing.
   ================================================================ */
import { useEffect } from "react";

export default function BodyClass({ className }: { className: string }) {
  useEffect(() => {
    const classes = className.split(/\s+/).filter(Boolean);
    document.body.classList.add(...classes);
    return () => document.body.classList.remove(...classes);
  }, [className]);

  return null;
}
