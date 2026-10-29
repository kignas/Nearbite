/* ================================================================
   EATSWADA — FOOD DELIVERY IN MAYNaguri
   (`food-delivery-in-maynaguri.html` → `/food-delivery-in-maynaguri`)
   ----------------------------------------------------------------
   CSS: the exact `<link>` order of the page L33–L44:
     1. eatswada-theme.css
     2. css/eatswada-ui-system.css?v=20260923-typography
     3. css/eatswada-secondary-pages.css?v=20260929-brand
     4. css/eatswada-back-button.css
     5. css/eatswada-site-footer.css?v=20260929-footer1
     6. css/eatswada-document-typography.css?v=20260929-core-pages
     7. inline <style> (extracted byte-for-byte to
        styles/legacy/food-delivery-in-maynaguri-inline.css, imported LAST —
        it sits after the shared sheets in the legacy head)
   The Font Awesome CDN sheet comes from layout.tsx.

   Head items verbatim from the page: title, description, robots `index, follow`,
   Open Graph (incl. og:locale, og:image + alt), twitter:card/title/description/
   image and two JSON-LD blocks. Canonical / og:url stay the clean URL the legacy
   page already used. The page's own `<meta name="theme-color" content="#fc8019">`
   overrides the shared layout's — see the comment below.
   ================================================================ */
import type { Metadata } from "next";
import "../../styles/legacy/eatswada-theme.css";
import "../../styles/legacy/css/eatswada-ui-system.css";
import "../../styles/legacy/eatswada-secondary-pages.css";
import "../../styles/legacy/css/eatswada-back-button.css";
import "../../styles/legacy/css/eatswada-site-footer.css";
import "../../styles/legacy/css/eatswada-document-typography.css";
import "../../styles/legacy/food-delivery-in-maynaguri-inline.css";
import FoodDeliveryShell from "../../components/FoodDeliveryShell";

/* Both JSON-LD blocks, verbatim from the page. */
const LD_GRAPH = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://eatswada.com/#website",
      url: "https://eatswada.com/",
      name: "Eatswada",
      description:
        "Local food-ordering and delivery platform focused on Maynaguri, West Bengal.",
      inLanguage: "en-IN",
      publisher: { "@id": "https://eatswada.com/#organization" },
    },
    {
      "@type": "Organization",
      "@id": "https://eatswada.com/#organization",
      name: "Eatswada",
      alternateName: "EatSwada",
      url: "https://eatswada.com/",
      logo: "https://eatswada.com/icon-512.png",
      description:
        "Eatswada is a local food-ordering and delivery platform focused on Maynaguri, West Bengal, connecting customers with restaurant partners.",
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
    },
    {
      "@type": "WebPage",
      "@id": "https://eatswada.com/food-delivery-in-maynaguri.html#webpage",
      url: "https://eatswada.com/food-delivery-in-maynaguri.html",
      name: "Food Delivery in Maynaguri | Order Food Online | Eatswada",
      description:
        "Information about food ordering and delivery through Eatswada in Maynaguri and nearby areas.",
      isPartOf: { "@id": "https://eatswada.com/#website" },
      about: { "@id": "https://eatswada.com/#organization" },
      breadcrumb: {
        "@id": "https://eatswada.com/food-delivery-in-maynaguri.html#breadcrumb",
      },
      inLanguage: "en-IN",
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://eatswada.com/food-delivery-in-maynaguri.html#breadcrumb",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: "https://eatswada.com/",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Food Delivery in Maynaguri",
          item: "https://eatswada.com/food-delivery-in-maynaguri.html",
        },
      ],
    },
  ],
};

const LD_FAQ = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Does Eatswada provide food delivery in Maynaguri?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Eatswada is focused on food ordering and delivery in Maynaguri and nearby areas. Availability depends on the delivery address, restaurant and current operating coverage.",
      },
    },
    {
      "@type": "Question",
      name: "Can I order food online in Maynaguri with Eatswada?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Customers can use the Eatswada website to choose a delivery location, browse available restaurants and menus, add items to the cart and complete checkout when service is available for the address.",
      },
    },
    {
      "@type": "Question",
      name: "Where does Eatswada deliver around Maynaguri?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Eatswada is focused on Maynaguri and nearby areas. Delivery availability can differ by restaurant and exact address, so the website checks serviceability before an order is placed.",
      },
    },
    {
      "@type": "Question",
      name: "How are Eatswada delivery charges shown?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Any applicable delivery charge is shown in the order bill before payment. Charges can vary by restaurant, delivery distance, order conditions or an available offer.",
      },
    },
  ],
};

/* Verbatim from the page. */
export const metadata: Metadata = {
  title: "Food Delivery in Maynaguri | Order Food Online | Eatswada",
  description:
    "Looking for food delivery in Maynaguri? Eatswada connects customers with local restaurant partners for online food ordering and delivery in Maynaguri and nearby areas.",
  robots: { index: true, follow: true },
  alternates: { canonical: "https://eatswada.com/food-delivery-in-maynaguri" },
  openGraph: {
    type: "website",
    siteName: "Eatswada",
    title: "Food Delivery in Maynaguri | Order Food Online | Eatswada",
    description:
      "Order food online with Eatswada, a local food-ordering and delivery platform focused on Maynaguri, West Bengal.",
    url: "https://eatswada.com/food-delivery-in-maynaguri",
    locale: "en_IN",
    images: [
      {
        url: "https://eatswada.com/icon-512.png",
        alt: "Eatswada — food delivery in Maynaguri",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Food Delivery in Maynaguri | Eatswada",
    description:
      "Order food online with Eatswada in Maynaguri and nearby areas. Check available restaurants, menus and delivery coverage for your address.",
    images: ["https://eatswada.com/icon-512.png"],
  },
};

export default function FoodDeliveryPage() {
  return (
    <>
      {/* The page's own theme-color (`#fc8019`), which in legacy came after and
          therefore overrode the shared layout's `#FFFFFF`. Rendered as a real
          <meta> so it wins by document order. */}
      <meta name="theme-color" content="#fc8019" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(LD_GRAPH) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(LD_FAQ) }}
      />
      <FoodDeliveryShell />
    </>
  );
}
