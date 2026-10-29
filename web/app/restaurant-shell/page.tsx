/* ================================================================
   EATSWADA — RESTAURANT SHELL PAGE  (`/restaurant-shell`)
   ----------------------------------------------------------------
   This route is the RAW shell. Legacy `restaurant-shell.html` carried NO
   `<link rel="canonical">` and NO `<meta name="robots">`; its noindex came
   solely from the `X-Robots-Tag: noindex, nofollow` response header, which
   `next.config.js` sets and `headers-redirects-parity.mjs` verifies. The port
   therefore emits neither, matching legacy exactly.

   The markup and CSS imports live in `components/RestaurantShell.tsx`, which is
   shared with `app/restaurant/page.tsx` so the two routes can never drift. This
   file only supplies the metadata.

   `/restaurant` is the ONLY indexed restaurant URL; it renders the same
   component with the SEO metadata from the SEO layer.
   ================================================================ */
import type { Metadata } from "next";
import RestaurantShell from "../../components/RestaurantShell";

export const metadata: Metadata = {
  /* Legacy `<title>Menu – EatSwada</title>`. `/restaurant` overwrites this with
     the restaurant name in the SEO layer. */
  title: "Menu – EatSwada",
  /* Legacy line 13: <meta name="view-transition" content="same-origin"> */
  other: { "view-transition": "same-origin" },
  /* Legacy line 50: <meta name="twitter:card" content="summary"> */
  twitter: { card: "summary" },
};

export default function RestaurantShellPage() {
  return <RestaurantShell />;
}
