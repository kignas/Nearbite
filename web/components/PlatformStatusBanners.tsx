"use client";

/* ================================================================
   EATSWADA — PLATFORM STATUS BANNER HOST
   ----------------------------------------------------------------
   Port of `EWPlatform.mount(el)` from legacy `platform-status.js`.
   Renders the same `<div class="ps-host" hidden>` host the legacy pages
   carry (`<div id="home-platform-banners" class="ps-host" hidden></div>`)
   and lets the shared lib paint the `.ps-banner` markup into it, so
   css/platform-status.css styles it unchanged.
   ================================================================ */
import { useEffect, useId, useRef } from "react";
import { installPlatformStatus, mount } from "../lib/platform-status";

export default function PlatformStatusBanners({
  id,
  className,
}: {
  id?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const autoId = useId();

  useEffect(() => {
    installPlatformStatus();
    if (ref.current) mount(ref.current);
  }, []);

  return (
    <div
      ref={ref}
      id={id || autoId}
      className={"ps-host" + (className ? " " + className : "")}
      hidden
    />
  );
}
