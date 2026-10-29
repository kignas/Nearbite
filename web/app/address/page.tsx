/* ================================================================
   EATSWADA — ADDRESS  (`address.html` → `/address`)
   ----------------------------------------------------------------
   CSS import order is the EXACT `<link>` / `<style>` order of legacy
   `address.html`:
     1. style.css                        (L21)
     2. address-flow.css?v=20260923-refine (L30)
     3. css/eatswada-ui-system.css?v=20260923-typography (L41)
     4. eatswada-theme.css               (L42)
     5. eatswada-header-theme.css        (L43)
     6. css/eatswada-back-button.css?v=20260928-back (L44)
   Every file is byte-for-byte the legacy copy in web/styles/legacy/. The
   Manrope + Font Awesome CDN sheets come from layout.tsx. `address-v3.css` is
   NOT loaded by this page (legacy comment: "The address flow is styled only by
   address-flow.css").

   Head items verbatim from address.html L46–54: title, description, robots
   `noindex, nofollow`, OG and twitter. Canonical / og:url are rewritten from
   `…/address.html` to the clean `…/address`. No JSON-LD.
   ================================================================ */
import type { Metadata } from "next";
import "../../styles/legacy/style.css";
import "../../styles/legacy/address-flow.css";
import "../../styles/legacy/css/eatswada-ui-system.css";
import "../../styles/legacy/eatswada-theme.css";
import "../../styles/legacy/eatswada-header-theme.css";
import "../../styles/legacy/css/eatswada-back-button.css";
import AddressShell from "../../components/AddressShell";

/* Verbatim from address.html. */
export const metadata: Metadata = {
  title: "Addresses · Eatswada | EatSwada",
  description:
    "Explore EatSwada, your local food ordering platform in Maynaguri, West Bengal.",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://eatswada.com/address" },
  openGraph: {
    type: "website",
    siteName: "EatSwada",
    title: "Addresses · Eatswada | EatSwada",
    description:
      "Explore EatSwada, your local food ordering platform in Maynaguri, West Bengal.",
    url: "https://eatswada.com/address.html",
  },
  twitter: { card: "summary" },
};

export default function AddressPage() {
  return <AddressShell />;
}
