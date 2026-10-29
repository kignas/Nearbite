/* ================================================================
   EATSWADA — ADDRESS-NEW  (`address-new.html` → `/address-new`)
   ----------------------------------------------------------------
   CSS import order is the EXACT `<link>` / `<style>` order of legacy
   `address-new.html`:
     1. style.css                        (L22)
     2. inline <style> L29–277           → styles/legacy/address-new-inline.css
     3. address-v3.css?v=20260922-3      (L278)
     4. css/eatswada-ui-system.css?v=20260923-typography (L279)
     5. eatswada-theme.css               (L280)
     6. eatswada-header-theme.css        (L281)
   Every file is byte-for-byte the legacy copy in web/styles/legacy/. The
   Manrope + Font Awesome CDN sheets come from layout.tsx.

   Head items verbatim from address-new.html L283–291: title, description,
   robots `noindex, nofollow`, OG and twitter. Canonical / og:url are rewritten
   from `…/address-new.html` to the clean `…/address-new`. No JSON-LD.
   ================================================================ */
import type { Metadata } from "next";
import "../../styles/legacy/style.css";
import "../../styles/legacy/address-new-inline.css";
import "../../styles/legacy/address-v3.css";
import "../../styles/legacy/css/eatswada-ui-system.css";
import "../../styles/legacy/eatswada-theme.css";
import "../../styles/legacy/eatswada-header-theme.css";
import AddressNewShell from "../../components/AddressNewShell";

/* Verbatim from address-new.html. */
export const metadata: Metadata = {
  title: "Set delivery address · Delivery address · Eatswada | EatSwada",
  description:
    "Explore EatSwada, your local food ordering platform in Maynaguri, West Bengal.",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://eatswada.com/address-new" },
  openGraph: {
    type: "website",
    siteName: "EatSwada",
    title: "Set delivery address · Delivery address · Eatswada | EatSwada",
    description:
      "Explore EatSwada, your local food ordering platform in Maynaguri, West Bengal.",
    url: "https://eatswada.com/address-new.html",
  },
  twitter: { card: "summary" },
};

export default function AddressNewPage() {
  return <AddressNewShell />;
}
