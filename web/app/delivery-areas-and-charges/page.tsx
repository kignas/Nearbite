/* ================================================================
   EATSWADA — DELIVERY AREAS & CHARGES
   (`delivery-areas-and-charges.html` → `/delivery-areas-and-charges`)
   ----------------------------------------------------------------
   CSS: the exact `<link>` order of delivery-areas-and-charges.html L8–L17:
     1. eatswada-theme.css
     2. eatswada-header-theme.css
     3. css/eatswada-ui-system.css?v=20260923-typography
     4. css/eatswada-secondary-pages.css?v=20260929-brand
     5. css/eatswada-back-button.css
     6. css/eatswada-site-footer.css?v=20260929-footer1
     7. css/eatswada-document-typography.css?v=20260929-core-pages
   The Manrope + Font Awesome CDN sheets come from layout.tsx.

   Head items verbatim from delivery-areas-and-charges.html: title, description,
   robots `index, follow` and the lone `og:url` (only that OG tag is present).
   Canonical / og:url stay the clean URL the legacy page already used. No
   JSON-LD.

   The page loads `eatswada-header-theme.js` and `navigation.js` (shared shell).
   ================================================================ */
import type { Metadata } from "next";
import "../../styles/legacy/eatswada-theme.css";
import "../../styles/legacy/eatswada-header-theme.css";
import "../../styles/legacy/css/eatswada-ui-system.css";
import "../../styles/legacy/eatswada-secondary-pages.css";
import "../../styles/legacy/css/eatswada-back-button.css";
import "../../styles/legacy/css/eatswada-site-footer.css";
import "../../styles/legacy/css/eatswada-document-typography.css";
import DeliveryAreasShell from "../../components/DeliveryAreasShell";

/* Verbatim from delivery-areas-and-charges.html. */
export const metadata: Metadata = {
  title: "Delivery Areas & Charges | Eatswada",
  description:
    "Find out where Eatswada delivers and how delivery charges are shown before checkout.",
  robots: { index: true, follow: true },
  alternates: { canonical: "https://eatswada.com/delivery-areas-and-charges" },
};

export default function DeliveryAreasPage() {
  return (
    <>
      <meta
        property="og:url"
        content="https://eatswada.com/delivery-areas-and-charges"
      />
      <DeliveryAreasShell />
    </>
  );
}
