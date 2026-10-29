/* ================================================================
   EATSWADA — web app manifest (`/manifest.webmanifest`)
   ----------------------------------------------------------------
   Legacy had NO web manifest. AGENTS.md asks for one: name EatSwada,
   standalone, the legacy theme colour and the two existing icons.
   `#E9546B` is the brand/theme colour legacy uses
   (`--hd-primary` in eatswada-header-theme.css and the `theme-color` meta on
   `under99.html`); `#FFFFFF` is the light `--page-bg` legacy paints.
   ================================================================ */
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EatSwada",
    short_name: "EatSwada",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#E9546B",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
