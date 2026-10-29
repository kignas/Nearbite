/* ================================================================
   EATSWADA — ABOUT  (`about.html` → `/about`)
   ----------------------------------------------------------------
   CSS: the exact `<link>` order of about.html L13–L60:
     1. inline <style>  (about.html's own block, extracted byte-for-byte
        to styles/legacy/about-inline.css and imported FIRST — the inline
        block sits before the shared sheets in legacy, so they win the
        cascade)
     2. css/eatswada-ui-system.css?v=20260923-typography
     3. eatswada-theme.css
     4. css/eatswada-secondary-pages.css?v=20260929-brand
     5. css/eatswada-site-footer.css?v=20260929-footer1
   The Manrope + Font Awesome CDN sheets come from layout.tsx.

   Head items verbatim from about.html: title, description, robots
   `index, follow`, Open Graph and the single Organization JSON-LD block.
   Canonical / og:url stay the clean `https://eatswada.com/about` (the legacy
   page already used the clean URL).

   about.html loads `navigation.js` (the shared shell) and `eatswada-theme.js`
   — both owned by the layout's `<ShellRuntime/>`, not re-installed here.
   ================================================================ */
import type { Metadata } from "next";
import "../../styles/legacy/about-inline.css";
import "../../styles/legacy/css/eatswada-ui-system.css";
import "../../styles/legacy/eatswada-theme.css";
import "../../styles/legacy/eatswada-secondary-pages.css";
import "../../styles/legacy/css/eatswada-site-footer.css";
import AboutShell from "../../components/AboutShell";

/* The Organization JSON-LD block, verbatim from about.html. */
const LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://eatswada.com/#organization",
  name: "Eatswada",
  alternateName: "EatSwada",
  url: "https://eatswada.com/",
  logo: "https://eatswada.com/icon-512.png",
  description:
    "Eatswada is a local food-ordering and delivery platform serving Maynaguri, West Bengal, connecting customers with local restaurant partners.",
  areaServed: {
    "@type": "City",
    name: "Maynaguri",
    containedInPlace: { "@type": "State", name: "West Bengal" },
  },
  address: {
    "@type": "PostalAddress",
    addressLocality: "Maynaguri",
    addressRegion: "West Bengal",
    addressCountry: "IN",
  },
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    email: "support@eatswada.com",
  },
};

/* Verbatim from about.html. */
export const metadata: Metadata = {
  title: "About Eatswada | Food Delivery in Maynaguri",
  description:
    "Learn about Eatswada, the local food-ordering and delivery platform serving Maynaguri, West Bengal. See how Eatswada works, delivery areas, payments and support.",
  robots: { index: true, follow: true },
  alternates: { canonical: "https://eatswada.com/about" },
  openGraph: {
    type: "website",
    siteName: "Eatswada",
    title: "About Eatswada | Food Delivery in Maynaguri",
    description:
      "Learn about Eatswada, the local food-ordering and delivery platform serving Maynaguri, West Bengal.",
    url: "https://eatswada.com/about",
  },
  twitter: { card: "summary" },
};

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(LD) }}
      />
      <AboutShell />
    </>
  );
}
