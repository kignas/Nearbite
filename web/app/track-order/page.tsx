/* ================================================================
   EATSWADA — TRACK ORDER  (`track-order.html` → `/track-order`)
   ----------------------------------------------------------------
   CSS import order is the EXACT `<link>` / `<style>` order of legacy
   `track-order.html`:
     1. Leaflet 1.9.4 CSS (unpkg, L19)   → rendered as the same CDN <link>
                                            (integrity hash kept; the sheet's
                                            url(images/…) refs make a local
                                            import impossible)
     2. inline <style> L22–459           → styles/legacy/track-order-inline.css
     3. style.css                        (L460)
     4. css/eatswada-ui-system.css?v=20260923-typography (L461)
     5. eatswada-theme.css               (L462)
     6. eatswada-header-theme.css        (L463)
     7. css/eatswada-back-button.css?v=20260928-back (L464)
   Every local file is byte-for-byte the legacy copy in web/styles/legacy/.
   The Manrope + Font Awesome 6.5.2 CDN sheets come from layout.tsx.

   Head items verbatim from track-order.html L466–474: title, description,
   robots `noindex, nofollow`, OG and twitter. Canonical / og:url are rewritten
   from `…/track-order.html` to the clean `…/track-order`. No JSON-LD.
   ================================================================ */
import type { Metadata } from "next";
import "../../styles/legacy/track-order-inline.css";
import "../../styles/legacy/style.css";
import "../../styles/legacy/css/eatswada-ui-system.css";
import "../../styles/legacy/eatswada-theme.css";
import "../../styles/legacy/eatswada-header-theme.css";
import "../../styles/legacy/css/eatswada-back-button.css";
import TrackOrderShell from "../../components/TrackOrderShell";

/* Verbatim from track-order.html. */
export const metadata: Metadata = {
  title: "Track order – Eatswada | EatSwada",
  description:
    "Explore EatSwada, your local food ordering platform in Maynaguri, West Bengal.",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://eatswada.com/track-order" },
  openGraph: {
    type: "website",
    siteName: "EatSwada",
    title: "Track order – Eatswada | EatSwada",
    description:
      "Explore EatSwada, your local food ordering platform in Maynaguri, West Bengal.",
    url: "https://eatswada.com/track-order.html",
  },
  twitter: { card: "summary" },
};

/* The Leaflet 1.9.4 stylesheet stays a CDN <link> exactly as legacy had it
   (same URL + integrity). React 19 hoists this <link> into <head>. */
const LEAFLET_CSS = {
  rel: "stylesheet",
  href: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  integrity: "sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H",
  crossOrigin: "anonymous",
} as const;

export default function TrackOrderPage() {
  return (
    <>
      <link {...LEAFLET_CSS} />
      <TrackOrderShell />
    </>
  );
}
