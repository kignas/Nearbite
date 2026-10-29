/* ================================================================
   EATSWADA — LEGAL / POLICIES  (`legal.html` → `/legal`)
   ----------------------------------------------------------------
   CSS: the exact `<link>` order of legal.html L8–L18:
     1. style.css
     2. css/eatswada-ui-system.css?v=20260923-typography
     3. eatswada-theme.css
     4. eatswada-header-theme.css
     5. css/eatswada-secondary-pages.css?v=20260929-brand
     6. css/eatswada-site-footer.css?v=20260929-footer1
     7. css/eatswada-document-typography.css?v=20260929-core-pages
   The Manrope + Font Awesome CDN sheets come from layout.tsx.

   Head items verbatim from legal.html: title, description, robots
   `noindex, nofollow`, Open Graph and the canonical. Canonical / og:url are
   rewritten from `…/legal.html` to the clean `…/legal`. No JSON-LD.

   legal.html loads `eatswada-theme.js`, `eatswada-header-theme.js`,
   `safe-html.js` and `navigation.js` (all the shared shell) plus one inline
   script that stamps the title/dates/entity — ported to lib/legal-page.ts.
   ================================================================ */
import type { Metadata } from "next";
import "../../styles/legacy/style.css";
import "../../styles/legacy/css/eatswada-ui-system.css";
import "../../styles/legacy/eatswada-theme.css";
import "../../styles/legacy/eatswada-header-theme.css";
import "../../styles/legacy/eatswada-secondary-pages.css";
import "../../styles/legacy/css/eatswada-site-footer.css";
import "../../styles/legacy/css/eatswada-document-typography.css";
import LegalShell from "../../components/LegalShell";

/* Verbatim from legal.html. */
export const metadata: Metadata = {
  title: "Terms & Conditions | EatSwada",
  description:
    "Read the terms and conditions for using EatSwada food ordering and delivery services.",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://eatswada.com/legal" },
  openGraph: {
    type: "website",
    siteName: "EatSwada",
    title: "Terms & Conditions | EatSwada",
    description:
      "Read the terms and conditions for using EatSwada food ordering and delivery services.",
    url: "https://eatswada.com/legal.html",
  },
  twitter: { card: "summary" },
};

export default function LegalPage() {
  return <LegalShell />;
}
