/* ================================================================
   EATSWADA — SEARCH PAGE (port of legacy search.html)
   ----------------------------------------------------------------
   search.html renders no markup of its own: it is a bootstrapper that opens
   the shared search overlay in full-page mode from the URL query. Everything
   visible is built at runtime by search-overlay.js.

   CSS: the exact <link> order of search.html (there is no inline <style>):
     1. css/eatswada-ui-system.css?v=20260923-typography
     2. eatswada-theme.css
     3. eatswada-header-theme.css
   `search-overlay.css` is injected at runtime by lib/search-overlay.ts, in the
   same position the legacy script injected it (after the three links above).
   The Google Fonts sheets live in layout.tsx; this page additionally needs the
   Inter sheet, which only search.html loads (its <body> uses Inter).
   ================================================================ */
import type { Metadata } from "next";
import "../../styles/legacy/css/eatswada-ui-system.css";
import "../../styles/legacy/eatswada-theme.css";
import "../../styles/legacy/eatswada-header-theme.css";
import SearchRuntime from "../../components/SearchRuntime";

/* Verbatim from search.html. The page is `noindex, nofollow` in legacy. */
export const metadata: Metadata = {
  title: "Search – Eatswada | EatSwada",
  description:
    "Explore EatSwada, your local food ordering platform in Maynaguri, West Bengal.",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://eatswada.com/search.html" },
  openGraph: {
    type: "website",
    siteName: "EatSwada",
    title: "Search – Eatswada | EatSwada",
    description:
      "Explore EatSwada, your local food ordering platform in Maynaguri, West Bengal.",
    url: "https://eatswada.com/search.html",
  },
  twitter: { card: "summary" },
};

export default function SearchPage() {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
      />
      <SearchRuntime />
    </>
  );
}
